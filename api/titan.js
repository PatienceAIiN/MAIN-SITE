// Titan Mail (GoDaddy) integration for the Growth portal. Titan has no OAuth
// REST API, so we connect over IMAP (read) + SMTP (send) using the mailbox
// email + password the user signs in with. The password is encrypted at rest
// (AES-256-GCM). Mirrors the Gmail handler's shape so the Mail UI is unified.
import crypto from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { queryDb, isMissingTableError } from './_db.js';
import { getMemberSession } from './_security.js';

const IMAP = { host: 'imap.titan.email', port: 993, secure: true };
const SMTP = { host: 'smtp.titan.email', port: 465, secure: true };

const keyOf = () => crypto.createHash('sha256').update(process.env.MAIL_ENC_KEY || process.env.ADMIN_SESSION_SECRET || 'mail-dev-key').digest();
const enc = (text) => { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', keyOf(), iv); const e = Buffer.concat([c.update(String(text), 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), e]).toString('base64'); };
const dec = (b64) => { const b = Buffer.from(b64, 'base64'); const d = crypto.createDecipheriv('aes-256-gcm', keyOf(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); };

const accountFor = async (email) => {
  const [a] = await queryDb(`SELECT * FROM titan_accounts WHERE owner_email=$1 LIMIT 1`, [email]).catch(() => []);
  if (!a) return null;
  return { email: a.mail_email, password: dec(a.enc_password) };
};

const newClient = (acc) => new ImapFlow({ ...IMAP, auth: { user: acc.email, pass: acc.password }, logger: false, emitLogs: false });
const withImap = async (acc, fn) => { const c = newClient(acc); await c.connect(); try { return await fn(c); } finally { await c.logout().catch(() => {}); } };

// Resolve a logical folder (INBOX/Sent/Drafts/Junk/Trash) to the server's path.
const folderPath = async (client, logical) => {
  if (logical === 'INBOX') return 'INBOX';
  const want = { Sent: '\\Sent', Drafts: '\\Drafts', Junk: '\\Junk', Trash: '\\Trash' }[logical];
  const list = await client.list();
  const byUse = want && list.find((m) => m.specialUse === want);
  if (byUse) return byUse.path;
  const byName = list.find((m) => m.path.toLowerCase() === logical.toLowerCase() || m.name.toLowerCase() === logical.toLowerCase());
  return byName ? byName.path : logical;
};
const FOLDERS = ['INBOX', 'Sent', 'Drafts', 'Junk', 'Trash'];

const addrStr = (a) => (a?.value || []).map((x) => x.name ? `${x.name} <${x.address}>` : x.address).join(', ') || a?.text || '';

export default async function handler(req, res) {
  const me = getMemberSession(req);
  if (!me) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      if (req.query.status === '1') {
        const [a] = await queryDb(`SELECT mail_email FROM titan_accounts WHERE owner_email=$1 LIMIT 1`, [me.email]).catch(() => []);
        return res.status(200).json({ provider: 'titan', configured: true, connected: Boolean(a), email: a?.mail_email || null });
      }
      const acc = await accountFor(me.email);
      if (!acc) return res.status(200).json({ connected: false, messages: [] });

      if (req.query.list === '1') {
        const logical = FOLDERS.includes(req.query.label) ? req.query.label : 'INBOX';
        const offset = parseInt(req.query.offset, 10) || 0;
        const q = (req.query.q || '').toString().slice(0, 200);
        const out = await withImap(acc, async (client) => {
          const path = await folderPath(client, logical);
          const lock = await client.getMailboxLock(path);
          try {
            const PAGE = 25;
            let uids = null;
            let totalCount = 0;
            if (q) {
              const found = await client.search({ or: [{ subject: q }, { from: q }, { to: q }, { body: q }] }, { uid: true });
              uids = (found || []).slice().reverse().slice(offset, offset + PAGE);
            } else {
              const st = await client.status(path, { messages: true });
              totalCount = st.messages || 0;
            }
            const byUid = Boolean(uids);
            const range = byUid ? (uids.length ? uids.join(',') : null)
              : (() => { const end = totalCount - offset; const start = Math.max(1, end - PAGE + 1); return end > 0 ? `${start}:${end}` : null; })();
            const collected = [];
            const messages = [];
            if (range) {
              for await (const m of client.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: byUid })) collected.push(m);
              collected.reverse();
              for (const m of collected) {
                const env = m.envelope || {};
                messages.push({
                  id: String(m.uid), from: addrStr({ value: env.from }), to: addrStr({ value: env.to }),
                  subject: env.subject || '', snippet: '', date: (env.date || m.internalDate || '').toString(),
                  unread: !(m.flags && m.flags.has('\\Seen')), starred: Boolean(m.flags && m.flags.has('\\Flagged')),
                });
              }
            }
            const more = byUid ? (uids.length === PAGE) : (totalCount - offset - PAGE) > 0;
            return { messages, nextOffset: more ? offset + PAGE : null };
          } finally { lock.release(); }
        });
        return res.status(200).json({ connected: true, label: logical, messages: out.messages, nextPageToken: out.nextOffset != null ? String(out.nextOffset) : null });
      }

      if (req.query.msg) {
        const logical = FOLDERS.includes(req.query.label) ? req.query.label : 'INBOX';
        const uid = String(req.query.msg);
        const parsed = await withImap(acc, async (client) => {
          const path = await folderPath(client, logical);
          const lock = await client.getMailboxLock(path);
          try {
            const m = await client.fetchOne(uid, { source: true }, { uid: true });
            return await simpleParser(m.source);
          } finally { lock.release(); }
        });
        return res.status(200).json({
          id: uid, from: addrStr(parsed.from), to: addrStr(parsed.to), cc: addrStr(parsed.cc),
          subject: parsed.subject || '', date: (parsed.date || '').toString(),
          html: parsed.html || null, text: parsed.text || null,
          attachments: (parsed.attachments || []).map((a, i) => ({ idx: i, filename: a.filename || `attachment-${i}`, mimeType: a.contentType, size: a.size })),
        });
      }

      if (req.query.attach && req.query.idx != null) {
        const logical = FOLDERS.includes(req.query.label) ? req.query.label : 'INBOX';
        const idx = parseInt(req.query.idx, 10);
        const data = await withImap(acc, async (client) => {
          const path = await folderPath(client, logical);
          const lock = await client.getMailboxLock(path);
          try {
            const m = await client.fetchOne(String(req.query.attach), { source: true }, { uid: true });
            const parsed = await simpleParser(m.source);
            const a = (parsed.attachments || [])[idx];
            return a ? a.content.toString('base64') : null;
          } finally { lock.release(); }
        });
        return res.status(200).json({ data, std: true }); // std base64 (not url-safe)
      }
      return res.status(400).json({ error: 'Unknown query' });
    }

    if (req.method === 'POST') {
      const b = req.body || {};

      if (b.action === 'connect') {
        const email = String(b.email || '').trim().toLowerCase();
        const password = String(b.password || '');
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        // Verify the credentials by opening an IMAP session before storing.
        try { await withImap({ email, password }, async (c) => c.mailboxOpen('INBOX')); }
        catch { return res.status(401).json({ error: 'Could not sign in to Titan — check the email and password.' }); }
        await queryDb(
          `INSERT INTO titan_accounts (owner_email, mail_email, enc_password) VALUES ($1,$2,$3)
           ON CONFLICT (owner_email) DO UPDATE SET mail_email=$2, enc_password=$3, updated_at=now()`,
          [me.email, email, enc(password)]
        );
        return res.status(200).json({ ok: true, email });
      }
      if (b.action === 'disconnect') { await queryDb(`DELETE FROM titan_accounts WHERE owner_email=$1`, [me.email]); return res.status(200).json({ ok: true }); }

      const acc = await accountFor(me.email);
      if (!acc) return res.status(400).json({ error: 'Titan not connected' });
      const ids = Array.isArray(b.ids) && b.ids.length ? b.ids.map(String) : (b.id != null ? [String(b.id)] : []);
      const logical = FOLDERS.includes(b.label) ? b.label : 'INBOX';

      if (b.action === 'send' || b.action === 'draft') {
        const mailOptions = {
          from: acc.email, to: b.to, cc: b.cc || undefined, subject: b.subject || '(no subject)', html: b.body || '',
          attachments: (b.attachments || []).map((a) => ({ filename: a.filename, content: Buffer.from(a.dataBase64 || '', 'base64'), contentType: a.mimeType })),
        };
        const raw = await new Promise((resolve, reject) => new MailComposer(mailOptions).compile().build((e, m) => e ? reject(e) : resolve(m)));
        if (b.action === 'send') {
          const t = nodemailer.createTransport({ ...SMTP, auth: { user: acc.email, pass: acc.password } });
          await t.sendMail(mailOptions);
          await withImap(acc, async (c) => { const p = await folderPath(c, 'Sent'); await c.append(p, raw, ['\\Seen']).catch(() => {}); });
        } else {
          await withImap(acc, async (c) => { const p = await folderPath(c, 'Drafts'); await c.append(p, raw, ['\\Draft']); });
        }
        return res.status(200).json({ ok: true });
      }

      if (!ids.length) return res.status(400).json({ error: 'id(s) required' });
      await withImap(acc, async (client) => {
        const path = await folderPath(client, logical);
        const lock = await client.getMailboxLock(path);
        try {
          if (b.action === 'markRead') await client.messageFlagsAdd(ids, ['\\Seen'], { uid: true });
          else if (b.action === 'markUnread') await client.messageFlagsRemove(ids, ['\\Seen'], { uid: true });
          else if (b.action === 'star') await client.messageFlagsAdd(ids, ['\\Flagged'], { uid: true });
          else if (b.action === 'unstar') await client.messageFlagsRemove(ids, ['\\Flagged'], { uid: true });
          else if (b.action === 'trash' || b.action === 'delete') {
            if (logical === 'Trash') await client.messageDelete(ids, { uid: true });
            else { const tp = await folderPath(client, 'Trash'); await client.messageMove(ids, tp, { uid: true }); }
          }
        } finally { lock.release(); }
      });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    if (isMissingTableError(e.message)) return res.status(200).json({ connected: false, messages: [] });
    return res.status(500).json({ error: e.message });
  }
}
