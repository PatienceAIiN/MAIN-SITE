// Gmail integration for the Growth portal. Each Growth user connects their own
// Google account via OAuth2 (authorization-code flow); we store the refresh
// token and proxy the Gmail REST API for inbox/sent/drafts, reading a message,
// sending, drafting, trashing and marking read. No Google SDK — plain fetch.
//
// Required env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Optional GOOGLE_REDIRECT_URI
// (defaults to <site>/api/gmail/callback). Add that redirect URI to the OAuth
// client in Google Cloud Console.
import { queryDb, isMissingTableError } from './_db.js';
import { getMemberSession } from './_security.js';

const SITE = (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://patienceai.in').replace(/\/$/, '');
const REDIRECT = process.env.GOOGLE_REDIRECT_URI || `${SITE}/api/gmail/callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');
const GAPI = 'https://gmail.googleapis.com/gmail/v1/users/me';
const configured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const b64urlEncode = (str) => Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

// ── OAuth ──────────────────────────────────────────────────────────────────
const exchangeCode = async (code) => {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.error || 'Token exchange failed');
  return d; // { access_token, refresh_token, expires_in, ... }
};

const refreshToken = async (refresh) => {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refresh, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.error || 'Token refresh failed');
  return d;
};

// Returns a valid access token for the member, refreshing if expired.
const accessTokenFor = async (email) => {
  const [acc] = await queryDb(`SELECT * FROM gmail_accounts WHERE owner_email=$1 LIMIT 1`, [email]);
  if (!acc) return null;
  const expSoon = !acc.token_expiry || new Date(acc.token_expiry).getTime() < Date.now() + 60000;
  if (!expSoon && acc.access_token) return { token: acc.access_token, account: acc };
  if (!acc.refresh_token) return null;
  const d = await refreshToken(acc.refresh_token);
  const expiry = new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString();
  await queryDb(`UPDATE gmail_accounts SET access_token=$1, token_expiry=$2, updated_at=now() WHERE owner_email=$3`, [d.access_token, expiry, email]);
  return { token: d.access_token, account: { ...acc, access_token: d.access_token } };
};

const gapi = async (token, path, opts = {}) => {
  const r = await fetch(`${GAPI}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error?.message || `Gmail API ${r.status}`), { code: r.status });
  return d;
};

// ── message parsing helpers ──────────────────────────────────────────────────
const header = (headers, name) => (headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
const findPart = (payload, mime) => {
  if (!payload) return null;
  if (payload.mimeType === mime && payload.body?.data) return payload.body.data;
  for (const p of payload.parts || []) { const f = findPart(p, mime); if (f) return f; }
  return null;
};
const collectAttachments = (payload, out = []) => {
  if (!payload) return out;
  if (payload.filename && payload.body?.attachmentId) out.push({ filename: payload.filename, mimeType: payload.mimeType, size: payload.body.size, attachmentId: payload.body.attachmentId });
  (payload.parts || []).forEach((p) => collectAttachments(p, out));
  return out;
};

// ── MIME builder for send / draft (with optional attachments) ───────────────
const buildRaw = ({ to, cc, subject, body, fromEmail, attachments }) => {
  const head = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${subject || '(no subject)'}`,
    'MIME-Version: 1.0',
  ];
  if (!attachments?.length) {
    return b64urlEncode([...head, 'Content-Type: text/html; charset="UTF-8"', '', body || ''].join('\r\n'));
  }
  const boundary = `pa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const parts = [
    `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', '', body || '', '',
    ...attachments.flatMap((a) => [
      `--${boundary}`,
      `Content-Type: ${a.mimeType || 'application/octet-stream'}; name="${a.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${a.filename}"`,
      '',
      String(a.dataBase64 || '').replace(/[\r\n]/g, '').replace(/(.{76})/g, '$1\r\n'),
      '',
    ]),
    `--${boundary}--`, '',
  ];
  return b64urlEncode([...head, `Content-Type: multipart/mixed; boundary="${boundary}"`, '', ...parts].join('\r\n'));
};

// Parse a Gmail message resource into our flat shape.
const parseMessage = (full) => {
  const h = full.payload?.headers || [];
  const html = findPart(full.payload, 'text/html');
  const text = findPart(full.payload, 'text/plain');
  return {
    id: full.id, threadId: full.threadId,
    from: header(h, 'From'), to: header(h, 'To'), cc: header(h, 'Cc'), subject: header(h, 'Subject'), date: header(h, 'Date'),
    html: html ? b64urlDecode(html) : null, text: text ? b64urlDecode(text) : null,
    attachments: collectAttachments(full.payload),
    unread: (full.labelIds || []).includes('UNREAD'),
    starred: (full.labelIds || []).includes('STARRED'),
    labelIds: full.labelIds || [],
  };
};

const okRedirect = (res, status) => { res.statusCode = 302; res.setHeader('Location', `${SITE}/growth?mail=${status}`); res.end(); };

export default async function handler(req, res) {
  const path = (req.path || req.url.split('?')[0]);

  // ── OAuth callback (browser redirect from Google; uses the session cookie) ──
  if (path.endsWith('/callback')) {
    const me = getMemberSession(req);
    const code = req.query.code;
    if (!me) return okRedirect(res, 'error');
    if (!code) return okRedirect(res, 'cancelled');
    try {
      const tok = await exchangeCode(code);
      const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json()).catch(() => ({}));
      const expiry = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
      await queryDb(
        `INSERT INTO gmail_accounts (owner_email, google_email, access_token, refresh_token, token_expiry)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (owner_email) DO UPDATE SET google_email=$2, access_token=$3,
           refresh_token=COALESCE($4, gmail_accounts.refresh_token), token_expiry=$5, updated_at=now()`,
        [me.email, ui.email || null, tok.access_token, tok.refresh_token || null, expiry]
      );
      return okRedirect(res, 'connected');
    } catch (e) {
      console.error('[gmail callback]', e.message);
      return okRedirect(res, 'error');
    }
  }

  const me = getMemberSession(req);
  if (!me) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      if (req.query.status === '1') {
        const [acc] = await queryDb(`SELECT google_email FROM gmail_accounts WHERE owner_email=$1 LIMIT 1`, [me.email]).catch(() => []);
        return res.status(200).json({ configured: configured(), connected: Boolean(acc), email: acc?.google_email || null });
      }
      if (req.query.authurl === '1') {
        if (!configured()) return res.status(503).json({ error: 'Gmail is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
        const url = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code',
          scope: SCOPES, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
        });
        return res.status(200).json({ url });
      }

      const at = await accessTokenFor(me.email);
      if (!at) return res.status(200).json({ connected: false, messages: [] });

      // User-created labels (for the sidebar + the message label picker).
      if (req.query.labels === '1') {
        const d = await gapi(at.token, '/labels');
        return res.status(200).json({ labels: (d.labels || []).filter((l) => l.type === 'user').map((l) => ({ id: l.id, name: l.name })) });
      }

      // List a folder (system label or user label id) with optional search query.
      if (req.query.list === '1') {
        const label = String(req.query.label || 'INBOX').replace(/[^A-Za-z0-9_]/g, '') || 'INBOX';
        if (label === 'DRAFT') {
          const d = await gapi(at.token, `/drafts?maxResults=25${req.query.pageToken ? `&pageToken=${req.query.pageToken}` : ''}`);
          const drafts = await Promise.all((d.drafts || []).map(async (dr) => {
            const full = await gapi(at.token, `/drafts/${dr.id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null);
            const h = full?.message?.payload?.headers || [];
            return { draftId: dr.id, id: full?.message?.id, threadId: full?.message?.threadId, to: header(h, 'To'), subject: header(h, 'Subject'), snippet: full?.message?.snippet || '', date: header(h, 'Date') };
          }));
          return res.status(200).json({ connected: true, label, messages: drafts, nextPageToken: d.nextPageToken || null });
        }
        const q = (req.query.q || '').toString().slice(0, 200);
        const listed = await gapi(at.token, `/messages?labelIds=${label}&maxResults=25${q ? `&q=${encodeURIComponent(q)}` : ''}${req.query.pageToken ? `&pageToken=${req.query.pageToken}` : ''}`);
        const msgs = await Promise.all((listed.messages || []).map(async (m) => {
          const full = await gapi(at.token, `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null);
          const h = full?.payload?.headers || [];
          return { id: m.id, threadId: m.threadId, from: header(h, 'From'), to: header(h, 'To'), subject: header(h, 'Subject'), snippet: full?.snippet || '', date: header(h, 'Date'), unread: (full?.labelIds || []).includes('UNREAD') };
        }));
        return res.status(200).json({ connected: true, label, messages: msgs, nextPageToken: listed.nextPageToken || null });
      }

      // Read one message in full.
      if (req.query.msg) {
        const full = await gapi(at.token, `/messages/${req.query.msg}?format=full`);
        return res.status(200).json(parseMessage(full));
      }

      // Read a whole conversation thread (all messages).
      if (req.query.thread) {
        const t = await gapi(at.token, `/threads/${req.query.thread}?format=full`);
        return res.status(200).json({ messages: (t.messages || []).map(parseMessage) });
      }

      // Download an attachment (base64).
      if (req.query.attach && req.query.att) {
        const a = await gapi(at.token, `/messages/${req.query.attach}/attachments/${req.query.att}`);
        return res.status(200).json({ data: a.data });
      }
      return res.status(400).json({ error: 'Unknown query' });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.action === 'disconnect') { await queryDb(`DELETE FROM gmail_accounts WHERE owner_email=$1`, [me.email]); return res.status(200).json({ ok: true }); }

      const at = await accessTokenFor(me.email);
      if (!at) return res.status(400).json({ error: 'Gmail not connected' });
      const fromEmail = at.account.google_email || me.email;

      if (b.action === 'send') {
        const raw = buildRaw({ to: b.to, cc: b.cc, subject: b.subject, body: b.body, fromEmail, attachments: b.attachments });
        const sent = await gapi(at.token, '/messages/send', { method: 'POST', body: JSON.stringify({ raw, ...(b.threadId ? { threadId: b.threadId } : {}) }) });
        if (b.draftId) await gapi(at.token, `/drafts/${b.draftId}`, { method: 'DELETE' }).catch(() => {});
        return res.status(200).json({ ok: true, id: sent.id });
      }
      if (b.action === 'draft') {
        const raw = buildRaw({ to: b.to, cc: b.cc, subject: b.subject, body: b.body, fromEmail, attachments: b.attachments });
        const payload = { message: { raw, ...(b.threadId ? { threadId: b.threadId } : {}) } };
        const d = b.id
          ? await gapi(at.token, `/drafts/${b.id}`, { method: 'PUT', body: JSON.stringify(payload) })
          : await gapi(at.token, '/drafts', { method: 'POST', body: JSON.stringify(payload) });
        return res.status(200).json({ ok: true, draftId: d.id });
      }
      if (b.action === 'trash') { await gapi(at.token, `/messages/${b.id}/trash`, { method: 'POST', body: '{}' }); return res.status(200).json({ ok: true }); }
      if (b.action === 'deleteDraft') { await gapi(at.token, `/drafts/${b.id}`, { method: 'DELETE' }); return res.status(200).json({ ok: true }); }
      if (b.action === 'markRead' || b.action === 'markUnread') {
        const mod = b.action === 'markRead' ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] };
        await gapi(at.token, `/messages/${b.id}/modify`, { method: 'POST', body: JSON.stringify(mod) });
        return res.status(200).json({ ok: true });
      }
      // Apply / remove labels (incl. STARRED) on a message.
      if (b.action === 'modifyLabels') {
        const clean = (a) => (Array.isArray(a) ? a : []).map((x) => String(x).replace(/[^A-Za-z0-9_]/g, '')).filter(Boolean);
        await gapi(at.token, `/messages/${b.id}/modify`, { method: 'POST', body: JSON.stringify({ addLabelIds: clean(b.add), removeLabelIds: clean(b.remove) }) });
        return res.status(200).json({ ok: true });
      }
      if (b.action === 'createLabel') {
        if (!b.name?.trim()) return res.status(400).json({ error: 'Label name required' });
        const l = await gapi(at.token, '/labels', { method: 'POST', body: JSON.stringify({ name: String(b.name).slice(0, 100), labelListVisibility: 'labelShow', messageListVisibility: 'show' }) });
        return res.status(200).json({ label: { id: l.id, name: l.name } });
      }
      if (b.action === 'deleteLabel') {
        await gapi(at.token, `/labels/${String(b.id).replace(/[^A-Za-z0-9_]/g, '')}`, { method: 'DELETE' });
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    if (isMissingTableError(e.message)) return res.status(200).json({ connected: false, messages: [] });
    return res.status(e.code === 401 ? 401 : 500).json({ error: e.message });
  }
}
