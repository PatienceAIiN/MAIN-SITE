import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE_NAME = 'site_content';
const SITE_SLUG = 'site';
const BROKEN_IMAGE_URL = 'https://images.unsplash.com/photo-1633511090164-b4bfdef39924?q=80&w=800&auto=format&fit=crop';
const FIXED_IMAGE_URL = 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=800&auto=format&fit=crop';
const BROKEN_THUMB_URL = 'https://images.unsplash.com/photo-1633511090164-b4bfdef39924?q=80&w=400&auto=format&fit=crop';
const FIXED_THUMB_URL = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readDefaultContent = () => {
  const filePath = path.resolve(__dirname, '..', 'src', 'data', 'siteContent.json');
  return JSON.parse(readFileSync(filePath, 'utf8'));
};

const sanitizeContent = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContent(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeContent(item)]));
  }

  if (value === BROKEN_IMAGE_URL) return FIXED_IMAGE_URL;
  if (value === BROKEN_THUMB_URL) return FIXED_THUMB_URL;

  return value;
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
        return res.status(200).json({ content: sanitizeContent(defaultContent), source: 'neondb-seeded-default' });
      }

      return res.status(200).json({ content: sanitizeContent(row.data), source: 'neondb' });
    } catch (error) {
      if (isMissingTableError(error.message)) {
        return res.status(200).json({ content: sanitizeContent(defaultContent), source: 'local-fallback-missing-table' });
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
      const sanitizedContent = sanitizeContent(content);
      await queryDb(
        `INSERT INTO ${TABLE_NAME} (slug, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [SITE_SLUG, JSON.stringify(sanitizedContent)]
      );
      return res.status(200).json({ content: sanitizedContent });
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
