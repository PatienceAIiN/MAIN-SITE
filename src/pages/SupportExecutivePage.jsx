import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchJson } from '../common/fetchJson';

const SupportExecutivePage = ({ inviteMode = false }) => {
  const location = useLocation();
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const inviteEmail = search.get('email') || '';
  const inviteToken = search.get('token') || '';

  const [auth, setAuth] = useState({ loading: true, authenticated: false, user: null });
  const [form, setForm] = useState({ email: inviteEmail, password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');

  const loadSession = async () => {
    try {
      const payload = await fetchJson('/api/support-auth');
      setAuth({ loading: false, authenticated: Boolean(payload?.authenticated), user: payload?.user || null });
    } catch {
      setAuth({ loading: false, authenticated: false, user: null });
    }
  };

  const loadConversations = async () => {
    try {
      const payload = await fetchJson('/api/support-chat');
      const list = payload?.conversations || [];
      setConversations(list);
      setConversationId((current) => current || list[0]?.conversation_id || list[0]?.conversationId || '');
    } catch (err) {
      setError(err.message);
    }
  };

  const loadMessages = async (targetConversationId) => {
    if (!targetConversationId) return;
    try {
      const payload = await fetchJson(`/api/support-chat?conversationId=${encodeURIComponent(targetConversationId)}`);
      setMessages(payload?.messages || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!auth.authenticated) return;
    loadConversations();
    const timer = window.setInterval(loadConversations, 3500);
    return () => window.clearInterval(timer);
  }, [auth.authenticated]);

  useEffect(() => {
    if (!auth.authenticated || !conversationId) return;
    loadMessages(conversationId);
    const timer = window.setInterval(() => loadMessages(conversationId), 2200);
    return () => window.clearInterval(timer);
  }, [auth.authenticated, conversationId]);

  const onLogin = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await fetchJson('/api/support-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteMode && inviteToken
          ? { email: form.email.trim(), password: form.password, inviteToken }
          : { email: form.email.trim(), password: form.password })
      });
      await loadSession();
    } catch (err) {
      setError(err.message || 'Unable to continue.');
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await fetchJson('/api/support-auth', { method: 'DELETE' });
    setConversations([]);
    setConversationId('');
    setMessages([]);
    await loadSession();
  };

  const joinConversation = async (targetConversationId) => {
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'joinConversation', conversationId: targetConversationId })
      });
      setConversationId(targetConversationId);
      loadMessages(targetConversationId);
    } catch (err) {
      setError(err.message);
    }
  };

  const sendMessage = async () => {
    if (!conversationId || !message.trim()) return;
    const next = message.trim();
    setMessage('');
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', conversationId, message: next })
      });
      loadMessages(conversationId);
    } catch (err) {
      setError(err.message);
      setMessage(next);
    }
  };

  if (auth.loading) {
    return <main className="min-h-screen bg-slate-950 text-white grid place-items-center">Loading support console…</main>;
  }

  if (!auth.authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-4">
        <form onSubmit={onLogin} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3">
          <h1 className="text-2xl font-semibold">{inviteMode ? 'Accept support invite' : 'Support executive login'}</h1>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="name@patienceai.in"
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder={inviteMode ? 'Create password (min 8 chars)' : 'Password'}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm"
            required
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-white text-slate-900 py-2 font-medium disabled:opacity-60">
            {saving ? 'Please wait…' : inviteMode ? 'Accept invite' : 'Login'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Support executive console</h1>
          <p className="text-sm text-white/60">Logged in as {auth.user?.email}</p>
        </div>
        <button type="button" onClick={onLogout} className="rounded-xl border border-white/20 px-4 py-2 text-sm">Logout</button>
      </div>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 max-h-[80vh] overflow-y-auto space-y-2">
          {conversations.map((item) => {
            const id = item.conversation_id || item.conversationId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => joinConversation(id)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${conversationId === id ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/10 bg-white/5'}`}
              >
                <p className="text-sm font-medium truncate">{id}</p>
                <p className="text-xs text-white/60">Status: {item.status}</p>
                <p className="text-xs text-white/50 truncate">Customer: {item.customer_email || item.customer_name || 'Unknown'}</p>
              </button>
            );
          })}
          {!conversations.length && <p className="text-sm text-white/50">No live conversations yet.</p>}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col min-h-[80vh]">
          <div className="text-sm text-white/70 mb-2">Conversation: {conversationId || 'Select one from left panel'}</div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${item.sender_role === 'executive' ? 'ml-auto bg-cyan-500/15 border border-cyan-300/30' : 'bg-slate-900 border border-white/10'}`}
              >
                <p className="whitespace-pre-wrap break-words">{item.message}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-white/50">{item.sender_role}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type reply..."
              className="flex-1 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm"
              disabled={!conversationId}
            />
            <button type="button" onClick={sendMessage} disabled={!conversationId || !message.trim()} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60">
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default SupportExecutivePage;
