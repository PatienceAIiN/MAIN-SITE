import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, hashPassword, verifyPassword,
  createExecSessionToken, EXEC_SESSION_COOKIE_NAME, serializeCookie, getExecSession } from './_security.js';

const TABLE = 'support_executives';
const TTL_HOURS = 72;
const SMTP_TIMEOUT_MS = 30000;

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

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
  const host = process.env.SMTP_HOST || 'smtpout.secureserver.net';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'false' ? false : (port === 465);

  if (!user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS.');
  }

  const transporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    tls: { rejectUnauthorized: false } // GoDaddy certs sometimes chain-fail in prod
  });

  const link = `${getSiteBase()}/support-executive?invite=${token}`;
  const fromName = process.env.SMTP_SENDER_NAME || 'Patience AI';
  const fromAddress = process.env.SMTP_FROM || user;

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    envelope: { from: user, to: email },
    to: email,
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
      await queryDb(`UPDATE ${TABLE} SET online_status=$1, updated_at=NOW() WHERE id=$2`, [status, exec.id]);
      await logExecutiveActivity(exec.id, 'status_change', oldStatus, status);
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
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
