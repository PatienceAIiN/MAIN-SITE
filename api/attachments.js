// Ticket file attachments — any format, up to 10 MB per file.
//
// Storage: Cloudflare R2 (primary). Uploads stream through the server (raw
// body, no bucket CORS needed); downloads 302-redirect to a 15-minute
// presigned R2 URL so file bytes never touch the app server or Postgres.
// If R2 is not configured the system degrades to base64-in-Postgres for
// small files (≤ 3 MB) so the feature keeps working in dev environments.
//
// Access control: staff authenticate by session; clients authenticate by
// proving the ticket's customer email (same model as /api/client-tickets).
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession, getMemberSession } from './_security.js';
import { notify, logAudit } from './_ticketing.js';
import { bumpVersion, verScopes } from './_cache.js';
import { isR2Configured, r2PutObject, r2SignedGetUrl, buildAttachmentKey } from './_r2.js';

const MAX_BYTES = 20 * 1024 * 1024;      // 20 MB — R2 path
const MAX_DB_BYTES = 3 * 1024 * 1024;    // 3 MB — Postgres fallback only

const parseTicketId = (value) => {
  const n = parseInt(String(value).replace(/^pa-/i, ''), 10);
  return Number.isFinite(n) ? n : null;
};

const getActor = (req) => {
  const exec = getExecSession(req);
  if (exec) return { role: 'executive', email: exec.email, name: exec.name };
  const member = getMemberSession(req);
  if (member) return { role: 'member', email: member.email, name: member.name };
  if (verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME))) return { role: 'admin', email: 'admin', name: 'Admin' };
  return null;
};

// Resolve access: staff sessions, or a client proving ticket key + email match.
const resolveAccess = async (req, ticketId, clientEmail) => {
  const actor = getActor(req);
  const rows = await queryDb(`SELECT * FROM support_tickets WHERE id=$1 LIMIT 1`, [ticketId]);
  const ticket = rows[0];
  if (!ticket) return { error: 'Ticket not found', code: 404 };
  if (actor) {
    if (actor.role === 'member' && ticket.assignee_email !== actor.email) return { error: 'Not your ticket', code: 403 };
    return { actor, ticket };
  }
  const email = String(clientEmail || '').trim().toLowerCase();
  if (email && ticket.customer_email && ticket.customer_email === email) {
    return { actor: { role: 'client', email, name: ticket.customer_name || 'Client' }, ticket };
  }
  return { error: 'Not authenticated', code: 401 };
};

const recordAttachment = async ({ ticketId, fileName, contentType, sizeBytes, storage, r2Key, dataBase64, actor, ticket }) => {
  const rows = await queryDb(
    `INSERT INTO ticket_attachments (ticket_id, file_name, content_type, size_bytes, storage, r2_key, data_base64, uploaded_by_name, uploaded_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, file_name, content_type, size_bytes, storage, uploaded_by_name, uploaded_by_role, created_at`,
    [ticketId, String(fileName).slice(0, 200), contentType, sizeBytes, storage, r2Key, dataBase64, actor.name, actor.role]
  );
  await queryDb(
    `INSERT INTO ticket_comments (ticket_id, author_role, author_name, message) VALUES ($1,'system','System',$2)`,
    [ticketId, `${actor.name} uploaded a file: ${fileName}`]
  ).catch(() => {});
  await queryDb(`UPDATE support_tickets SET updated_at=NOW() WHERE id=$1`, [ticketId]).catch(() => {});
  await bumpVersion(verScopes.tickets, verScopes.ticket(ticketId));
  if (actor.email !== ticket.assignee_email) {
    await notify(ticket.assignee_email, 'comment', ticketId, `${actor.name} uploaded "${fileName}" on PA-${ticketId}`);
  }
  await logAudit(actor.role, actor.email, 'file_uploaded', `PA-${ticketId}`, { fileName, sizeBytes, storage });
  return rows[0];
};

export default async function handler(req, res) {
  // ── POST /api/attachments/upload?ticketId=&fileName=&clientEmail= ─────────
  // Raw request body = the file bytes (Content-Type header = the file type).
  if (req.method === 'POST' && req.url?.includes('/upload')) {
    const ticketId = parseTicketId(req.query.ticketId);
    const fileName = String(req.query.fileName || '').trim();
    if (!ticketId || !fileName) return res.status(400).json({ error: 'ticketId and fileName required' });
    const body = req.body;
    if (!Buffer.isBuffer(body) || !body.length) return res.status(400).json({ error: 'Empty upload' });
    if (body.length > MAX_BYTES) return res.status(413).json({ error: 'File too large (max 20 MB)' });
    const contentType = req.headers['content-type'] || 'application/octet-stream';

    try {
      const access = await resolveAccess(req, ticketId, req.query.clientEmail);
      if (access.error) return res.status(access.code).json({ error: access.error });
      const { actor, ticket } = access;

      let storage = 'db';
      let r2Key = null;
      let dataBase64 = null;
      if (isR2Configured()) {
        storage = 'r2';
        r2Key = buildAttachmentKey(ticketId, fileName);
        await r2PutObject(r2Key, body, contentType);
      } else {
        if (body.length > MAX_DB_BYTES) {
          return res.status(413).json({ error: 'File too large for fallback storage (max 3 MB). Configure Cloudflare R2 for uploads up to 10 MB.' });
        }
        dataBase64 = body.toString('base64');
      }

      const attachment = await recordAttachment({
        ticketId, fileName, contentType, sizeBytes: body.length, storage, r2Key, dataBase64, actor, ticket
      });
      return res.status(200).json({ attachment });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET ?id=X — download one attachment ───────────────────────────────────
  if (req.method === 'GET' && req.query.id) {
    try {
      const rows = await queryDb(`SELECT * FROM ticket_attachments WHERE id=$1 LIMIT 1`, [req.query.id]);
      const file = rows[0];
      if (!file) return res.status(404).json({ error: 'File not found' });
      const access = await resolveAccess(req, file.ticket_id, req.query.email);
      if (access.error) return res.status(access.code).json({ error: access.error });

      if (file.storage === 'r2' && file.r2_key) {
        // Redirect to a presigned URL — bytes stream from R2, not from us.
        const url = await r2SignedGetUrl(file.r2_key, file.file_name);
        res.setHeader('Cache-Control', 'private, no-store');
        return res.redirect(302, url);
      }

      const buffer = Buffer.from(file.data_base64 || '', 'base64');
      res.setHeader('Content-Type', file.content_type);
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name.replace(/"/g, '')}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.status(200).send(buffer);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET ?ticketId=X — list attachments (metadata only) ────────────────────
  if (req.method === 'GET' && req.query.ticketId) {
    try {
      const ticketId = parseTicketId(req.query.ticketId);
      const access = await resolveAccess(req, ticketId, req.query.email);
      if (access.error) return res.status(access.code).json({ error: access.error });
      const rows = await queryDb(
        `SELECT id, comment_id, file_name, content_type, size_bytes, storage, uploaded_by_name, uploaded_by_role, created_at
         FROM ticket_attachments WHERE ticket_id=$1 ORDER BY created_at ASC`,
        [ticketId]
      );
      return res.status(200).json({ attachments: rows });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ attachments: [] });
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
