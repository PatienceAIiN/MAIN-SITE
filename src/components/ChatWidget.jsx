import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheck, FiCopy, FiInfo, FiMessageCircle, FiSend, FiX } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

const YES_PATTERN = /^(yes|yeah|yep|sure|ok|okay|please|why not|go ahead)$/i;
const CONTACT_FORM_PATTERN = /\b(show|open|fill|need|want).{0,24}\b(contact|sales)\s+form\b|\bcontact\s+form\b/i;
const JOB_FORM_PATTERN = /\b(job|career|hiring|apply|application|job\s*enquiry|job\s*inquiry)\b.*\b(form|enquiry|inquiry|apply)\b|\bjob\s*enquiry\b|\bjob\s*inquiry\b/i;
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
  const [showWave, setShowWave] = useState(true);
  const [copiedConversationId, setCopiedConversationId] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', subject: 'Sales inquiry via AI chat', message: '' });
  const [jobForm, setJobForm] = useState({ name: '', email: '', role: '', message: '' });
  const [messages, setMessages] = useState([]);
  const [liveResponse, setLiveResponse] = useState('');
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);

  const conversationId = useMemo(() => (typeof window !== 'undefined' ? getOrCreateId('pa_chat_conversation_id', 'PatienceAI') : 'PatienceAI-local'), []);
  const sessionId = useMemo(() => (typeof window !== 'undefined' ? getOrCreateId('pa_chat_session_id', 'session') : 'session-local'), []);
  const hasUserMessaged = useMemo(() => messages.some((message) => message.role === 'user'), [messages]);
  const suggestionPrompts = useMemo(() => {
    const brandName = brand?.name || siteContent?.brand?.name || 'your platform';
    return [
      `What does ${brandName} help teams do?`,
      'Show available products.',
      'How can I request a product demo?',
      'Share case study highlights.',
      'Do you have open roles?'
    ];
  }, [brand]);


  useEffect(() => {
    if (isOpen) {
      setShowWave(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
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

  useEffect(() => {
    const panel = scrollAreaRef.current;
    if (!panel) return;
    panel.scrollTop = panel.scrollHeight;
  }, [messages, busy, showContactForm, showJobForm, liveResponse, isOpen]);

  const launcherMonogram = 'PA';

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

  const copyConversationId = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(conversationId);
      setCopiedConversationId(true);
      window.setTimeout(() => setCopiedConversationId(false), 1400);
    } catch {
      setCopiedConversationId(false);
    }
  };


  const playDropletTone = () => {
    if (typeof window === 'undefined') return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(860, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(520, audioContext.currentTime + 0.22);

    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.13, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.24);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.24);

    oscillator.onended = () => {
      audioContext.close().catch(() => {});
    };
  };

  const toggleChat = () => {
    setIsOpen((current) => {
      const next = !current;
      if (next) {
        playDropletTone();
      }
      return next;
    });
  };

  const ask = async (presetQuestion = null) => {
    const question = String(presetQuestion ?? input).trim();
    if (!question || busy) return;

    const openForm = shouldOpenContactForm(question, messages);
    const wantsContactForm = CONTACT_FORM_PATTERN.test(question);
    const wantsJobForm = JOB_FORM_PATTERN.test(question);
    const userMessage = { role: 'user', content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    if (!presetQuestion) {
      setInput('');
    }
    setLiveResponse('');
    setIsStreamingResponse(false);

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
      const fullAnswer = payload.answer || '';
      let visibleAnswer = '';
      setIsStreamingResponse(true);

      for (let index = 0; index < fullAnswer.length; index += 1) {
        visibleAnswer += fullAnswer[index];
        setLiveResponse(visibleAnswer);
        await new Promise((resolve) => setTimeout(resolve, 8));
      }

      setMessages((current) => [...current, { role: 'assistant', content: fullAnswer }]);
      setLiveResponse('');
      setIsStreamingResponse(false);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: `Sorry, I couldn't respond right now. ${error.message}` }]);
      setLiveResponse('');
      setIsStreamingResponse(false);
    } finally {
      setBusy(false);
    }
  };

  const onSuggestionClick = (prompt) => {
    ask(prompt);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[120] flex flex-col items-end gap-2">
        {showWave && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, rotate: [0, -2, 2, -1, 0], y: [0, -2, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="rounded-full border border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-sky-50 text-slate-800 px-3 py-1.5 text-sm shadow-lg"
          >
            <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.25)]" />
            Hi 👋
          </motion.div>
        )}

        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={toggleChat}
          className="h-16 w-16 rounded-full bg-slate-950 text-white shadow-2xl border border-white/10 flex items-center justify-center"
          aria-label="Open AI chat"
        >
          <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold"><span className="site-brand text-base leading-none tracking-normal">{launcherMonogram}</span></div>
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
                <div className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold shrink-0"><span className="site-brand text-base leading-none tracking-normal">{launcherMonogram}</span></div>
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
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0">
                      Conversation ID: <span className="font-semibold break-all">{conversationId}</span>
                    </p>
                    <button
                      type="button"
                      onClick={copyConversationId}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                      aria-label="Copy conversation ID"
                      title="Copy conversation ID"
                    >
                      {copiedConversationId ? <FiCheck size={13} /> : <FiCopy size={13} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div ref={scrollAreaRef} className={`h-[360px] overflow-y-auto p-4 space-y-3 bg-slate-50 ${showInfo ? 'pt-16' : ''}`}>
              {!hasUserMessaged && !showContactForm && !showJobForm && (
                <div className="flex flex-wrap gap-2">
                  {suggestionPrompts.map((prompt, index) => (
                    <motion.button
                      key={prompt}
                      type="button"
                      onClick={() => onSuggestionClick(prompt)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08, duration: 0.35, ease: 'easeOut' }}
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-full border border-cyan-100 bg-gradient-to-r from-white via-sky-50 to-cyan-50 px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:shadow-md"
                    >
                      {prompt}
                    </motion.button>
                  ))}
                </div>
              )}

              {messages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${item.role === 'user' ? 'ml-auto bg-slate-950 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}
                >
                  {item.content}
                </div>
              ))}

              {isStreamingResponse && (
                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words bg-white text-slate-800 border border-slate-200">
                  {liveResponse || 'Generating response...'}
                </div>
              )}

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

              {busy && <div className="text-xs text-slate-500">{isStreamingResponse ? 'Generating response in real time...' : 'Generating response...'}</div>}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <input
                ref={inputRef}
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
