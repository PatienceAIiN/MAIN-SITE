import crypto from 'node:crypto';
import { queryDb } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';
import { sendInviteMail } from './_mailer.js';

const requireAdmin = (req) => verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME));
const validEmail = (email = '') => /^[^\s@]+@patienceai\.in$/i.test(String(email).trim());
const toHash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const normalizeBaseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const inferBaseFromRequest = (req) => {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').trim();
  if (!host) return '';
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim() || 'https';
  return `${proto}://${host}`;
};

const buildInviteLink = (req, email, token) => {
  const baseCandidate = normalizeBaseUrl(process.env.SITE_URL)
    || normalizeBaseUrl(process.env.PUBLIC_SITE_URL)
    || normalizeBaseUrl(process.env.RENDER_EXTERNAL_URL)
    || inferBaseFromRequest(req)
    || 'http://localhost:3000';
  const url = new URL('/support/accept-invite', baseCandidate);
  url.searchParams.set('email', email);
  url.searchParams.set('token', token);
  return url.toString();
};

const sendInvite = async ({ req, email, adminName }) => {
  const token = crypto.randomBytes(24).toString('hex');
  const inviteTokenHash = toHash(token);
  await queryDb(
    `UPDATE public.support_executives
     SET invite_token_hash = $1, invite_sent_at = NOW(), status = 'invited', updated_at = NOW()
     WHERE email = $2`,
    [inviteTokenHash, email]
  );

  const inviteLink = buildInviteLink(req, email, token);
  await sendInviteMail({ to: email, inviteLink, invitedBy: adminName });
};

const formatInviteError = (error) => {
  const message = String(error?.message || '').trim();
  if (!message) {
    return 'Invite email could not be sent right now. You can resend it later from Admin.';
  }
  if (/SMTP is not configured/i.test(message)) {
    return 'Support executive was added, but SMTP is not configured so invite email was not sent.';
  }
  return `Support executive was added, but invite email failed: ${message}`;
};

export default async function supportExecutivesHandler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const rows = await queryDb(
      `SELECT id, email, status, display_name, invite_sent_at, invite_accepted_at, created_at, updated_at
       FROM public.support_executives
       ORDER BY created_at DESC`
    );

    const summary = rows.reduce((acc, row) => {
      if (row.status === 'active') acc.active += 1;
      else if (row.status === 'invited') acc.invited += 1;
      else if (row.status === 'accepted') acc.accepted += 1;
      return acc;
    }, { active: 0, invited: 0, accepted: 0, total: rows.length });

    return res.status(200).json({ items: rows, summary });
  }

  if (req.method === 'POST') {
    const { email, displayName } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    if (!validEmail(normalized)) {
      return res.status(400).json({ error: 'Only @patienceai.in support emails are allowed' });
    }

    await queryDb(
      `INSERT INTO public.support_executives (email, display_name, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (email)
       DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()`,
      [normalized, displayName || null, admin.username || 'admin']
    );

    try {
      await sendInvite({ req, email: normalized, adminName: admin.username || 'admin' });
      return res.status(200).json({ ok: true, message: 'Invite sent' });
    } catch (error) {
      return res.status(200).json({
        ok: true,
        inviteSent: false,
        warning: formatInviteError(error)
      });
    }
  }

  if (req.method === 'PATCH') {
    const { id, action, displayName, status } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    if (action === 'resendInvite') {
      const rows = await queryDb('SELECT email FROM public.support_executives WHERE id = $1 LIMIT 1', [id]);
      if (!rows[0]) return res.status(404).json({ error: 'Support executive not found' });
      try {
        await sendInvite({ req, email: rows[0].email, adminName: admin.username || 'admin' });
        return res.status(200).json({ ok: true, message: 'Invite resent' });
      } catch (error) {
        return res.status(200).json({
          ok: true,
          inviteSent: false,
          warning: formatInviteError(error)
        });
      }
    }

    const updates = [];
    const params = [];
    if (displayName !== undefined) {
      params.push(String(displayName || '').trim() || null);
      updates.push(`display_name = $${params.length}`);
    }
    if (status && ['invited', 'accepted', 'active', 'disabled'].includes(status)) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (!updates.length) {
      return res.status(400).json({ error: 'No supported fields to update' });
    }

    params.push(id);
    const rows = await queryDb(
      `UPDATE public.support_executives SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}
       RETURNING id, email, status, display_name, invite_sent_at, invite_accepted_at, created_at, updated_at`,
      params
    );
    return res.status(200).json({ item: rows[0] || null });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await queryDb('DELETE FROM public.support_executives WHERE id = $1', [id]);
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
