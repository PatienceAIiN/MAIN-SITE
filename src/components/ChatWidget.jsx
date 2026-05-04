import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheck, FiCopy, FiInfo, FiSend, FiSquare, FiTrash2, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { fetchJson } from '../common/fetchJson';

const YES_PATTERN = /^(yes|yeah|yep|sure|ok|okay|please|why not|go ahead)$/i;
const CONTACT_FORM_PATTERN = /\b(show|open|fill|need|want).{0,24}\b(contact|sales)\s+form\b|\bcontact\s+form\b/i;
const JOB_FORM_PATTERN = /\b(job|career|hiring|apply|application|job\s*enquiry|job\s*inquiry)\b.*\b(form|enquiry|inquiry|apply)\b|\bjob\s*enquiry\b|\bjob\s*inquiry\b/i;
const NAVIGATION_REQUEST_PATTERN = /\b(open|go to|navigate|take me to|redirect|show me)\b/i;
const HUMAN_AGENT_PATTERN = /\b(connect.*human|human.*agent|talk.*human|speak.*human|live.*agent|real.*agent|customer.*service|support.*agent|agent.*help|help.*agent)\b/i;
const buildRouteActions = (message = '') => {
  const text = String(message).toLowerCase();
  const actions = [];
  const pushAction = (action) => {
    if (!actions.some((item) => item.path === action.path)) actions.push(action);
  };

  if (/(home|landing|main)\b/.test(text)) pushAction({ label: 'Open Home', path: '/', hint: 'Visit homepage' });
  if (/(product|pricing|solution|offer)\b/.test(text)) pushAction({ label: 'Open Products', path: '/products', hint: 'See products' });
  if (/(platform|service|capabilit)/.test(text)) pushAction({ label: 'Open Services', path: '/platform', hint: 'See services' });
  if (/(case study|blog|stories|insight)/.test(text)) pushAction({ label: 'Open Case Studies', path: '/company/blog', hint: 'Read case studies' });
  if (/(career|job|hiring|apply)/.test(text)) pushAction({ label: 'Open Careers', path: '/company/careers', hint: 'See open roles' });
  return actions;
};
const normalizeMessageContent = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeMessageContent(entry))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (value && typeof value === 'object') {
    const preferredKey = ['content', 'text', 'message', 'answer'].find((key) => typeof value[key] === 'string' && value[key].trim());
    if (preferredKey) return value[preferredKey].trim();
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return '';
};


const LAUNCHER_SIZE = 64;
const LAUNCHER_MARGIN = 24;
const MOBILE_EDGE_GAP = 12;
const DESKTOP_EDGE_GAP = 16;
const MOBILE_BREAKPOINT = 768;

const getViewportSize = () => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement?.clientWidth || 0;
  const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement?.clientHeight || 0;
  return {
    width: Math.max(0, Math.round(viewportWidth)),
    height: Math.max(0, Math.round(viewportHeight))
  };
};

const isMobileViewport = (width = 0) => {
  if (typeof window === "undefined") return width < MOBILE_BREAKPOINT;
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
  return width < MOBILE_BREAKPOINT || Boolean(hasCoarsePointer);
};

const getDefaultLauncherPosition = () => {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  const { width: viewportWidth, height: viewportHeight } = getViewportSize();

  if (isMobileViewport(viewportWidth)) {
    return {
      x: Math.max(MOBILE_EDGE_GAP, viewportWidth - LAUNCHER_SIZE - DESKTOP_EDGE_GAP),
      y: Math.max(MOBILE_EDGE_GAP, viewportHeight - LAUNCHER_SIZE - DESKTOP_EDGE_GAP)
    };
  }

  return {
    x: Math.max(LAUNCHER_MARGIN, viewportWidth - LAUNCHER_SIZE - LAUNCHER_MARGIN),
    y: Math.max(LAUNCHER_MARGIN, viewportHeight - LAUNCHER_SIZE - LAUNCHER_MARGIN)
  };
};

const isAtPageEnd = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const scrollBottom = window.scrollY + window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  return documentHeight - scrollBottom <= 8;
};

const clampLauncherPosition = (x, y, width = LAUNCHER_SIZE, height = LAUNCHER_SIZE) => {
  if (typeof window === 'undefined') return { x, y };
  const { width: viewportWidth, height: viewportHeight } = getViewportSize();

  if (isMobileViewport(viewportWidth)) {
    const anchoredX = Math.max(MOBILE_EDGE_GAP, viewportWidth - width - DESKTOP_EDGE_GAP);
    const mobileY = Math.max(MOBILE_EDGE_GAP, viewportHeight - height - DESKTOP_EDGE_GAP);
    return { x: anchoredX, y: mobileY };
  }

  const maxX = Math.max(LAUNCHER_MARGIN, viewportWidth - width - LAUNCHER_MARGIN);
  const maxY = Math.max(LAUNCHER_MARGIN, viewportHeight - height - LAUNCHER_MARGIN);
  return {
    x: Math.min(Math.max(x, LAUNCHER_MARGIN), maxX),
    y: Math.min(Math.max(y, LAUNCHER_MARGIN), maxY)
  };
};

const getOrCreateId = (storageKey, prefix) => {
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const raw = window.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const next = `${prefix}-${raw}`;
  window.localStorage.setItem(storageKey, next);
  return next;
};

const ChatWidget = ({ brand }) => {
  const navigate = useNavigate();
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
  const [routeActions, setRouteActions] = useState([]);
  const [assistantSuggestions, setAssistantSuggestions] = useState([]);
  const [showContactCta, setShowContactCta] = useState(false);
  const [showHumanAgentPopup, setShowHumanAgentPopup] = useState(false);
  const [humanAgentETA, setHumanAgentETA] = useState('2-5 minutes');

  // Live support chat state
  const [isLiveChat, setIsLiveChat] = useState(false);
  const [showLiveChatEntry, setShowLiveChatEntry] = useState(false);
  const [liveNameInput, setLiveNameInput] = useState('');
  const [liveEmailInput, setLiveEmailInput] = useState('');
  const [liveMessages, setLiveMessages] = useState([]);
  const [liveInput, setLiveInput] = useState('');
  const [liveSending, setLiveSending] = useState(false);
  const [liveConversationId, setLiveConversationId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [liveSession, setLiveSession] = useState(null);
  const livePollRef = useRef(null);
  const liveMessagesEndRef = useRef(null);

  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const liveResponseRef = useRef('');
  const launcherStackRef = useRef(null);
  const chatPanelRef = useRef(null);
  const [launcherPosition, setLauncherPosition] = useState(() => getDefaultLauncherPosition());

  const conversationId = useMemo(() => (typeof window !== 'undefined' ? getOrCreateId('pa_chat_conversation_id', 'PatienceAI') : 'PatienceAI-local'), []);
  const sessionId = useMemo(() => (typeof window !== 'undefined' ? getOrCreateId('pa_chat_session_id', 'session') : 'session-local'), []);
  const hasUserMessaged = useMemo(() => messages.some((message) => message.role === 'user'), [messages]);
  const suggestionPrompts = useMemo(() => {
    const brandName = brand?.name || 'PATIENCE AI';
    return [
      `What does ${brandName} help teams do?`,
      'Show available products.',
      'How can I request a product demo?',
      'Share case study highlights.',
      'Do you have open roles?',
      'Talk to a live agent'
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
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      const isInsideLauncher = launcherStackRef.current?.contains(event.target);
      const isInsideChat = chatPanelRef.current?.contains(event.target);
      if (!isInsideLauncher && !isInsideChat) {
        setIsOpen(false);
        setShowInfo(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
  }, [messages, busy, showContactForm, showJobForm, liveResponse, isOpen, liveMessages]);

  useEffect(() => {
    return () => {
      if (livePollRef.current) clearInterval(livePollRef.current);
    };
  }, []);

  useEffect(() => {
    liveResponseRef.current = liveResponse;
  }, [liveResponse]);


  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = 0;

    const syncLauncherPosition = () => {
      const { width: viewportWidth, height: viewportHeight } = getViewportSize();
      const stackRect = launcherStackRef.current?.getBoundingClientRect();
      const stackWidth = stackRect?.width || LAUNCHER_SIZE;
      const stackHeight = stackRect?.height || LAUNCHER_SIZE;

      const defaultPosition = clampLauncherPosition(
        viewportWidth - stackWidth - LAUNCHER_MARGIN,
        viewportHeight - stackHeight - LAUNCHER_MARGIN,
        stackWidth,
        stackHeight
      );

      if (isMobileViewport(viewportWidth) || !isAtPageEnd()) {
        setLauncherPosition(defaultPosition);
        return;
      }

      const socialLinks = document.getElementById('footer-social-links');
      if (!socialLinks) {
        setLauncherPosition(defaultPosition);
        return;
      }

      const rect = socialLinks.getBoundingClientRect();
      const anchored = clampLauncherPosition(rect.right - stackWidth, rect.top - stackHeight - 18, stackWidth, stackHeight);
      setLauncherPosition(anchored);
    };

    const scheduleSync = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncLauncherPosition);
    };

    scheduleSync();
    window.addEventListener('resize', scheduleSync);
    window.visualViewport?.addEventListener('resize', scheduleSync);
    window.addEventListener('scroll', scheduleSync, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleSync);
      window.visualViewport?.removeEventListener('resize', scheduleSync);
      window.removeEventListener('scroll', scheduleSync);
    };
  }, [isOpen, showWave]);

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

  const clearChat = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setInput('');
    setLiveResponse('');
    setIsStreamingResponse(false);
    setBusy(false);
    setShowContactForm(false);
    setShowJobForm(false);
    setLeadError('');
    setRouteActions([]);
    setAssistantSuggestions([]);
    setShowContactCta(false);
    stopLiveChat();
  };

  const stopLiveChat = () => {
    if (livePollRef.current) {
      clearInterval(livePollRef.current);
      livePollRef.current = null;
    }
    setIsLiveChat(false);
    setShowLiveChatEntry(false);
    setLiveNameInput('');
    setLiveEmailInput('');
    setLiveMessages([]);
    setLiveInput('');
    setLiveConversationId('');
    setCustomerEmail('');
    setLiveSession(null);
  };

  const pollLiveMessages = async (convId, email) => {
    try {
      const params = new URLSearchParams({ conversationId: convId });
      if (email) params.set('customerEmail', email);
      const data = await fetchJson(`/api/support-chat?${params.toString()}`);
      setLiveMessages(data.messages || []);
      setLiveSession(data.session || null);
    } catch {
      // silently ignore poll errors
    }
  };

  const startLiveChat = async () => {
    const name = liveNameInput.trim();
    const email = liveEmailInput.trim();
    if (!name || !email || !liveConversationId) return;
    setShowLiveChatEntry(false);
    setShowContactCta(false);
    openLiveChatPopup({ conversationId: liveConversationId, name, email, mode: 'new' });
  };

  const sendLiveMessage = async () => {
    const text = liveInput.trim();
    if (!text || liveSending || !liveConversationId) return;
    setLiveSending(true);
    setLiveInput('');
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: liveConversationId,
          customerEmail: customerEmail || null,
          message: text,
          sender: 'customer'
        })
      });
      await pollLiveMessages(liveConversationId, customerEmail);
    } catch { /* ignore */ } finally {
      setLiveSending(false);
    }
  };

  const stopResponse = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    const partial = liveResponseRef.current.trim();
    if (partial) {
      setMessages((current) => [...current, { role: 'assistant', content: partial }]);
    }
    setLiveResponse('');
    setIsStreamingResponse(false);
    setBusy(false);
  };

  const ask = async (presetQuestion = null) => {
    const sourceQuestion = typeof presetQuestion === 'string' ? presetQuestion : input;
    const question = normalizeMessageContent(sourceQuestion).trim();
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
    setRouteActions([]);
    setAssistantSuggestions([]);
    setShowContactCta(false);

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

    // Check for human agent request
    if (HUMAN_AGENT_PATTERN.test(question)) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'I\'ll connect you to a live human agent right away. Let me check availability and get you connected.'
        }
      ]);
      setShowHumanAgentPopup(true);
      // Trigger notification to all active executives
      fetchJson('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_agent_alert',
          conversationId,
          customerMessage: question
        })
      }).catch(() => {});
      return;
    }

    const navigationActions = buildRouteActions(question);
    if (NAVIGATION_REQUEST_PATTERN.test(question) && navigationActions.length > 0) {
      setRouteActions(navigationActions);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Absolutely — tap one of these quick actions and I’ll take you there.'
        }
      ]);
      return;
    }

    setBusy(true);
    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const payload = await fetchJson('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, sessionId, conversationId, history: nextMessages.slice(-16) }),
        signal: controller.signal
      });
      const fullAnswer = normalizeMessageContent(payload.answer || payload.message || '');
      let visibleAnswer = '';
      setIsStreamingResponse(true);

      for (let index = 0; index < fullAnswer.length; index += 1) {
        if (controller.signal.aborted) break;
        visibleAnswer += fullAnswer[index];
        setLiveResponse(visibleAnswer);
        await new Promise((resolve) => setTimeout(resolve, 3));
      }

      if (!controller.signal.aborted) {
        setMessages((current) => [...current, { role: 'assistant', content: fullAnswer }]);
        setAssistantSuggestions(Array.isArray(payload?.suggestions) ? payload.suggestions.filter((entry) => typeof entry === 'string' && entry.trim()) : []);
        setShowContactCta(Boolean(payload?.needsExpertHelp));
        if (payload?.needsExpertHelp) {
          setShowJobForm(false);
        }
      }
      setLiveResponse('');
      setIsStreamingResponse(false);
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      setMessages((current) => [...current, { role: 'assistant', content: `Sorry, I couldn't respond right now. ${error.message}` }]);
      setLiveResponse('');
      setIsStreamingResponse(false);
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
    }
  };

  const createLiveConversationId = () => {
    const raw = window.crypto?.randomUUID?.().replace(/-/g,'').slice(0,6) || `${Date.now().toString(36).slice(-4)}`;
    return `PatienceAILive-${raw}`;
  };

  const showLiveChatStart = () => {
    setShowLiveChatEntry(false);
    setShowContactCta(false);
    setIsOpen(false);
    openLiveChatPopup();
  };

  const openLiveChatPopup = ({ conversationId: convId, name = '', email = '', mode = 'new' } = {}) => {
    const params = new URLSearchParams();
    if (convId) params.set('conversationId', convId);
    if (mode && convId) params.set('mode', mode);
    if (email) params.set('customerEmail', email);
    if (name) params.set('customerName', name);
    const query = params.toString();
    const url = query ? `/live-chat?${query}` : '/live-chat';
    const popup = window.open(url, 'pa_live_chat',
      'width=420,height=680,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no');
    if (!popup || popup.closed) {
      // Fallback: open in same tab
      window.open(url, '_blank');
    }
  };

  const onSuggestionClick = (prompt) => {
    if (prompt === 'Talk to a live agent') {
      showLiveChatStart();
      return;
    }
    ask(prompt);
  };
  return (
    <>
      <motion.div
        ref={launcherStackRef}
        style={{ left: launcherPosition.x, top: launcherPosition.y }}
        className="fixed z-[140] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-2 touch-none"
      >
        {showWave && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, rotate: [0, -2, 2, -1, 0], y: [0, -2, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="max-w-[calc(100vw-7rem)] truncate rounded-full border border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-sky-50 px-3 py-1.5 text-sm text-slate-800 shadow-lg"
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
          className="h-16 w-16 rounded-full border border-slate-200 bg-white text-slate-900 shadow-2xl flex items-center justify-center"
          aria-label="Open AI chat"
        >
          <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-bold"><span className="site-brand site-brand--dark text-base leading-none tracking-normal">{launcherMonogram}</span></div>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatPanelRef}
            initial={{ opacity: 0, y: 26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.7 }}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-3 right-3 z-[140] w-auto max-w-[calc(100vw-1.5rem)] md:bottom-24 md:left-auto md:right-6 md:w-[min(calc(100vw-3rem),380px)] md:max-w-[420px] max-h-[calc(100dvh-8rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="bg-slate-50 text-slate-900 p-4 relative flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold shrink-0"><span className="site-brand site-brand--dark text-base leading-none tracking-normal">{launcherMonogram}</span></div>
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold leading-tight truncate">{brand?.name || 'Company'} Assistant</p>
                  <button
                    type="button"
                    onClick={() => setShowInfo((current) => !current)}
                    className="text-slate-500 hover:text-slate-900 shrink-0"
                    aria-label="Conversation info"
                  >
                    <FiInfo size={15} />
                  </button>
                </div>
              </div>
              <div className="ml-3 shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-slate-500 hover:text-slate-900"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <FiTrash2 size={16} />
                </button>
                <button type="button" onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-900" aria-label="Close chat">
                  <FiX size={18} />
                </button>
              </div>

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

            <div ref={scrollAreaRef} className={`h-[clamp(260px,45vh,360px)] overflow-y-auto p-4 space-y-3 bg-slate-50 ${showInfo ? 'pt-16' : ''}`}>
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
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${item.role === 'user' ? 'ml-auto bg-slate-900 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}
                >
                  {normalizeMessageContent(item.content)}
                </div>
              ))}

              {routeActions.length > 0 && (
                <div className="max-w-[95%] rounded-2xl border border-cyan-100 bg-white/95 p-2.5 shadow-sm">
                  <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Quick navigation</p>
                  <div className="flex flex-wrap gap-2">
                    {routeActions.map((action, index) => (
                      <motion.button
                        key={action.path}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06, duration: 0.24, ease: 'easeOut' }}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          navigate(action.path);
                          setRouteActions([]);
                          setIsOpen(false);
                        }}
                        className="rounded-full border border-cyan-200 bg-gradient-to-r from-white via-cyan-50 to-sky-50 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition"
                      >
                        {action.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              {assistantSuggestions.length > 0 && (
                <div className="max-w-[95%] rounded-2xl border border-cyan-100 bg-white/95 p-2.5 shadow-sm">
                  <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {assistantSuggestions.map((suggestion, index) => (
                      <motion.button
                        key={`${suggestion}-${index}`}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06, duration: 0.24, ease: 'easeOut' }}
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setAssistantSuggestions([]);
                          ask(suggestion.toLowerCase() === 'continue' ? 'continue' : suggestion);
                        }}
                        className="rounded-full border border-cyan-200 bg-gradient-to-r from-white via-cyan-50 to-sky-50 px-3 py-1.5 text-xs text-slate-700 shadow-sm transition"
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {showContactCta && !showContactForm && !isLiveChat && !showLiveChatEntry && (
                <div className="max-w-[95%] rounded-2xl border border-amber-100 bg-amber-50/80 p-2.5 shadow-sm">
                  <p className="px-1 pb-2 text-xs text-slate-700">Need help from our team?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowContactForm(true);
                        setShowContactCta(false);
                      }}
                      className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm"
                    >
                      Open contact form
                    </button>
                    <button
                      type="button"
                      onClick={showLiveChatStart}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm"
                    >
                      Chat with a live agent
                    </button>
                  </div>
                </div>
              )}

              {showLiveChatEntry && (
                <div className="max-w-[95%] rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Start live chat</p>
                  <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Conversation ID</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="font-mono text-xs font-semibold text-slate-800 break-all">{liveConversationId}</p>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(liveConversationId).catch(() => {})}
                        className="h-7 w-7 shrink-0 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-center"
                        aria-label="Copy live chat conversation ID"
                      >
                        <FiCopy size={12} />
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Save this ID to continue this chat later.</p>
                  </div>
                  <input
                    value={liveNameInput}
                    onChange={(e) => setLiveNameInput(e.target.value)}
                    placeholder="Your name *"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500"
                  />
                  <input
                    type="email"
                    value={liveEmailInput}
                    onChange={(e) => setLiveEmailInput(e.target.value)}
                    placeholder="Your email *"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startLiveChat}
                      disabled={!liveNameInput.trim() || !liveEmailInput.trim()}
                      className="rounded-full bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowLiveChatEntry(false); setShowContactCta(true); }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isLiveChat && (
                <div className="max-w-[98%] rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.3)]" />
                      <p className="text-xs font-semibold text-slate-700">
                        {liveSession?.status === 'active' ? `Live chat — ${liveSession.assigned_executive || 'Support Team'}` : 'Waiting for a live agent...'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={stopLiveChat}
                      className="text-slate-400 hover:text-slate-700"
                      title="End live chat"
                    >
                      <FiX size={13} />
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5" ref={liveMessagesEndRef}>
                    {liveMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-xl px-2.5 py-1.5 text-xs max-w-[88%] ${
                          msg.sender === 'customer'
                            ? 'ml-auto bg-slate-900 text-white'
                            : 'bg-emerald-50 border border-emerald-100 text-slate-800'
                        }`}
                      >
                        {msg.sender === 'executive' && (
                          <p className="text-[9px] uppercase tracking-wider text-emerald-600 mb-0.5">{msg.executive_name || 'Support Team'}</p>
                        )}
                        <p className="whitespace-pre-wrap leading-snug">{msg.message}</p>
                      </div>
                    ))}
                    {liveMessages.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2">A live agent will respond shortly.</p>
                    )}
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <input
                      value={liveInput}
                      onChange={(e) => setLiveInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendLiveMessage(); } }}
                      placeholder="Type a message..."
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-black placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                    />
                    <button
                      type="button"
                      onClick={sendLiveMessage}
                      disabled={liveSending || !liveInput.trim()}
                      className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50"
                    >
                      <FiSend size={11} />
                    </button>
                  </div>
                </div>
              )}

              {isStreamingResponse && (
                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words bg-white text-slate-800 border border-slate-200">
                  {liveResponse || 'Generating response...'}
                </div>
              )}

              {showContactForm && (
                <form onSubmit={submitLead} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Sales contact form</p>
                  <input value={leadForm.name} onChange={(e) => setLeadForm((c) => ({ ...c, name: e.target.value }))} required placeholder="Name" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500" />
                  <input type="email" value={leadForm.email} onChange={(e) => setLeadForm((c) => ({ ...c, email: e.target.value }))} required placeholder="Email" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500" />
                  <input value={leadForm.subject} onChange={(e) => setLeadForm((c) => ({ ...c, subject: e.target.value }))} required placeholder="Subject" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500" />
                  <textarea value={leadForm.message} onChange={(e) => setLeadForm((c) => ({ ...c, message: e.target.value }))} required placeholder="How can our team help you?" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500 min-h-20" />
                  {leadError && <p className="text-xs text-red-600">{leadError}</p>}
                  <button type="submit" disabled={leadStatus === 'submitting'} className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm disabled:opacity-60">
                    {leadStatus === 'submitting' ? 'Submitting...' : 'Submit form'}
                  </button>
                </form>
              )}

              {showJobForm && (
                <form onSubmit={submitJobEnquiry} className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Job enquiry form</p>
                  <input value={jobForm.name} onChange={(e) => setJobForm((c) => ({ ...c, name: e.target.value }))} required placeholder="Name" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500" />
                  <input type="email" value={jobForm.email} onChange={(e) => setJobForm((c) => ({ ...c, email: e.target.value }))} required placeholder="Email" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500" />
                  <input value={jobForm.role} onChange={(e) => setJobForm((c) => ({ ...c, role: e.target.value }))} required placeholder="Role you're applying for" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500" />
                  <textarea value={jobForm.message} onChange={(e) => setJobForm((c) => ({ ...c, message: e.target.value }))} required placeholder="Tell us about your profile" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500 min-h-20" />
                  {leadError && <p className="text-xs text-red-600">{leadError}</p>}
                  <button type="submit" disabled={leadStatus === 'submitting'} className="w-full rounded-lg bg-slate-900 text-white py-2 text-sm disabled:opacity-60">
                    {leadStatus === 'submitting' ? 'Submitting...' : 'Submit form'}
                  </button>
                </form>
              )}

              {busy && <div className="text-xs text-slate-500">{isStreamingResponse ? 'Generating response in real time...' : 'Generating response...'}</div>}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
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
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (busy) {
                        stopResponse();
                        return;
                      }
                      ask();
                    }}
                    disabled={!busy && !input.trim()}
                    className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center disabled:opacity-50"
                    aria-label={busy ? 'Stop response' : 'Send message'}
                  >
                    {busy ? <FiSquare size={14} /> : <FiSend size={16} />}
                  </button>
                </div>
                <div className="flex items-center gap-2 px-1">
                <p className="text-[11px] text-slate-500 flex-1">Responses are AI-generated and may be imperfect.</p>
                {!isLiveChat && !showLiveChatEntry && (
                  <button
                    type="button"
                    onClick={showLiveChatStart}
                    className="text-[10px] text-emerald-600 hover:text-emerald-800 shrink-0 font-medium"
                  >
                    Talk to a person
                  </button>
                )}
              </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Human Agent Connection Popup */}
      <AnimatePresence>
        {showHumanAgentPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4"
            onClick={() => setShowHumanAgentPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Connecting to Human Agent</h3>
                <p className="text-sm text-slate-600 mb-4">
                  We're finding the best available agent to help you. This usually takes {humanAgentETA}.
                </p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowHumanAgentPopup(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHumanAgentPopup(false);
                    showLiveChatStart();
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Open Chat Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;
