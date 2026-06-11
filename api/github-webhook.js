// GitHub webhook → ticket auto-linking + workflow progression.
// Configure a repo/org webhook to POST here (JSON) with secret GITHUB_WEBHOOK_SECRET.
// Any branch/commit/PR/release mentioning PA-<n> is linked to that ticket:
//   branch/PR opened → ticket in_progress · PR merged → resolved (QA-ready)
import crypto from 'node:crypto';
import { queryDb } from './_db.js';
import { notify, logAudit } from './_ticketing.js';
import { bumpVersion, verScopes } from './_cache.js';

const TICKET_RE = /PA-?(\d+)/gi;
const ticketIdsIn = (...texts) => {
  const ids = new Set();
  for (const t of texts) for (const m of String(t || '').matchAll(TICKET_RE)) ids.add(Number(m[1]));
  return [...ids];
};

const link = async (ticketId, kind, ref, { title, url, author, state } = {}) => {
  const [t] = await queryDb(`SELECT id, assignee_email, status FROM support_tickets WHERE id=$1`, [ticketId]).catch(() => []);
  if (!t) return;
  await queryDb(
    `INSERT INTO ticket_github_links (ticket_id, kind, ref, title, url, author, state) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [ticketId, kind, ref.slice(0, 300), title || null, url || null, author || null, state || null]
  ).catch(() => {});
  await queryDb(
    `INSERT INTO ticket_comments (ticket_id, author_role, author_name, message) VALUES ($1,'system','GitHub',$2)`,
    [ticketId, `GitHub ${kind}${state ? ` ${state}` : ''}: ${title || ref}${url ? ` — ${url}` : ''}`]
  ).catch(() => {});
  await notify(t.assignee_email, 'comment', ticketId, `GitHub ${kind} linked to PA-${ticketId}: ${title || ref}`);
  // Workflow progression on the existing status set (no breaking changes):
  let next = null;
  if (['branch', 'commit'].includes(kind) && t.status === 'open') next = 'in_progress';
  if (kind === 'pr' && state === 'opened' && t.status === 'open') next = 'in_progress';
  if (kind === 'pr' && state === 'merged' && ['open', 'in_progress'].includes(t.status)) next = 'resolved';
  if (next) {
    await queryDb(`UPDATE support_tickets SET status=$1, resolved_at=${next === 'resolved' ? 'NOW()' : 'resolved_at'}, updated_at=NOW() WHERE id=$2`, [next, ticketId]).catch(() => {});
    await queryDb(`INSERT INTO ticket_comments (ticket_id, author_role, author_name, message) VALUES ($1,'system','GitHub',$2)`,
      [ticketId, `Workflow: moved to ${next.replace('_', ' ')} (${kind} ${state || ''})`]).catch(() => {});
  }
  await bumpVersion(verScopes.tickets, verScopes.ticket(ticketId));
  await logAudit('system', 'github', `github_${kind}_linked`, `PA-${ticketId}`, { ref, state });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers['x-hub-signature-256'] || '';
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex')}`;
    if (!crypto.timingSafeEqual(Buffer.from(sig.padEnd(expected.length)), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Bad signature' });
    }
  }
  const event = req.headers['x-github-event'];
  const p = req.body || {};
  try {
    if (event === 'push') {
      const branch = (p.ref || '').replace('refs/heads/', '');
      for (const id of ticketIdsIn(branch)) await link(id, 'branch', branch, { url: p.repository?.html_url, author: p.pusher?.name });
      for (const c of p.commits || []) {
        for (const id of ticketIdsIn(c.message)) await link(id, 'commit', c.id?.slice(0, 10) || '', { title: c.message?.split('\n')[0], url: c.url, author: c.author?.name });
      }
    } else if (event === 'pull_request') {
      const pr = p.pull_request || {};
      const state = p.action === 'closed' ? (pr.merged ? 'merged' : 'closed') : p.action;
      for (const id of ticketIdsIn(pr.title, pr.head?.ref, pr.body)) {
        await link(id, 'pr', `#${pr.number}`, { title: pr.title, url: pr.html_url, author: pr.user?.login, state });
      }
    } else if (event === 'release') {
      const rel = p.release || {};
      for (const id of ticketIdsIn(rel.name, rel.body)) {
        await link(id, 'release', rel.tag_name || '', { title: rel.name, url: rel.html_url, state: p.action });
      }
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
