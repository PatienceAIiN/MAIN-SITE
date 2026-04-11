import { getSupabaseAdminClient } from './_supabase.js';
import {
  createSessionToken,
  getCookieValue,
  hashPassword,
  serializeCookie,
  SESSION_COOKIE_NAME,
  verifyPassword,
  verifySessionToken
} from './_security.js';

const TEMP_ADMIN = {
  username: 'admin',
  password: 'admin123'
};

const getJsonBody = (req) => req.body || {};

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

const ensureTempAdmin = async (supabase, username, password) => {
  const { data: existing } = await supabase.from('admin_users').select('*').eq('username', username).maybeSingle();
  if (existing) {
    return existing;
  }

  const { salt, hash } = hashPassword(password);
  const { data, error } = await supabase
    .from('admin_users')
    .insert({
      username,
      password_salt: salt,
      password_hash: hash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export default async function handler(req, res) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase is not configured' });
  }

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

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username === TEMP_ADMIN.username && password === TEMP_ADMIN.password) {
      await ensureTempAdmin(supabase, username, password);
      const token = createSessionToken({ username });
      setAuthCookie(res, token);

      return res.status(200).json({ authenticated: true, user: { username } });
    }

    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createSessionToken({ username: user.username });
    setAuthCookie(res, token);
    return res.status(200).json({ authenticated: true, user: { username: user.username } });
  }

  if (req.method === 'DELETE') {
    clearAuthCookie(res);
    return res.status(200).json({ authenticated: false });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
