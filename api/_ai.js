// Provider-abstracted AI completion. Default: Groq (existing GROQ_API_KEY).
// Swap providers via AI_PROVIDER + per-provider env keys — callers never change.
export const aiComplete = async (prompt, { maxTokens = 400 } = {}) => {
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'AI request failed');
    return d.content?.[0]?.text || '';
  }
  // groq / openai-compatible
  const base = provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.groq.com/openai/v1';
  const key = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
  if (!key) throw new Error('AI provider key not configured');
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'llama-3.3-70b-versatile', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || 'AI request failed');
  return d.choices?.[0]?.message?.content || '';
};
