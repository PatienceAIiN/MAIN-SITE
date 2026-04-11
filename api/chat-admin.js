import { getSupabaseAdminClient } from './_supabase.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE_NAME = 'chatbot_messages';

const requireAdmin = (req) => {
  const token = getCookieValue(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
};

export default async function handler(req, res) {
  const supabase = getSupabaseAdminClient();

  if (!requireAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase is not configured' });
  }

  if (req.method === 'GET') {
    const conversationId = String(req.query.conversationId || '').trim();

    let query = supabase.from(TABLE_NAME).select('*').order('created_at', { ascending: false }).limit(200);
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const grouped = (data || []).reduce((acc, item) => {
      const key = item.conversation_id || 'unknown';
      if (!acc[key]) {
        acc[key] = {
          conversationId: key,
          ipAddress: item.ip_address || 'unknown',
          updatedAt: item.created_at,
          messages: []
        };
      }
      acc[key].messages.push(item);
      if (item.created_at > acc[key].updatedAt) {
        acc[key].updatedAt = item.created_at;
      }
      return acc;
    }, {});

    const conversations = Object.values(grouped)
      .map((item) => ({
        ...item,
        messages: item.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return res.status(200).json({ conversations });
  }

  if (req.method === 'PATCH') {
    const { id, message } = req.body || {};
    if (!id || !message) {
      return res.status(400).json({ error: 'id and message are required' });
    }

    const { data, error } = await supabase.from(TABLE_NAME).update({ message }).eq('id', id).select('*').single();
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ item: data });
  }

  if (req.method === 'DELETE') {
    const { id, conversationId } = req.body || {};

    if (id) {
      const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ deleted: true, id });
    }

    if (conversationId) {
      const { error } = await supabase.from(TABLE_NAME).delete().eq('conversation_id', conversationId);
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ deleted: true, conversationId });
    }

    return res.status(400).json({ error: 'id or conversationId is required' });
  }

  if (req.method === 'POST') {
    const { conversationId, role, message, ipAddress } = req.body || {};
    if (!conversationId || !role || !message) {
      return res.status(400).json({ error: 'conversationId, role, and message are required' });
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        conversation_id: conversationId,
        session_id: conversationId,
        role,
        message,
        ip_address: ipAddress || null,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ item: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
