import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, hashPassword, verifyPassword,
  createExecSessionToken, EXEC_SESSION_COOKIE_NAME, serializeCookie, getExecSession } from './_security.js';

const TABLE = 'support_executives';
const TTL_HOURS = 72;
const SMTP_TIMEOUT_MS = 20000;

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

const logSupportAuthEvent = async (req, identifier, status) => {
  try {
    await queryDb(
      `INSERT INTO public.auth_login_events (role, identifier, status, ip_address, user_agent)
       VALUES ('support', $1, $2, $3, $4)`,
      [
        String(identifier || 'unknown'),
        String(status || 'unknown'),
        String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || null,
        String(req.headers['user-agent'] || '').trim() || null
      ]
    );
  } catch (err) {
    console.error('[auth-log] support auth log failed:', err.message);
  }
};

const getSiteBase = () => {
  const raw = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || '';
  const url = String(raw).trim();
  if (!url) return 'https://patienceai.in';
  if (url.startsWith('http://') || url.startsWith('https://')) return url.replace(/\/$/, '');
  return `https://${url.replace(/\/$/, '')}`;
};

const isAllowedExecutiveEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  const configured = String(process.env.SUPPORT_EXEC_ALLOWED_DOMAINS || '@patienceai.in')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return configured.some((rule) => {
    if (rule.startsWith('@')) return normalized.endsWith(rule);
    return normalized === rule;
  });
};

const sendCredentialsEmail = async (email, name, password) => {
  const host = process.env.SMTP_HOST || 'smtpout.secureserver.net';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'false' ? false : (port === 465);

  if (!user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    pool: false,
    tls: { rejectUnauthorized: false } // GoDaddy certs sometimes chain-fail in prod
  });

    const fromName = process.env.SMTP_SENDER_NAME || 'Patience AI';
  const fromAddress = process.env.SMTP_FROM || user;

  const sendPromise = transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    envelope: { from: user, to: email },
    to: email,
    subject: `Support Executive Login Credentials — Patience AI`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f172a">Welcome, ${name}!</h2>
      <p style="color:#475569">You've been added as a <strong>Support Executive</strong> for Patience AI Live Support.</p>
      <p style="color:#475569">Use the credentials below to sign in instantly.</p>
      <p style="color:#0f172a"><strong>Email:</strong> ${email}<br/><strong>Password:</strong> ${password}</p>
      <a href="${getSiteBase()}/support-executive" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open Support Executive Login</a>
      <p style="color:#94a3b8;font-size:12px">For security, please change this password after first login.</p>
    </div>`,
    text: `Welcome ${name}!\n\nYou have been added as a Support Executive.\n\nLogin URL: ${getSiteBase()}/support-executive\nEmail: ${email}\nPassword: ${password}\n\nPlease change your password after first login.`
  });
  await Promise.race([
    sendPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP request timed out while sending invite email.')), SMTP_TIMEOUT_MS + 2000))
  ]);
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
      if (!exec) {
        await logSupportAuthEvent(req, email, 'failure');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (exec.status === 'invited') {
        await logSupportAuthEvent(req, exec.email, 'failure');
        return res.status(403).json({ error: 'Account not activated. Check your invite email.' });
      }
      if (!verifyPassword(password, exec.password_salt, exec.password_hash)) {
        await logSupportAuthEvent(req, exec.email, 'failure');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      // update last_seen only; online status is controlled manually by executive
      await queryDb(`UPDATE ${TABLE} SET last_seen_at=NOW(), updated_at=NOW() WHERE id=$1`, [exec.id]);
      await logExecutiveActivity(exec.id, 'login', null, null, { status_preserved: true });
      await logSupportAuthEvent(req, exec.email, 'success');
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
      if (!exec) {
        await logSupportAuthEvent(req, 'invite', 'failure');
        return res.status(400).json({ error: 'Invalid or expired invite link' });
      }
      const { salt, hash } = hashPassword(password);
      await queryDb(
        `UPDATE ${TABLE} SET password_salt=$1, password_hash=$2, status='active', invite_token=NULL,
         invite_expires_at=NULL, online_status='offline', updated_at=NOW() WHERE id=$3`,
        [salt, hash, exec.id]
      );
      await logExecutiveActivity(exec.id, 'status_change', 'invited', 'active', { source: 'invite_accept' });
      await logSupportAuthEvent(req, exec.email, 'success');
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
      const rows = await queryDb(`SELECT id, email, name, online_status FROM ${TABLE} WHERE email=$1 LIMIT 1`, [exec.email]);
      const dbExec = rows[0];
      if (dbExec) return res.status(200).json({ executive: dbExec });
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

  // POST — create/update executive credentials and optionally send credentials email
  if (req.method === 'POST') {
    const { email, name, password, sendMail = false } = req.body || {};
    if (!email || !name || !password) return res.status(400).json({ error: 'email, name and password required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!isAllowedExecutiveEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Email is not allowed for support executive accounts' });
    }

    const { salt, hash } = hashPassword(password);
    try {
      const existing = await queryDb(`SELECT id FROM ${TABLE} WHERE email=$1 LIMIT 1`, [normalizedEmail]);
      let exec;
      if (existing.length > 0) {
        const rows = await queryDb(
          `UPDATE ${TABLE} SET name=$1, password_salt=$2, password_hash=$3, status='active', invite_token=NULL,
           invite_expires_at=NULL, updated_at=NOW() WHERE email=$4 RETURNING *`,
          [name, salt, hash, normalizedEmail]
        );
        exec = rows[0];
      } else {
        const rows = await queryDb(
          `INSERT INTO ${TABLE} (email, name, password_salt, password_hash, status)
           VALUES ($1,$2,$3,$4,'active') RETURNING *`,
          [normalizedEmail, name, salt, hash]
        );
        exec = rows[0];
      }

      let emailError = null;
      if (sendMail) {
        try {
          await sendCredentialsEmail(normalizedEmail, name, password);
        } catch (e) {
          emailError = e.message;
          console.error('[credentials] email send failed:', e.message);
        }
      }

      return res.status(200).json({
        ok: true,
        executive: { id: exec.id, email: exec.email, name: exec.name, status: exec.status },
        emailSent: sendMail ? !emailError : false,
        emailError: emailError || undefined
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
