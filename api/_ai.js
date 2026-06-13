// Provider-abstracted AI completion. Default: Groq (existing GROQ_API_KEY).
// Swap providers via AI_PROVIDER + per-provider env keys — callers never change.
export const aiComplete = async (prompt, { maxTokens = 400, timeoutMs = 18000, system } = {}) => {
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  // Hard timeout so a slow/queued provider never hangs the request — callers
  // fall back to a deterministic answer instead of spinning indefinitely.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: 'user', content: prompt }] })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'AI request failed');
      return d.content?.[0]?.text || '';
    }
    // groq / openai-compatible
    const base = provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.groq.com/openai/v1';
    const key = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
    if (!key) throw new Error('AI provider key not configured');
    const msgs = system ? [{ role: 'system', content: system }, { role: 'user', content: prompt }] : [{ role: 'user', content: prompt }];
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST', signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'llama-3.3-70b-versatile', max_tokens: maxTokens, messages: msgs })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'AI request failed');
    return d.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
};
