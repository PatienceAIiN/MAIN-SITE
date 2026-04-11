import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiInfo, FiMessageCircle, FiSend, FiX } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

const YES_PATTERN = /^(yes|yeah|yep|sure|ok|okay|please|why not|go ahead)$/i;
const CONTACT_FORM_PATTERN = /\b(show|open|fill|need|want).{0,24}\b(contact|sales)\s+form\b|\bcontact\s+form\b/i;
const JOB_FORM_PATTERN = /\b(job|career|hiring|apply|application|job\s*enquiry|job\s*inquiry)\b.*\b(form|enquiry|inquiry|apply)\b|\bjob\s*enquiry\b|\bjob\s*inquiry\b/i;
const WAVE_SEEN_KEY = 'pa_chat_wave_seen';

const getOrCreateId = (storageKey, prefix) => {
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const raw = window.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const next = `${prefix}-${raw}`;
  window.localStorage.setItem(storageKey, next);
  return next;
};

const ChatWidget = ({ brand }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [leadStatus, setLeadStatus] = useState('idle');
  const [leadError, setLeadError] = useState('');
  const [showWave, setShowWave] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', subject: 'Sales inquiry via AI chat', message: '' });
  const [jobForm, setJobForm] = useState({ name: '', email: '', role: '', message: '' });
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hii ✨ I’m ${brand?.name || 'our'} assistant. I can help with anything on this site in a cute and clear way.` }
  ]);

  const conversationId = useMemo(() => (typeof window !== 'undefined' ? getOrCreateId('pa_chat_conversation_id', 'PatienceAI') : 'PatienceAI-local'), []);
  const sessionId = useMemo(() => (typeof window !== 'undefined' ? getOrCreateId('pa_chat_session_id', 'session') : 'session-local'), []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const seen = window.localStorage.getItem(WAVE_SEEN_KEY) === 'true';
    setShowWave(!seen);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(WAVE_SEEN_KEY, 'true');
    setShowWave(false);
  }, [isOpen]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    const collapse = () => {
      setIsOpen(false);
      setShowInfo(false);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        collapse();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', collapse);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', collapse);
    };
  }, []);

  const initials = useMemo(() => {
    const name = brand?.name || 'PA';
    return name.split(' ').map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase();
  }, [brand?.name]);

  const shouldOpenContactForm = (question, currentMessages) => {
    if (!YES_PATTERN.test(question.trim())) return false;
    const lastAssistant = [...currentMessages].reverse().find((item) => item.role === 'assistant');
    return Boolean(lastAssistant && /Would you like me to provide a contact email or phone number for our sales team\?/i.test(lastAssistant.content));
  };

  const submitLead = async (e) => {
    e.preventDefault();
    setLeadStatus('submitting');
    setLeadError('');

    try {
      await fetchJson('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadForm, source: 'chatbot', company: null, productName: null })
      });

      setLeadStatus('submitted');
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Thanks for submitting the contact form. Our sales team will review your request and follow up shortly. For your safety, please use this form for contact sharing requests.'
        }
      ]);
      setShowContactForm(false);
      setLeadForm({ name: '', email: '', subject: 'Sales inquiry via AI chat', message: '' });
    } catch (error) {
      setLeadStatus('idle');
      setLeadError(error.message || 'Unable to submit form right now.');
    }
  };

  const submitJobEnquiry = async (e) => {
    e.preventDefault();
    setLeadStatus('submitting');
    setLeadError('');

    try {
      await fetchJson('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: jobForm.name,
          email: jobForm.email,
          subject: `Job Inquiry - ${jobForm.role || 'General'}`,
          message: `${jobForm.message}\n\nRole: ${jobForm.role || 'Not specified'}`,
          source: 'job-inquiry-chat',
          company: null,
          productName: null
        })
      });

      setLeadStatus('submitted');
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Thanks for your job enquiry. Our team will review and get back to you soon.'
        }
      ]);
      setShowJobForm(false);
      setJobForm({ name: '', email: '', role: '', message: '' });
    } catch (error) {
      setLeadStatus('idle');
      setLeadError(error.message || 'Unable to submit form right now.');
    }
  };

  const ask = async () => {
    const question = input.trim();
    if (!question || busy) return;

    const openForm = shouldOpenContactForm(question, messages);
    const wantsContactForm = CONTACT_FORM_PATTERN.test(question);
    const wantsJobForm = JOB_FORM_PATTERN.test(question);
    const userMessage = { role: 'user', content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');

    if (openForm) {
      setShowContactForm(true);
      setShowJobForm(false);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Great — please fill this quick contact form. For your safety and to route correctly, we only share contact details after form submission.'
        }
      ]);
      return;
    }

    if (wantsJobForm) {
      setShowJobForm(true);
      setShowContactForm(false);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Sure — please fill this quick job enquiry form in chat.'
        }
      ]);
      return;
    }

    if (wantsContactForm) {
      setShowContactForm(true);
      setShowJobForm(false);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Sure — please fill this quick contact form in chat.'
        }
      ]);
      return;
    }

    setBusy(true);
    try {
      const payload = await fetchJson('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, sessionId, conversationId, history: nextMessages.slice(-16) })
      });

      setMessages((current) => [...current, { role: 'assistant', content: payload.answer }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: `Sorry, I couldn't respond right now. ${error.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[120] flex flex-col items-end gap-2">
        {showWave && !isOpen && (
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
          <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold">{initials}</div>
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
            <div className="bg-slate-950 text-white p-4 relative flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold shrink-0">{initials}</div>
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold leading-tight truncate">{brand?.name || 'Company'} Assistant</p>
                  <button
                    type="button"
                    onClick={() => setShowInfo((current) => !current)}
                    className="text-white/80 hover:text-white shrink-0"
                    aria-label="Conversation info"
                  >
                    <FiInfo size={15} />
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white ml-3 shrink-0" aria-label="Close chat">
                <FiX size={18} />
              </button>

              {showInfo && (
                <div className="absolute top-[calc(100%+8px)] left-3 right-3 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg">
                  Conversation ID: <span className="font-semibold break-all">{conversationId}</span>
                </div>
              )}
            </div>

            <div className={`h-[360px] overflow-y-auto p-4 space-y-3 bg-slate-50 ${showInfo ? 'pt-16' : ''}`}>
              {messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${item.role === 'user' ? 'ml-auto bg-slate-950 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}
                >
                  {item.content}
                </div>
              ))}

              {showContactForm && (
                <form onSubmit={submitLead} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Sales contact form</p>
                  <input value={leadForm.name} onChange={(e) => setLeadForm((c) => ({ ...c, name: e.target.value }))} required placeholder="Name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input type="email" value={leadForm.email} onChange={(e) => setLeadForm((c) => ({ ...c, email: e.target.value }))} required placeholder="Email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input value={leadForm.subject} onChange={(e) => setLeadForm((c) => ({ ...c, subject: e.target.value }))} required placeholder="Subject" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <textarea value={leadForm.message} onChange={(e) => setLeadForm((c) => ({ ...c, message: e.target.value }))} required placeholder="How can our team help you?" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-20" />
                  {leadError && <p className="text-xs text-red-600">{leadError}</p>}
                  <button type="submit" disabled={leadStatus === 'submitting'} className="w-full rounded-lg bg-slate-950 text-white py-2 text-sm disabled:opacity-60">
                    {leadStatus === 'submitting' ? 'Submitting...' : 'Submit form'}
                  </button>
                </form>
              )}

              {showJobForm && (
                <form onSubmit={submitJobEnquiry} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Job enquiry form</p>
                  <input value={jobForm.name} onChange={(e) => setJobForm((c) => ({ ...c, name: e.target.value }))} required placeholder="Name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input type="email" value={jobForm.email} onChange={(e) => setJobForm((c) => ({ ...c, email: e.target.value }))} required placeholder="Email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input value={jobForm.role} onChange={(e) => setJobForm((c) => ({ ...c, role: e.target.value }))} required placeholder="Role you're applying for" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <textarea value={jobForm.message} onChange={(e) => setJobForm((c) => ({ ...c, message: e.target.value }))} required placeholder="Tell us about your profile" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-20" />
                  {leadError && <p className="text-xs text-red-600">{leadError}</p>}
                  <button type="submit" disabled={leadStatus === 'submitting'} className="w-full rounded-lg bg-slate-950 text-white py-2 text-sm disabled:opacity-60">
                    {leadStatus === 'submitting' ? 'Submitting...' : 'Submit form'}
                  </button>
                </form>
              )}

              {busy && <div className="text-xs text-slate-500">PA is typing...</div>}
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
              <button type="button" onClick={ask} disabled={busy || !input.trim()} className="h-10 w-10 rounded-xl bg-slate-950 text-white flex items-center justify-center disabled:opacity-50" aria-label="Send message">
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
