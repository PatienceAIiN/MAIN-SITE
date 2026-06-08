import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';
import { broadcastTopic } from './newsletter.js';

const TABLE_NAME = 'site_content';
const PRIMARY_SITE_SLUG = 'default';
const LEGACY_SITE_SLUG = 'site';
const BROKEN_IMAGE_ID = 'photo-1633511090164-b4bfdef39924';
const BROKEN_IMAGE_URL = 'https://images.unsplash.com/photo-1633511090164-b4bfdef39924?q=80&w=800&auto=format&fit=crop';
const FIXED_IMAGE_URL = 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=800&auto=format&fit=crop';
const BROKEN_THUMB_URL = 'https://images.unsplash.com/photo-1633511090164-b4bfdef39924?q=80&w=400&auto=format&fit=crop';
const FIXED_THUMB_URL = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop';
const CANONICAL_BRAND_NAME = 'PATIENCE AI';

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
  if (typeof value === 'string' && value.includes(BROKEN_IMAGE_ID)) {
    return value.includes('w=400') ? FIXED_THUMB_URL : FIXED_IMAGE_URL;
  }

  return value;
};

const normalizeBranding = (content) => {
  if (!content || typeof content !== 'object') {
    return content;
  }

  const nextContent = { ...content };
  nextContent.brand = {
    ...(nextContent.brand || {}),
    name: CANONICAL_BRAND_NAME
  };
  return nextContent;
};

const requireAdmin = (req) => {
  const token = getCookieValue(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
};

const isLocalFallbackError = (message = '') =>
  /not configured|fetch failed|networkerror|enotfound|econnrefused/i.test(String(message));

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const siteUrl = () => (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, '');

const newItems = (prevArr, nextArr, idKey) => {
  if (!Array.isArray(nextArr)) return [];
  if (!Array.isArray(prevArr) || prevArr.length === 0) return nextArr.slice(0, 5);
  const prevIds = new Set(prevArr.map((x) => x?.[idKey]).filter(Boolean));
  return nextArr.filter((x) => x?.[idKey] && !prevIds.has(x[idKey])).slice(0, 5);
};

const renderItemEmail = ({ heading, intro, items, ctaLabel, ctaPath }) => {
  const list = items
    .map(
      (item) => `
      <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:12px">
        <h3 style="margin:0 0 6px;color:#1a1a1a;font-size:16px">${escapeHtml(item.title)}</h3>
        ${item.excerpt ? `<p style="margin:0;color:#666;font-size:14px">${escapeHtml(item.excerpt)}</p>` : ''}
      </div>`
    )
    .join('');
  const url = `${siteUrl()}${ctaPath}`;
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
      <h2 style="margin:0 0 8px">${escapeHtml(heading)}</h2>
      <p style="color:#666;margin:0 0 16px">${escapeHtml(intro)}</p>
      ${list}
      <p style="margin:28px 0 0">
        <a href="${url}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:9999px;text-decoration:none;font-weight:600">${escapeHtml(ctaLabel)}</a>
      </p>
    </div>`;
};

const detectContentChanges = (prev, next) => {
  if (!prev || !next) return [];
  const events = [];

  const newProducts = newItems(prev?.productsPage?.products, next?.productsPage?.products, 'slug');
  if (newProducts.length) {
    events.push({
      topic: 'products',
      subject: `New on Patience AI: ${newProducts[0].title}`,
      html: renderItemEmail({
        heading: 'New products on Patience AI',
        intro: 'You subscribed to product updates. Here\'s what\'s new:',
        items: newProducts.map((p) => ({ title: p.title || p.name, excerpt: p.excerpt || p.tagline || '' })),
        ctaLabel: 'See products',
        ctaPath: '/products'
      }),
      text: `New on Patience AI: ${newProducts.map((p) => p.title || p.name).join(', ')}`
    });
  }

  const newPosts = newItems(prev?.blogPage?.posts, next?.blogPage?.posts, 'slug');
  if (newPosts.length) {
    events.push({
      topic: 'blog',
      subject: `New from the Patience AI blog: ${newPosts[0].title}`,
      html: renderItemEmail({
        heading: 'Fresh from the blog',
        intro: 'You subscribed to blog updates. The latest posts:',
        items: newPosts.map((p) => ({ title: p.title, excerpt: p.excerpt })),
        ctaLabel: 'Read the blog',
        ctaPath: '/company/blog'
      }),
      text: `New posts: ${newPosts.map((p) => p.title).join(', ')}`
    });
  }

  const prevLegalKey = JSON.stringify({
    pp: prev?.legal?.privacyPolicy?.updatedValue,
    tos: prev?.legal?.termsOfService?.updatedValue
  });
  const nextLegalKey = JSON.stringify({
    pp: next?.legal?.privacyPolicy?.updatedValue,
    tos: next?.legal?.termsOfService?.updatedValue
  });
  if (prevLegalKey !== nextLegalKey) {
    events.push({
      topic: 'legal',
      subject: 'Patience AI: privacy & terms updated',
      html: renderItemEmail({
        heading: 'Our legal documents were updated',
        intro: 'You subscribed to terms & privacy updates. Please review the latest versions.',
        items: [
          { title: 'Privacy Policy', excerpt: next?.legal?.privacyPolicy?.updatedValue || '' },
          { title: 'Terms of Service', excerpt: next?.legal?.termsOfService?.updatedValue || '' }
        ],
        ctaLabel: 'Review documents',
        ctaPath: '/legal/privacy-policy'
      }),
      text: 'Privacy/Terms updated. Review at /legal.'
    });
  }

  return events;
};

const readStoredSiteContent = async () => {
  const rows = await queryDb(
    `SELECT slug, data
     FROM ${TABLE_NAME}
     WHERE slug IN ($1, $2)
     ORDER BY CASE WHEN slug = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [PRIMARY_SITE_SLUG, LEGACY_SITE_SLUG]
  );

  return rows[0] || null;
};

export default async function handler(req, res) {
  const defaultContent = readDefaultContent();
  const canonicalContent = normalizeBranding(sanitizeContent(defaultContent));

  if (req.method === 'GET') {
    try {
      const row = await readStoredSiteContent();

      if (!row) {
        await queryDb(
          `INSERT INTO ${TABLE_NAME} (slug, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (slug) DO NOTHING`,
          [PRIMARY_SITE_SLUG, JSON.stringify(canonicalContent)]
        );
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).json({ content: canonicalContent, source: 'neondb-seeded-default' });
      }

      const storedContent = normalizeBranding(sanitizeContent(row.data));
      if (row.slug === LEGACY_SITE_SLUG) {
        await queryDb(
          `INSERT INTO ${TABLE_NAME} (slug, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (slug) DO NOTHING`,
          [PRIMARY_SITE_SLUG, JSON.stringify(storedContent)]
        );
      }
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ content: storedContent, source: 'neondb' });
    } catch (error) {
      if (isMissingTableError(error.message) || isLocalFallbackError(error.message)) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).json({
          content: canonicalContent,
          source: 'local-fallback-missing-table'
        });
      }
      console.error('[site-content GET]', error.message);
      return res.status(500).json({ error: 'Internal server error' });
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
      const sanitizedContent = normalizeBranding(sanitizeContent(content));

      // Detect diff against previously stored content to drive newsletter broadcasts
      const prevRow = await readStoredSiteContent();
      const prevContent = prevRow ? normalizeBranding(sanitizeContent(prevRow.data)) : null;
      const diffEvents = detectContentChanges(prevContent, sanitizedContent);

      await queryDb(
        `INSERT INTO ${TABLE_NAME} (slug, data, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [PRIMARY_SITE_SLUG, JSON.stringify(sanitizedContent)]
      );

      // Fire newsletter broadcasts in background (don't block admin save)
      if (diffEvents.length > 0) {
        Promise.resolve().then(async () => {
          for (const ev of diffEvents) {
            try {
              await broadcastTopic(ev);
            } catch (e) {
              console.error('[site-content] broadcast failed:', ev.topic, e.message);
            }
          }
        });
      }

      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ content: sanitizedContent, broadcasts: diffEvents.map((e) => e.topic) });
    } catch (error) {
      console.error('[site-content PATCH]', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await queryDb(`DELETE FROM ${TABLE_NAME} WHERE slug IN ($1, $2)`, [PRIMARY_SITE_SLUG, LEGACY_SITE_SLUG]);
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ reset: true, content: normalizeBranding(sanitizeContent(defaultContent)) });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
