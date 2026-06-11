// PEOS — PatienceAI Engineering Operating System API.
// Consolidated, generic CRUD over the engineering entities plus universal
// search, executive dashboard and AI summaries. Tickets stay the central
// entity (/api/tickets untouched); everything here links back to them.
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession, getMemberSession } from './_security.js';
import { logAudit } from './_ticketing.js';

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));
const getActor = (req) => {
  if (isAdmin(req)) return { role: 'admin', email: 'admin', name: 'Admin' };
  const e = getExecSession(req); if (e) return { role: 'executive', ...e };
  const m = getMemberSession(req); if (m) return { role: 'member', ...m };
  return null;
};

// resource → { table, columns writable, who can write }
const RESOURCES = {
  epics: { table: 'epics', cols: ['title', 'description', 'status', 'owner_email', 'milestone'], write: ['admin', 'executive'] },
  sprints: { table: 'sprints', cols: ['name', 'goal', 'status', 'starts_on', 'ends_on', 'capacity_points'], write: ['admin', 'executive'] },
  incidents: { table: 'incidents', cols: ['title', 'severity', 'status', 'service', 'owner_email', 'summary', 'postmortem', 'ticket_id'], write: ['admin', 'executive', 'member'] },
  services: { table: 'services_catalog', cols: ['name', 'description', 'owner_email', 'backup_owner_email', 'team', 'repository', 'runbook', 'sla', 'dependencies', 'api_docs'], write: ['admin'] },
  okrs: { table: 'okrs', cols: ['level', 'objective', 'key_result', 'progress', 'owner_email', 'parent_id', 'quarter'], write: ['admin', 'executive'] },
  announcements: { table: 'announcements', cols: ['kind', 'title', 'body', 'author'], write: ['admin'] }
};

export default async function handler(req, res) {
  const actor = getActor(req);
  if (!actor) return res.status(401).json({ error: 'Not authenticated' });
  const r = req.query.resource;

  try {
    // ── Universal search ────────────────────────────────────────────────────
    if (req.method === 'GET' && req.query.search) {
      const q = `%${String(req.query.search).toLowerCase().slice(0, 80)}%`;
      const safe = (p) => p.catch(() => []);
      const [tickets, incidents, services, epics, kb, members, gh] = await Promise.all([
        safe(queryDb(`SELECT id, subject AS title, status, 'ticket' AS kind FROM support_tickets WHERE lower(subject) LIKE $1 OR lower(coalesce(customer_email,'')) LIKE $1 ORDER BY created_at DESC LIMIT 8`, [q])),
        safe(queryDb(`SELECT id, title, status, 'incident' AS kind FROM incidents WHERE lower(title) LIKE $1 LIMIT 5`, [q])),
        safe(queryDb(`SELECT id, name AS title, team AS status, 'service' AS kind FROM services_catalog WHERE lower(name) LIKE $1 OR lower(coalesce(description,'')) LIKE $1 LIMIT 5`, [q])),
        safe(queryDb(`SELECT id, title, status, 'epic' AS kind FROM epics WHERE lower(title) LIKE $1 LIMIT 5`, [q])),
        safe(queryDb(`SELECT id, title, kind AS status, 'doc' AS kind FROM kb_articles WHERE lower(title) LIKE $1 OR lower(body) LIKE $1 LIMIT 5`, [q])),
        safe(queryDb(`SELECT id, name AS title, status, 'person' AS kind FROM team_members WHERE lower(name) LIKE $1 OR lower(email) LIKE $1 LIMIT 5`, [q])),
        safe(queryDb(`SELECT ticket_id AS id, coalesce(title, ref) AS title, state AS status, 'github' AS kind FROM ticket_github_links WHERE lower(ref) LIKE $1 OR lower(coalesce(title,'')) LIKE $1 LIMIT 5`, [q]))
      ]);
      return res.status(200).json({ results: [...tickets, ...incidents, ...services, ...epics, ...kb, ...members, ...gh] });
    }

    // ── Executive dashboard ─────────────────────────────────────────────────
    if (req.method === 'GET' && req.query.dashboard === '1') {
      const one = async (sql) => (await queryDb(sql).catch(() => [{}]))[0] || {};
      const t = await one(`SELECT count(*) FILTER (WHERE status IN ('open','in_progress'))::int AS open,
        count(*) FILTER (WHERE status IN ('open','in_progress') AND due_at < NOW())::int AS overdue,
        count(*) FILTER (WHERE sla_breached)::int AS breaches,
        count(*) FILTER (WHERE resolved_at > NOW() - interval '7 days')::int AS closed_week FROM support_tickets`);
      const i = await one(`SELECT count(*) FILTER (WHERE status != 'closed')::int AS open,
        count(*) FILTER (WHERE severity IN ('SEV-1','SEV-2') AND status != 'closed')::int AS critical FROM incidents`);
      const s = await one(`SELECT count(*)::int AS active, coalesce(sum(capacity_points),0)::int AS capacity FROM sprints WHERE status = 'active'`);
      const v = await one(`SELECT coalesce(sum(t.story_points),0)::int AS velocity FROM support_tickets t
        JOIN sprints sp ON t.sprint_id = sp.id WHERE t.status IN ('resolved','closed') AND sp.status = 'active'`);
      // Simple health score: penalize overdue, breaches, critical incidents.
      const health = Math.max(0, 100 - (t.overdue || 0) * 5 - (t.breaches || 0) * 5 - (i.critical || 0) * 15);
      return res.status(200).json({ tickets: t, incidents: i, sprints: s, velocity: v.velocity || 0, health });
    }

    // ── Sprint board: tickets grouped for one sprint ────────────────────────
    if (req.method === 'GET' && req.query.sprintBoard) {
      const rows = await queryDb(`SELECT id, subject, status, priority, story_points, assignee_name FROM support_tickets WHERE sprint_id=$1 ORDER BY status, priority`, [req.query.sprintBoard]);
      return res.status(200).json({ tickets: rows.map((x) => ({ ...x, key: `PA-${x.id}` })) });
    }

    // ── GitHub links for a ticket ───────────────────────────────────────────
    if (req.method === 'GET' && req.query.githubFor) {
      const rows = await queryDb(`SELECT * FROM ticket_github_links WHERE ticket_id=$1 ORDER BY created_at DESC`, [req.query.githubFor]);
      return res.status(200).json({ links: rows });
    }

    // ── AI summary (Groq via existing key; provider-abstracted) ─────────────
    if (req.method === 'GET' && req.query.summarize) {
      const id = parseInt(String(req.query.summarize).replace(/^pa-/i, ''), 10);
      const [tk] = await queryDb(`SELECT * FROM support_tickets WHERE id=$1`, [id]);
      if (!tk) return res.status(404).json({ error: 'Ticket not found' });
      const comments = await queryDb(`SELECT author_role, author_name, message FROM ticket_comments WHERE ticket_id=$1 ORDER BY created_at ASC LIMIT 100`, [id]);
      const { aiComplete } = await import('./_ai.js');
      const text = await aiComplete(
        `Summarize this support ticket for an engineering lead in <=5 bullet points: current state, what's blocking, next action.\n\nTicket PA-${id}: ${tk.subject}\nStatus: ${tk.status} | Priority: ${tk.priority} | Assignee: ${tk.assignee_email}\nDescription: ${tk.description || '-'}\n\nTimeline:\n${comments.map((c) => `${c.author_name || c.author_role}: ${c.message}`).join('\n').slice(0, 6000)}`
      );
      return res.status(200).json({ summary: text });
    }

    // ── Assign ticket to sprint/epic/points (PATCH tickets via PEOS) ────────
    if (req.method === 'PATCH' && req.query.ticket) {
      if (actor.role === 'member') return res.status(403).json({ error: 'Forbidden' });
      const id = parseInt(String(req.query.ticket).replace(/^pa-/i, ''), 10);
      const { sprintId, epicId, storyPoints, ticketType } = req.body || {};
      const rows = await queryDb(
        `UPDATE support_tickets SET sprint_id=COALESCE($1, sprint_id), epic_id=COALESCE($2, epic_id),
         story_points=COALESCE($3, story_points), ticket_type=COALESCE($4, ticket_type), updated_at=NOW()
         WHERE id=$5 RETURNING id, sprint_id, epic_id, story_points, ticket_type`,
        [sprintId ?? null, epicId ?? null, storyPoints ?? null, ticketType ?? null, id]
      );
      await logAudit(actor.role, actor.email, 'ticket_planned', `PA-${id}`, { sprintId, epicId, storyPoints });
      return res.status(200).json({ ticket: rows[0] || null });
    }

    // ── Generic resource CRUD ───────────────────────────────────────────────
    const def = RESOURCES[r];
    if (!def) return res.status(400).json({ error: 'Unknown resource' });

    if (req.method === 'GET') {
      const rows = await queryDb(`SELECT * FROM ${def.table} ORDER BY created_at DESC LIMIT 200`);
      return res.status(200).json({ items: rows });
    }
    if (!def.write.includes(actor.role)) return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'POST') {
      // Only insert provided fields so column defaults (status etc.) apply.
      const cols = def.cols.filter((c) => req.body?.[c] !== undefined && req.body?.[c] !== null && req.body?.[c] !== '');
      if (!cols.length) return res.status(400).json({ error: 'No fields provided' });
      const vals = cols.map((c) => req.body[c]);
      const rows = await queryDb(
        `INSERT INTO ${def.table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, vals
      );
      await logAudit(actor.role, actor.email, `${r}_created`, rows[0]?.title || rows[0]?.name || String(rows[0]?.id));
      return res.status(200).json({ item: rows[0] });
    }
    if (req.method === 'PATCH') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const sets = []; const vals = [];
      for (const c of def.cols) if (req.body[c] !== undefined) { vals.push(req.body[c]); sets.push(`${c}=$${vals.length}`); }
      if (r === 'incidents' && ['resolved', 'closed'].includes(req.body.status)) sets.push('resolved_at=COALESCE(resolved_at, NOW())');
      if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
      vals.push(id);
      const rows = await queryDb(`UPDATE ${def.table} SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      return res.status(200).json({ item: rows[0] });
    }
    if (req.method === 'DELETE') {
      if (actor.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      await queryDb(`DELETE FROM ${def.table} WHERE id=$1`, [req.body?.id]);
      await logAudit('admin', 'admin', `${r}_deleted`, String(req.body?.id));
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (isMissingTableError(err.message)) return res.status(200).json({ items: [], results: [] });
    return res.status(500).json({ error: err.message });
  }
}
