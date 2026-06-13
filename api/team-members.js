import crypto from 'node:crypto';
import { queryDb, isMissingTableError } from './_db.js';
import {
  getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, hashPassword, verifyPassword,
  createMemberSessionToken, MEMBER_SESSION_COOKIE_NAME, serializeCookie, getMemberSession
} from './_security.js';
import { sendEmail } from './_email.js';
import { logAudit } from './_ticketing.js';
import { redisSetJson, redisDel } from './_redis.js';
import { broadcastToEmails } from './_teamhub.js';

const SEVEN_DAYS = 7 * 24 * 3600;
const revokeMember = (id) => redisSetJson(`revoked:member:${id}`, 1, SEVEN_DAYS).catch(() => {});
const unrevokeMember = (id) => redisDel(`revoked:member:${id}`).catch(() => {});

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
const TEAM_ROLES = ['member', 'software_dev', 'team_lead', 'engineering_manager', 'product_manager', 'qa'];
export const ALL_PERMS = ['github_read', 'github_write', 'roster_manage', 'collaborator_manage'];
// Defaults by role when admin hasn't set explicit per-user permissions.
export const ROLE_DEFAULT_PERMS = {
  software_dev: ['github_read', 'github_write'],
  team_lead: ['github_read', 'github_write', 'collaborator_manage'],
  engineering_manager: ['github_read', 'github_write', 'roster_manage', 'collaborator_manage'],
  product_manager: ['github_read', 'roster_manage'],
  qa: ['github_read'],
  member: []
};
// An explicitly-saved empty string means "no permissions"; only NULL
// (never customised by an admin) falls back to the role defaults.
export const resolvePerms = (row) => (row?.permissions !== null && row?.permissions !== undefined)
  ? String(row.permissions).split(',').map((x) => x.trim()).filter(Boolean)
  : (ROLE_DEFAULT_PERMS[row?.team_role] || []);
// Product / engineering managers can also manage the roster (not delete).
// Roster + permission management: admin and engineering managers ONLY.
const isManager = async (req) => {
  const m = getMemberSession(req);
  if (!m) return false;
  const rows = await queryDb(`SELECT team_role FROM team_members WHERE id=$1`, [m.id]).catch(() => []);
  return rows[0]?.team_role === 'engineering_manager';
};

const getSiteBase = () => {
  const url = process.env.SITE_URL || '';
  if (url.startsWith('http')) return url.replace(/\/$/, '');
  return `https://${url || 'patienceai.in'}`;
};

// Role-specific invitation copy — each role gets its own subject and
// description of what they'll actually do, not one generic template.
const ROLE_INVITE = {
  software_dev: { title: 'Software Developer', blurb: 'Your team lead will assign development tickets to your bucket. You can work them through to QA, chat on each ticket, and create branches/pull requests from the built-in GitHub workspace.' },
  team_lead: { title: 'Team Lead', blurb: 'Approved tickets land in your triage queue — you decide which developer takes each one, manage sprints and epics, and oversee the pipeline board.' },
  engineering_manager: { title: 'Engineering Manager', blurb: 'You review escalated work, route it to team leads, manage the engineering roster, sprints, services and OKRs.' },
  product_manager: { title: 'Product Manager', blurb: 'Tickets escalated from support arrive at your review queue first — approve them into engineering or send them back with feedback. You also manage epics, OKRs and announcements.' },
  qa: { title: 'QA Engineer', blurb: 'Completed development work lands in your queue — run test cases, approve releases, or send tickets back to the developer with what needs improvement.' },
  member: { title: 'Team Member', blurb: 'Support tickets will be assigned to you here — track them, chat with the support team and attach files.' }
};

const sendInviteEmail = async (email, name, token, teamRole = 'member') => {
  const link = `${getSiteBase()}/team?invite=${token}`;
  const role = ROLE_INVITE[teamRole] || ROLE_INVITE.member;
  await sendEmail({
    to: { email, name },
    subject: `${name}, you're invited as ${role.title} — Patience AI`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f172a">Welcome aboard, ${name}!</h2>
      <p style="color:#475569">You've been added to the Patience AI engineering platform as a <strong>${role.title}</strong>.</p>
      <p style="color:#475569">${role.blurb}</p>
      <p style="color:#475569">Set your password to activate your account — this link expires in ${TTL_HOURS} hours.</p>
      <a href="${link}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Set Password &amp; Activate</a>
      <p style="color:#94a3b8;font-size:12px">A quick guided tour will greet you on first login. If you didn't expect this, ignore this email.</p>
    </div>`,
    text: `Welcome aboard, ${name}!\n\nYou've been added to the Patience AI engineering platform as a ${role.title}.\n\n${role.blurb}\n\nSet your password here (expires in ${TTL_HOURS} hours):\n${link}`
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
      if (!verifyPassword(password, member.password_salt, member.password_hash)) {
        await logAudit('member', email.toLowerCase(), 'login_failed', email.toLowerCase()).catch(() => {});
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      await logAudit('member', member.email, 'login', member.email).catch(() => {});
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
    let teamRole = 'member';
    let notificationsEnabled = true;
    let allowedRepos = [];
    try {
      await queryDb(`UPDATE ${TABLE} SET last_seen_at=NOW() WHERE id=$1`, [member.id]);
      const rows = await queryDb(`SELECT team_role, permissions, notifications_enabled, allowed_repos FROM ${TABLE} WHERE id=$1`, [member.id]);
      teamRole = rows[0]?.team_role || 'member';
      notificationsEnabled = rows[0]?.notifications_enabled !== false;
      allowedRepos = String(rows[0]?.allowed_repos || '').split(',').map((x) => x.trim()).filter(Boolean);
      var perms = resolvePerms(rows[0]);
    } catch { perms = []; }
    return res.status(200).json({ member: { ...member, teamRole, permissions: perms, notificationsEnabled, allowedRepos } });
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

  // ── Roster management: admin, or product/engineering managers ─────────────
  const admin = isAdmin(req);
  if (!admin && !(await isManager(req))) return res.status(401).json({ error: 'Unauthorized' });

  // GET — list all team members
  if (req.method === 'GET') {
    try {
      const rows = await queryDb(
        `SELECT id, email, name, status, team_role, permissions, allowed_repos, last_seen_at, created_at FROM ${TABLE} ORDER BY created_at DESC`
      );
      return res.status(200).json({ members: rows });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ members: [] });
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — invite a new team member (or re-invite)
  if (req.method === 'POST') {
    const { email, name, teamRole = 'member' } = req.body || {};
    if (!email || !name) return res.status(400).json({ error: 'email and name required' });
    if (!TEAM_ROLES.includes(teamRole)) return res.status(400).json({ error: 'Invalid team role' });
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
           password_salt=$4, password_hash=$5, team_role=$6, updated_at=NOW() WHERE email=$7 RETURNING *`,
          [name, inviteToken, expiresAt, salt, hash, teamRole, email.toLowerCase()]
        );
        member = rows[0];
      } else {
        const rows = await queryDb(
          `INSERT INTO ${TABLE} (email, name, password_salt, password_hash, status, invite_token, invite_expires_at, team_role)
           VALUES ($1,$2,$3,$4,'invited',$5,$6,$7) RETURNING *`,
          [email.toLowerCase(), name, salt, hash, inviteToken, expiresAt, teamRole]
        );
        member = rows[0];
      }

      let emailError = null;
      try {
        await sendInviteEmail(email, name, inviteToken, teamRole);
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
    const { id, status, teamRole, permissions, allowedRepos } = req.body || {};
    if (!id || (!status && !teamRole && permissions === undefined && allowedRepos === undefined)) return res.status(400).json({ error: 'id and status, teamRole, permissions or allowedRepos required' });
    if (permissions !== undefined && (!Array.isArray(permissions) || permissions.some((x) => !ALL_PERMS.includes(x))))
      return res.status(400).json({ error: 'Invalid permissions' });
    if (allowedRepos !== undefined && !Array.isArray(allowedRepos))
      return res.status(400).json({ error: 'allowedRepos must be an array of owner/repo names' });
    if (status && !['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (teamRole && !TEAM_ROLES.includes(teamRole)) return res.status(400).json({ error: 'Invalid team role' });
    try {
      const rows = await queryDb(
        `UPDATE ${TABLE} SET status=COALESCE($1,status), team_role=COALESCE($2,team_role),
           permissions=CASE WHEN $3::text IS NULL THEN permissions ELSE $3 END,
           allowed_repos=CASE WHEN $4::text IS NULL THEN allowed_repos ELSE $4 END, updated_at=NOW()
         WHERE id=$5 RETURNING id, email, name, status, team_role, permissions, allowed_repos`,
        [status || null, teamRole || null, permissions === undefined ? null : permissions.join(','),
         allowedRepos === undefined ? null : allowedRepos.join(','), id]
      );
      await logAudit('admin', 'admin', 'team_member_status_changed', rows[0]?.email, { status });
      if (status === 'inactive') await revokeMember(id);      // instant lockout
      if (status === 'active') await unrevokeMember(id);
      // Instant propagation: the member's open portal refetches perms/tabs/repos live
      if (rows[0]?.email) broadcastToEmails([rows[0].email], { type: 'perms_updated' });
      return res.status(200).json({ member: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE — remove member (admin only)
  if (req.method === 'DELETE') {
    if (!admin) return res.status(403).json({ error: 'Admin only' });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      await queryDb(`DELETE FROM ${TABLE} WHERE id=$1`, [id]);
      await revokeMember(id);                                 // instant lockout
      await logAudit('admin', 'admin', 'team_member_removed', String(id));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
