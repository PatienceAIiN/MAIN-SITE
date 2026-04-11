import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseAdminClient } from './_supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_TABLE = 'site_content';
const SITE_SLUG = 'site';
const CHAT_TABLE = 'chatbot_messages';

const readDefaultContent = () => {
  const filePath = path.resolve(__dirname, '..', 'src', 'data', 'siteContent.json');
  return JSON.parse(readFileSync(filePath, 'utf8'));
};

const normalize = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const flattenContent = (node, prefix = '', bucket = []) => {
  if (!node) {
    return bucket;
  }

  if (typeof node === 'string') {
    if (node.trim().length > 3) {
      bucket.push(`${prefix}: ${node}`);
    }
    return bucket;
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => flattenContent(item, `${prefix}[${index}]`, bucket));
    return bucket;
  }

  if (typeof node === 'object') {
    Object.entries(node).forEach(([key, value]) => flattenContent(value, prefix ? `${prefix}.${key}` : key, bucket));
  }

  return bucket;
};

const rankChunks = (chunks, query, limit = 8) => {
  const tokens = normalize(query);
  if (!tokens.length) {
    return chunks.slice(0, limit);
  }

  return chunks
    .map((chunk) => {
      const sourceTokens = normalize(chunk);
      const overlap = tokens.reduce((score, token) => (sourceTokens.includes(token) ? score + 1 : score), 0);
      return { chunk, overlap };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((item) => item.chunk);
};

const readSiteContent = async (supabase) => {
  if (!supabase) {
    return readDefaultContent();
  }

  const { data } = await supabase.from(SITE_TABLE).select('data').eq('slug', SITE_SLUG).maybeSingle();
  return data?.data || readDefaultContent();
};

const saveMessage = async (supabase, payload) => {
  if (!supabase) {
    return;
  }

  await supabase.from(CHAT_TABLE).insert({
    ...payload,
    created_at: new Date().toISOString()
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, sessionId, history = [] } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY environment variable' });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const siteContent = await readSiteContent(supabase);
    const chunks = flattenContent(siteContent);
    const topChunks = rankChunks(chunks, message);

    const brandName = siteContent?.brand?.name || 'our company';
    const systemPrompt = [
      `You are ${brandName}'s AI assistant for website visitors.`,
      'Use friendly, natural conversational tone and keep answers concise but useful.',
      'Only use provided context for company-specific details. If unknown, say you are not sure and offer contact/sales support.',
      'Do not fabricate pricing, policies, or legal claims.'
    ].join(' ');

    const contextPrompt = topChunks.length
      ? `Website context:\n- ${topChunks.join('\n- ')}`
      : 'Website context: No direct matches found in indexed content.';

    const trimmedHistory = Array.isArray(history)
      ? history
          .filter((item) => item?.role && item?.content)
          .slice(-8)
          .map((item) => ({ role: item.role, content: String(item.content) }))
      : [];

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'system', content: contextPrompt },
          ...trimmedHistory,
          { role: 'user', content: String(message) }
        ]
      })
    });

    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      return res.status(500).json({ error: `Groq request failed: ${errorBody.slice(0, 220)}` });
    }

    const completion = await groqResponse.json();
    const answer = completion?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return res.status(500).json({ error: 'No answer returned by Groq' });
    }

    const safeSessionId = sessionId || `web-${Date.now()}`;
    await Promise.all([
      saveMessage(supabase, {
        session_id: safeSessionId,
        role: 'user',
        message: String(message).slice(0, 4000)
      }),
      saveMessage(supabase, {
        session_id: safeSessionId,
        role: 'assistant',
        message: answer.slice(0, 4000)
      })
    ]);

    return res.status(200).json({ answer, sessionId: safeSessionId });
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: 'Unable to generate a response right now.' });
  }
}
