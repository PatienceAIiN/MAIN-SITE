import { getSupabaseAdminClient } from './_supabase.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE_NAME = 'contact_submissions';

const normalizeSearch = (value = '') => value.trim().toLowerCase();

const requireAdmin = (req) => {
  const token = getCookieValue(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
};

export default async function handler(req, res) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return res.status(500).json({
      error: 'Supabase is not configured',
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    });
  }

  if (req.method === 'GET') {
    if (!requireAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const search = normalizeSearch(req.query.search);
    const status = normalizeSearch(req.query.status || 'all');

    const items = (data || []).filter((item) => {
      const matchesStatus = status === 'all' ? true : item.status === status;
      const haystack = [
        item.name,
        item.email,
        item.subject,
        item.message,
        item.source,
        item.status
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = search ? haystack.includes(search) : true;
      return matchesStatus && matchesSearch;
    });

    const counts = items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { total: 0, new: 0, reviewing: 0, replied: 0, archived: 0 }
    );

    return res.status(200).json({ items, counts });
  }

  if (req.method === 'PATCH') {
    if (!requireAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id, status } = req.body || {};

    if (!id || !status) {
      return res.status(400).json({ error: 'id and status are required' });
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ item: data });
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }

    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ deleted: true, id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
