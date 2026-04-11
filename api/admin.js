import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE_NAME = 'contact_submissions';

const normalizeSearch = (value = '') => value.trim().toLowerCase();

const requireAdmin = (req) => {
  const token = getCookieValue(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!requireAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const status = normalizeSearch(req.query.status || 'all');
      const search = normalizeSearch(req.query.search || '');

      let whereSql = 'WHERE 1=1';
      const params = [];

      if (status !== 'all') {
        params.push(status);
        whereSql += ` AND status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        whereSql += ` AND LOWER(COALESCE(name,'') || ' ' || COALESCE(email,'') || ' ' || COALESCE(subject,'') || ' ' || COALESCE(message,'') || ' ' || COALESCE(source,'') || ' ' || COALESCE(status,'')) LIKE $${params.length}`;
      }

      const items = await queryDb(`SELECT * FROM ${TABLE_NAME} ${whereSql} ORDER BY created_at DESC`, params);
      const counts = items.reduce(
        (acc, item) => {
          acc.total += 1;
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        },
        { total: 0, new: 0, reviewing: 0, replied: 0, archived: 0 }
      );

      return res.status(200).json({ items, counts });
    } catch (error) {
      if (isMissingTableError(error.message)) {
        return res.status(200).json({ items: [], counts: { total: 0, new: 0, reviewing: 0, replied: 0, archived: 0 } });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    if (!requireAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id, status } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: 'id and status are required' });

    try {
      const rows = await queryDb(`UPDATE ${TABLE_NAME} SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [status, id]);
      return res.status(200).json({ item: rows[0] || null });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      await queryDb(`DELETE FROM ${TABLE_NAME} WHERE id = $1`, [id]);
      return res.status(200).json({ deleted: true, id });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
