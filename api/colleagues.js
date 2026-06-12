// Colleague chat for team members: searchable roster with live presence,
// 1:1 + group chats (create / update / delete), message history with
// pagination and edit/delete, web-push subscriptions and the per-member
// notification toggle.
import { queryDb, isMissingTableError } from './_db.js';
import { getMemberSession, getExecSession } from './_security.js';
import { presenceSnapshot, broadcastToEmails, hasActiveSocket } from './_teamhub.js';
import { getVapidPublicKey, sendPushToEmails } from './_push.js';
import { resolvePerms } from './team-members.js';

// Group create/edit/delete is roster management — gated on the roster_manage
// permission. Support executives manage the support roster; team members need
// the explicit grant. (1:1 DMs are open to everyone.)
const canManageRoster = async (req, me) => {
  if (!getMemberSession(req) && getExecSession(req)) return true;
  const rows = await queryDb(`SELECT team_role, permissions FROM team_members WHERE email=$1 LIMIT 1`, [me.email]).catch(() => []);
  return resolvePerms(rows[0]).includes('roster_manage');
};

const chatMembers = (chat) => String(chat.members || '').split(',').map((x) => x.trim()).filter(Boolean);
const inChat = (chat, email) => chatMembers(chat).includes(email);

const loadChat = async (id) => (await queryDb(`SELECT * FROM team_chats WHERE id=$1 LIMIT 1`, [id]))[0] || null;

const notifyChat = (chat, payload) => broadcastToEmails(chatMembers(chat), payload);

export default async function handler(req, res) {
  // Team members and support executives are both first-class participants —
  // they share the same roster, chats, groups and calls (cross-side enabled).
  const me = getMemberSession(req) || getExecSession(req);
  if (!me) return res.status(401).json({ error: 'Not authenticated' });
  const myEmail = me.email;

  try {
    // ── POST /api/colleagues/upload?chatId=&fileName= — raw body ≤10 MB ─────
    if (req.method === 'POST' && req.url?.includes('/upload')) {
      const chatId = parseInt(req.query.chatId, 10);
      const fileName = String(req.query.fileName || 'file').slice(0, 200);
      const contentType = req.headers['content-type'] || 'application/octet-stream';
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'Empty file' });
      const chat = await loadChat(chatId);
      if (!chat || !inChat(chat, myEmail)) return res.status(404).json({ error: 'Chat not found' });
      const [msg] = await queryDb(
        `INSERT INTO team_chat_messages (chat_id, sender_email, sender_name, message, file_name, file_type, file_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [chat.id, myEmail, me.name, fileName, fileName, contentType, buf.length]);
      await queryDb(`INSERT INTO team_chat_files (message_id, data_base64) VALUES ($1,$2)`,
        [msg.id, buf.toString('base64')]);
      notifyChat(chat, { type: 'chat', event: 'new', chatId: chat.id, message: msg });
      sendPushToEmails(chatMembers(chat).filter((e) => e !== myEmail && !hasActiveSocket(e)), {
        title: chat.kind === 'group' ? `${me.name} · ${chat.name || 'Group'}` : `${me.name}`,
        body: `📎 ${fileName}`, url: '/team', tag: `chat-${chat.id}`
      });
      return res.status(200).json({ message: msg });
    }

    if (req.method === 'GET') {
      // VAPID public key for the browser's PushManager
      if (req.query.vapid === '1') return res.status(200).json({ key: getVapidPublicKey() });

      // Stream a chat file (membership-checked)
      if (req.query.file) {
        const [msg] = await queryDb(`SELECT * FROM team_chat_messages WHERE id=$1 LIMIT 1`, [parseInt(req.query.file, 10)]);
        const chat = msg && await loadChat(msg.chat_id);
        if (!msg?.file_name || msg.deleted || !chat || !inChat(chat, myEmail)) return res.status(404).json({ error: 'File not found' });
        const [f] = await queryDb(`SELECT data_base64 FROM team_chat_files WHERE message_id=$1 LIMIT 1`, [msg.id]);
        if (!f) return res.status(404).json({ error: 'File not found' });
        // XSS guard: never render active content (html/svg/xml/js) on our origin
        const unsafe = /html|svg|xml|javascript|xhtml/i.test(msg.file_type || '');
        res.setHeader('Content-Type', unsafe ? 'application/octet-stream' : (msg.file_type || 'application/octet-stream'));
        res.setHeader('Content-Disposition', `${(req.query.download || unsafe) ? 'attachment' : 'inline'}; filename="${encodeURIComponent(msg.file_name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        // The chat file-preview modal renders this in a same-origin <iframe>. The
        // global X-Frame-Options: DENY / CSP frame-ancestors 'none' would block it,
        // so allow same-origin framing for this response only (unsafe active types
        // are already forced to an octet-stream attachment above).
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
        return res.status(200).send(Buffer.from(f.data_base64, 'base64'));
      }

      // Colleague roster + presence — team members ∪ support executives
      if (req.query.list === '1') {
        const rows = await queryDb(
          `SELECT email, name, team_role, last_seen_at FROM team_members WHERE status='active'
           UNION ALL
           SELECT email, name, 'support_executive' AS team_role, last_seen_at FROM support_executives WHERE status='active'
           ORDER BY name ASC`
        );
        const presence = presenceSnapshot();
        return res.status(200).json({
          colleagues: rows.filter((r) => r.email !== myEmail).map((r) => ({
            ...r,
            // Which portal this colleague belongs to, so the UI can list Team and
            // Support people in separate groups instead of one mixed roster.
            side: r.team_role === 'support_executive' ? 'support' : 'team',
            presence: presence[r.email] || 'offline'
          })),
          presence
        });
      }

      // My chats with last message preview
      if (req.query.chats === '1') {
        const rows = await queryDb(
          `SELECT c.*, m.message AS last_message, m.sender_name AS last_sender, m.deleted AS last_deleted, m.created_at AS last_at
           FROM team_chats c
           LEFT JOIN LATERAL (
             SELECT message, sender_name, deleted, created_at FROM team_chat_messages
             WHERE chat_id = c.id ORDER BY id DESC LIMIT 1
           ) m ON true
           WHERE ',' || c.members || ',' LIKE $1
           ORDER BY COALESCE(m.created_at, c.updated_at) DESC`,
          [`%,${myEmail},%`]
        );
        return res.status(200).json({ chats: rows.map((c) => ({ ...c, member_list: chatMembers(c) })) });
      }

      // Message history, newest-first pagination with ?before=<id>
      if (req.query.messages) {
        const chat = await loadChat(parseInt(req.query.messages, 10));
        if (!chat || !inChat(chat, myEmail)) return res.status(404).json({ error: 'Chat not found' });
        const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
        const before = parseInt(req.query.before, 10);
        const rows = Number.isFinite(before)
          ? await queryDb(`SELECT * FROM team_chat_messages WHERE chat_id=$1 AND id < $2 ORDER BY id DESC LIMIT ${limit}`, [chat.id, before])
          : await queryDb(`SELECT * FROM team_chat_messages WHERE chat_id=$1 ORDER BY id DESC LIMIT ${limit}`, [chat.id]);
        return res.status(200).json({ messages: rows.reverse(), hasMore: rows.length === limit });
      }

      return res.status(400).json({ error: 'Unknown query' });
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};

      if (action === 'create_chat') {
        const { kind = 'dm', memberEmails = [], name } = req.body;
        const valid = await queryDb(
          `SELECT email FROM team_members WHERE status='active' AND email = ANY(string_to_array($1, ','))
           UNION
           SELECT email FROM support_executives WHERE status='active' AND email = ANY(string_to_array($1, ','))`,
          [memberEmails.join(',')]
        );
        const others = valid.map((r) => r.email).filter((e) => e !== myEmail);
        if (!others.length) return res.status(400).json({ error: 'Pick at least one colleague' });
        if (kind === 'dm') {
          const members = [myEmail, others[0]].sort().join(',');
          const existing = await queryDb(`SELECT * FROM team_chats WHERE kind='dm' AND members=$1 LIMIT 1`, [members]);
          if (existing.length) return res.status(200).json({ chat: existing[0], existing: true });
          const rows = await queryDb(
            `INSERT INTO team_chats (kind, members, created_by) VALUES ('dm',$1,$2) RETURNING *`, [members, myEmail]);
          notifyChat(rows[0], { type: 'chat_meta', event: 'created', chat: rows[0] });
          return res.status(200).json({ chat: rows[0] });
        }
        if (!(await canManageRoster(req, me))) return res.status(403).json({ error: 'You do not have permission to create group chats' });
        const members = [...new Set([myEmail, ...others])].join(',');
        const rows = await queryDb(
          `INSERT INTO team_chats (kind, name, members, created_by) VALUES ('group',$1,$2,$3) RETURNING *`,
          [name || 'Group chat', members, myEmail]);
        notifyChat(rows[0], { type: 'chat_meta', event: 'created', chat: rows[0] });
        return res.status(200).json({ chat: rows[0] });
      }

      if (action === 'update_chat') {
        const { chatId, name, memberEmails } = req.body;
        const chat = await loadChat(chatId);
        if (!chat || !inChat(chat, myEmail)) return res.status(404).json({ error: 'Chat not found' });
        if (chat.kind !== 'group') return res.status(400).json({ error: 'Only group chats can be edited' });
        if (!(await canManageRoster(req, me))) return res.status(403).json({ error: 'You do not have permission to edit group chats' });
        const members = Array.isArray(memberEmails) && memberEmails.length
          ? [...new Set([chat.created_by, ...memberEmails])].join(',')
          : chat.members;
        const rows = await queryDb(
          `UPDATE team_chats SET name=COALESCE($1,name), members=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
          [name || null, members, chatId]);
        // notify old + new member sets so removed members drop the chat
        broadcastToEmails([...new Set([...chatMembers(chat), ...chatMembers(rows[0])])],
          { type: 'chat_meta', event: 'updated', chat: rows[0] });
        return res.status(200).json({ chat: rows[0] });
      }

      if (action === 'send') {
        const { chatId, message, replyTo } = req.body;
        const text = String(message || '').trim();
        if (!text) return res.status(400).json({ error: 'message required' });
        const chat = await loadChat(chatId);
        if (!chat || !inChat(chat, myEmail)) return res.status(404).json({ error: 'Chat not found' });
        // snapshot the quoted message (same chat only)
        let quoted = null;
        if (replyTo) {
          const [q] = await queryDb(`SELECT id, sender_name, message, file_name, deleted FROM team_chat_messages WHERE id=$1 AND chat_id=$2 LIMIT 1`, [replyTo, chat.id]);
          if (q && !q.deleted) quoted = { id: q.id, name: q.sender_name, text: (q.file_name ? `📎 ${q.file_name}` : q.message).slice(0, 180) };
        }
        const rows = await queryDb(
          `INSERT INTO team_chat_messages (chat_id, sender_email, sender_name, message, reply_to, reply_name, reply_text)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [chat.id, myEmail, me.name, text.slice(0, 4000), quoted?.id || null, quoted?.name || null, quoted?.text || null]);
        const msg = rows[0];
        notifyChat(chat, { type: 'chat', event: 'new', chatId: chat.id, message: msg });
        // Web-push colleagues who don't have the portal open right now
        const recipients = chatMembers(chat).filter((e) => e !== myEmail && !hasActiveSocket(e));
        sendPushToEmails(recipients, {
          title: chat.kind === 'group' ? `${me.name} · ${chat.name || 'Group'}` : `${me.name}`,
          body: text.slice(0, 140), url: '/team', tag: `chat-${chat.id}`
        });
        return res.status(200).json({ message: msg });
      }

      if (action === 'edit_message' || action === 'delete_message') {
        const { id, message } = req.body;
        const rows = await queryDb(`SELECT * FROM team_chat_messages WHERE id=$1 LIMIT 1`, [id]);
        const msg = rows[0];
        if (!msg || msg.sender_email !== myEmail) return res.status(403).json({ error: 'You can only modify your own messages' });
        const chat = await loadChat(msg.chat_id);
        let updated;
        if (action === 'edit_message') {
          const text = String(message || '').trim();
          if (!text) return res.status(400).json({ error: 'message required' });
          updated = (await queryDb(`UPDATE team_chat_messages SET message=$1, edited=true WHERE id=$2 RETURNING *`, [text.slice(0, 4000), id]))[0];
        } else {
          updated = (await queryDb(`UPDATE team_chat_messages SET deleted=true, message='' WHERE id=$1 RETURNING *`, [id]))[0];
        }
        if (chat) notifyChat(chat, { type: 'chat', event: 'updated', chatId: chat.id, message: updated });
        return res.status(200).json({ message: updated });
      }

      if (action === 'push_subscribe') {
        const { subscription } = req.body;
        if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription required' });
        await queryDb(
          `INSERT INTO push_subscriptions (email, endpoint, subscription) VALUES ($1,$2,$3)
           ON CONFLICT (endpoint) DO UPDATE SET email=$1, subscription=$3`,
          [myEmail, subscription.endpoint, JSON.stringify(subscription)]);
        return res.status(200).json({ ok: true });
      }
      if (action === 'push_unsubscribe') {
        const { endpoint } = req.body;
        if (endpoint) await queryDb(`DELETE FROM push_subscriptions WHERE endpoint=$1 AND email=$2`, [endpoint, myEmail]);
        return res.status(200).json({ ok: true });
      }

      if (action === 'settings') {
        const { notificationsEnabled } = req.body;
        await queryDb(`UPDATE team_members SET notifications_enabled=$1, updated_at=NOW() WHERE email=$2`,
          [Boolean(notificationsEnabled), myEmail]);
        return res.status(200).json({ ok: true, notificationsEnabled: Boolean(notificationsEnabled) });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    if (req.method === 'DELETE') {
      const { chatId } = req.body || {};
      const chat = await loadChat(chatId);
      if (!chat || !inChat(chat, myEmail)) return res.status(404).json({ error: 'Chat not found' });
      if (chat.kind === 'group' && !(await canManageRoster(req, me))) return res.status(403).json({ error: 'You do not have permission to delete group chats' });
      const recipients = chatMembers(chat);
      await queryDb(`DELETE FROM team_chats WHERE id=$1`, [chatId]);
      broadcastToEmails(recipients, { type: 'chat_meta', event: 'deleted', chatId: chat.id });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (isMissingTableError(err.message)) return res.status(200).json({ chats: [], colleagues: [], messages: [] });
    return res.status(500).json({ error: err.message });
  }
}
