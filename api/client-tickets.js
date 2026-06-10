// Public client ticket portal — a client proves ownership with the ticket key
// (PA-xx, from their confirmation email) plus the email they used in chat.
// Internal notes are never exposed here.
import crypto from 'node:crypto';
import { queryDb } from './_db.js';
import { notify, logAudit } from './_ticketing.js';
import { cached, cacheKeys, getVersion, bumpVersion, verScopes } from './_cache.js';

const parseTicketId = (value) => {
  const n = parseInt(String(value).replace(/^pa-/i, ''), 10);
  return Number.isFinite(n) ? n : null;
};

const findTicket = async (key, email) => {
  const id = parseTicketId(key);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!id || !cleanEmail) return null;
  const rows = await queryDb(`SELECT * FROM support_tickets WHERE id=$1 LIMIT 1`, [id]);
  const ticket = rows[0];
  if (!ticket || !ticket.customer_email || ticket.customer_email !== cleanEmail) return null;
  return ticket;
};

const publicTicket = (t) => ({
  key: `PA-${t.id}`,
  subject: t.subject,
  description: t.description,
  category: t.category,
  priority: t.priority,
  status: t.status,
  created_at: t.created_at,
  updated_at: t.updated_at,
  resolved_at: t.resolved_at,
  customer_name: t.customer_name
});

export default async function handler(req, res) {
  // ── GET ?key=PA-1&email=... — ticket + public timeline ─────────────────────
  if (req.method === 'GET') {
    const { key, email } = req.query;
    if (!key || !email) return res.status(400).json({ error: 'key and email required' });
    try {
      // The client page polls every 6s; same version-stamp scheme as staff views.
      // The cache key includes the requester's email so a wrong-email probe can
      // never be served another caller's cached payload.
      const id = parseTicketId(key);
      const ver = await getVersion(verScopes.ticket(id));
      const emailTag = crypto.createHash('md5').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 12);
      const hit = await cached(`${cacheKeys.clientTicket(id, ver)}:${emailTag}`, 20, async () => {
      const ticket = await findTicket(key, email);
      if (!ticket) return { missing: true };
      const [comments, attachments] = await Promise.all([
        queryDb(
          `SELECT id, author_role, author_name, message, created_at FROM ticket_comments
           WHERE ticket_id=$1 AND is_internal=false ORDER BY created_at ASC LIMIT 300`,
          [ticket.id]
        ).catch(() => []),
        queryDb(
          `SELECT id, file_name, content_type, size_bytes, uploaded_by_name, created_at
           FROM ticket_attachments WHERE ticket_id=$1 ORDER BY created_at ASC`,
          [ticket.id]
        ).catch(() => [])
      ]);
      // Staff identities stay private — clients see "Support team".
      const publicComments = comments.map((c) => ({
        ...c,
        author_name: c.author_role === 'client' ? (c.author_name || 'You')
          : c.author_role === 'system' ? 'Update'
          : 'Support team'
      }));
      return { ticket: publicTicket(ticket), comments: publicComments, attachments };
      });
      if (hit.missing) return res.status(404).json({ error: 'No ticket found for that ID and email' });
      return res.status(200).json(hit);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — reply or close: {key, email, message?} / {key, email, action:'close'} ──
  if (req.method === 'POST') {
    const { key, email, message, action } = req.body || {};
    if (!key || !email) return res.status(400).json({ error: 'key and email required' });
    try {
      const ticket = await findTicket(key, email);
      if (!ticket) return res.status(404).json({ error: 'No ticket found for that ID and email' });
      const tKey = `PA-${ticket.id}`;
      const clientName = ticket.customer_name || 'Client';

      if (action === 'close') {
        if (['closed'].includes(ticket.status)) return res.status(200).json({ ok: true, ticket: publicTicket(ticket) });
        const rows = await queryDb(
          `UPDATE support_tickets SET status='closed', closed_by_client=true, resolved_at=COALESCE(resolved_at, NOW()), updated_at=NOW()
           WHERE id=$1 RETURNING *`,
          [ticket.id]
        );
        await queryDb(
          `INSERT INTO ticket_comments (ticket_id, author_role, author_name, message) VALUES ($1,'system','System',$2)`,
          [ticket.id, `${clientName} confirmed the issue is resolved and closed the ticket.`]
        ).catch(() => {});
        await notify(ticket.assignee_email, 'status_change', ticket.id, `${clientName} closed ${tKey} (confirmed resolved)`);
        await logAudit('client', ticket.customer_email, 'ticket_closed_by_client', tKey);
        await bumpVersion(verScopes.tickets, verScopes.ticket(ticket.id));
        return res.status(200).json({ ok: true, ticket: publicTicket(rows[0]) });
      }

      if (!message?.trim()) return res.status(400).json({ error: 'message required' });
      if (ticket.status === 'closed') return res.status(409).json({ error: 'This ticket is closed. Start a new chat for further help.' });
      const rows = await queryDb(
        `INSERT INTO ticket_comments (ticket_id, author_role, author_name, author_email, message)
         VALUES ($1,'client',$2,$3,$4) RETURNING id, author_role, author_name, message, created_at`,
        [ticket.id, clientName, ticket.customer_email, String(message).slice(0, 4000)]
      );
      await queryDb(`UPDATE support_tickets SET updated_at=NOW() WHERE id=$1`, [ticket.id]).catch(() => {});
      await notify(ticket.assignee_email, 'comment', ticket.id, `${clientName} replied on ${tKey}: ${String(message).slice(0, 80)}`);
      await bumpVersion(verScopes.tickets, verScopes.ticket(ticket.id));
      return res.status(200).json({ comment: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
