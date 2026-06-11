// Jira-like engineering workflow on top of tickets.
// Pipeline: support → pm_review → em_review → lead_triage → dev → qa → done
// QA can reject back to dev with a required comment. Every transition keeps
// assignee_email = current holder, so each person's "bucket" is simply their
// assigned tickets in the existing /team portal. Nothing existing changes.
import { queryDb } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession, getMemberSession } from './_security.js';
import { notify, logAudit } from './_ticketing.js';
import { bumpVersion, verScopes } from './_cache.js';

export const TEAM_ROLES = ['member', 'software_dev', 'team_lead', 'engineering_manager', 'product_manager', 'qa'];
const STAGES = ['support', 'pm_review', 'em_review', 'lead_triage', 'dev', 'qa', 'done'];

const getActor = async (req) => {
  if (verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME))) return { role: 'admin', email: 'admin', name: 'Admin', teamRole: 'admin' };
  const e = getExecSession(req);
  if (e) return { role: 'executive', email: e.email, name: e.name, teamRole: 'executive' };
  const m = getMemberSession(req);
  if (m) {
    const [row] = await queryDb(`SELECT team_role FROM team_members WHERE id=$1`, [m.id]).catch(() => [{}]);
    return { role: 'member', email: m.email, name: m.name, teamRole: row?.team_role || 'member' };
  }
  return null;
};

// Least-loaded routing: among active holders of the role, pick whoever has
// the fewest open tickets currently assigned (fair round-robin under load).
const firstWithRole = async (role) => {
  const rows = await queryDb(
    `SELECT m.email, m.name FROM team_members m
     LEFT JOIN support_tickets t ON t.assignee_email = m.email AND t.status IN ('open','in_progress')
     WHERE m.status='active' AND m.team_role=$1
     GROUP BY m.id, m.email, m.name ORDER BY count(t.id) ASC, m.id ASC LIMIT 1`, [role]);
  return rows[0] || null;
};

const move = async (ticket, actor, { stage, assignee, note, status }) => {
  await queryDb(
    `UPDATE support_tickets SET stage=$1, assignee_email=COALESCE($2, assignee_email),
       assignee_name=COALESCE($3, assignee_name), status=COALESCE($4, status),
       resolved_at=${status === 'resolved' ? 'NOW()' : 'resolved_at'}, updated_at=NOW() WHERE id=$5`,
    [stage, assignee?.email || null, assignee?.name || null, status || null, ticket.id]
  );
  await queryDb(
    `INSERT INTO ticket_comments (ticket_id, author_role, author_name, message) VALUES ($1,'system','Workflow',$2)`,
    [ticket.id, note]
  ).catch(() => {});
  if (assignee?.email) await notify(assignee.email, 'assignment', ticket.id, `PA-${ticket.id} moved to your bucket (${stage.replace('_', ' ')}): ${ticket.subject}`);
  await logAudit(actor.teamRole, actor.email, 'workflow_' + stage, `PA-${ticket.id}`, { by: actor.name });
  await bumpVersion(verScopes.tickets, verScopes.ticket(ticket.id));
};

// action → { allowed roles (admin/executive always allowed) }
const CAN = {
  escalate: ['executive', 'admin', 'product_manager'],
  pm_approve: ['product_manager'], pm_reject: ['product_manager'],
  em_approve: ['engineering_manager'], em_reject: ['engineering_manager'],
  lead_assign: ['team_lead', 'engineering_manager'],
  dev_complete: ['software_dev'],
  qa_approve: ['qa'], qa_reject: ['qa']
};

export default async function handler(req, res) {
  const actor = await getActor(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // ── GET ?pipeline=1 — all tickets grouped by stage (staff + leads/managers) ──
    if (req.method === 'GET') {
      const mine = req.query.bucket === '1';
      const rows = await queryDb(
        `SELECT id, subject, status, stage, priority, assignee_email, assignee_name, dev_email, created_by_name, updated_at
         FROM support_tickets WHERE stage != 'support' ${mine ? 'AND assignee_email=$1' : ''}
         ORDER BY updated_at DESC LIMIT 300`, mine ? [actor.email] : []
      );
      const pipeline = Object.fromEntries(STAGES.map((s) => [s, []]));
      for (const t of rows) (pipeline[t.stage] || (pipeline[t.stage] = [])).push({ ...t, key: `PA-${t.id}` });
      return res.status(200).json({ pipeline, stages: STAGES, myRole: actor.teamRole });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { ticketId, action, comment = '', assigneeEmail } = req.body || {};
    const id = parseInt(String(ticketId).replace(/^pa-/i, ''), 10);
    const [ticket] = await queryDb(`SELECT * FROM support_tickets WHERE id=$1`, [id]);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!CAN[action]) return res.status(400).json({ error: 'Unknown action' });
    if (!['admin', 'executive'].includes(actor.teamRole) && !CAN[action].includes(actor.teamRole)) {
      return res.status(403).json({ error: `Your role (${actor.teamRole.replace('_', ' ')}) cannot perform this step` });
    }
    if (comment) {
      await queryDb(`INSERT INTO ticket_comments (ticket_id, author_role, author_name, author_email, message, is_internal)
        VALUES ($1,$2,$3,$4,$5,true)`, [id, actor.role, actor.name, actor.email, comment]).catch(() => {});
    }

    // Routing helpers — auto-pick the first active holder of the next role,
    // falling down the chain when a tier doesn't exist yet.
    const pm = await firstWithRole('product_manager');
    const em = await firstWithRole('engineering_manager');
    const lead = await firstWithRole('team_lead');
    const qa = await firstWithRole('qa');

    if (action === 'escalate') {
      const target = pm || em || lead;
      if (!target) return res.status(400).json({ error: 'No product manager / engineering manager / team lead exists yet. Add one in admin → team.' });
      const stage = pm ? 'pm_review' : em ? 'em_review' : 'lead_triage';
      await move(ticket, actor, { stage, assignee: target, note: `${actor.name} escalated to engineering — ${target.name} (${stage.replace('_', ' ')}).` });
    } else if (action === 'pm_approve') {
      const target = em || lead;
      if (!target) return res.status(400).json({ error: 'No engineering manager or team lead exists yet.' });
      await move(ticket, actor, { stage: em ? 'em_review' : 'lead_triage', assignee: target, note: `${actor.name} (PM) approved — forwarded to ${target.name}.` });
    } else if (action === 'em_approve') {
      if (!lead) return res.status(400).json({ error: 'No team lead exists yet.' });
      await move(ticket, actor, { stage: 'lead_triage', assignee: lead, note: `${actor.name} (EM) approved — sent to ${lead.name} for triage.` });
    } else if (action === 'pm_reject' || action === 'em_reject') {
      if (!comment) return res.status(400).json({ error: 'A comment explaining the rejection is required' });
      const creator = ticket.created_by_id ? (await queryDb(`SELECT email, name FROM support_executives WHERE id=$1`, [ticket.created_by_id]))[0] : null;
      await move(ticket, actor, { stage: 'support', assignee: creator, note: `${actor.name} rejected and returned to support: ${comment}` });
    } else if (action === 'lead_assign') {
      const email = String(assigneeEmail || '').trim().toLowerCase();
      const [dev] = await queryDb(`SELECT email, name FROM team_members WHERE email=$1 AND status='active'`, [email]);
      if (!dev) return res.status(400).json({ error: 'Pick an active team member to assign' });
      await queryDb(`UPDATE support_tickets SET dev_email=$1 WHERE id=$2`, [dev.email, id]);
      await move(ticket, actor, { stage: 'dev', assignee: dev, status: 'in_progress', note: `${actor.name} assigned development to ${dev.name}.` });
    } else if (action === 'dev_complete') {
      if (!qa) return res.status(400).json({ error: 'No QA member exists yet. Add one in admin → team.' });
      await queryDb(`UPDATE support_tickets SET dev_email=COALESCE(dev_email,$1) WHERE id=$2`, [actor.email, id]);
      await move(ticket, actor, { stage: 'qa', assignee: qa, note: `${actor.name} completed development — handed to QA (${qa.name}).` });
    } else if (action === 'qa_approve') {
      await move(ticket, actor, { stage: 'done', status: 'resolved', note: `${actor.name} (QA) approved — ticket resolved.` });
    } else if (action === 'qa_reject') {
      if (!comment) return res.status(400).json({ error: 'A comment describing what to improve is required' });
      const [dev] = ticket.dev_email ? await queryDb(`SELECT email, name FROM team_members WHERE email=$1`, [ticket.dev_email]) : [null];
      await move(ticket, actor, { stage: 'dev', assignee: dev || null, status: 'in_progress', note: `${actor.name} (QA) sent back for improvement: ${comment}` });
    }
    const [updated] = await queryDb(`SELECT id, stage, status, assignee_email FROM support_tickets WHERE id=$1`, [id]);
    return res.status(200).json({ ticket: { ...updated, key: `PA-${id}` } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
