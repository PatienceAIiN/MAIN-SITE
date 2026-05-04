import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPhone, FiPhoneOff, FiPhoneIncoming, FiMic, FiMicOff, FiSend,
  FiLogOut, FiUser, FiRefreshCw, FiCheck, FiEye, FiEyeOff, FiChevronLeft, FiChevronRight, FiSearch,
  FiVolume2, FiSmartphone
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';
const PAGE_SIZE = 10;

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
function ActivateForm({ token, onActivated }) {
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
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
function LoginForm({ onLogin }) {
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
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

  const [sessions,     setSessions]     = useState([]);
  const [selectedId,   setSelectedId]   = useState('');
  const [previousSessionCount, setPreviousSessionCount] = useState(0);
  const [messages,     setMessages]     = useState([]);
  const [unattendedNotificationRef, setUnattendedNotificationRef] = useState(null);
  const [reply,        setReply]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [sessLoading,  setSessLoading]  = useState(false);
  const [error,        setError]        = useState('');

  // Sidebar pagination + search
  const [sessPage,   setSessPage]   = useState(1);
  const [sessSearch, setSessSearch] = useState('');

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

  callRoomIdRef.current = callRoomId;

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
      
      // Play notification if new active sessions arrived
      if (activeNewSessions.length > activePreviousSessions.length && activePreviousSessions.length > 0) {
        playNotificationTone();
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
    return sessions.filter(s =>
      !q ||
      s.conversation_id?.toLowerCase().includes(q) ||
      s.customer_email?.toLowerCase().includes(q) ||
      s.assigned_executive?.toLowerCase().includes(q)
    );
  }, [sessions, sessSearch]);

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

  useEffect(() => {
    if (msgPollRef.current) clearInterval(msgPollRef.current);
    if (!selectedId || !executive) return;
    userScrolled.current = false;
    loadMessages(selectedId);
    msgPollRef.current = setInterval(() => loadMessages(selectedId), 2000);
    return () => clearInterval(msgPollRef.current);
  }, [selectedId, executive, loadMessages]);

  /* ── Poll for incoming customer call ─────────────────────────────────── */
  useEffect(() => {
    if (!selectedId || !executive || callState) return;
    const poll = async () => {
      try {
        const d = await fetchJson(`/api/voice-room?conversationId=${encodeURIComponent(selectedId)}`);
        const room = d.room;
        if (room && room.status === 'calling' && room.initiator === 'customer' && room.offer) {
          setCallRoomId(room.room_id);
          setCallState('incoming');
        } else if (room && room.status === 'ended') {
          // Client ended the call before executive joined
          setCallState(null);
          setCallRoomId(null);
        }
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 500);
    return () => clearInterval(id);
  }, [selectedId, executive, callState]);

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
      setOnlineStatus(newStatus);
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = async () => {
    await fetchJson('/api/support-executives/logout', { method: 'DELETE' }).catch(() => {});
    setExecutive(null);
  };

  /* ── Render guards ───────────────────────────────────────────────────── */
  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 text-sm">Loading…</div>;
  }
  if (inviteToken && !activated && !executive) {
    return <ActivateForm token={inviteToken} onActivated={() => setActivated(true)} />;
  }
  if (activated && !executive) {
    return <LoginForm onLogin={(exec) => { setExecutive(exec); setActivated(false); }} />;
  }
  if (!executive) {
    return <LoginForm onLogin={setExecutive} />;
  }

  const selectedSession = sessions.find(s => s.conversation_id === selectedId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

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
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-medium">Support Executive</p>
          <h1 className="text-lg font-bold text-slate-900">{executive.name}</h1>
        </div>
        <div className="flex items-center gap-3">
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
          <button onClick={loadSessions} className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <FiRefreshCw size={16} />
          </button>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            <FiLogOut size={15} /> Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Session sidebar */}
        <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={sessSearch} onChange={e => { setSessSearch(e.target.value); setSessPage(1); }}
                placeholder="Search sessions…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
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
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    s.status === 'waiting'
                      ? selectedId === s.conversation_id ? 'bg-amber-400/30 text-amber-200' : 'bg-amber-100 text-amber-700'
                      : selectedId === s.conversation_id ? 'bg-emerald-400/30 text-emerald-200' : 'bg-emerald-100 text-emerald-700'
                  }`}>{s.status}</span>
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
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Select a session to start chatting
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-white shrink-0">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm font-mono truncate">{selectedId}</p>
                  <p className="text-xs text-slate-500 truncate">{selectedSession?.customer_name || selectedSession?.customer_email || 'Anonymous customer'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!callState && (
                    <button onClick={startVoiceCall}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                      <FiPhone size={12}/> Call customer
                    </button>
                  )}
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

              <div className="border-t border-slate-200 p-3 bg-white flex items-end gap-2 shrink-0">
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
        </main>
      </div>
    </div>
  );
}
