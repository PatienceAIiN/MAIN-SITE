import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheck, FiCopy, FiInfo, FiSend, FiSquare, FiTrash2, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { fetchJson } from '../common/fetchJson';

const YES_PATTERN = /^(yes|yeah|yep|sure|ok|okay|please|why not|go ahead)$/i;
const CONTACT_FORM_PATTERN = /\b(show|open|fill|need|want).{0,24}\b(contact|sales)\s+form\b|\bcontact\s+form\b/i;
const JOB_FORM_PATTERN = /\b(job|career|hiring|apply|application|job\s*enquiry|job\s*inquiry)\b.*\b(form|enquiry|inquiry|apply)\b|\bjob\s*enquiry\b|\bjob\s*inquiry\b/i;
const NAVIGATION_REQUEST_PATTERN = /\b(open|go to|navigate|take me to|redirect|show me)\b/i;
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

const TypingDots = () => (
  <span className="inline-flex items-center gap-1" aria-label="Loading response">
    {[0, 1, 2, 3].map((dot) => (
      <span
        key={dot}
        className="h-1.5 w-1.5 rounded-full bg-slate-500/80 animate-bounce"
        style={{ animationDelay: `${dot * 0.12}s`, animationDuration: '0.8s' }}
      />
    ))}
  </span>
);


const LAUNCHER_SIZE = 64;
const LAUNCHER_MARGIN = 24;
const MOBILE_EDGE_GAP = 12;
const DESKTOP_EDGE_GAP = 16;
const MOBILE_BREAKPOINT = 768;
const PANEL_MAX_WIDTH = 420;
const PANEL_DEFAULT_WIDTH = 380;
const PANEL_MIN_HEIGHT = 360;
const PANEL_DEFAULT_HEIGHT = 620;
const DRAG_THRESHOLD = 8;

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

const clampPanelPosition = (x, y, panelWidth, panelHeight) => {
  const { width: viewportWidth, height: viewportHeight } = getViewportSize();
  const edgeGap = isMobileViewport(viewportWidth) ? MOBILE_EDGE_GAP : DESKTOP_EDGE_GAP;
  const maxX = Math.max(edgeGap, viewportWidth - panelWidth - edgeGap);
  const maxY = Math.max(edgeGap, viewportHeight - panelHeight - edgeGap);

  return {
    x: Math.min(Math.max(x, edgeGap), maxX),
    y: Math.min(Math.max(y, edgeGap), maxY)
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
  const edgeGap = isMobileViewport(viewportWidth) ? MOBILE_EDGE_GAP : LAUNCHER_MARGIN;
  const maxX = Math.max(edgeGap, viewportWidth - width - edgeGap);
  const maxY = Math.max(edgeGap, viewportHeight - height - edgeGap);
  return {
    x: Math.min(Math.max(x, edgeGap), maxX),
    y: Math.min(Math.max(y, edgeGap), maxY)
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
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [routeActions, setRouteActions] = useState([]);
  const [assistantSuggestions, setAssistantSuggestions] = useState([]);
  const [showContactCta, setShowContactCta] = useState(false);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const launcherStackRef = useRef(null);
  const chatPanelRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, offsetX: 0, offsetY: 0, originX: 0, originY: 0, moved: false });
  const [launcherPosition, setLauncherPosition] = useState(() => getDefaultLauncherPosition());
  const [hasManualPosition, setHasManualPosition] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: PANEL_DEFAULT_WIDTH, height: PANEL_DEFAULT_HEIGHT });

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
  }, [messages, busy, isOpen]);


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

      if (hasManualPosition) {
        setLauncherPosition((current) => clampLauncherPosition(current.x, current.y, stackWidth, stackHeight));
        return;
      }

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
  }, [hasManualPosition, isOpen, showWave]);

  useEffect(() => {
    if (!chatPanelRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setPanelSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(chatPanelRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleMove = (event) => onDragMove(event);
    const handleUp = () => endDrag();
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, []);

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
    setIsStreamingResponse(false);
    setBusy(false);
    setShowContactForm(false);
    setShowJobForm(false);
    setLeadError('');
    setRouteActions([]);
    setAssistantSuggestions([]);
    setShowContactCta(false);
  };

  const stopResponse = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
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
      setIsStreamingResponse(true);
      await new Promise((resolve) => setTimeout(resolve, 260));

      if (!controller.signal.aborted) {
        setMessages((current) => [...current, { role: 'assistant', content: fullAnswer }]);
        setAssistantSuggestions(Array.isArray(payload?.suggestions) ? payload.suggestions.filter((entry) => typeof entry === 'string' && entry.trim()) : []);
        setShowContactCta(Boolean(payload?.needsExpertHelp));
        if (payload?.needsExpertHelp) {
          setShowJobForm(false);
        }
      }
      setIsStreamingResponse(false);
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      setMessages((current) => [...current, { role: 'assistant', content: `Sorry, I couldn't respond right now. ${error.message}` }]);
      setIsStreamingResponse(false);
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
    }
  };

  const onSuggestionClick = (prompt) => {
    ask(prompt);
  };

  const messageLinksFromText = (text) => {
    const actions = buildRouteActions(text);
    return actions.slice(0, 3);
  };

  const panelPosition = useMemo(() => {
    const width = Math.min(PANEL_MAX_WIDTH, Math.max(320, panelSize.width || PANEL_DEFAULT_WIDTH));
    const height = Math.max(PANEL_MIN_HEIGHT, panelSize.height || PANEL_DEFAULT_HEIGHT);
    const launcherWidth = launcherStackRef.current?.getBoundingClientRect()?.width || LAUNCHER_SIZE;
    const launcherHeight = launcherStackRef.current?.getBoundingClientRect()?.height || LAUNCHER_SIZE;
    const preferredX = launcherPosition.x + launcherWidth - width;
    const preferredY = launcherPosition.y - height - 12;
    const fallbackY = launcherPosition.y + launcherHeight + 10;
    const clampedPrimary = clampPanelPosition(preferredX, preferredY, width, height);
    const hasRoomAbove = preferredY >= DESKTOP_EDGE_GAP;
    if (hasRoomAbove) return clampedPrimary;
    return clampPanelPosition(preferredX, fallbackY, width, height);
  }, [launcherPosition.x, launcherPosition.y, panelSize.height, panelSize.width]);

  const parseMessageWithLinks = (content) => {
    const text = normalizeMessageContent(content);
    const parts = [];
    const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }
      const rawUrl = match[0];
      const href = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      parts.push({ type: 'link', value: rawUrl, href });
      lastIndex = match.index + rawUrl.length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return parts.length ? parts : [{ type: 'text', value: text }];
  };

  const startDrag = (event) => {
    if (typeof window === 'undefined') return;
    const target = event.target;
    const handle = event.currentTarget;
    if (target instanceof HTMLElement && handle instanceof HTMLElement && !handle.contains(target)) return;
    if (
      target instanceof HTMLElement &&
      handle instanceof HTMLElement &&
      !target.closest('[data-drag-handle]') &&
      target.closest('button, input, textarea, a')
    ) return;
    const stackRect = launcherStackRef.current?.getBoundingClientRect();
    if (!stackRect) return;
    const pointX = event.clientX;
    const pointY = event.clientY;
    dragStateRef.current = {
      dragging: true,
      offsetX: pointX - stackRect.left,
      offsetY: pointY - stackRect.top,
      originX: pointX,
      originY: pointY,
      moved: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onDragMove = (event) => {
    const state = dragStateRef.current;
    if (!state.dragging) return;
    const deltaX = Math.abs(event.clientX - state.originX);
    const deltaY = Math.abs(event.clientY - state.originY);
    const moved = deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD;
    if (!moved && !state.moved) return;
    dragStateRef.current.moved = true;
    setHasManualPosition(true);
    setLauncherPosition(clampLauncherPosition(event.clientX - state.offsetX, event.clientY - state.offsetY));
  };

  const endDrag = () => {
    dragStateRef.current.dragging = false;
  };

  const onLauncherClick = () => {
    if (dragStateRef.current.moved) {
      dragStateRef.current.moved = false;
      return;
    }
    toggleChat();
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
          data-drag-handle="true"
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onPointerDown={startDrag}
          onClick={onLauncherClick}
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
            style={{ left: panelPosition.x, top: panelPosition.y }}
            className="fixed z-[140] flex w-[min(calc(100vw-1.25rem),420px)] max-w-[420px] flex-col max-h-[calc(100dvh-1.25rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div data-drag-handle="true" onPointerDown={startDrag} className="cursor-grab active:cursor-grabbing bg-slate-50 text-slate-900 p-4 relative flex items-center justify-between border-b border-slate-200">
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

            <div ref={scrollAreaRef} className={`min-h-[220px] flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 ${showInfo ? 'pt-16' : ''}`}>
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
                  {parseMessageWithLinks(item.content).map((part, partIndex) =>
                    part.type === 'link' ? (
                      <a
                        key={`${index}-link-${partIndex}`}
                        href={part.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-cyan-700 underline decoration-cyan-300 underline-offset-2"
                      >
                        {part.value}
                      </a>
                    ) : (
                      <span key={`${index}-txt-${partIndex}`}>{part.value}</span>
                    )
                  )}
                  {item.role === 'assistant' && messageLinksFromText(item.content).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {messageLinksFromText(item.content).map((action) => (
                        <button
                          key={`${index}-${action.path}`}
                          type="button"
                          onClick={() => {
                            navigate(action.path);
                            setIsOpen(false);
                          }}
                          className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-800 ring-1 ring-cyan-200"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
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

              {showContactCta && !showContactForm && (
                <div className="max-w-[95%] rounded-2xl border border-amber-100 bg-amber-50/80 p-2.5 shadow-sm">
                  <p className="px-1 pb-2 text-xs text-slate-700">Need a precise recommendation from our team?</p>
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
                </div>
              )}

              {(showContactForm || showJobForm) && (
                <div className="max-w-[96%] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">{showContactForm ? 'Sales contact form' : 'Job enquiry form'}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowContactForm(false);
                        setShowJobForm(false);
                        setLeadError('');
                      }}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                    >
                      Hide form
                    </button>
                  </div>
                  {showContactForm && (
                    <form onSubmit={submitLead} className="space-y-2">
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
                    <form onSubmit={submitJobEnquiry} className="space-y-2">
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
                </div>
              )}

              {isStreamingResponse && (
                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words bg-white text-slate-800 border border-slate-200">
                  <TypingDots />
                </div>
              )}
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
                <p className="text-[11px] text-slate-500 px-1">Responses are AI-generated and may be imperfect.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWidget;
