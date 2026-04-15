import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE_NAME = 'site_content';
const SITE_SLUG = 'site';
const BROKEN_IMAGE_ID = 'photo-1633511090164-b4bfdef39924';
const BROKEN_IMAGE_URL = 'https://images.unsplash.com/photo-1633511090164-b4bfdef39924?q=80&w=800&auto=format&fit=crop';
const FIXED_IMAGE_URL = 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=800&auto=format&fit=crop';
const BROKEN_THUMB_URL = 'https://images.unsplash.com/photo-1633511090164-b4bfdef39924?q=80&w=400&auto=format&fit=crop';
const FIXED_THUMB_URL = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mergeWithDefaults = (defaults, overrides) => {
  if (Array.isArray(defaults)) {
    return Array.isArray(overrides) ? overrides : defaults;
  }

  if (defaults && typeof defaults === 'object') {
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
      return defaults;
    }

    const merged = { ...defaults, ...overrides };
    Object.keys(defaults).forEach((key) => {
      merged[key] = mergeWithDefaults(defaults[key], overrides[key]);
    });
    return merged;
  }

  return overrides ?? defaults;
};

const withContentMetadata = (content, version = 1) => ({
  ...content,
  _schemaVersion: content._schemaVersion ?? 1,
  _contentVersion: version,
  _contentUpdatedAt: content._contentUpdatedAt ?? new Date().toISOString()
});

const applyContentPatch = (base, patch) => {
  if (patch === undefined) return base;
  if (patch === null) return undefined;
  if (Array.isArray(patch) || Array.isArray(base) || typeof patch !== 'object' || typeof base !== 'object' || !base) {
    return patch;
  }

  const result = { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null) {
      delete result[key];
      return;
    }
    result[key] = applyContentPatch(base[key], value);
  });
  return result;
};

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
  if (typeof value === 'string' && value.includes(BROKEN_IMAGE_ID)) {
    return value.includes('w=400') ? FIXED_THUMB_URL : FIXED_IMAGE_URL;
  }

  return value;
};

const requireAdmin = (req) => {
  const token = getCookieValue(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
};

const isLocalFallbackError = (message = '') =>
  /not configured|fetch failed|networkerror|enotfound|econnrefused/i.test(String(message));

export default async function handler(req, res) {
  const defaultContent = readDefaultContent();

  if (req.method === 'GET') {
    try {
      const rows = await queryDb(`SELECT data FROM ${TABLE_NAME} WHERE slug = $1 LIMIT 1`, [SITE_SLUG]);
      const row = rows[0];

      if (!row) {
        const seededContent = withContentMetadata(defaultContent, 1);
        await queryDb(
          `INSERT INTO ${TABLE_NAME} (slug, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (slug) DO NOTHING`,
          [SITE_SLUG, JSON.stringify(seededContent)]
        );
        return res.status(200).json({ content: sanitizeContent(seededContent), source: 'neondb-seeded-default' });
      }

      const mergedContent = withContentMetadata(mergeWithDefaults(defaultContent, row.data), row.data?._contentVersion ?? 1);
      return res.status(200).json({ content: sanitizeContent(mergedContent), source: 'neondb' });
    } catch (error) {
      if (isMissingTableError(error.message) || isLocalFallbackError(error.message)) {
        return res.status(200).json({
          content: sanitizeContent(withContentMetadata(defaultContent, defaultContent._contentVersion ?? 1)),
          source: 'local-fallback-missing-table'
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  const session = requireAdmin(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'PATCH') {
    const { patch, content } = req.body || {};
    const update = patch ?? content;
    if (!update || typeof update !== 'object') {
      return res.status(400).json({ error: 'patch object is required' });
    }

    try {
      const currentRows = await queryDb(`SELECT data FROM ${TABLE_NAME} WHERE slug = $1 LIMIT 1`, [SITE_SLUG]);
      const currentVersion = currentRows[0]?.data?._contentVersion ?? currentRows[0]?.data?._schemaVersion ?? 0;
      const currentContent = mergeWithDefaults(defaultContent, currentRows[0]?.data || {});
      const nextContent = applyContentPatch(currentContent, update) || currentContent;
      const sanitizedContent = sanitizeContent(withContentMetadata(nextContent, currentVersion + 1));
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
      const resetContent = sanitizeContent(withContentMetadata(defaultContent, 1));
      await queryDb(`DELETE FROM ${TABLE_NAME} WHERE slug = $1`, [SITE_SLUG]);
      return res.status(200).json({ reset: true, content: resetContent });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
