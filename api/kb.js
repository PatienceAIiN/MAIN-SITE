// Knowledge base — articles, FAQs and troubleshooting guides.
// Read/search: any signed-in staff. Write: admin only.
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession, getMemberSession } from './_security.js';

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));

export default async function handler(req, res) {
  const authed = isAdmin(req) || getExecSession(req) || getMemberSession(req);
  if (!authed) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const { search, id } = req.query;
    try {
      if (id) {
        const rows = await queryDb(`SELECT * FROM kb_articles WHERE id=$1 LIMIT 1`, [id]);
        return res.status(200).json({ article: rows[0] || null });
      }
      if (search?.trim()) {
        // Simple keyword search across title, body and tags.
        const words = search.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
        if (!words.length) return res.status(200).json({ articles: [] });
        const clauses = words.map((_, i) => `(lower(title) LIKE $${i + 1} OR lower(body) LIKE $${i + 1} OR lower(coalesce(tags,'')) LIKE $${i + 1})`);
        const rows = await queryDb(
          `SELECT id, title, kind, left(body, 200) AS excerpt, tags, updated_at FROM kb_articles
           WHERE ${clauses.join(' OR ')} ORDER BY updated_at DESC LIMIT 8`,
          words.map((w) => `%${w}%`)
        );
        return res.status(200).json({ articles: rows });
      }
      const rows = await queryDb(
        `SELECT id, title, kind, left(body, 200) AS excerpt, tags, updated_at FROM kb_articles ORDER BY updated_at DESC LIMIT 100`
      );
      return res.status(200).json({ articles: rows });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ articles: [] });
      return res.status(500).json({ error: err.message });
    }
  }

  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  if (req.method === 'POST') {
    const { title, body, kind = 'article', tags = '' } = req.body || {};
    if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'title and body required' });
    if (!['article', 'faq', 'guide'].includes(kind)) return res.status(400).json({ error: 'Invalid kind' });
    try {
      const rows = await queryDb(
        `INSERT INTO kb_articles (title, body, kind, tags) VALUES ($1,$2,$3,$4) RETURNING *`,
        [title.trim().slice(0, 200), body.slice(0, 20000), kind, String(tags).slice(0, 300)]
      );
      return res.status(200).json({ article: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PATCH') {
    const { id, title, body, kind, tags } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      const rows = await queryDb(
        `UPDATE kb_articles SET
           title = COALESCE($1, title), body = COALESCE($2, body),
           kind = COALESCE($3, kind), tags = COALESCE($4, tags), updated_at = NOW()
         WHERE id=$5 RETURNING *`,
        [title?.trim() || null, body || null, kind || null, tags ?? null, id]
      );
      return res.status(200).json({ article: rows[0] || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      await queryDb(`DELETE FROM kb_articles WHERE id=$1`, [id]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
