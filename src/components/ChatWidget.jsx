import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMessageCircle, FiSend, FiX } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

const createSessionId = () => {
  const stored = window.localStorage.getItem('pa_chat_session_id');
  if (stored) {
    return stored;
  }

  const next = window.crypto?.randomUUID?.() || `session-${Date.now()}`;
  window.localStorage.setItem('pa_chat_session_id', next);
  return next;
};

const ChatWidget = ({ brand }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi 👋 I'm ${brand?.name || 'our'} assistant. Ask me anything about our site, products, or services.`
    }
  ]);

  const initials = useMemo(() => {
    const name = brand?.name || 'PA';
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [brand?.name]);

  const ask = async () => {
    const question = input.trim();
    if (!question || busy) {
      return;
    }

    const userMessage = { role: 'user', content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);

    try {
      const payload = await fetchJson('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          sessionId: createSessionId(),
          history: nextMessages.slice(-8)
        })
      });

      setMessages((current) => [...current, { role: 'assistant', content: payload.answer }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `Sorry, I couldn't respond right now. ${error.message}`
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[120] flex flex-col items-end gap-2">
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-full bg-white/95 text-slate-800 px-3 py-1.5 text-sm shadow-lg"
          >
            Hi 👋
          </motion.div>
        )}

        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setIsOpen((current) => !current)}
          className="h-16 w-16 rounded-full bg-slate-950 text-white shadow-2xl border border-white/10 flex items-center justify-center"
          aria-label="Open AI chat"
        >
          <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="fixed bottom-24 right-6 z-[120] w-[min(92vw,380px)] rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          >
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <div>
                  <p className="font-semibold leading-tight">{brand?.name || 'Company'} Assistant</p>
                  <p className="text-xs text-white/70">Natural AI chat powered by RAG</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white" aria-label="Close chat">
                <FiX size={18} />
              </button>
            </div>

            <div className="h-[360px] overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    item.role === 'user' ? 'ml-auto bg-slate-950 text-white' : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                >
                  {item.content}
                </div>
              ))}
              {busy && <div className="text-xs text-slate-500">Assistant is typing...</div>}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder="Ask about products, services, or anything..."
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                type="button"
                onClick={ask}
                disabled={busy || !input.trim()}
                className="h-10 w-10 rounded-xl bg-slate-950 text-white flex items-center justify-center disabled:opacity-50"
                aria-label="Send message"
              >
                {busy ? <FiMessageCircle size={16} /> : <FiSend size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;
