import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPhone, FiPhoneOff, FiPhoneIncoming, FiMic, FiMicOff, FiSend,
  FiLogOut, FiUser, FiRefreshCw, FiCheck, FiEye, FiEyeOff, FiChevronLeft, FiChevronRight, FiSearch,
  FiVolume2, FiSmartphone, FiUsers, FiX, FiCornerUpRight, FiSun, FiMoon, FiAlertTriangle, FiTag, FiMessageSquare, FiBell, FiBellOff, FiMail, FiSettings, FiLock
} from 'react-icons/fi';
import { TicketModal, TicketsPanel, NotificationBell } from '../components/TicketCenter';
import GrowthMail from '../components/GrowthMail';

const STATUS_DOT = { online: 'bg-emerald-500', away: 'bg-amber-500', offline: 'bg-slate-300' };
const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 min without activity → auto-offline
import { fetchJson } from '../common/fetchJson';
import Dropdown from '../common/Dropdown';
import NetworkDot from '../common/NetworkDot';
import Colleagues, { lastSeenText, enablePushNotifications, disablePushNotifications, isPushSubscribed } from '../components/Colleagues';

const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';
const PAGE_SIZE = 10;

// Canned quick replies — standard helpdesk feature for fast, consistent responses.
const CANNED_REPLIES = [
  { label: '👋 Greeting', text: 'Hi! Thanks for reaching out to PATIENCE AI support. How can I help you today?' },
  { label: '⏳ One moment', text: 'Thanks for your patience — let me look into this for you. One moment please.' },
  { label: '🙏 Apology', text: "I'm sorry for the inconvenience. I'll do my best to get this sorted for you right away." },
  { label: '✅ Resolved?', text: 'Is there anything else I can help you with, or did that resolve your issue?' },
  { label: '👋 Closing', text: 'Thank you for contacting PATIENCE AI. Have a great day!' }
];

const getIceServers = async () => {
  try {
    const d = await fetchJson('/api/voice-room/ice-servers');
    return d.iceServers || [];
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
};

const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16
  }
};

const createPeerConnection = (iceServers) => new RTCPeerConnection({
  iceServers,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
});

const tuneAudioSender = (sender) => {
  const params = sender.getParameters?.();
  if (!params?.encodings?.length) return;
  params.encodings[0].maxBitrate = 32000;
  params.encodings[0].priority = 'high';
  sender.setParameters(params).catch(() => {});
};

const startDialTone = (ref) => {
  if (ref.current || typeof window === 'undefined') return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    gain.connect(ctx.destination);
    const play = () => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 440;
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.42);
    };
    play();
    const timer = window.setInterval(play, 1150);
    ref.current = { ctx, timer };
  } catch {
    /* ignore */
  }
};

const stopDialTone = (ref) => {
  if (!ref.current) return;
  window.clearInterval(ref.current.timer);
  ref.current.ctx?.close?.().catch(() => {});
  ref.current = null;
};

const playNotificationTone = () => {
  if (typeof window === 'undefined') return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
    
    oscillator.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch { /* ignore */ }
};

/* ── Activate account form ───────────────────────────────────────────────── */
function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="support-theme-toggle inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? <FiSun size={14} /> : <FiMoon size={14} />}
      {isDark ? 'Light' : 'Dark'}
    </button>
  );
}

function LogoutConfirmDialog({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="support-logout-title">
      <div className="support-dialog w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <FiAlertTriangle size={22} />
        </div>
        <h2 id="support-logout-title" className="text-2xl font-bold">Log out of support?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">You will be marked offline and active chats may stop receiving your replies. Please confirm before ending your session.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
            Stay signed in
          </button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700">
            Yes, logout
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivateForm({ token, onActivated, theme, onToggleTheme }) {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [show,     setShow]     = useState(false);
  const [err,      setErr]      = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setErr('Passwords do not match'); return; }
    setLoading(true); setErr('');
    try {
      await fetchJson('/api/support-executives/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      onActivated();
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  return (
    <div className={`support-console support-${theme} min-h-screen bg-slate-50 flex items-center justify-center p-4`}>
      <div className="absolute right-4 top-4">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-emerald-600 mb-2 font-medium">Activate account</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Set your password</h1>
        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="New password (min 8 chars)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 pr-12 text-sm" />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {show ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
            </button>
          </div>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            required placeholder="Confirm password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 text-sm" />
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Activating…' : 'Activate & sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Login form ──────────────────────────────────────────────────────────── */
function LoginForm({ onLogin, theme, onToggleTheme }) {
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [show,    setShow]    = useState(false);
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const data = await fetchJson('/api/support-executives/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      onLogin(data.executive);
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  return (
    <div className={`support-console support-${theme} min-h-screen bg-slate-50 flex items-center justify-center p-4`}>
      <div className="absolute right-4 top-4">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2 font-medium">Support executive</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Sign in</h1>
        <form onSubmit={submit} className="space-y-4">
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required placeholder="Email"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 text-sm" />
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required placeholder="Password"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 pr-12 text-sm" />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {show ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
            </button>
          </div>
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Animated calling screen ─────────────────────────────────────────────── */
function CallingScreen({ state, peerName, onAccept, onEnd, muted, onMute, speakerOn, onToggleSpeaker, screenOff, onWakeScreen }) {
  const isIncoming = state === 'incoming';
  const isActive   = state === 'active';
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {screenOff && isActive && (
        <button
          type="button"
          onClick={onWakeScreen}
          className="absolute inset-0 z-20 bg-black text-white flex flex-col items-center justify-center gap-3"
        >
          <FiSmartphone size={28} className="text-white/80" />
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">Tap to wake</span>
        </button>
      )}
      <div className="relative flex items-center justify-center mb-10">
        {[1,2,3].map(i => (
          <motion.div key={i} className="absolute rounded-full border border-emerald-400/30"
            animate={{ scale: [1, 1.4+i*0.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
            style={{ width: 80 + i*48, height: 80 + i*48 }} />
        ))}
        <div className="h-20 w-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center z-10">
          <FiUser size={32} className="text-emerald-300" />
        </div>
      </div>
      <p className="text-white/60 text-sm uppercase tracking-widest mb-2">
        {isIncoming ? 'Incoming call' : isActive ? 'On call' : 'Dialling…'}
      </p>
      <h2 className="text-3xl font-bold text-white mb-2">{peerName || 'Customer'}</h2>
      <p className="text-white/40 text-sm mb-10">{isIncoming ? 'Answer to join' : 'Connected audio session'}</p>
      <div className="flex items-center gap-6">
        {isActive && (
          <button onClick={onMute}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-500/30 border border-red-400 text-red-300' : 'bg-white/10 border border-white/20 text-white'}`}>
            {muted ? <FiMicOff size={22}/> : <FiMic size={22}/>}
          </button>
        )}
        {isActive && (
          <button onClick={onToggleSpeaker}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${speakerOn ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-700/60 border border-slate-500 text-slate-100'}`}>
            {speakerOn ? <FiVolume2 size={22}/> : <FiSmartphone size={22}/>}
          </button>
        )}
        {isIncoming && (
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={onAccept}
            className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
            <FiPhone size={26} className="text-white" />
          </motion.button>
        )}
        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={onEnd}
          className="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
          <FiPhoneOff size={26} className="text-white" />
        </motion.button>
      </div>
      {isActive && (
        <div className="flex items-end gap-1 mt-12 h-8">
          {Array.from({length:12}).map((_,i) => (
            <motion.div key={i} className="w-1.5 rounded-full bg-emerald-400"
              animate={{ height: [8, 4+Math.random()*24, 8] }}
              transition={{ duration: 0.5+Math.random()*0.5, repeat: Infinity, delay: i*0.07 }} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Main panel ──────────────────────────────────────────────────────────── */
export default function SupportExecutivePage() {
  const urlParams   = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const inviteToken = urlParams.get('invite');

  const [executive,    setExecutive]    = useState(null);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [activated,    setActivated]    = useState(false);
  const [onlineStatus, setOnlineStatus] = useState('offline');
  const [supportTheme, setSupportTheme] = useState(() => {
    try { return window.localStorage.getItem('pa_support_theme') || 'light'; } catch { return 'light'; }
  });
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mailAcct, setMailAcct] = useState(null);
  const loadMailAcct = () => fetchJson('/api/gmail?status=1', { credentials: 'include' }).then((d) => setMailAcct(d.connected ? { email: d.email } : false)).catch(() => setMailAcct(false));
  const disconnectMail = async () => { await fetchJson('/api/gmail', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) }).catch(() => {}); loadMailAcct(); };
  const [pwd, setPwd] = useState({ cur: '', next: '', show: false });
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [pwdBusy, setPwdBusy] = useState(false);
  const changePassword = async () => {
    if (!pwd.cur || !pwd.next) { setPwdMsg({ type: 'err', text: 'Enter your current and new password.' }); return; }
    if (pwd.next.length < 8) { setPwdMsg({ type: 'err', text: 'New password must be at least 8 characters.' }); return; }
    setPwdBusy(true); setPwdMsg({ type: '', text: '' });
    try {
      await fetchJson('/api/support-executives/change-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwd.cur, newPassword: pwd.next }) });
      setPwdMsg({ type: 'ok', text: 'Password updated.' }); setPwd({ cur: '', next: '', show: false });
    } catch (e) { setPwdMsg({ type: 'err', text: e.message }); } finally { setPwdBusy(false); }
  };

  const [sessions,     setSessions]     = useState([]);
  const [selectedId,   setSelectedId]   = useState('');
  const [previousSessionCount, setPreviousSessionCount] = useState(0);
  const [messages,     setMessages]     = useState([]);
  const [unattendedNotificationRef, setUnattendedNotificationRef] = useState(null);
  const [reply,        setReply]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [sessLoading,  setSessLoading]  = useState(false);
  const [error,        setError]        = useState('');
  // Queue modal
  const [queueModal,   setQueueModal]   = useState(false);
  const [queueItems,   setQueueItems]   = useState([]);
  const prevWaitingIds = useRef(new Set());
  const joinedRef = useRef(new Set());

  // Sidebar pagination + search
  const [sessPage,   setSessPage]   = useState(1);
  const [sessTab,    setSessTab]    = useState('all'); // all | incoming | mine
  const [sessSearch, setSessSearch] = useState('');

  // Team presence, internal chat & transfers
  const [colleagues,    setColleagues]    = useState([]);
  const [teamOpen,      setTeamOpen]      = useState(false);
  const [colleaguesOpen, setColleaguesOpen] = useState(false);
  const [colUnread, setColUnread] = useState(0);
  const [pushOn, setPushOn] = useState(false);
  useEffect(() => { isPushSubscribed().then(setPushOn); }, []);
  const togglepush = async () => {
    try {
      if (pushOn) { await disablePushNotifications(); setPushOn(false); }
      else { await enablePushNotifications(); setPushOn(true); }
    } catch (e) { window.alert(e.message || 'Could not change notifications'); }
  };
  const [internalWith,  setInternalWith]  = useState(null);   // colleague object
  const [internalMsgs,  setInternalMsgs]  = useState([]);
  const [internalInput, setInternalInput] = useState('');
  const [transferOpen,  setTransferOpen]  = useState(false);
  const [incomingTransfer, setIncomingTransfer] = useState(null);

  // Ticket center
  const [view,         setView]         = useState('chats');   // 'chats' | 'tickets'
  const [ticketModal,  setTicketModal]  = useState(null);      // null | prefill object

  // Voice call
  const [callState,  setCallState]  = useState(null);
  const [callRoomId, setCallRoomId] = useState(null);
  const [muted,      setMuted]      = useState(false);
  const [speakerOn,  setSpeakerOn]  = useState(true);
  const [screenOff,  setScreenOff]  = useState(false);
  const pcRef        = useRef(null);
  const localStream  = useRef(null);
  const remoteAudio  = useRef(null);
  const pollRoomRef  = useRef(null);
  const msgPollRef   = useRef(null);
  const messagesEndRef = useRef(null);
  const msgListRef   = useRef(null);
  const callRoomIdRef = useRef(null);
  const speechRef = useRef(null);
  const dialToneRef = useRef(null);
  const userScrolled = useRef(false);
  const prevMsgCount = useRef(0);
  // Idle detection → auto-offline after 10 min of no user activity
  const lastActiveRef = useRef(Date.now());
  const autoOfflineRef = useRef(false);
  const manualOfflineRef = useRef(false);

  callRoomIdRef.current = callRoomId;

  /* ── Instant teardown when admin revokes this account ─────────────────── */
  useEffect(() => {
    const onRevoked = () => setExecutive(null);
    window.addEventListener('pa-session-revoked', onRevoked);
    return () => window.removeEventListener('pa-session-revoked', onRevoked);
  }, []);

  /* ── Auth ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (inviteToken && !activated) { setAuthLoading(false); return; }
    fetchJson('/api/support-executives/me')
      .then(d => setExecutive(d.executive))
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, [inviteToken, activated]);

  /* ── Session polling ─────────────────────────────────────────────────── */
  const loadSessions = useCallback(async () => {
    setSessLoading(true);
    try {
      const d = await fetchJson('/api/support-chat?listSessions=1');
      const newSessions = d.sessions || [];
      
      // Check if new sessions arrived (excluding closed ones)
      const activeNewSessions = newSessions.filter(s => s.status !== 'closed');
      const activePreviousSessions = sessions.filter(s => s.status !== 'closed');
      
      // Detect genuinely new waiting sessions by ID
      const waitingNow = newSessions.filter(s => s.status === 'waiting');
      const newlyArrived = waitingNow.filter(s => !prevWaitingIds.current.has(s.conversation_id));
      prevWaitingIds.current = new Set(waitingNow.map(s => s.conversation_id));

      if (newlyArrived.length > 0) {
        playNotificationTone();
        setQueueItems(waitingNow);
        setQueueModal(true);
      } else if (waitingNow.length > 0) {
        // Keep queue items fresh even without new arrivals
        setQueueItems(waitingNow);
      }
      
      setSessions(newSessions);
      // Only auto-select first chat if not previously closed by executive
      const chatClosedByExecutive = localStorage.getItem('pa_executive_chat_closed') === 'true';
      setSelectedId(id => {
        if (id) return id; // Keep existing selection
        if (chatClosedByExecutive) return ''; // Don't auto-select if closed before
        return d.sessions?.[0]?.conversation_id || ''; // Auto-select first chat
      });

      // Handle persistent notifications for unattended chats
      const unattendedChats = newSessions.filter(s => 
        s.status === 'waiting' && onlineStatus === 'online'
      );
      
      if (unattendedChats.length > 0 && !selectedId) {
        // Start persistent notification if there are unattended chats and executive is online
        if (!unattendedNotificationRef) {
          const interval = setInterval(() => {
            playNotificationTone();
          }, 5000); // Play every 5 seconds
          setUnattendedNotificationRef(interval);
        }
      } else {
        // Stop persistent notification if no unattended chats or executive is busy/offline
        if (unattendedNotificationRef) {
          clearInterval(unattendedNotificationRef);
          setUnattendedNotificationRef(null);
        }
      }
    } catch (e) { setError(e.message); }
    finally { setSessLoading(false); }
  }, [sessions, onlineStatus, selectedId, unattendedNotificationRef]);

  useEffect(() => {
    if (!executive) return;
    loadSessions();
    const id = setInterval(loadSessions, 6000);
    return () => {
      clearInterval(id);
      if (unattendedNotificationRef) {
        clearInterval(unattendedNotificationRef);
      }
    };
  }, [executive, loadSessions, unattendedNotificationRef]);

  /* ── Filtered + paginated sessions ──────────────────────────────────── */
  const filteredSessions = useMemo(() => {
    const q = sessSearch.toLowerCase();
    return sessions.filter(s => {
      if (sessTab === 'incoming' && s.status !== 'waiting') return false;     // new + transferred-back land in 'waiting'
      if (sessTab === 'mine' && s.assigned_executive !== executive?.name) return false;
      return !q ||
        s.conversation_id?.toLowerCase().includes(q) ||
        s.customer_email?.toLowerCase().includes(q) ||
        s.assigned_executive?.toLowerCase().includes(q);
    });
  }, [sessions, sessSearch, sessTab, executive]);
  const incomingCount = useMemo(() => sessions.filter(s => s.status === 'waiting').length, [sessions]);

  const totalPages    = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pagedSessions = filteredSessions.slice((sessPage - 1) * PAGE_SIZE, sessPage * PAGE_SIZE);

  /* ── Smart scroll ────────────────────────────────────────────────────── */
  const handleMsgScroll = () => {
    const el = msgListRef.current;
    if (!el) return;
    userScrolled.current = (el.scrollHeight - el.scrollTop - el.clientHeight) > 80;
  };

  useEffect(() => {
    const newCount = messages.length;
    if (newCount > prevMsgCount.current && !userScrolled.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCount.current = newCount;
  }, [messages]);

  useEffect(() => {
    if (callState === 'calling' || callState === 'incoming') {
      startDialTone(dialToneRef);
    } else {
      stopDialTone(dialToneRef);
    }
    return () => stopDialTone(dialToneRef);
  }, [callState]);

  useEffect(() => {
    if (callState !== 'active') {
      setScreenOff(false);
      return undefined;
    }

    if (speakerOn) {
      setScreenOff(false);
      return undefined;
    }

    const ProximitySensor = window.ProximitySensor;
    if (ProximitySensor) {
      try {
        const sensor = new ProximitySensor({ frequency: 5 });
        sensor.addEventListener('reading', () => {
          setScreenOff(Boolean(sensor.distance !== null && sensor.distance <= (sensor.activatedDistance || 5)));
        });
        sensor.addEventListener('error', () => setScreenOff(true));
        sensor.start();
        return () => sensor.stop();
      } catch {
        setScreenOff(true);
        return undefined;
      }
    }

    const onDeviceProximity = (event) => {
      setScreenOff(Boolean(event?.value !== undefined && event.value <= 1));
    };
    if ('ondeviceproximity' in window) {
      window.addEventListener('deviceproximity', onDeviceProximity);
      return () => window.removeEventListener('deviceproximity', onDeviceProximity);
    }

    setScreenOff(true);
    return undefined;
  }, [callState, speakerOn]);

  /* ── Message polling ─────────────────────────────────────────────────── */
  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const d = await fetchJson(`/api/support-chat?conversationId=${encodeURIComponent(convId)}`);
      setMessages(d.messages || []);
    } catch { /* ignore */ }
  }, []);

  // When an executive opens a waiting session, mark it joined (waiting → active),
  // assign their name, and drop a system note so the customer sees who joined.
  const joinSession = useCallback(async (convId) => {
    if (!convId || !executive || joinedRef.current.has(convId)) return;
    const sess = sessions.find((s) => s.conversation_id === convId);
    if (sess && sess.status !== 'waiting') { joinedRef.current.add(convId); return; }
    joinedRef.current.add(convId);
    try {
      await fetchJson('/api/support-chat', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, status: 'active', assignedExecutive: executive.name })
      });
      await fetchJson('/api/support-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, sender: 'system', message: `${executive.name} joined the chat.` })
      });
      await loadSessions();
    } catch { joinedRef.current.delete(convId); }
  }, [executive, sessions, loadSessions]);

  useEffect(() => {
    if (msgPollRef.current) clearInterval(msgPollRef.current);
    if (!selectedId || !executive) return;
    userScrolled.current = false;
    joinSession(selectedId);
    loadMessages(selectedId);
    msgPollRef.current = setInterval(() => loadMessages(selectedId), 2000);
    return () => clearInterval(msgPollRef.current);
  }, [selectedId, executive, loadMessages, joinSession]);

  /* ── Poll for incoming customer call (global — any conversation) ─────── */
  useEffect(() => {
    // Poll while idle or already ringing; stop once a call is being connected/active.
    if (!executive || (callState && callState !== 'incoming')) return;
    const poll = async () => {
      try {
        const d = await fetchJson('/api/voice-room?incoming=1');
        const room = d.room;
        if (room && room.status === 'calling' && room.initiator === 'customer' && room.offer) {
          // Open the caller's conversation and start ringing the executive.
          if (room.conversation_id !== selectedId) setSelectedId(room.conversation_id);
          setCallRoomId(room.room_id);
          setCallState('incoming');
        } else if (callState === 'incoming') {
          // Customer hung up before we answered — stop ringing.
          setCallState(null);
          setCallRoomId(null);
        }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [executive, callState, selectedId]);

  /* ── Send reply ──────────────────────────────────────────────────────── */
  const sendReply = async () => {
    if (!reply.trim() || sending || !selectedId) return;
    setSending(true);
    userScrolled.current = false;
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, message: reply.trim(), sender: 'executive' })
      });
      setReply('');
      await loadMessages(selectedId);
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  const closeSession = async (convId) => {
    try {
      await fetchJson('/api/support-chat', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, status: 'closed' })
      });
      // Store that executive closed chat to prevent auto-opening
      localStorage.setItem('pa_executive_chat_closed', 'true');
      await loadSessions();
      if (selectedId === convId) setSelectedId('');
    } catch (e) { setError(e.message); }
  };

  const stopTranscription = useCallback(() => {
    if (!speechRef.current) return;
    speechRef.current.active = false;
    speechRef.current.recognition?.stop?.();
    if (speechRef.current.bulkSendInterval) {
      clearInterval(speechRef.current.bulkSendInterval);
    }
    // Send any remaining transcripts before stopping
    if (speechRef.current.transcripts.length > 0) {
      const bulkText = speechRef.current.transcripts.join(' ');
      fetchJson('/api/voice-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_transcript', roomId: speechRef.current.roomId, side: speechRef.current.side, text: bulkText })
      }).catch(() => {});
    }
    speechRef.current = null;
  }, []);

  const startTranscription = useCallback((roomId, side = 'executive') => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!roomId || !SpeechRecognition) return;
    stopTranscription();
    const recognition = new SpeechRecognition();
    const holder = { active: true, recognition, transcripts: [], roomId, side };
    speechRef.current = holder;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    // Send bulk transcriptions every 10 seconds
    const bulkSendInterval = setInterval(() => {
      if (holder.transcripts.length > 0) {
        const bulkText = holder.transcripts.join(' ');
        holder.transcripts = [];
        fetchJson('/api/voice-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bulk_transcript', roomId, side, text: bulkText })
        }).catch(() => {});
      }
    }, 10000);
    holder.bulkSendInterval = bulkSendInterval;
    
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (text) {
        holder.transcripts.push(text);
      }
    };
    recognition.onend = () => {
      if (holder.active) {
        try { recognition.start?.(); } catch { /* ignore */ }
      }
    };
    try { recognition.start(); } catch { /* ignore */ }
  }, [stopTranscription]);

  /* ── WebRTC ──────────────────────────────────────────────────────────── */
  const stopCall = useCallback(async (roomId) => {
    if (pollRoomRef.current) { clearInterval(pollRoomRef.current); pollRoomRef.current = null; }
    stopTranscription();
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    const r = roomId || callRoomIdRef.current;
    if (r) await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end', roomId: r }) }).catch(() => {});
    setCallState(null); setCallRoomId(null); setMuted(false);
    if (selectedId) loadMessages(selectedId);
  }, [loadMessages, selectedId, stopTranscription]);

  // Executive initiates call to customer
  const startVoiceCall = async () => {
    if (!selectedId) return;
    try {
      const iceServers = await getIceServers();
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      localStream.current = stream;
      const pc = createPeerConnection(iceServers);
      pcRef.current = pc;
      stream.getTracks().forEach(t => tuneAudioSender(pc.addTrack(t, stream)));
      pc.ontrack = (e) => { if (remoteAudio.current) remoteAudio.current.srcObject = e.streams[0]; };
      const pendingCandidates = [];
      let newRoomId = null;
      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate) return;
        if (newRoomId) {
          await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ice', roomId: newRoomId, candidate, side: 'caller' }) }).catch(() => {});
        } else { pendingCandidates.push(candidate); }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const d = await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', conversationId: selectedId, offer, initiator: 'executive' }) });
      newRoomId = d.room?.room_id;
      setCallRoomId(newRoomId);
      setCallState('calling');
      for (const c of pendingCandidates) {
        await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ice', roomId: newRoomId, candidate: c, side: 'caller' }) }).catch(() => {});
      }
      pollRoomRef.current = setInterval(async () => {
        try {
          const upd = await fetchJson(`/api/voice-room?roomId=${newRoomId}`);
          const room = upd.room;
          if (!room || room.status === 'ended') { stopCall(newRoomId); return; }
          if (room.answer && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(room.answer));
            for (const c of room.callee_candidates || []) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
            setCallState('active');
            startTranscription(newRoomId, 'executive');
          }
        } catch { /* ignore */ }
      }, 500);
    } catch (e) { console.error('exec startVoiceCall', e); }
  };

  // Executive accepts customer-initiated call
  const acceptCall = async () => {
    const rid = callRoomIdRef.current;
    if (!rid) return;
    try {
      const iceServers = await getIceServers();
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      localStream.current = stream;
      const pc = createPeerConnection(iceServers);
      pcRef.current = pc;
      stream.getTracks().forEach(t => tuneAudioSender(pc.addTrack(t, stream)));
      pc.ontrack = (e) => { if (remoteAudio.current) remoteAudio.current.srcObject = e.streams[0]; };
      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate) return;
        await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ice', roomId: rid, candidate, side: 'callee' }) }).catch(() => {});
      };
      const d = await fetchJson(`/api/voice-room?roomId=${rid}`);
      const offer = d.room?.offer;
      if (!offer) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const c of d.room?.caller_candidates || []) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'answer', roomId: rid, answer }) });
      setCallState('active');
      startTranscription(rid, 'executive');
      pollRoomRef.current = setInterval(async () => {
        try {
          const upd = await fetchJson(`/api/voice-room?roomId=${rid}`);
          if (upd.room?.status === 'ended') { stopCall(rid); return; }
          for (const c of upd.room?.caller_candidates || []) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
        } catch { /* ignore */ }
      }, 500);
    } catch (e) { console.error('acceptCall', e); stopCall(rid); }
  };

  const toggleMute = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleSpeaker = () => {
    setSpeakerOn((value) => {
      const next = !value;
      if (next) setScreenOff(false);
      return next;
    });
  };

  const updateStatus = async (newStatus) => {
    try {
      await fetchJson('/api/support-executives/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      manualOfflineRef.current = newStatus === 'offline';
      if (newStatus !== 'offline') lastActiveRef.current = Date.now();
      setOnlineStatus(newStatus);
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Track user activity; waking from auto-offline restores online ────── */
  useEffect(() => {
    if (!executive) return;
    const mark = () => {
      lastActiveRef.current = Date.now();
      if (autoOfflineRef.current) {
        autoOfflineRef.current = false;
        updateStatus('online');
      }
    };
    const evs = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    evs.forEach(e => window.addEventListener(e, mark, { passive: true }));
    return () => evs.forEach(e => window.removeEventListener(e, mark));
     
  }, [executive]);

  /* ── Presence heartbeat: go online on login, keep Redis presence fresh.
        After 10 min without activity, auto-switch to offline. ─────────────── */
  useEffect(() => {
    if (!executive) return;
    if (onlineStatus === 'offline' && !autoOfflineRef.current && !manualOfflineRef.current) setOnlineStatus('online');
    const ping = () => {
      const idle = Date.now() - lastActiveRef.current > IDLE_LIMIT_MS;
      if (idle && onlineStatus !== 'offline') {
        autoOfflineRef.current = true;
        fetchJson('/api/support-executives/status', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'offline' })
        }).catch(() => {});
        setOnlineStatus('offline');
        return;
      }
      if (onlineStatus === 'offline') return; // idle/offline — stop heartbeating so presence expires
      fetchJson('/api/support-executives/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: onlineStatus })
      }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 30000);
    return () => clearInterval(id);
     
  }, [executive, onlineStatus]);

  /* ── Poll colleague presence ───────────────────────────────────────────── */
  useEffect(() => {
    if (!executive) return;
    const load = () => fetchJson('/api/support-executives?colleagues=1')
      .then(d => setColleagues(d.colleagues || [])).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [executive]);

  /* ── Poll for incoming transfer requests addressed to me ───────────────── */
  useEffect(() => {
    if (!executive) return;
    const load = () => fetchJson('/api/support-executives/transfer')
      .then(d => setIncomingTransfer((d.incoming || [])[0] || null)).catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [executive]);

  /* ── Internal chat: poll messages with the selected colleague ──────────── */
  useEffect(() => {
    if (!internalWith) { setInternalMsgs([]); return; }
    const load = () => fetchJson(`/api/support-executives/internal?withId=${internalWith.id}`)
      .then(d => setInternalMsgs(d.messages || [])).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [internalWith]);

  const sendInternal = async () => {
    if (!internalInput.trim() || !internalWith) return;
    const text = internalInput.trim();
    setInternalInput('');
    try {
      await fetchJson('/api/support-executives/internal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId: internalWith.id, message: text })
      });
      const d = await fetchJson(`/api/support-executives/internal?withId=${internalWith.id}`);
      setInternalMsgs(d.messages || []);
    } catch (err) { setError(err.message); }
  };

  const transferTo = async (colleague) => {
    if (!selectedId) return;
    setTransferOpen(false);
    try {
      await fetchJson('/api/support-executives/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, toId: colleague.id, kind: callState ? 'call' : 'chat' })
      });
      setError('');
    } catch (err) { setError(err.message); }
  };

  // Reclaim a chat that was transferred away — reassign it to me and continue.
  const reclaimChat = async (convId) => {
    try {
      await fetchJson('/api/support-executives/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: convId, retract: true }) }).catch(() => {});
      await fetchJson('/api/support-chat', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: convId, status: 'active', assignedExecutive: executive.name }) });
      await fetchJson('/api/support-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: convId, sender: 'system', message: `${executive.name} took the chat back.` }) }).catch(() => {});
      joinedRef.current.add(convId);
      await loadSessions();
    } catch (err) { setError(err.message); }
  };

  const respondTransfer = async (action) => {
    if (!incomingTransfer) return;
    const t = incomingTransfer;
    setIncomingTransfer(null);
    try {
      const d = await fetchJson('/api/support-executives/transfer', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId: t.id, action })
      });
      if (action === 'accept' && d.conversationId) {
        joinedRef.current.add(d.conversationId); // already announced server-side
        setSelectedId(d.conversationId);
        await loadSessions();
      }
    } catch (err) { setError(err.message); }
  };

  const confirmLogout = async () => {
    setShowLogoutDialog(false);
    await fetchJson('/api/support-executives/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'offline' })
    }).catch(() => {});
    await fetchJson('/api/support-executives/logout', { method: 'DELETE' }).catch(() => {});
    setExecutive(null);
  };

  /* ── Render guards ───────────────────────────────────────────────────── */
  if (authLoading) {
    return <div className={`support-console support-${supportTheme} min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 text-sm`}>Loading…</div>;
  }
  if (inviteToken && !activated && !executive) {
    return <ActivateForm token={inviteToken} theme={supportTheme} onToggleTheme={() => setSupportTheme((current) => (current === 'dark' ? 'light' : 'dark'))} onActivated={() => setActivated(true)} />;
  }
  if (activated && !executive) {
    return <LoginForm theme={supportTheme} onToggleTheme={() => setSupportTheme((current) => (current === 'dark' ? 'light' : 'dark'))} onLogin={(exec) => { setExecutive(exec); setActivated(false); }} />;
  }
  if (!executive) {
    return <LoginForm theme={supportTheme} onToggleTheme={() => setSupportTheme((current) => (current === 'dark' ? 'light' : 'dark'))} onLogin={setExecutive} />;
  }

  const selectedSession = sessions.find(s => s.conversation_id === selectedId);
  // You can only chat/call on a session you currently own. After a transfer is
  // accepted, assigned_executive becomes the new agent → the previous agent goes
  // read-only. Calling the customer is only allowed on a live (active) chat.
  const chatOwned = Boolean(selectedSession) && (!selectedSession.assigned_executive || selectedSession.assigned_executive === executive?.name);
  // Customer is "live" only if their widget polled within the last 75s AND the
  // chat isn't closed — a transferred/abandoned chat stays 'active' but the
  // customer's last-seen goes stale, so the call button correctly disables.
  const chatLive = selectedSession?.status !== 'closed'
    && Boolean(selectedSession?.customer_last_seen_at)
    && (Date.now() - new Date(selectedSession.customer_last_seen_at).getTime() < 75000);

  return (
    <div className={`support-console support-${supportTheme} min-h-screen bg-slate-50 text-slate-900 flex flex-col`}>
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

      {showLogoutDialog && (
        <LogoutConfirmDialog onCancel={() => setShowLogoutDialog(false)} onConfirm={confirmLogout} />
      )}
      {showSettings && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><FiSettings size={16} /> Settings</h3><button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><FiX /></button></div>
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-1"><FiMail size={13} /> Connected mailbox (Gmail)</p>
            {mailAcct === null ? <p className="text-xs text-slate-400">Checking…</p>
              : mailAcct ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600 truncate">{mailAcct.email}</span>
                  <button onClick={disconnectMail} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium shrink-0">Disconnect</button>
                </div>
              ) : <p className="text-xs text-slate-400">No Gmail connected. Connect it from the Mail tab.</p>}

            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2"><FiLock size={13} /> Change password</p>
              <div className="space-y-2">
                <input type={pwd.show ? 'text' : 'password'} value={pwd.cur} onChange={(e) => setPwd((p) => ({ ...p, cur: e.target.value }))} placeholder="Current password" autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                <div className="relative">
                  <input type={pwd.show ? 'text' : 'password'} value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="New password (min 8 chars)" autoComplete="new-password"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-9 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                  <button type="button" onClick={() => setPwd((p) => ({ ...p, show: !p.show }))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{pwd.show ? <FiEyeOff size={14} /> : <FiEye size={14} />}</button>
                </div>
                {pwdMsg.text && <p className={`text-xs ${pwdMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{pwdMsg.text}</p>}
                <button onClick={changePassword} disabled={pwdBusy} className="w-full text-sm font-medium px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50">{pwdBusy ? 'Updating…' : 'Update password'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {callState && (
          <CallingScreen
            state={callState}
            peerName={selectedSession?.customer_name || selectedSession?.customer_email || selectedId || 'Customer'}
            muted={muted}
            speakerOn={speakerOn}
            screenOff={screenOff}
            onAccept={acceptCall}
            onEnd={() => stopCall()}
            onMute={toggleMute}
            onToggleSpeaker={toggleSpeaker}
            onWakeScreen={() => setScreenOff(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-3 sm:px-6 py-3 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2 shrink-0 shadow-sm">
        <div className="shrink-0">
          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 font-medium">Support Executive</p>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-[70vw]">{executive.name}</h1>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 flex-wrap lg:flex-nowrap w-full lg:w-auto">
          {/* Chats / Tickets view toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            {[{ key: 'chats', label: 'Chats', icon: FiMessageSquare }, { key: 'tickets', label: 'Tickets', icon: FiTag }, { key: 'mail', label: 'Mail', icon: FiMail }].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  view === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
          {/* Status Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            {['online', 'away', 'offline'].map((status) => (
              <button
                key={status}
                onClick={() => updateStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  onlineStatus === status
                    ? status === 'online' 
                      ? 'bg-emerald-500 text-white'
                      : status === 'away'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-300 text-slate-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          {/* Colleagues workspace: chat / groups / files / voice & video calls with team members and executives */}
          <button onClick={() => setColleaguesOpen(true)}
            className="relative flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
            <FiMessageSquare size={14} /> Colleagues
            {colUnread > 0 && !colleaguesOpen && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">{colUnread > 9 ? '9+' : colUnread}</span>
            )}
          </button>
          <NetworkDot className="mr-1" />
          {/* Team presence dropdown */}
          <Dropdown open={teamOpen} onClose={() => setTeamOpen(false)} className="relative">
            <button onClick={() => setTeamOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">
              <FiUsers size={14} /> Team
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] rounded-full bg-emerald-100 text-emerald-700">
                {colleagues.filter(c => c.status === 'online').length}
              </span>
            </button>
            {teamOpen && (
              <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2">
                <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Colleagues</p>
                {colleagues.length === 0 && <p className="px-2 py-2 text-xs text-slate-400">No colleagues yet.</p>}
                {colleagues.filter(c => c.email !== executive.email).map(c => (
                  <button key={c.id}
                    onClick={() => { setInternalWith(c); setTeamOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[c.status] || 'bg-slate-300'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-slate-800 truncate">{c.name}</span>
                      <span className="block text-[11px] text-slate-400 capitalize">{c.status === 'offline' && c.last_seen_at ? lastSeenText(c.last_seen_at) : c.status}</span>
                    </span>
                    <FiSend size={12} className="text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
<ThemeToggle
            theme={supportTheme}
            onToggle={() => setSupportTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          />
          <NotificationBell pushOn={pushOn} onTogglePush={togglepush} />
          <button onClick={loadSessions} className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <FiRefreshCw size={16} />
          </button>
          <button onClick={() => { setShowSettings(true); loadMailAcct(); }} title="Settings" className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <FiSettings size={16} />
          </button>
          <button onClick={() => setShowLogoutDialog(true)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            <FiLogOut size={15} /> Logout
          </button>
        </div>
      </header>

      {view === 'mail' ? (
        <div className="flex-1 overflow-y-auto p-4"><GrowthMail gmailOnly portal="support" /></div>
      ) : view === 'tickets' ? (
        <TicketsPanel onCreateNew={() => setTicketModal({})} />
      ) : (
      <div className="flex flex-1 overflow-hidden">
        {/* Session sidebar — on mobile it takes the full width and is replaced by
            the chat once a session is opened; desktop keeps both side-by-side. */}
        <aside className={`w-full md:w-72 border-r border-slate-200 bg-white flex-col shrink-0 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={sessSearch} onChange={e => { setSessSearch(e.target.value); setSessPage(1); }}
                placeholder="Search sessions…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
            </div>
            {/* New / transferred chats land in "Incoming"; accepting one opens it. */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 mt-2">
              {[['all', 'All'], ['incoming', 'Incoming'], ['mine', 'Mine']].map(([k, label]) => (
                <button key={k} onClick={() => { setSessTab(k); setSessPage(1); }}
                  className={`relative flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors ${sessTab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {label}
                  {k === 'incoming' && incomingCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">{incomingCount > 9 ? '9+' : incomingCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Sessions <span className="ml-1 text-slate-400">({filteredSessions.length})</span></p>
            {sessLoading && <span className="text-[10px] text-slate-400 animate-pulse">Refreshing…</span>}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!sessLoading && filteredSessions.length === 0 && (
              <p className="text-slate-400 text-xs p-4 text-center">No sessions found.</p>
            )}
            {pagedSessions.map(s => (
              <button key={s.conversation_id} type="button"
                onClick={() => { 
                  setSelectedId(s.conversation_id); 
                  userScrolled.current = false;
                  // Clear closed state since executive manually opened chat
                  localStorage.removeItem('pa_executive_chat_closed');
                }}
                className={`w-full text-left px-3 py-3 border-b border-slate-100 transition-colors ${
                  selectedId === s.conversation_id
                    ? 'bg-slate-900 text-white border-l-4 border-l-emerald-500'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${
                    s.status === 'waiting'
                      ? selectedId === s.conversation_id ? 'bg-amber-400/30 text-amber-200' : 'bg-amber-100 text-amber-700 animate-pulse'
                      : s.status === 'closed'
                      ? selectedId === s.conversation_id ? 'bg-slate-400/30 text-slate-300' : 'bg-slate-100 text-slate-500'
                      : selectedId === s.conversation_id ? 'bg-emerald-400/30 text-emerald-200' : 'bg-emerald-100 text-emerald-700'
                  }`}>{s.status === 'waiting' ? '● Incoming' : s.status}</span>
                  <span className={`text-[10px] ${selectedId === s.conversation_id ? 'text-white/40' : 'text-slate-400'}`}>{fmt(s.updated_at)}</span>
                </div>
                <p className="text-xs font-mono font-medium truncate">{s.conversation_id}</p>
                <p className={`text-xs truncate mt-0.5 ${selectedId === s.conversation_id ? 'text-white/60' : 'text-slate-500'}`}>
                  {s.customer_name || s.customer_email || 'Anonymous'}
                </p>
                {s.assigned_executive && (
                  <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${selectedId === s.conversation_id ? 'text-emerald-300' : 'text-emerald-600'}`}>
                    <FiCheck size={9}/>{s.assigned_executive}
                  </p>
                )}
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
              <button disabled={sessPage <= 1} onClick={() => setSessPage(p => p - 1)}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 transition-colors text-slate-600">
                <FiChevronLeft size={14}/>
              </button>
              <span className="text-xs text-slate-500 font-medium">{sessPage} / {totalPages}</span>
              <button disabled={sessPage >= totalPages} onClick={() => setSessPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-slate-100 transition-colors text-slate-600">
                <FiChevronRight size={14}/>
              </button>
            </div>
          )}
        </aside>

        {/* Chat panel */}
        <main className={`flex-1 flex-col overflow-hidden ${selectedId ? 'flex' : 'hidden md:flex'}`}>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Select a session to start chatting
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setSelectedId(null)} title="Back to sessions"
                    className="md:hidden shrink-0 p-1.5 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100">
                    <FiChevronLeft size={18} />
                  </button>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm font-mono truncate">{selectedId}</p>
                    <p className="text-xs text-slate-500 truncate">{selectedSession?.customer_name || selectedSession?.customer_email || 'Anonymous customer'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => setTicketModal({
                      conversationId: selectedId,
                      customerEmail: selectedSession?.customer_email || '',
                      customerName: selectedSession?.customer_name || ''
                    })}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors">
                    <FiTag size={12}/> Create ticket
                  </button>
                  {!callState && (
                    <button onClick={startVoiceCall} disabled={!chatLive || !chatOwned}
                      title={!chatOwned ? 'This chat is handled by another agent' : !chatLive ? 'The customer is not in an active chat' : 'Call the customer'}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      <FiPhone size={12}/> Call customer
                    </button>
                  )}
                  {/* Transfer / handoff */}
                  <Dropdown open={transferOpen} onClose={() => setTransferOpen(false)} className="relative">
                    <button onClick={() => setTransferOpen(o => !o)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors">
                      <FiCornerUpRight size={12}/> Transfer
                    </button>
                    {transferOpen && (
                      <div className="absolute right-0 mt-2 w-60 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2">
                        <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Transfer to</p>
                        {colleagues.filter(c => c.email !== executive.email).length === 0 && (
                          <p className="px-2 py-2 text-xs text-slate-400">No colleagues available.</p>
                        )}
                        {colleagues.filter(c => c.email !== executive.email).map(c => (
                          <button key={c.id} onClick={() => transferTo(c)}
                            title={c.status === 'offline' ? 'Offline — they’ll be notified by push & email' : ''}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors">
                            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[c.status] || 'bg-slate-300'}`} />
                            <span className="flex-1 text-sm text-slate-800 truncate">{c.name}</span>
                            <span className="text-[11px] text-slate-400 capitalize">{c.status === 'offline' && c.last_seen_at ? lastSeenText(c.last_seen_at) : c.status}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </Dropdown>
                  <button onClick={() => closeSession(selectedId)}
                    className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors">
                    Close chat
                  </button>
                </div>
              </div>

              <div ref={msgListRef} onScroll={handleMsgScroll}
                className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                {messages.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-8">No messages yet.</p>
                )}
                {messages.map(msg => (
                  <div key={msg.id}
                    className={`${msg.sender === 'system' ? 'mx-auto max-w-[92%] text-center border-amber-200 bg-amber-50 text-amber-800' : 'max-w-[75%]'} rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      msg.sender === 'system' ? '' : msg.sender === 'executive'
                        ? 'ml-auto bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    <p className={`text-[10px] uppercase tracking-wider mb-1 ${msg.sender === 'system' ? 'text-amber-600/70' : msg.sender === 'executive' ? 'text-white/40' : 'text-slate-400'}`}>
                      {msg.sender === 'system' ? 'Call event' : msg.sender === 'executive' ? (msg.executive_name || 'You') : 'Customer'} · {fmt(msg.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap leading-snug">{msg.message}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {!chatOwned ? (
                <div className="px-4 py-4 bg-white border-t border-slate-200 shrink-0 text-center">
                  <p className="text-xs text-slate-500">This chat was transferred to <span className="font-semibold text-slate-700">{selectedSession?.assigned_executive}</span>. It's read-only for you now.</p>
                  <button onClick={() => reclaimChat(selectedId)}
                    className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800">Take it back &amp; continue</button>
                </div>
              ) : (
              <>
              <div className="border-t border-slate-200 px-3 pt-2 bg-white flex flex-wrap gap-1.5 shrink-0">
                {CANNED_REPLIES.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setReply((r) => (r ? `${r} ${c.text}` : c.text))}
                    title={c.text}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="px-3 pb-3 pt-2 bg-white flex items-end gap-2 shrink-0">
                <textarea value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }}}
                  placeholder="Type a reply… (Enter to send)"
                  rows={2}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20 resize-none" />
                <button onClick={sendReply} disabled={sending || !reply.trim()}
                  className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 flex items-center justify-center disabled:opacity-40 transition-colors self-end">
                  <FiSend size={15} className="text-white"/>
                </button>
              </div>
              </>
              )}
            </>
          )}
        </main>
      </div>
      )}

      <TicketModal
        open={Boolean(ticketModal)}
        prefill={ticketModal || {}}
        onClose={() => setTicketModal(null)}
        onCreated={() => { if (selectedId) loadMessages(selectedId); }}
      />

      {/* ── Incoming transfer request prompt ──────────────────────────────── */}
      <AnimatePresence>
        {incomingTransfer && (
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 right-6 z-50 w-80 bg-white border border-indigo-200 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <FiCornerUpRight className="text-indigo-600" size={16} />
              <p className="text-sm font-bold text-slate-800">Incoming {incomingTransfer.kind === 'call' ? 'call' : 'chat'} transfer</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">{incomingTransfer.from_name}</span> wants to transfer a conversation to you.
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">{incomingTransfer.conversation_id}</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => respondTransfer('accept')}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 transition-colors">
                  Accept
                </button>
                <button onClick={() => respondTransfer('deny')}
                  className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 transition-colors">
                  Decline
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Internal colleague chat popover ───────────────────────────────── */}
      <AnimatePresence>
        {internalWith && (
          <motion.div
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-6 z-50 w-80 h-96 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center gap-2 shrink-0">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[internalWith.status] || 'bg-slate-300'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{internalWith.name}</p>
                <p className="text-[10px] text-white/50 capitalize">{internalWith.status} · internal</p>
              </div>
              <button onClick={() => setInternalWith(null)} className="text-white/60 hover:text-white"><FiX size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {internalMsgs.length === 0 && <p className="text-slate-400 text-xs text-center py-6">No messages yet. Say hi 👋</p>}
              {internalMsgs.map(m => (
                <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.from_name === executive.name ? 'ml-auto bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                  <p className="whitespace-pre-wrap leading-snug">{m.message}</p>
                  <p className={`text-[9px] mt-1 ${m.from_name === executive.name ? 'text-white/40' : 'text-slate-400'}`}>{fmt(m.created_at)}</p>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-slate-200 flex items-end gap-2 shrink-0">
              <textarea value={internalInput} onChange={e => setInternalInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInternal(); }}}
                rows={1} placeholder="Message colleague…"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900/20 resize-none" />
              <button onClick={sendInternal} disabled={!internalInput.trim()}
                className="h-9 w-9 rounded-xl bg-slate-900 hover:bg-slate-800 flex items-center justify-center disabled:opacity-40 transition-colors">
                <FiSend size={14} className="text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Incoming chat queue modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {queueModal && queueItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setQueueModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border-b border-amber-100">
                <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_0_4px_rgba(251,191,36,0.3)]" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    {queueItems.length === 1 ? 'Incoming chat request' : `${queueItems.length} chat requests in queue`}
                  </p>
                  <p className="text-xs text-slate-500">Join to start helping, or discard</p>
                </div>
                <button onClick={() => setQueueModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
                  ✕
                </button>
              </div>

              {/* Queue list */}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {queueItems.map((item, i) => (
                  <div key={item.conversation_id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {item.customer_name || item.customer_email || 'Anonymous visitor'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{item.conversation_id}</p>
                      {item.customer_email && (
                        <p className="text-[10px] text-slate-500 truncate">{item.customer_email}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedId(item.conversation_id);
                          localStorage.removeItem('pa_executive_chat_closed');
                          // Remove from queue items; close modal if empty
                          const remaining = queueItems.filter(q => q.conversation_id !== item.conversation_id);
                          setQueueItems(remaining);
                          if (remaining.length === 0) setQueueModal(false);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors"
                      >
                        Join
                      </button>
                      <button
                        onClick={async () => {
                          await closeSession(item.conversation_id);
                          const remaining = queueItems.filter(q => q.conversation_id !== item.conversation_id);
                          setQueueItems(remaining);
                          if (remaining.length === 0) setQueueModal(false);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button onClick={() => setQueueModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
                  Dismiss (handle later)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Colleagues workspace — ALWAYS mounted (never under display:none) so
          presence, incoming calls and message notifications work portal-wide,
          regardless of which screen the executive is on. */}
      {executive && (
        <Colleagues member={{ email: executive.email, name: executive.name }}
          visible={colleaguesOpen} fullscreen onClose={() => setColleaguesOpen(false)} onUnread={setColUnread}
          canShareMeetingLink />
      )}
    </div>
  );
}
