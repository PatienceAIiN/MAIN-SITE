import crypto from 'node:crypto';
import { queryDb } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';
import { requireSupport } from './support-auth.js';
import { redisGetJson, redisPublish, redisSetJson } from './_redis.js';

const requireAdmin = (req) => verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME));

const createConversationId = () => `PatienceAILive-${crypto.randomBytes(3).toString('hex')}`;
const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const saveMessage = async ({ conversationId, role, email, message, messageType = 'text', attachment = null }) => {
  await queryDb(
    `INSERT INTO public.support_chat_messages
    (conversation_id, sender_role, sender_email, message_type, message, attachment_name, attachment_url, attachment_size)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [conversationId, role, email || null, messageType, message, attachment?.name || null, attachment?.url || null, attachment?.size || null]
  );
};

const updateConversationTouch = async (conversationId) => {
  await queryDb('UPDATE public.support_chat_conversations SET updated_at = NOW() WHERE conversation_id = $1', [conversationId]);
};

export default async function supportChatHandler(req, res) {
  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'createConversation') {
      const { customerName, customerEmail } = req.body || {};
      const safeName = String(customerName || '').trim();
      const safeEmail = normalizeEmail(customerEmail);
      if (!safeName || !safeEmail) {
        return res.status(400).json({ error: 'Name and email are required' });
      }
      const conversationId = createConversationId();
      await queryDb(
        `INSERT INTO public.support_chat_conversations (conversation_id, customer_name, customer_email, status)
         VALUES ($1,$2,$3,'waiting')`,
        [conversationId, safeName, safeEmail]
      );
      await saveMessage({ conversationId, role: 'system', messageType: 'system', message: 'Conversation created. Waiting for executive.' });
      return res.status(200).json({ conversationId, status: 'waiting' });
    }

    if (action === 'restoreConversation') {
      const { conversationId, customerEmail } = req.body || {};
      const safeEmail = normalizeEmail(customerEmail);
      if (!conversationId || !safeEmail) {
        return res.status(400).json({ error: 'conversationId and email are required' });
      }
      const convoRows = await queryDb('SELECT * FROM public.support_chat_conversations WHERE conversation_id = $1 LIMIT 1', [conversationId]);
      const convo = convoRows[0];
      if (!convo) return res.status(404).json({ error: 'Conversation not found' });
      if (normalizeEmail(convo.customer_email) !== safeEmail) {
        return res.status(403).json({ error: 'Conversation/email does not match' });
      }
      const messages = await queryDb('SELECT * FROM public.support_chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500', [conversationId]);
      return res.status(200).json({ conversation: convo, messages });
    }

    if (action === 'joinConversation') {
      const support = requireSupport(req);
      if (!support) return res.status(401).json({ error: 'Unauthorized support session' });
      const { conversationId } = req.body || {};
      const rows = await queryDb('SELECT * FROM public.support_chat_conversations WHERE conversation_id = $1 LIMIT 1', [conversationId]);
      const convo = rows[0];
      if (!convo) return res.status(404).json({ error: 'Conversation not found' });

      if (convo.status === 'active' && convo.executive_email && convo.executive_email !== support.email) {
        return res.status(409).json({ error: 'Chat already in progress with another executive' });
      }

      await queryDb(
        `UPDATE public.support_chat_conversations
         SET executive_email = $1, status = 'active', assigned_at = COALESCE(assigned_at, NOW()), updated_at = NOW()
         WHERE conversation_id = $2`,
        [support.email, conversationId]
      );

      await saveMessage({ conversationId, role: 'system', messageType: 'system', message: `${support.email} joined the chat` });
      await redisSetJson(`support:presence:${conversationId}`, { executiveEmail: support.email, updatedAt: Date.now() }, 600);
      await redisPublish(`support:chat:${conversationId}`, { type: 'joined', executiveEmail: support.email });
      return res.status(200).json({ joined: true });
    }

    if (action === 'sendMessage') {
      const support = requireSupport(req);
      const admin = requireAdmin(req);
      const { conversationId, message, senderRole = 'customer', attachment, customerEmail } = req.body || {};
      if (!conversationId || (!message && !attachment)) return res.status(400).json({ error: 'conversationId and message/attachment required' });

      let effectiveRole = senderRole;
      let senderEmail = null;
      if (support) {
        effectiveRole = 'executive';
        senderEmail = support.email;
      } else if (admin) {
        effectiveRole = 'admin';
        senderEmail = admin.username;
      } else if (senderRole !== 'customer') {
        return res.status(401).json({ error: 'Unauthorized sender' });
      }

      if (effectiveRole === 'customer') {
        const convoRows = await queryDb('SELECT customer_email FROM public.support_chat_conversations WHERE conversation_id = $1 LIMIT 1', [conversationId]);
        const convo = convoRows[0];
        if (!convo) return res.status(404).json({ error: 'Conversation not found' });
        if (!normalizeEmail(customerEmail) || normalizeEmail(convo.customer_email) !== normalizeEmail(customerEmail)) {
          return res.status(403).json({ error: 'Conversation/email does not match' });
        }
      }

      if (attachment && Number(attachment.size || 0) > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Attachment exceeds 10MB limit' });
      }

      await saveMessage({
        conversationId,
        role: effectiveRole,
        email: senderEmail,
        message: message || `Attachment shared: ${attachment.name || 'file'}`,
        messageType: attachment ? 'file' : 'text',
        attachment
      });
      await updateConversationTouch(conversationId);
      await redisPublish(`support:chat:${conversationId}`, { type: 'message', role: effectiveRole, message: message || '', attachment: attachment || null });
      return res.status(200).json({ sent: true });
    }

    if (action === 'typing') {
      const { conversationId, role = 'customer', typing = true } = req.body || {};
      if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
      await redisSetJson(`support:typing:${conversationId}:${role}`, { typing: Boolean(typing), ts: Date.now() }, 20);
      await redisPublish(`support:chat:${conversationId}`, { type: 'typing', role, typing: Boolean(typing) });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unsupported action' });
  }

  if (req.method === 'GET') {
    const admin = requireAdmin(req);
    const support = requireSupport(req);
    const { conversationId, customerEmail } = req.query || {};

    if (conversationId) {
      const convoRows = await queryDb('SELECT * FROM public.support_chat_conversations WHERE conversation_id = $1 LIMIT 1', [conversationId]);
      const convo = convoRows[0];
      if (!convo) return res.status(404).json({ error: 'Conversation not found' });
      const isCustomer = normalizeEmail(customerEmail) && normalizeEmail(convo.customer_email) === normalizeEmail(customerEmail);
      if (!admin && !isCustomer && (!support || (convo.executive_email && convo.executive_email !== support.email))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const messages = await queryDb('SELECT * FROM public.support_chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500', [conversationId]);
      const presence = await redisGetJson(`support:presence:${conversationId}`);
      return res.status(200).json({ conversation: convo, messages, presence });
    }

    if (!admin && !support) return res.status(401).json({ error: 'Unauthorized' });

    const rows = admin
      ? await queryDb('SELECT * FROM public.support_chat_conversations ORDER BY updated_at DESC LIMIT 200')
      : await queryDb(
        `SELECT * FROM public.support_chat_conversations
         WHERE executive_email = $1 OR status = 'waiting'
         ORDER BY updated_at DESC
         LIMIT 200`,
        [support.email]
      );

    return res.status(200).json({ conversations: rows });
  }

  if (req.method === 'DELETE') {
    const { id, conversationId } = req.body || {};
    if (!id && !conversationId) return res.status(400).json({ error: 'id or conversationId required' });

    if (id) {
      await queryDb('DELETE FROM public.support_chat_messages WHERE id = $1', [id]);
      return res.status(200).json({ deleted: true, id });
    }

    await queryDb('DELETE FROM public.support_chat_messages WHERE conversation_id = $1', [conversationId]);
    await queryDb('DELETE FROM public.support_chat_conversations WHERE conversation_id = $1', [conversationId]);
    return res.status(200).json({ deleted: true, conversationId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
