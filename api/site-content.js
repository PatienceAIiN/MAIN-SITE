import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE_NAME = 'site_content';
const SITE_SLUG = 'site';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readDefaultContent = () => {
  const filePath = path.resolve(__dirname, '..', 'src', 'data', 'siteContent.json');
  return JSON.parse(readFileSync(filePath, 'utf8'));
};

const requireAdmin = (req) => {
  const token = getCookieValue(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
};

export default async function handler(req, res) {
  const defaultContent = readDefaultContent();

  if (req.method === 'GET') {
    try {
      const rows = await queryDb(`SELECT data FROM ${TABLE_NAME} WHERE slug = $1 LIMIT 1`, [SITE_SLUG]);
      const row = rows[0];

      if (!row) {
        await queryDb(
          `INSERT INTO ${TABLE_NAME} (slug, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (slug) DO NOTHING`,
          [SITE_SLUG, JSON.stringify(defaultContent)]
        );
        return res.status(200).json({ content: defaultContent, source: 'neondb-seeded-default' });
      }

      return res.status(200).json({ content: row.data, source: 'neondb' });
    } catch (error) {
      if (isMissingTableError(error.message)) {
        return res.status(200).json({ content: defaultContent, source: 'local-fallback-missing-table' });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  const session = requireAdmin(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'PATCH') {
    const { content } = req.body || {};
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'content object is required' });
    }

    try {
      await queryDb(
        `INSERT INTO ${TABLE_NAME} (slug, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [SITE_SLUG, JSON.stringify(content)]
      );
      return res.status(200).json({ content });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await queryDb(`DELETE FROM ${TABLE_NAME} WHERE slug = $1`, [SITE_SLUG]);
      return res.status(200).json({ reset: true, content: defaultContent });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
