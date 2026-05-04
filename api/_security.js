import crypto from 'node:crypto';

const SESSION_COOKIE = 'pa_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const getSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] ADMIN_SESSION_SECRET env var is not set. Set it in Render environment variables immediately.');
    }
    return 'dev-admin-session-secret-change-me';
  }
  return secret;
};

const base64UrlEncode = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const base64UrlDecode = (input) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
};

export const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
};

export const verifyPassword = (password, salt, expectedHash) => {
  const actualHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(actualHash, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

const sign = (value) => crypto.createHmac('sha256', getSecret()).update(value).digest('hex');

export const createSessionToken = (payload) => {
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: Date.now() + SESSION_TTL_SECONDS * 1000
    })
  );
  return `${body}.${sign(body)}`;
};

export const verifySessionToken = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const [body, signature] = token.split('.');
  if (!body || !signature) {
    return null;
  }

  const expected = sign(body);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const getCookieValue = (req, name) => {
  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : null;
};

export const serializeCookie = (name, value, options = {}) => {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  segments.push(`Path=${options.path || '/'}`);
  segments.push(`HttpOnly`);
  segments.push(`SameSite=${options.sameSite || 'Lax'}`);

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  if (options.secure) {
    segments.push('Secure');
  }

  return segments.join('; ');
};

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

// ── Support Executive session ─────────────────────────────────────────────────
const EXEC_SESSION_COOKIE = 'pa_exec_session';

export const EXEC_SESSION_COOKIE_NAME = EXEC_SESSION_COOKIE;

export const createExecSessionToken = (payload) => {
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      role: 'executive',
      exp: Date.now() + SESSION_TTL_SECONDS * 1000
    })
  );
  return `${body}.${sign(body)}`;
};

export const verifyExecSessionToken = (token) => {
  const payload = verifySessionToken(token); // reuse same sig logic
  if (!payload || payload.role !== 'executive') return null;
  return payload;
};

export const getExecSession = (req) => {
  const token = getCookieValue(req, EXEC_SESSION_COOKIE);
  return verifyExecSessionToken(token);
};
