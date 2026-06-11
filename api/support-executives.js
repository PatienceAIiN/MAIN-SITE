import crypto from 'node:crypto';
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, hashPassword, verifyPassword,
  createExecSessionToken, EXEC_SESSION_COOKIE_NAME, serializeCookie, getExecSession } from './_security.js';
import { sendEmail } from './_email.js';
import { redisSetJson, redisGetJson, redisDel } from './_redis.js';
import { invalidate, cacheKeys } from './_cache.js';

const TABLE = 'support_executives';
const TTL_HOURS = 72;
const PRESENCE_TTL = 75; // seconds — refreshed by the client heartbeat
const IDLE_LIMIT_MS = 10 * 60 * 1000; // no heartbeat/activity for 10 min → shown offline

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

// Live presence is mirrored to Redis (self-hosted, via REDIS_URL — not Upstash) so an
// executive that closes their tab auto-expires to offline. DB online_status is the durable fallback.
const presenceKey = (id) => `presence:exec:${id}`;
const setPresence = async (id, status, name) => {
  try { await redisSetJson(presenceKey(id), { status, name, at: Date.now() }, PRESENCE_TTL); }
  catch { /* Redis optional — DB remains source of truth */ }
};
const getPresence = async (id) => {
  try { return await redisGetJson(presenceKey(id)); }
  catch { return null; }
};

const logExecutiveActivity = async (executiveId, action, oldStatus = null, newStatus = null, metadata = null) => {
  try {
    await queryDb(
      `INSERT INTO executive_activity_logs (executive_id, action, old_status, new_status, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [executiveId, action, oldStatus, newStatus, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error('[activity] log failed:', err.message);
  }
};

const getSiteBase = () => {
  const url = process.env.SITE_URL || '';
  if (url.startsWith('http')) return url.replace(/\/$/, '');
  return `https://${url || 'patienceai.in'}`;
};

const sendInviteEmail = async (email, name, token) => {
  const link = `${getSiteBase()}/support-executive?invite=${token}`;
  await sendEmail({
    to: { email, name },
    subject: `You're invited as a Support Executive — Patience AI`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f172a">Welcome, ${name}!</h2>
      <p style="color:#475569">You've been added as a <strong>Support Executive</strong> for Patience AI Live Support.</p>
      <p style="color:#475569">Click the button below to set your password and activate your account. This link expires in ${TTL_HOURS} hours.</p>
      <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Set Password &amp; Activate</a>
      <p style="color:#94a3b8;font-size:12px">If you didn't expect this, ignore this email.</p>
    </div>`,
    text: `Welcome ${name}!\n\nYou've been invited as a Support Executive.\n\nSet your password here:\n${link}\n\nThis link expires in ${TTL_HOURS} hours.`
  });
  console.log('[invite] email sent to', email);
};

// Ensure seed executive exists (called at server startup via ensureSchema side-effect)
export const seedExecutive = async () => {
  try {
    const existing = await queryDb(`SELECT id FROM ${TABLE} WHERE email = $1 LIMIT 1`, ['harsh@patienceai.in']);
    if (existing.length > 0) return;
    const { salt, hash } = hashPassword('Admin@110426');
    await queryDb(
      `INSERT INTO ${TABLE} (email, name, password_salt, password_hash, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'active',NOW(),NOW())`,
      ['harsh@patienceai.in', 'Harsh', salt, hash]
    );
    console.log('[seed] support executive harsh@patienceai.in created');
  } catch (err) {
    if (!isMissingTableError(err.message)) console.error('[seed] executive seed error:', err.message);
  }
};

export default async function handler(req, res) {
  // ── POST /api/support-executives/login ───────────────────────────────────
  if (req.method === 'POST' && req.url?.includes('/login')) {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
      const rows = await queryDb(`SELECT * FROM ${TABLE} WHERE email = $1 LIMIT 1`, [email.trim().toLowerCase()]);
      const exec = rows[0];
      if (!exec) return res.status(401).json({ error: 'Invalid credentials' });
      if (exec.status === 'invited') return res.status(403).json({ error: 'Account not activated. Check your invite email.' });
      if (!verifyPassword(password, exec.password_salt, exec.password_hash))
        return res.status(401).json({ error: 'Invalid credentials' });
      // update last_seen and set online status
      await queryDb(`UPDATE ${TABLE} SET last_seen_at=NOW(), online_status='online', updated_at=NOW() WHERE id=$1`, [exec.id]);
      await logExecutiveActivity(exec.id, 'login', null, 'online');
      const token = createExecSessionToken({ id: exec.id, email: exec.email, name: exec.name });
      const isSecure = process.env.NODE_ENV === 'production';
      res.setHeader('Set-Cookie', serializeCookie(EXEC_SESSION_COOKIE_NAME, token, {
        maxAge: 60 * 60 * 24 * 7,
        secure: isSecure,
        sameSite: 'Lax'
      }));
      return res.status(200).json({ ok: true, executive: { id: exec.id, email: exec.email, name: exec.name } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/support-executives/activate ────────────────────────────────
  if (req.method === 'POST' && req.url?.includes('/activate')) {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'token and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    try {
      const rows = await queryDb(
        `SELECT * FROM ${TABLE} WHERE invite_token=$1 AND invite_expires_at > NOW() LIMIT 1`, [token]
      );
      const exec = rows[0];
      if (!exec) return res.status(400).json({ error: 'Invalid or expired invite link' });
      const { salt, hash } = hashPassword(password);
      await queryDb(
        `UPDATE ${TABLE} SET password_salt=$1, password_hash=$2, status='active', invite_token=NULL,
         invite_expires_at=NULL, updated_at=NOW() WHERE id=$3`,
        [salt, hash, exec.id]
      );
      return res.status(200).json({ ok: true, email: exec.email });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/support-executives/me ───────────────────────────────────────
  if (req.method === 'GET' && req.url?.includes('/me')) {
    const exec = getExecSession(req);
    if (!exec) return res.status(401).json({ error: 'Not authenticated' });
    try {
      await queryDb(`UPDATE ${TABLE} SET last_seen_at=NOW() WHERE email=$1`, [exec.email]);
    } catch { /* ignore */ }
    return res.status(200).json({ executive: exec });
  }

  // ── DELETE /api/support-executives/logout ───────────────────────────────────
  if (req.method === 'DELETE' && req.url?.includes('/logout')) {
    const exec = getExecSession(req);
    if (exec) {
      await queryDb(`UPDATE ${TABLE} SET online_status='offline', updated_at=NOW() WHERE id=$1`, [exec.id]);
      await setPresence(exec.id, 'offline', exec.name);
      await logExecutiveActivity(exec.id, 'logout', 'online', 'offline');
    }
    res.setHeader('Set-Cookie', serializeCookie(EXEC_SESSION_COOKIE_NAME, '', { maxAge: 0 }));
    return res.status(200).json({ ok: true });
  }

  // ── PATCH /api/support-executives/status ───────────────────────────────────
  if (req.method === 'PATCH' && req.url?.includes('/status')) {
    const exec = getExecSession(req);
    if (!exec) return res.status(401).json({ error: 'Not authenticated' });
    const { status } = req.body || {};
    if (!status || !['online', 'away', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required (online, away, offline)' });
    }
    try {
      const rows = await queryDb(`SELECT online_status FROM ${TABLE} WHERE id=$1 LIMIT 1`, [exec.id]);
      const oldStatus = rows[0]?.online_status || 'offline';
      await queryDb(`UPDATE ${TABLE} SET online_status=$1, last_seen_at=NOW(), updated_at=NOW() WHERE id=$2`, [status, exec.id]);
      await setPresence(exec.id, status, exec.name);
      if (oldStatus !== status) await logExecutiveActivity(exec.id, 'status_change', oldStatus, status);
      return res.status(200).json({ ok: true, status });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/support-executives/activity ───────────────────────────────
  if (req.method === 'GET' && req.url?.includes('/activity')) {
    const exec = getExecSession(req);
    if (!exec && !isAdmin(req)) return res.status(401).json({ error: 'Not authenticated' });
    const executiveId = req.query.executiveId;
    try {
      let query = `SELECT 
        eal.action, 
        eal.old_status, 
        eal.new_status, 
        eal.metadata,
        eal.created_at,
        se.name as executive_name,
        se.email as executive_email
        FROM executive_activity_logs eal
        JOIN support_executives se ON eal.executive_id = se.id`;
      const params = [];
      
      if (executiveId) {
        query += ` WHERE eal.executive_id = $1`;
        params.push(executiveId);
      } else if (exec && !isAdmin(req)) {
        // Executive can only see their own logs
        query += ` WHERE eal.executive_id = (SELECT id FROM support_executives WHERE email = $1)`;
        params.push(exec.email);
      }
      
      query += ` ORDER BY eal.created_at DESC LIMIT 100`;
      
      const rows = await queryDb(query, params);
      return res.status(200).json({ logs: rows });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/support-executives?colleagues=1 — presence list (exec or admin) ──
  if (req.method === 'GET' && req.query.colleagues === '1') {
    const exec = getExecSession(req);
    if (!exec && !isAdmin(req)) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const rows = await queryDb(
        `SELECT id, name, email, online_status, last_seen_at FROM ${TABLE} WHERE status='active' ORDER BY name ASC`
      );
      // Overlay Redis presence (authoritative when available); otherwise trust DB.
      const colleagues = await Promise.all(rows.map(async (r) => {
        const p = await getPresence(r.id);
        // Without live Redis presence, only trust the DB status if the executive
        // was seen recently — a stale 'online' (closed tab, idle 10+ min) reads offline.
        const seenRecently = r.last_seen_at && (Date.now() - new Date(r.last_seen_at).getTime()) < IDLE_LIMIT_MS;
        return {
          id: r.id, name: r.name, email: r.email,
          status: p?.status || (seenRecently ? (r.online_status || 'offline') : 'offline'),
          last_seen_at: r.last_seen_at
        };
      }));
      return res.status(200).json({ colleagues, selfId: exec?.id || null });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ colleagues: [], selfId: null });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Internal 1:1 chat between executives: /internal ────────────────────────
  if (req.url?.includes('/internal')) {
    const exec = getExecSession(req);
    if (!exec) return res.status(401).json({ error: 'Not authenticated' });
    if (req.method === 'GET') {
      const withId = parseInt(req.query.withId, 10);
      if (!withId) return res.status(400).json({ error: 'withId required' });
      try {
        const rows = await queryDb(
          `SELECT id, from_id, from_name, to_id, message, created_at
           FROM executive_internal_messages
           WHERE (from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)
           ORDER BY created_at ASC LIMIT 200`,
          [exec.id, withId]
        );
        return res.status(200).json({ messages: rows });
      } catch (err) {
        if (isMissingTableError(err.message)) return res.status(200).json({ messages: [] });
        return res.status(500).json({ error: err.message });
      }
    }
    if (req.method === 'POST') {
      const { toId, message } = req.body || {};
      if (!toId || !message?.trim()) return res.status(400).json({ error: 'toId and message required' });
      try {
        const rows = await queryDb(
          `INSERT INTO executive_internal_messages (from_id, from_name, to_id, message, created_at)
           VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
          [exec.id, exec.name, toId, String(message).slice(0, 4000)]
        );
        return res.status(200).json({ message: rows[0] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Conversation/call transfer between executives: /transfer ───────────────
  if (req.url?.includes('/transfer')) {
    const exec = getExecSession(req);
    if (!exec) return res.status(401).json({ error: 'Not authenticated' });

    if (req.method === 'POST') {
      const { conversationId, toId, kind = 'chat' } = req.body || {};
      if (!conversationId || !toId) return res.status(400).json({ error: 'conversationId and toId required' });
      if (Number(toId) === Number(exec.id)) return res.status(400).json({ error: 'Cannot transfer to yourself' });
      try {
        const target = await queryDb(`SELECT name FROM ${TABLE} WHERE id=$1 LIMIT 1`, [toId]);
        if (!target.length) return res.status(404).json({ error: 'Executive not found' });
        // Cancel any other pending transfer for this conversation, then create a fresh request.
        await queryDb(`UPDATE chat_transfers SET status='cancelled', updated_at=NOW() WHERE conversation_id=$1 AND status='pending'`, [conversationId]).catch(() => {});
        const rows = await queryDb(
          `INSERT INTO chat_transfers (conversation_id, from_id, from_name, to_id, to_name, kind, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',NOW(),NOW()) RETURNING *`,
          [conversationId, exec.id, exec.name, toId, target[0].name, kind === 'call' ? 'call' : 'chat']
        );
        return res.status(200).json({ transfer: rows[0] });
      } catch (err) {
        if (isMissingTableError(err.message)) return res.status(500).json({ error: 'Transfer table not ready' });
        return res.status(500).json({ error: err.message });
      }
    }

    // GET — pending transfers addressed to me (incoming) + my outgoing pending
    if (req.method === 'GET') {
      try {
        const incoming = await queryDb(
          `SELECT * FROM chat_transfers WHERE to_id=$1 AND status='pending' ORDER BY created_at DESC LIMIT 5`,
          [exec.id]
        );
        return res.status(200).json({ incoming });
      } catch (err) {
        if (isMissingTableError(err.message)) return res.status(200).json({ incoming: [] });
        return res.status(500).json({ error: err.message });
      }
    }

    // PATCH — accept or deny a transfer addressed to me
    if (req.method === 'PATCH') {
      const { transferId, action } = req.body || {};
      if (!transferId || !['accept', 'deny'].includes(action))
        return res.status(400).json({ error: 'transferId and action (accept|deny) required' });
      try {
        const rows = await queryDb(`SELECT * FROM chat_transfers WHERE id=$1 AND to_id=$2 LIMIT 1`, [transferId, exec.id]);
        const t = rows[0];
        if (!t) return res.status(404).json({ error: 'Transfer not found' });
        if (t.status !== 'pending') return res.status(409).json({ error: 'Transfer already handled' });

        if (action === 'deny') {
          await queryDb(`UPDATE chat_transfers SET status='denied', updated_at=NOW() WHERE id=$1`, [transferId]);
          await queryDb(
            `INSERT INTO support_chats (conversation_id, sender, message, created_at) VALUES ($1,'system',$2,NOW())`,
            [t.conversation_id, `${exec.name} declined the transfer from ${t.from_name}.`]
          ).catch(() => {});
          await invalidate(cacheKeys.messages(t.conversation_id), cacheKeys.sessionList);
          return res.status(200).json({ ok: true, status: 'denied' });
        }

        // accept: reassign the conversation and announce the new agent
        await queryDb(`UPDATE chat_transfers SET status='accepted', updated_at=NOW() WHERE id=$1`, [transferId]);
        await queryDb(
          `UPDATE support_sessions SET status='active', assigned_executive=$1, updated_at=NOW() WHERE conversation_id=$2`,
          [exec.name, t.conversation_id]
        );
        await queryDb(
          `INSERT INTO support_chats (conversation_id, sender, message, created_at) VALUES ($1,'system',$2,NOW())`,
          [t.conversation_id, `${exec.name} joined the chat (transferred from ${t.from_name}).`]
        ).catch(() => {});
        await logExecutiveActivity(exec.id, 'chat_assigned', null, null, { transferFrom: t.from_name, conversationId: t.conversation_id });
        await invalidate(cacheKeys.messages(t.conversation_id), cacheKeys.sessionList);
        return res.status(200).json({ ok: true, status: 'accepted', conversationId: t.conversation_id });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Admin-only routes below ───────────────────────────────────────────────
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  // GET — list all executives
  if (req.method === 'GET') {
    try {
      const rows = await queryDb(
        `SELECT id, email, name, status, last_seen_at, created_at FROM ${TABLE} ORDER BY created_at DESC`
      );
      return res.status(200).json({ executives: rows });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ executives: [] });
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — invite a new executive (or re-invite)
  if (req.method === 'POST') {
    const { email, name, activateImmediately = false } = req.body || {};
    if (!email || !name) return res.status(400).json({ error: 'email and name required' });
    
    // Validate email domain
    if (!email.endsWith('@patienceai.in')) {
      return res.status(400).json({ error: 'Only @patienceai.in email addresses are allowed' });
    }
    
    const inviteToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString();
    
    // Generate random human-readable password if activating immediately
    const dogWords = ['puppy', 'doggo', 'pupper', 'woof', 'bark', 'fetch', 'treat', 'bone', 'leash', 'collar'];
    const foodWords = ['pizza', 'burger', 'taco', 'pasta', 'salad', 'soup', 'bread', 'cheese', 'apple', 'banana'];
    const randomPassword = activateImmediately 
      ? `${dogWords[Math.floor(Math.random() * dogWords.length)]}${foodWords[Math.floor(Math.random() * foodWords.length)]}${Math.floor(Math.random() * 100)}`
      : crypto.randomBytes(16).toString('hex');
    
    const { salt, hash } = hashPassword(randomPassword);
    try {
      const existing = await queryDb(`SELECT id, status FROM ${TABLE} WHERE email=$1 LIMIT 1`, [email.toLowerCase()]);
      let exec;
      if (existing.length > 0) {
        // re-invite or activate
        const rows = await queryDb(
          `UPDATE ${TABLE} SET name=$1, invite_token=$2, invite_expires_at=$3, status=$4, 
           password_salt=$5, password_hash=$6, updated_at=NOW()
           WHERE email=$7 RETURNING *`,
          [name, inviteToken, expiresAt, activateImmediately ? 'active' : 'invited', salt, hash, email.toLowerCase()]
        );
        exec = rows[0];
      } else {
        const rows = await queryDb(
          `INSERT INTO ${TABLE} (email, name, password_salt, password_hash, status, invite_token, invite_expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [email.toLowerCase(), name, salt, hash, activateImmediately ? 'active' : 'invited', inviteToken, expiresAt]
        );
        exec = rows[0];
      }
      
      let emailError = null;
      if (!activateImmediately) {
        try { 
          await sendInviteEmail(email, name, inviteToken); 
        } catch (e) {
          emailError = e.message;
          console.error('[invite] email send failed:', e.message);
        }
      }
      
      return res.status(200).json({
        ok: true,
        executive: { id: exec.id, email: exec.email, name: exec.name, status: exec.status },
        emailSent: !emailError && !activateImmediately,
        emailError: emailError || undefined,
        generatedPassword: activateImmediately ? randomPassword : undefined
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH — update status (admin can activate/deactivate)
  if (req.method === 'PATCH') {
    const { id, status } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: 'id and status required' });
    try {
      const rows = await queryDb(
        `UPDATE ${TABLE} SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, email, name, status`,
        [status, id]
      );
      // instant lockout / restore for live sessions
      if (status === 'inactive') await redisSetJson(`revoked:exec:${id}`, 1, 7 * 24 * 3600).catch(() => {});
      else await redisDel(`revoked:exec:${id}`).catch(() => {});
      return res.status(200).json({ executive: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE — remove executive
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      await queryDb(`DELETE FROM ${TABLE} WHERE id=$1`, [id]);
      await redisSetJson(`revoked:exec:${id}`, 1, 7 * 24 * 3600).catch(() => {});
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
