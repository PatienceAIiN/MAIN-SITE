import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseAdminClient } from './_supabase.js';
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
  const supabase = getSupabaseAdminClient();
  const defaultContent = readDefaultContent();

  if (!supabase) {
    if (req.method === 'GET') {
      return res.status(200).json({ content: defaultContent, source: 'local-fallback' });
    }

    return res.status(500).json({ error: 'Supabase is not configured' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('slug', SITE_SLUG).maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert({
          slug: SITE_SLUG,
          data: defaultContent,
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }

      return res.status(200).json({ content: inserted.data, source: 'supabase' });
    }

    return res.status(200).json({ content: data.data, source: 'supabase' });
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

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert({
        slug: SITE_SLUG,
        data: content,
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ content: data.data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('slug', SITE_SLUG);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ reset: true, content: defaultContent });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
