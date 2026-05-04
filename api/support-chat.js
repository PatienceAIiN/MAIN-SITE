import nodemailer from 'nodemailer';
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession } from './_security.js';

const CHATS_TABLE = 'support_chats';
const SESSIONS_TABLE = 'support_sessions';
const EXEC_TABLE = 'support_executives';

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));
const getExec = (req) => getExecSession(req);

const createTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 12000,
  greetingTimeout: 12000,
  socketTimeout: 12000,
  tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
});

const notifyExecutives = async (conversationId, customerEmail, customerName) => {
  try {
    const execs = await queryDb(
      `SELECT email, name FROM ${EXEC_TABLE} WHERE status='active'`
    );
    if (!execs.length) return;
    const base = process.env.SITE_URL?.startsWith('http')
      ? process.env.SITE_URL
      : `https://${process.env.SITE_URL || 'patienceai.in'}`;
    const link = `${base}/support-executive`;
    const transporter = createTransporter();
    for (const exec of execs) {
      await transporter.sendMail({
        from: `"${process.env.SMTP_SENDER_NAME || 'Patience AI'}" <${process.env.SMTP_USER}>`,
        to: exec.email,
        subject: `New live chat request — ${conversationId}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
            <h2 style="color:#0f172a">New support chat request</h2>
            <p style="color:#475569">A customer is waiting for live support.</p>
            <table style="margin:16px 0;color:#475569">
              <tr><td style="padding:4px 12px 4px 0;font-weight:600">Conversation ID</td><td>${conversationId}</td></tr>
              ${customerName ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Customer name</td><td>${customerName}</td></tr>` : ''}
              ${customerEmail ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600">Customer email</td><td>${customerEmail}</td></tr>` : ''}
            </table>
            <a href="${link}" style="display:inline-block;padding:12px 28px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open Support Panel</a>
          </div>`
      }).catch((e) => console.error('exec notify email failed:', e.message));
    }
  } catch (e) {
    console.error('notifyExecutives error:', e.message);
  }
};

const ensureSession = async (conversationId, customerEmail, customerName) => {
  await queryDb(
    `INSERT INTO ${SESSIONS_TABLE} (conversation_id, customer_email, customer_name, status, created_at, updated_at)
     VALUES ($1,$2,$3,'waiting',NOW(),NOW())
     ON CONFLICT (conversation_id) DO UPDATE SET
       customer_email=COALESCE(EXCLUDED.customer_email, ${SESSIONS_TABLE}.customer_email),
       customer_name=COALESCE(EXCLUDED.customer_name, ${SESSIONS_TABLE}.customer_name),
       updated_at=NOW()`,
    [conversationId, customerEmail || null, customerName || null]
  );
};

export default async function handler(req, res) {
  const admin = isAdmin(req);
  const exec = getExec(req);
  const authorized = admin || exec;

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const conversationId = String(req.query.conversationId || '').trim();
    const customerEmail  = String(req.query.customerEmail  || '').trim();
    const since          = String(req.query.since          || '').trim();
    const listSessions   = req.query.listSessions === '1';

    // Admin/exec: list all sessions
    if (listSessions) {
      if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
      try {
        const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10) || 100, 1), 100);
        const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
        const sessions = await queryDb(
          `SELECT * FROM ${SESSIONS_TABLE} ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
        const totalRows = await queryDb(`SELECT COUNT(*)::int AS total FROM ${SESSIONS_TABLE}`);
        return res.status(200).json({ sessions, total: totalRows[0]?.total || sessions.length });
      } catch (err) {
        if (isMissingTableError(err.message)) return res.status(200).json({ sessions: [] });
        return res.status(500).json({ error: err.message });
      }
    }

    if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });
    if (!authorized && !conversationId.startsWith('PatienceAILive-'))
      return res.status(403).json({ error: 'Forbidden' });

    try {
      const rows = since
        ? await queryDb(
            `SELECT * FROM ${CHATS_TABLE} WHERE conversation_id=$1 AND created_at>$2 ORDER BY created_at ASC LIMIT 100`,
            [conversationId, since]
          )
        : await queryDb(
            `SELECT * FROM ${CHATS_TABLE} WHERE conversation_id=$1 ORDER BY created_at ASC LIMIT 200`,
            [conversationId]
          );
      const sessionRows = await queryDb(
        `SELECT * FROM ${SESSIONS_TABLE} WHERE conversation_id=$1 LIMIT 1`,
        [conversationId]
      );
      return res.status(200).json({ messages: rows, session: sessionRows[0] || null });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ messages: [], session: null });
      console.error('support-chat GET error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — send message ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { conversationId, customerEmail, customerName, message, sender, executiveName } = req.body || {};
    if (!conversationId || !message || !sender)
      return res.status(400).json({ error: 'conversationId, message, sender required' });
    if (!['customer', 'executive', 'system'].includes(sender))
      return res.status(400).json({ error: 'sender must be customer, executive, or system' });
    if (sender === 'executive' && !authorized)
      return res.status(401).json({ error: 'Unauthorized' });
    if (sender === 'customer' && !conversationId.startsWith('PatienceAILive-'))
      return res.status(400).json({ error: 'Invalid conversation ID format' });

    try {
      const isNew = await queryDb(
        `SELECT id FROM ${SESSIONS_TABLE} WHERE conversation_id=$1 LIMIT 1`,
        [conversationId]
      );
      const firstMessage = isNew.length === 0;

      await ensureSession(conversationId, customerEmail || null, customerName || null);
      const rows = await queryDb(
        `INSERT INTO ${CHATS_TABLE} (conversation_id, customer_email, sender, message, executive_name, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
        [conversationId, customerEmail || null, sender, String(message).slice(0, 4000),
          sender === 'executive' ? (exec?.name || executiveName || 'Support Team') : null]
      );

      if (sender === 'executive') {
        await queryDb(
          `UPDATE ${SESSIONS_TABLE} SET status='active', assigned_executive=$1, updated_at=NOW() WHERE conversation_id=$2`,
          [exec?.name || executiveName || 'Support Team', conversationId]
        );
      } else {
        await queryDb(`UPDATE ${SESSIONS_TABLE} SET updated_at=NOW() WHERE conversation_id=$1`, [conversationId]);
        // Notify executives only on the very first customer message
        if (firstMessage) {
          notifyExecutives(conversationId, customerEmail || null, customerName || null); // fire-and-forget
        }
      }
      return res.status(200).json({ message: rows[0] });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(500).json({ error: 'Support chat table not ready. Try again.' });
      console.error('support-chat POST error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PATCH — update session (admin/exec only) ──────────────────────────────
  if (req.method === 'PATCH') {
    if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
    const { conversationId, status, assignedExecutive } = req.body || {};
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    try {
      const sets = [];
      const params = [];
      let i = 1;
      if (status)               { sets.push(`status=$${i++}`);               params.push(status); }
      if (assignedExecutive !== undefined) { sets.push(`assigned_executive=$${i++}`); params.push(assignedExecutive); }
      sets.push('updated_at=NOW()');
      params.push(conversationId);
      const rows = await queryDb(
        `UPDATE ${SESSIONS_TABLE} SET ${sets.join(',')} WHERE conversation_id=$${i} RETURNING *`,
        params
      );
      return res.status(200).json({ session: rows[0] || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
    const { conversationId } = req.body || {};
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    try {
      await queryDb(`DELETE FROM ${CHATS_TABLE} WHERE conversation_id=$1`, [conversationId]);
      await queryDb(`DELETE FROM ${SESSIONS_TABLE} WHERE conversation_id=$1`, [conversationId]);
      await queryDb(`UPDATE voice_rooms SET status='ended', updated_at=NOW() WHERE conversation_id=$1`, [conversationId]).catch(() => {});
      return res.status(200).json({ ok: true, conversationId });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
