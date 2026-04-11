import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE_NAME = 'chatbot_messages';

const requireAdmin = (req) => {
  const token = getCookieValue(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
};

export default async function handler(req, res) {
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const conversationId = String(req.query.conversationId || '').trim();
      const rows = conversationId
        ? await queryDb(`SELECT * FROM ${TABLE_NAME} WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 300`, [conversationId])
        : await queryDb(`SELECT * FROM ${TABLE_NAME} ORDER BY created_at DESC LIMIT 300`);

      const grouped = rows.reduce((acc, item) => {
        const key = item.conversation_id || 'unknown';
        if (!acc[key]) {
          acc[key] = { conversationId: key, ipAddress: item.ip_address || 'unknown', updatedAt: item.created_at, messages: [] };
        }
        acc[key].messages.push(item);
        return acc;
      }, {});

      const conversations = Object.values(grouped).map((item) => ({ ...item, messages: item.messages.reverse() }));
      return res.status(200).json({ conversations });
    } catch (error) {
      if (isMissingTableError(error.message)) {
        return res.status(200).json({ conversations: [] });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    const { id, message } = req.body || {};
    if (!id || !message) return res.status(400).json({ error: 'id and message are required' });

    try {
      const rows = await queryDb(`UPDATE ${TABLE_NAME} SET message = $1 WHERE id = $2 RETURNING *`, [message, id]);
      return res.status(200).json({ item: rows[0] || null });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id, conversationId } = req.body || {};
    try {
      if (id) {
        await queryDb(`DELETE FROM ${TABLE_NAME} WHERE id = $1`, [id]);
        return res.status(200).json({ deleted: true, id });
      }

      if (conversationId) {
        await queryDb(`DELETE FROM ${TABLE_NAME} WHERE conversation_id = $1`, [conversationId]);
        return res.status(200).json({ deleted: true, conversationId });
      }

      return res.status(400).json({ error: 'id or conversationId is required' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    const { conversationId, role, message, ipAddress } = req.body || {};
    if (!conversationId || !role || !message) {
      return res.status(400).json({ error: 'conversationId, role, and message are required' });
    }

    try {
      const rows = await queryDb(
        `INSERT INTO ${TABLE_NAME} (session_id, conversation_id, role, message, ip_address, created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
        [conversationId, conversationId, role, message, ipAddress || null]
      );
      return res.status(200).json({ item: rows[0] || null });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
