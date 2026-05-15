import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiPhone, FiPhoneOff, FiPhoneIncoming, FiMic, FiMicOff, FiX, FiCopy, FiCheck, FiVolume2, FiSmartphone } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(v)) : '';

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
  } catch { /* ignore */ }
};

const stopDialTone = (ref) => {
  if (!ref.current) return;
  window.clearInterval(ref.current.timer);
  ref.current.ctx?.close?.().catch(() => {});
  ref.current = null;
};

export default function LiveChatPage() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const urlConvId   = params.get('conversationId') || '';
  const initEmail   = params.get('customerEmail')  || '';
  const initName    = params.get('customerName')   || '';
  const initMode    = params.get('mode') || '';

  // Pre-start form state
  const [convIdInput, setConvIdInput] = useState(urlConvId);
  const [nameInput,   setNameInput]   = useState(initName);
  const [emailInput,  setEmailInput]  = useState(initEmail);
  const [isReturning, setIsReturning] = useState(Boolean(urlConvId) && initMode !== 'new'); // true = continuation mode

  // Chat state
  const [conversationId, setConversationId] = useState(urlConvId);
  const [name,  setName]  = useState(initName);
  const [email, setEmail] = useState(initEmail);
  const [messages,  setMessages]  = useState([]);
  const [session,   setSession]   = useState(null);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [started,   setStarted]   = useState(false);
  const [error,     setError]     = useState('');
  const [agentJoinedToast, setAgentJoinedToast] = useState(false);
  const prevSessionStatus = useRef(null);

  // Copy convId banner
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const pollRef    = useRef(null);
  const msgListRef = useRef(null);
  const endRef     = useRef(null);
  const prevMsgCount = useRef(0);
  const userScrolled = useRef(false);

  // Voice call
  const [callState, setCallState] = useState(null); // null | 'calling' | 'incoming' | 'active'
  const [callRoomId, setCallRoomId] = useState(null);
  const [muted, setMuted]           = useState(false);
  const [speakerOn, setSpeakerOn]   = useState(true);
  const [screenOff, setScreenOff]   = useState(false);
  const pcRef       = useRef(null);
  const localStream = useRef(null);
  const remoteAudio = useRef(null);
  const pollCallRef = useRef(null);
  const callRoomIdRef = useRef(null);
  const speechRef = useRef(null);
  const dialToneRef = useRef(null);

  callRoomIdRef.current = callRoomId;

  /* ── Smart scroll: only auto-scroll when near bottom ─────────────────── */
  const scrollToBottom = useCallback((force = false) => {
    if (!endRef.current) return;
    if (force || !userScrolled.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = msgListRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    userScrolled.current = !nearBottom;
  }, []);

  useEffect(() => {
    const newCount = messages.length;
    if (newCount > prevMsgCount.current && isReturning) {
      scrollToBottom(false);
    }
    prevMsgCount.current = newCount;
  }, [messages, scrollToBottom, isReturning]);

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
      let sensor;
      try {
        sensor = new ProximitySensor({ frequency: 5 });
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

  /* ── Poll messages ────────────────────────────────────────────────────── */
  const fetchMessages = useCallback(async (convId, cEmail) => {
    if (!convId) return;
    try {
      const d = await fetchJson(
        `/api/support-chat?conversationId=${encodeURIComponent(convId)}&customerEmail=${encodeURIComponent(cEmail || '')}`
      );
      setMessages(d.messages || []);
      const newSession = d.session || null;
      setSession(newSession);
      // Detect when agent joins (status flips to 'active')
      if (prevSessionStatus.current !== 'active' && newSession?.status === 'active') {
        setAgentJoinedToast(true);
        setTimeout(() => setAgentJoinedToast(false), 5000);
      }
      prevSessionStatus.current = newSession?.status || null;
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!started) return;
    fetchMessages(conversationId, email);
    pollRef.current = setInterval(() => fetchMessages(conversationId, email), 2500);
    return () => clearInterval(pollRef.current);
  }, [started, conversationId, email, fetchMessages]);

  /* ── Poll for exec-initiated voice call ──────────────────────────────── */
  useEffect(() => {
    if (!started || !conversationId || callState) return;
    const poll = async () => {
      try {
        const d = await fetchJson(`/api/voice-room?conversationId=${encodeURIComponent(conversationId)}`);
        const room = d.room;
        if (room && room.status === 'calling' && room.initiator === 'executive' && room.offer) {
          setCallRoomId(room.room_id);
          setCallState('incoming');
        }
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 500);
    return () => clearInterval(id);
  }, [started, conversationId, callState]);

  /* ── Start new chat ───────────────────────────────────────────────────── */
  const startNewChat = async () => {
    setError('');
    if (!nameInput.trim()) { setError('Please enter your name.'); return; }
    if (!emailInput.trim()) { setError('Please enter your email.'); return; }
    const newConvId = convIdInput.trim() || urlConvId || `PatienceAILive-${crypto.randomUUID().replace(/-/g,'').slice(0,6)}`;
    if (!newConvId.startsWith('PatienceAILive-')) { setError('Invalid conversation ID.'); return; }
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: newConvId,
          customerEmail: emailInput.trim() || null,
          customerName:  nameInput.trim(),
          message: `Hello, I need help from a live agent. — ${nameInput.trim()}`,
          sender: 'customer'
        })
      });
      setConversationId(newConvId);
      setName(nameInput.trim());
      setEmail(emailInput.trim());
      prevMsgCount.current = 0;
      setStarted(true);
      userScrolled.current = false;
    } catch (e) { setError(e.message); }
  };

  /* ── Continue existing chat ───────────────────────────────────────────── */
  const continueChat = async () => {
    setError('');
    if (!convIdInput.trim()) { setError('Please enter your conversation ID.'); return; }
    const cid = convIdInput.trim();
    try {
      // Just load messages — no new message sent
      const d = await fetchJson(
        `/api/support-chat?conversationId=${encodeURIComponent(cid)}&customerEmail=${encodeURIComponent(emailInput || '')}`
      );
      if (!d.session) { setError('Conversation not found. Check the ID and try again.'); return; }
      setConversationId(cid);
      setName(nameInput.trim() || d.session?.customer_email?.split('@')[0] || 'You');
      setEmail(emailInput.trim() || d.session?.customer_email || '');
      setMessages(d.messages || []);
      setSession(d.session || null);
      prevMsgCount.current = d.messages?.length || 0;
      setStarted(true);
      userScrolled.current = true;
    } catch (e) { setError(e.message || 'Could not load conversation.'); }
  };

  /* ── Send message ─────────────────────────────────────────────────────── */
  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    userScrolled.current = false; // force scroll on own message
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, customerEmail: email || null, message: input.trim(), sender: 'customer' })
      });
      setInput('');
      await fetchMessages(conversationId, email);
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  /* ── Copy conversation ID ─────────────────────────────────────────────── */
  const copyConvId = () => {
    navigator.clipboard?.writeText(conversationId).catch(() => {});
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2000);
  };

  const stopTranscription = useCallback(() => {
    if (!speechRef.current) return;
    speechRef.current.active = false;
    speechRef.current.recognition?.stop?.();
    speechRef.current = null;
  }, []);

  const clearVoiceCallUi = useCallback(() => {
    if (pollCallRef.current) { clearInterval(pollCallRef.current); pollCallRef.current = null; }
    stopTranscription();
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    setCallState(null);
    setCallRoomId(null);
    setMuted(false);
    setScreenOff(false);
  }, [stopTranscription]);

  const startTranscription = useCallback((roomId, side = 'customer') => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!roomId || !SpeechRecognition) return;
    stopTranscription();
    const recognition = new SpeechRecognition();
    const holder = { active: true, recognition };
    speechRef.current = holder;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (text) {
        fetchJson('/api/voice-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'transcript', roomId, side, text })
        }).catch(() => {});
      }
    };
    recognition.onend = () => {
      if (holder.active) {
        try { recognition.start?.(); } catch { /* ignore */ }
      }
    };
    try { recognition.start(); } catch { /* ignore */ }
  }, [stopTranscription]);

  /* ── WebRTC helpers ───────────────────────────────────────────────────── */
  const stopVoiceCall = useCallback(async (rid) => {
    clearVoiceCallUi();
    const r = rid || callRoomIdRef.current;
    if (r) await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end', roomId: r }) }).catch(() => {});
    fetchMessages(conversationId, email);
  }, [clearVoiceCallUi, conversationId, email, fetchMessages]);

  useEffect(() => {
    if (!conversationId || !callState) return;
    const pollRemoteEnd = async () => {
      const rid = callRoomIdRef.current;
      if (!rid) return;
      try {
        const d = await fetchJson(`/api/voice-room?roomId=${encodeURIComponent(rid)}`);
        if (!d.room || d.room.status === 'ended') {
          clearVoiceCallUi();
          fetchMessages(conversationId, email);
        }
      } catch {
        /* ignore polling errors */
      }
    };
    const timer = window.setInterval(pollRemoteEnd, 350);
    return () => window.clearInterval(timer);
  }, [callState, clearVoiceCallUi, conversationId, email, fetchMessages]);

  /* ── Customer initiates voice call ───────────────────────────────────── */
  const startVoiceCall = async () => {
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
        } else {
          pendingCandidates.push(candidate);
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const d = await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', conversationId, offer, initiator: 'customer' }) });
      newRoomId = d.room?.room_id;
      setCallRoomId(newRoomId);
      setCallState('calling');
      // flush pending ICE candidates
      for (const c of pendingCandidates) {
        await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ice', roomId: newRoomId, candidate: c, side: 'caller' }) }).catch(() => {});
      }
      // Poll for answer
      pollCallRef.current = setInterval(async () => {
        try {
          const upd = await fetchJson(`/api/voice-room?roomId=${newRoomId}`);
          const room = upd.room;
          if (!room || room.status === 'ended') { stopVoiceCall(newRoomId); return; }
          if (room.answer && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(room.answer));
            for (const c of room.callee_candidates || []) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
            setCallState('active');
            startTranscription(newRoomId, 'customer');
          }
        } catch { /* ignore */ }
      }, 500);
    } catch (e) { console.error('startVoiceCall', e); }
  };

  /* ── Customer accepts exec-initiated call ─────────────────────────────── */
  const acceptIncomingCall = async () => {
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
      startTranscription(rid, 'customer');
      pollCallRef.current = setInterval(async () => {
        try {
          const upd = await fetchJson(`/api/voice-room?roomId=${rid}`);
          if (upd.room?.status === 'ended') { stopVoiceCall(rid); return; }
          for (const c of upd.room?.caller_candidates || []) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
        } catch { /* ignore */ }
      }, 500);
    } catch (e) { console.error('acceptIncomingCall', e); stopVoiceCall(rid); }
  };

  const toggleMute = () => {
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleSpeaker = () => {
    setSpeakerOn((value) => {
      const next = !value;
      if (next) setScreenOff(false);
      return next;
    });
  };

  /* ── Pre-start screen ─────────────────────────────────────────────────── */
  if (!started) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs uppercase tracking-widest text-emerald-600 font-medium">Live support</p>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Chat with an agent</h1>
          <p className="text-slate-500 text-sm mb-6">A support executive will join shortly.</p>

          {!isReturning && convIdInput && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold">Save this conversation ID</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="font-mono text-sm font-bold text-amber-950 break-all">{convIdInput}</p>
                <button type="button" onClick={() => navigator.clipboard?.writeText(convIdInput).catch(() => {})}
                  className="h-8 w-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                  <FiCopy size={13}/>
                </button>
              </div>
            </div>
          )}

          {/* Toggle: new chat vs continue */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-5 text-sm font-medium">
            <button
              onClick={() => setIsReturning(false)}
              className={`flex-1 py-2.5 transition-colors ${!isReturning ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            >New chat</button>
            <button
              onClick={() => setIsReturning(true)}
              className={`flex-1 py-2.5 transition-colors ${isReturning ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            >Continue chat</button>
          </div>

          {isReturning ? (
            <div className="space-y-3">
              <input value={convIdInput} onChange={e => setConvIdInput(e.target.value)}
                placeholder="Conversation ID (PatienceAILive-...)"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/30 text-sm" />
              <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/30 text-sm" />
              <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                placeholder="Your email *"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/30 text-sm" />
            </div>
          ) : (
            <div className="space-y-3">
              <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                placeholder="Your name *"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/30 text-sm" />
              <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                placeholder="Your email (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/30 text-sm" />
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          <button
            onClick={isReturning ? continueChat : startNewChat}
            className="w-full mt-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 transition-colors text-sm">
            {isReturning ? 'Load conversation' : 'Start chat'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col text-slate-900 overflow-hidden relative">
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

      {/* Voice call overlay */}
      <AnimatePresence>
        {callState && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center">
            {screenOff && callState === 'active' && (
              <button
                type="button"
                onClick={() => setScreenOff(false)}
                className="absolute inset-0 z-20 bg-black text-white flex flex-col items-center justify-center gap-3"
              >
                <FiSmartphone size={28} className="text-white/80" />
                <span className="text-xs uppercase tracking-[0.3em] text-white/60">Tap to wake</span>
              </button>
            )}
            <div className="relative flex items-center justify-center mb-8">
              {[1,2,3].map(i => (
                <motion.div key={i} className="absolute rounded-full border border-emerald-400/30"
                  animate={{ scale: [1, 1.3+i*0.25, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i*0.35 }}
                  style={{ width: 64+i*40, height: 64+i*40 }} />
              ))}
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center z-10 text-2xl">
                {callState === 'active' ? '📞' : callState === 'incoming' ? '📲' : '📲'}
              </div>
            </div>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">
              {callState === 'calling' ? 'Dialling…' : callState === 'incoming' ? 'Incoming call' : 'Connected'}
            </p>
            <h2 className="text-xl font-bold text-white mb-2">{session?.assigned_executive || 'Support Executive'}</h2>
            <p className="text-white/45 text-xs mb-8">{name || email || conversationId}</p>
            {callState === 'active' && (
              <div className="flex items-end gap-1 h-6 mb-6">
                {Array.from({length:10}).map((_,i)=>(
                  <motion.div key={i} className="w-1.5 rounded-full bg-emerald-400"
                    animate={{ height: [4, 4+Math.random()*18, 4] }}
                    transition={{ duration: 0.45+Math.random()*0.4, repeat: Infinity, delay: i*0.06 }} />
                ))}
              </div>
            )}
            <div className="flex items-center gap-4">
              {callState === 'active' && (
                <button onClick={toggleMute}
                  className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-500/30 border border-red-400 text-red-300' : 'bg-white/10 border border-white/20 text-white'}`}>
                  {muted ? <FiMicOff size={18}/> : <FiMic size={18}/>}
                </button>
              )}
              {callState === 'active' && (
                <button onClick={toggleSpeaker}
                  className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors ${speakerOn ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-700/60 border border-slate-500 text-slate-100'}`}>
                  {speakerOn ? <FiVolume2 size={18}/> : <FiSmartphone size={18}/>}
                </button>
              )}
              {callState === 'incoming' && (
                <button onClick={acceptIncomingCall}
                  className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                  <FiPhoneIncoming size={20} className="text-white"/>
                </button>
              )}
              <button onClick={() => stopVoiceCall()}
                className="h-14 w-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
                <FiPhoneOff size={22} className="text-white"/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save convId banner */}
      <AnimatePresence>
        {!bannerDismissed && conversationId && (
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-amber-800 font-medium flex-1 min-w-0">
              Save your chat ID to continue later: <span className="font-mono font-bold">{conversationId}</span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={copyConvId}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium transition-colors">
                {copiedBanner ? <><FiCheck size={11}/> Copied!</> : <><FiCopy size={11}/> Copy ID</>}
              </button>
              <button onClick={() => setBannerDismissed(true)} className="text-amber-600 hover:text-amber-900 p-1">
                <FiX size={14}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent joined toast */}
      <AnimatePresence>
        {agentJoinedToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="absolute top-3 left-3 right-3 z-20 flex items-center gap-3 bg-emerald-600 text-white rounded-xl px-4 py-3 shadow-lg"
          >
            <span className="h-2 w-2 rounded-full bg-white animate-pulse shrink-0" />
            <p className="text-sm font-semibold flex-1">
              {session?.assigned_executive || 'A support agent'} has joined the chat!
            </p>
            <button onClick={() => setAgentJoinedToast(false)} className="text-white/70 hover:text-white">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${
            session?.status === 'active' ? 'bg-emerald-500 animate-pulse'
            : session?.status === 'closed' ? 'bg-slate-400'
            : 'bg-amber-400 animate-pulse'
          }`} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {session?.status === 'closed' ? 'Chat closed' : session?.status === 'active' ? `With ${session.assigned_executive || 'Support'}` : 'Waiting for agent…'}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{name || email || 'Guest'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {session?.status === 'active' && !callState && (
            <button onClick={startVoiceCall}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
              <FiPhone size={12}/> Call
            </button>
          )}
          <button onClick={() => window.close()}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <FiX size={16}/>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={msgListRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">A support executive will join shortly.</p>
            <p className="text-slate-300 text-xs mt-1">Usually within a few minutes.</p>
          </div>
        )}
        {messages.map(msg => (
          msg.sender === 'system' ? (
            <div key={msg.id} className="mx-auto max-w-[92%] rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-800 shadow-sm">
              {msg.message} <span className="text-amber-600/70">{fmt(msg.created_at)}</span>
            </div>
          ) : (
            <div key={msg.id}
              className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                msg.sender === 'customer'
                  ? 'ml-auto bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              {msg.sender === 'executive' && (
                <p className="text-[9px] uppercase tracking-wider text-emerald-600 mb-0.5 font-medium">{msg.executive_name || 'Support'}</p>
              )}
              <p className="whitespace-pre-wrap leading-snug">{msg.message}</p>
              <p className={`text-[9px] text-right mt-1 ${msg.sender === 'customer' ? 'text-white/40' : 'text-slate-400'}`}>{fmt(msg.created_at)}</p>
            </div>
          )
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-2 bg-white flex items-end gap-2 shrink-0">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }}}
          placeholder="Type a message…"
          rows={2}
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/30 resize-none"
        />
        <button onClick={send} disabled={sending || !input.trim()}
          className="h-9 w-9 rounded-xl bg-slate-900 hover:bg-slate-800 flex items-center justify-center disabled:opacity-40 transition-colors self-end">
          <FiSend size={14} className="text-white"/>
        </button>
      </div>
    </div>
  );
}
