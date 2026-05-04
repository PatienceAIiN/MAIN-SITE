import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSend, FiPhone, FiPhoneOff, FiMic, FiMicOff, FiX } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(v)) : '';
const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

export default function LiveChatPage() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const conversationId = params.get('conversationId') || '';
  const initEmail      = params.get('customerEmail')  || '';

  const [email, setEmail]         = useState(initEmail);
  const [emailLocked, setEmailLocked] = useState(Boolean(initEmail));
  const [messages, setMessages]   = useState([]);
  const [session, setSession]     = useState(null);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [started, setStarted]     = useState(false);
  const [error, setError]         = useState('');
  const pollRef = useRef(null);
  const endRef  = useRef(null);

  // Voice call
  const [callState, setCallState] = useState(null); // null | 'calling' | 'active' | 'ended'
  const [muted, setMuted]         = useState(false);
  const [roomId, setRoomId]       = useState(null);
  const pcRef        = useRef(null);
  const localStream  = useRef(null);
  const remoteAudio  = useRef(null);
  const pollCallRef  = useRef(null);

  /* ── Poll messages ───────────────────────────────────────────────────── */
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const d = await fetchJson(`/api/support-chat?conversationId=${encodeURIComponent(conversationId)}&customerEmail=${encodeURIComponent(email)}`);
      setMessages(d.messages || []);
      setSession(d.session || null);
    } catch { /* ignore */ }
  }, [conversationId, email]);

  useEffect(() => {
    if (!started) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [started, fetchMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Start chat ─────────────────────────────────────────────────────── */
  const startChat = async () => {
    setError('');
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          customerEmail: email || null,
          message: 'Hello, I need help from a live agent.',
          sender: 'customer'
        })
      });
      setEmailLocked(true);
      setStarted(true);
    } catch (e) { setError(e.message); }
  };

  /* ── Send message ────────────────────────────────────────────────────── */
  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, customerEmail: email || null, message: input.trim(), sender: 'customer' })
      });
      setInput('');
      await fetchMessages();
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  /* ── Voice call: customer initiates ─────────────────────────────────── */
  const startVoiceCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;
      const pc = new RTCPeerConnection(STUN);
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = (e) => { if (remoteAudio.current) remoteAudio.current.srcObject = e.streams[0]; };
      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate) return;
        await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ice', roomId, candidate, side: 'caller' }) }).catch(() => {});
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const d = await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', conversationId, offer }) });
      const newRoomId = d.room?.room_id;
      setRoomId(newRoomId);
      setCallState('calling');

      // Poll for answer
      pollCallRef.current = setInterval(async () => {
        try {
          const upd = await fetchJson(`/api/voice-room?roomId=${newRoomId}`);
          const room = upd.room;
          if (!room) return;
          if (room.status === 'ended') { stopVoiceCall(newRoomId); return; }
          if (room.answer && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(room.answer));
            for (const c of room.callee_candidates || []) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
            setCallState('active');
          }
          if (room.status === 'active' && callState !== 'active') setCallState('active');
        } catch { /* ignore */ }
      }, 2000);
    } catch (e) { console.error('startVoiceCall', e); }
  };

  const stopVoiceCall = useCallback(async (rid) => {
    if (pollCallRef.current) { clearInterval(pollCallRef.current); pollCallRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    const r = rid || roomId;
    if (r) await fetchJson('/api/voice-room', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end', roomId: r }) }).catch(() => {});
    setCallState(null); setRoomId(null); setMuted(false);
  }, [roomId]);

  const toggleMute = () => {
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  /* ── Pre-start screen ────────────────────────────────────────────────── */
  if (!started) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs uppercase tracking-widest text-emerald-400">Live support</p>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Chat with an agent</h1>
          <p className="text-white/50 text-sm mb-6">A support executive will join shortly.</p>
          {!emailLocked && (
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Your email (optional)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 mb-3" />
          )}
          {error && <p className="text-red-300 text-sm mb-3">{error}</p>}
          <button onClick={startChat}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 transition-colors">
            Start chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col text-white overflow-hidden">
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

      {/* Calling overlay */}
      <AnimatePresence>
        {callState && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center"
          >
            <div className="relative flex items-center justify-center mb-8">
              {[1,2,3].map(i => (
                <motion.div key={i}
                  className="absolute rounded-full border border-emerald-400/25"
                  animate={{ scale: [1, 1.3+i*0.25, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i*0.35 }}
                  style={{ width: 64+i*40, height: 64+i*40 }}
                />
              ))}
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center z-10 text-2xl">
                {callState === 'active' ? '📞' : '📲'}
              </div>
            </div>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">
              {callState === 'calling' ? 'Calling support…' : callState === 'active' ? 'Connected' : 'Call ended'}
            </p>
            <h2 className="text-xl font-bold text-white mb-8">Support Executive</h2>
            {callState === 'active' && (
              <div className="flex items-end gap-1 h-6 mb-6">
                {Array.from({length:10}).map((_,i)=>(
                  <motion.div key={i} className="w-1.5 rounded-full bg-emerald-400"
                    animate={{ height: [4, 4+Math.random()*18, 4] }}
                    transition={{ duration: 0.45+Math.random()*0.4, repeat: Infinity, delay: i*0.06 }}
                  />
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
              <button onClick={() => stopVoiceCall()}
                className="h-14 w-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
                <FiPhoneOff size={22} className="text-white"/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${session?.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          <div>
            <p className="text-xs font-semibold text-white">
              {session?.status === 'active' ? `With ${session.assigned_executive || 'Support'}` : 'Waiting for agent…'}
            </p>
            {email && <p className="text-[10px] text-white/40">{email}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {started && session?.status === 'active' && !callState && (
            <button onClick={startVoiceCall}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30 transition-colors">
              <FiPhone size={12}/> Voice call
            </button>
          )}
          <button onClick={() => window.close()}
            className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <FiX size={16}/>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-white/30 text-sm">A support executive will join shortly.</p>
            <p className="text-white/20 text-xs mt-1">Usually within a few minutes.</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id}
            className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
              msg.sender === 'customer'
                ? 'ml-auto bg-white text-slate-900'
                : 'bg-slate-800 border border-white/10 text-white'
            }`}
          >
            {msg.sender === 'executive' && (
              <p className="text-[9px] uppercase tracking-wider text-emerald-400 mb-0.5">{msg.executive_name || 'Support'}</p>
            )}
            <p className="whitespace-pre-wrap leading-snug">{msg.message}</p>
            <p className="text-[9px] text-right mt-1 opacity-40">{fmt(msg.created_at)}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-2 bg-slate-900/80 flex items-end gap-2 shrink-0">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }}}
          placeholder="Type a message…"
          rows={2}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-emerald-400/60 resize-none"
        />
        <button onClick={send} disabled={sending || !input.trim()}
          className="h-9 w-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center disabled:opacity-50 transition-colors self-end">
          <FiSend size={14}/>
        </button>
      </div>
    </div>
  );
}
