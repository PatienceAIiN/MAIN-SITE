import crypto from 'node:crypto';
import { queryDb } from './_db.js';
import {
  createSessionToken,
  getCookieValue,
  hashPassword,
  serializeCookie,
  verifyPassword,
  verifySessionToken
} from './_security.js';

const COOKIE_NAME = 'pa_support_session';
const EXPIRE_SECONDS = 60 * 60 * 24 * 7;

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const validEmail = (email = '') => /^[^\s@]+@patienceai\.in$/i.test(String(email).trim());

const setCookie = (res, token) => {
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, token, {
    maxAge: EXPIRE_SECONDS,
    secure: process.env.NODE_ENV === 'production'
  }));
};

const clearCookie = (res) => {
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', {
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production'
  }));
};

export const requireSupport = (req) => {
  const token = getCookieValue(req, COOKIE_NAME);
  const session = verifySessionToken(token);
  if (!session || session.role !== 'support') return null;
  return session;
};

export default async function supportAuthHandler(req, res) {
  if (req.method === 'GET') {
    const session = requireSupport(req);
    if (!session) return res.status(200).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, user: { email: session.email, role: session.role } });
  }

  if (req.method === 'DELETE') {
    clearCookie(res);
    return res.status(200).json({ authenticated: false });
  }

  if (req.method === 'POST') {
    const { email, password, inviteToken } = req.body || {};

    if (inviteToken) {
      if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
      if (!validEmail(email)) return res.status(400).json({ error: 'Only @patienceai.in email is allowed' });
      if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const rows = await queryDb('SELECT * FROM public.support_executives WHERE email = $1 LIMIT 1', [String(email).trim().toLowerCase()]);
      const executive = rows[0];
      if (!executive || !executive.invite_token_hash) return res.status(404).json({ error: 'Invite not found' });
      if (executive.invite_token_hash !== hashToken(inviteToken)) return res.status(401).json({ error: 'Invalid invite token' });
      if (!executive.invite_sent_at || (Date.now() - new Date(executive.invite_sent_at).getTime()) > 48 * 60 * 60 * 1000) {
        return res.status(401).json({ error: 'Invite expired. Ask admin to resend invite.' });
      }

      const { salt, hash } = hashPassword(password);
      await queryDb(
        `UPDATE public.support_executives
         SET password_salt = $1, password_hash = $2, invite_token_hash = NULL, invite_accepted_at = NOW(), status = 'active', updated_at = NOW()
         WHERE id = $3`,
        [salt, hash, executive.id]
      );

      const token = createSessionToken({ email: executive.email, role: 'support' });
      setCookie(res, token);
      return res.status(200).json({ authenticated: true, accepted: true, user: { email: executive.email, role: 'support' } });
    }

    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    if (!validEmail(email)) return res.status(400).json({ error: 'Only @patienceai.in email is allowed' });

    const rows = await queryDb('SELECT * FROM public.support_executives WHERE email = $1 LIMIT 1', [String(email).trim().toLowerCase()]);
    const executive = rows[0];
    if (!executive || !executive.password_hash || executive.status === 'disabled') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = verifyPassword(password, executive.password_salt, executive.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    await queryDb('UPDATE public.support_executives SET status = $1, updated_at = NOW() WHERE id = $2', ['active', executive.id]);

    const token = createSessionToken({ email: executive.email, role: 'support' });
    setCookie(res, token);
    return res.status(200).json({ authenticated: true, user: { email: executive.email, role: 'support' } });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
