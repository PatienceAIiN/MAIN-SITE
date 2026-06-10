import crypto from 'node:crypto';
import { queryDb, isMissingTableError } from './_db.js';
import {
  getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, hashPassword, verifyPassword,
  createMemberSessionToken, MEMBER_SESSION_COOKIE_NAME, serializeCookie, getMemberSession
} from './_security.js';
import { sendEmail } from './_email.js';
import { logAudit } from './_ticketing.js';

const TABLE = 'team_members';

// Password strength: at least 8 chars, one letter and one number.
const passwordIssue = (password) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'Password must include at least one letter and one number';
  return null;
};
const TTL_HOURS = 72;
const ALLOWED_DOMAIN = '@patienceai.in';

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

const getSiteBase = () => {
  const url = process.env.SITE_URL || '';
  if (url.startsWith('http')) return url.replace(/\/$/, '');
  return `https://${url || 'patienceai.in'}`;
};

const sendInviteEmail = async (email, name, token) => {
  const link = `${getSiteBase()}/team?invite=${token}`;
  await sendEmail({
    to: { email, name },
    subject: `You're invited to the Patience AI Ticket Portal`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f172a">Welcome, ${name}!</h2>
      <p style="color:#475569">You've been added to the <strong>Patience AI internal ticket portal</strong>. Support tickets will be assigned to you here.</p>
      <p style="color:#475569">Click the button below to set your password and activate your account. This link expires in ${TTL_HOURS} hours.</p>
      <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Set Password &amp; Activate</a>
      <p style="color:#94a3b8;font-size:12px">If you didn't expect this, ignore this email.</p>
    </div>`,
    text: `Welcome ${name}!\n\nYou've been invited to the Patience AI internal ticket portal.\n\nSet your password here:\n${link}\n\nThis link expires in ${TTL_HOURS} hours.`
  });
};

const setMemberCookie = (res, token, maxAge = 60 * 60 * 24 * 7) => {
  res.setHeader('Set-Cookie', serializeCookie(MEMBER_SESSION_COOKIE_NAME, token, {
    maxAge,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax'
  }));
};

export default async function handler(req, res) {
  // ── POST /api/team-members/login ──────────────────────────────────────────
  if (req.method === 'POST' && req.url?.includes('/login')) {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
      const rows = await queryDb(`SELECT * FROM ${TABLE} WHERE email = $1 LIMIT 1`, [email.trim().toLowerCase()]);
      const member = rows[0];
      if (!member) return res.status(401).json({ error: 'Invalid credentials' });
      if (member.status === 'invited') return res.status(403).json({ error: 'Account not activated. Check your invite email.' });
      if (member.status === 'inactive') return res.status(403).json({ error: 'Account is deactivated. Contact your admin.' });
      if (!verifyPassword(password, member.password_salt, member.password_hash))
        return res.status(401).json({ error: 'Invalid credentials' });
      await queryDb(`UPDATE ${TABLE} SET last_seen_at=NOW(), updated_at=NOW() WHERE id=$1`, [member.id]);
      setMemberCookie(res, createMemberSessionToken({ id: member.id, email: member.email, name: member.name }));
      return res.status(200).json({ ok: true, member: { id: member.id, email: member.email, name: member.name } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST /api/team-members/activate ───────────────────────────────────────
  if (req.method === 'POST' && req.url?.includes('/activate')) {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'token and password required' });
    const issue = passwordIssue(password);
    if (issue) return res.status(400).json({ error: issue });
    try {
      const rows = await queryDb(
        `SELECT * FROM ${TABLE} WHERE invite_token=$1 AND invite_expires_at > NOW() LIMIT 1`, [token]
      );
      const member = rows[0];
      if (!member) return res.status(400).json({ error: 'Invalid or expired invite link' });
      const { salt, hash } = hashPassword(password);
      await queryDb(
        `UPDATE ${TABLE} SET password_salt=$1, password_hash=$2, status='active', invite_token=NULL,
         invite_expires_at=NULL, updated_at=NOW() WHERE id=$3`,
        [salt, hash, member.id]
      );
      return res.status(200).json({ ok: true, email: member.email });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET /api/team-members/me ──────────────────────────────────────────────
  if (req.method === 'GET' && req.url?.includes('/me')) {
    const member = getMemberSession(req);
    if (!member) return res.status(401).json({ error: 'Not authenticated' });
    try {
      await queryDb(`UPDATE ${TABLE} SET last_seen_at=NOW() WHERE id=$1`, [member.id]);
    } catch { /* ignore */ }
    return res.status(200).json({ member });
  }

  // ── DELETE /api/team-members/logout ───────────────────────────────────────
  if (req.method === 'DELETE' && req.url?.includes('/logout')) {
    setMemberCookie(res, '', 0);
    return res.status(200).json({ ok: true });
  }

  // ── POST /api/team-members/change-password ────────────────────────────────
  if (req.method === 'POST' && req.url?.includes('/change-password')) {
    const member = getMemberSession(req);
    if (!member) return res.status(401).json({ error: 'Not authenticated' });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
    const issue = passwordIssue(newPassword);
    if (issue) return res.status(400).json({ error: issue });
    try {
      const rows = await queryDb(`SELECT * FROM ${TABLE} WHERE id=$1 LIMIT 1`, [member.id]);
      const row = rows[0];
      if (!row) return res.status(404).json({ error: 'Account not found' });
      if (!verifyPassword(currentPassword, row.password_salt, row.password_hash))
        return res.status(401).json({ error: 'Current password is incorrect' });
      const { salt, hash } = hashPassword(newPassword);
      await queryDb(`UPDATE ${TABLE} SET password_salt=$1, password_hash=$2, updated_at=NOW() WHERE id=$3`, [salt, hash, member.id]);
      await logAudit('member', member.email, 'password_changed', member.email);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Admin-only routes below ────────────────────────────────────────────────
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  // GET — list all team members
  if (req.method === 'GET') {
    try {
      const rows = await queryDb(
        `SELECT id, email, name, status, last_seen_at, created_at FROM ${TABLE} ORDER BY created_at DESC`
      );
      return res.status(200).json({ members: rows });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ members: [] });
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — invite a new team member (or re-invite)
  if (req.method === 'POST') {
    const { email, name } = req.body || {};
    if (!email || !name) return res.status(400).json({ error: 'email and name required' });
    if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      return res.status(400).json({ error: `Only ${ALLOWED_DOMAIN} email addresses are allowed` });
    }
    const inviteToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString();
    const { salt, hash } = hashPassword(crypto.randomBytes(16).toString('hex'));
    try {
      const existing = await queryDb(`SELECT id FROM ${TABLE} WHERE email=$1 LIMIT 1`, [email.toLowerCase()]);
      let member;
      if (existing.length > 0) {
        const rows = await queryDb(
          `UPDATE ${TABLE} SET name=$1, invite_token=$2, invite_expires_at=$3, status='invited',
           password_salt=$4, password_hash=$5, updated_at=NOW() WHERE email=$6 RETURNING *`,
          [name, inviteToken, expiresAt, salt, hash, email.toLowerCase()]
        );
        member = rows[0];
      } else {
        const rows = await queryDb(
          `INSERT INTO ${TABLE} (email, name, password_salt, password_hash, status, invite_token, invite_expires_at)
           VALUES ($1,$2,$3,$4,'invited',$5,$6) RETURNING *`,
          [email.toLowerCase(), name, salt, hash, inviteToken, expiresAt]
        );
        member = rows[0];
      }

      let emailError = null;
      try {
        await sendInviteEmail(email, name, inviteToken);
      } catch (e) {
        emailError = e.message;
        console.error('[team invite] email send failed:', e.message);
      }
      await logAudit('admin', 'admin', 'team_member_invited', email.toLowerCase(), { emailSent: !emailError });

      return res.status(200).json({
        ok: true,
        member: { id: member.id, email: member.email, name: member.name, status: member.status },
        emailSent: !emailError,
        emailError: emailError || undefined,
        // Fallback so the admin can hand over the activation link manually
        // when the invite email could not be delivered.
        inviteLink: emailError ? `${getSiteBase()}/team?invite=${inviteToken}` : undefined
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // PATCH — activate/deactivate a member
  if (req.method === 'PATCH') {
    const { id, status } = req.body || {};
    if (!id || !['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'id and status (active|inactive) required' });
    try {
      const rows = await queryDb(
        `UPDATE ${TABLE} SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, email, name, status`,
        [status, id]
      );
      await logAudit('admin', 'admin', 'team_member_status_changed', rows[0]?.email, { status });
      return res.status(200).json({ member: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE — remove member
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      await queryDb(`DELETE FROM ${TABLE} WHERE id=$1`, [id]);
      await logAudit('admin', 'admin', 'team_member_removed', String(id));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
