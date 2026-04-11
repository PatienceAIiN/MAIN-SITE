import crypto from 'node:crypto';
import {
  createSessionToken,
  getCookieValue,
  serializeCookie,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from './_security.js';

const getJsonBody = (req) => req.body || {};

const secureEqual = (left = '', right = '') => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const setAuthCookie = (res, token) => {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE_NAME, token, {
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === 'production'
    })
  );
};

const clearAuthCookie = (res) => {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE_NAME, '', {
      maxAge: 0,
      secure: process.env.NODE_ENV === 'production'
    })
  );
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const token = getCookieValue(req, SESSION_COOKIE_NAME);
    const session = verifySessionToken(token);

    if (!session) {
      return res.status(200).json({ authenticated: false });
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        username: session.username
      }
    });
  }

  if (req.method === 'POST') {
    const { username, password } = getJsonBody(req);
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!adminUser || !adminPass) {
      return res.status(500).json({ error: 'Admin credentials are not configured in environment variables' });
    }

    if (!secureEqual(username, adminUser) || !secureEqual(password, adminPass)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createSessionToken({ username: adminUser });
    setAuthCookie(res, token);
    return res.status(200).json({ authenticated: true, user: { username: adminUser } });
  }

  if (req.method === 'DELETE') {
    clearAuthCookie(res);
    return res.status(200).json({ authenticated: false });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
