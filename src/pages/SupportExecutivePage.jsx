import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiPhoneOff, FiPhoneIncoming, FiMic, FiMicOff, FiSend, FiLogOut, FiUser, FiRefreshCw, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';

const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

/* ── Activate account form (from invite link) ───────────────────────────── */
function ActivateForm({ token, onActivated }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [show, setShow]         = useState(false);
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setErr('Passwords do not match'); return; }
    setLoading(true); setErr('');
    try {
      await fetchJson('/api/support-executives/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      onActivated();
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-2">Activate account</p>
        <h1 className="text-2xl font-bold text-white mb-6">Set your password</h1>
        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)}
              required placeholder="New password (min 8 chars)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 pr-12" />
            <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
              {show ? <FiEyeOff/> : <FiEye/>}
            </button>
          </div>
          <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}
            required placeholder="Confirm password"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/60" />
          {err && <p className="text-red-300 text-sm">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 disabled:opacity-50 transition-colors">
            {loading ? 'Activating…' : 'Activate & Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Login form ─────────────────────────────────────────────────────────── */
function LoginForm({ onLogin }) {
  const [form, setForm]   = useState({ email: '', password: '' });
  const [show, setShow]   = useState(false);
  const [err, setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const data = await fetchJson('/api/support-executives/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      onLogin(data.executive);
    } catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8">
        <p className="text-xs uppercase tracking-widest text-cyan-400 mb-2">Support executive</p>
        <h1 className="text-2xl font-bold text-white mb-6">Sign in</h1>
        <form onSubmit={submit} className="space-y-4">
          <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
            required placeholder="Email"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/60" />
          <div className="relative">
            <input type={show?'text':'password'} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
              required placeholder="Password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 pr-12" />
            <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
              {show ? <FiEyeOff/> : <FiEye/>}
            </button>
          </div>
          {err && <p className="text-red-300 text-sm">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold py-3 disabled:opacity-50 transition-colors">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Animated calling screen ─────────────────────────────────────────────── */
function CallingScreen({ state, peerName, onAccept, onEnd, muted, onMute }) {
  const isIncoming = state === 'incoming';
  const isActive   = state === 'active';
  const isCalling  = state === 'calling';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950"
    >
      {/* Pulsing rings */}
      <div className="relative flex items-center justify-center mb-10">
        {[1,2,3].map(i => (
          <motion.div key={i}
            className="absolute rounded-full border border-emerald-400/30"
            animate={{ scale: [1, 1.4+i*0.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
            style={{ width: 80 + i*48, height: 80 + i*48 }}
          />
        ))}
        <div className="h-20 w-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center z-10">
          <FiUser size={32} className="text-emerald-300" />
        </div>
      </div>

      <p className="text-white/60 text-sm uppercase tracking-widest mb-2">
        {isIncoming ? 'Incoming voice call' : isActive ? 'On call' : 'Calling…'}
      </p>
      <h2 className="text-3xl font-bold text-white mb-10">{peerName || 'Customer'}</h2>

      <div className="flex items-center gap-6">
        {/* Mute */}
        {(isActive) && (
          <button onClick={onMute}
            className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-500/30 border border-red-400 text-red-300' : 'bg-white/10 border border-white/20 text-white'}`}>
            {muted ? <FiMicOff size={22}/> : <FiMic size={22}/>}
          </button>
        )}

        {/* Accept (incoming only) */}
        {isIncoming && (
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
            onClick={onAccept}
            className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
            <FiPhone size={26} className="text-white" />
          </motion.button>
        )}

        {/* End / Reject */}
        <motion.button
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
          onClick={onEnd}
          className="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40">
          <FiPhoneOff size={26} className="text-white" />
        </motion.button>
      </div>

      {/* Soundwave bar (active only) */}
      {isActive && (
        <div className="flex items-end gap-1 mt-12 h-8">
          {Array.from({length:12}).map((_,i)=>(
            <motion.div key={i}
              className="w-1.5 rounded-full bg-emerald-400"
              animate={{ height: [8, 4+Math.random()*24, 8] }}
              transition={{ duration: 0.5+Math.random()*0.5, repeat: Infinity, delay: i*0.07 }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Main panel ─────────────────────────────────────────────────────────── */
export default function SupportExecutivePage() {
  const urlParams  = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const inviteToken = urlParams.get('invite');

  const [executive, setExecutive]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activated, setActivated]   = useState(false);

  const [sessions, setSessions]         = useState([]);
  const [selectedId, setSelectedId]     = useState('');
  const [messages, setMessages]         = useState([]);
  const [reply, setReply]               = useState('');
  const [sending, setSending]           = useState(false);
  const [sessLoading, setSessLoading]   = useState(false);
  const [error, setError]               = useState('');

  // Voice call state
  const [callState, setCallState]   = useState(null); // null | 'incoming' | 'calling' | 'active'
  const [callRoomId, setCallRoomId] = useState(null);
  const [muted, setMuted]           = useState(false);
  const pcRef       = useRef(null);
  const localStream = useRef(null);
  const remoteAudio = useRef(null);
  const pollRoomRef = useRef(null);
  const msgPollRef  = useRef(null);
  const messagesEndRef = useRef(null);

  /* ── Auth check ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (inviteToken && !activated) { setAuthLoading(false); return; }
    fetchJson('/api/support-executives/me')
      .then(d => { setExecutive(d.executive); })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, [inviteToken, activated]);

  /* ── Session polling ────────────────────────────────────────────────── */
  const loadSessions = useCallback(async () => {
    setSessLoading(true);
    try {
      const d = await fetchJson('/api/support-chat?listSessions=1');
      const list = (d.sessions || []).filter(s => s.status !== 'closed');
      setSessions(list);
      setSelectedId(id => id || list[0]?.conversation_id || '');
    } catch (e) { setError(e.message); }
    finally { setSessLoading(false); }
  }, []);

  useEffect(() => {
    if (!executive) return;
    loadSessions();
    const id = setInterval(loadSessions, 8000);
    return () => clearInterval(id);
  }, [executive, loadSessions]);

  /* ── Message polling for selected session ───────────────────────────── */
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
    loadMessages(selectedId);
    msgPollRef.current = setInterval(() => loadMessages(selectedId), 3000);
    return () => clearInterval(msgPollRef.current);
  }, [selectedId, executive, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Send reply ─────────────────────────────────────────────────────── */
  const sendReply = async () => {
    if (!reply.trim() || sending || !selectedId) return;
    setSending(true);
    try {
      await fetchJson('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      await loadSessions();
      if (selectedId === convId) setSelectedId('');
    } catch (e) { setError(e.message); }
  };

  /* ── WebRTC helpers ─────────────────────────────────────────────────── */
  const stopCall = useCallback(async (roomId) => {
    if (pollRoomRef.current) { clearInterval(pollRoomRef.current); pollRoomRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    if (roomId || callRoomId) {
      await fetchJson('/api/voice-room', { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'end', roomId: roomId || callRoomId }) }).catch(()=>{});
    }
    setCallState(null);
    setCallRoomId(null);
    setMuted(false);
  }, [callRoomId]);

  // Executive: poll for incoming call offers on selected conversation
  useEffect(() => {
    if (!selectedId || !executive || callState) return;
    const poll = async () => {
      try {
        const d = await fetchJson(`/api/voice-room?conversationId=${encodeURIComponent(selectedId)}`);
        const room = d.room;
        if (room && room.status === 'calling' && room.offer) {
          setCallRoomId(room.room_id);
          setCallState('incoming');
        }
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [selectedId, executive, callState]);

  const acceptCall = async () => {
    if (!callRoomId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;
      const pc = new RTCPeerConnection(STUN);
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (remoteAudio.current) { remoteAudio.current.srcObject = e.streams[0]; }
      };
      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate) return;
        await fetchJson('/api/voice-room', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'ice', roomId: callRoomId, candidate, side:'callee' }) }).catch(()=>{});
      };

      // Get offer
      const d = await fetchJson(`/api/voice-room?roomId=${callRoomId}`);
      const offer = d.room?.offer;
      if (!offer) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Add caller ICE candidates
      const callerCands = d.room?.caller_candidates || [];
      for (const c of callerCands) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await fetchJson('/api/voice-room', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'answer', roomId: callRoomId, answer }) });

      setCallState('active');

      // Poll for callee candidates from caller side
      pollRoomRef.current = setInterval(async () => {
        try {
          const upd = await fetchJson(`/api/voice-room?roomId=${callRoomId}`);
          if (upd.room?.status === 'ended') { stopCall(callRoomId); return; }
          const newCands = upd.room?.caller_candidates || [];
          for (const c of newCands) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
          }
        } catch { /* ignore */ }
      }, 2000);
    } catch (e) { console.error('acceptCall error', e); stopCall(callRoomId); }
  };

  const toggleMute = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  /* ── Logout ─────────────────────────────────────────────────────────── */
  const logout = async () => {
    await fetchJson('/api/support-executives/logout', { method: 'DELETE' }).catch(()=>{});
    setExecutive(null);
  };

  /* ── Render guards ──────────────────────────────────────────────────── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white/50">
        Loading…
      </div>
    );
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudio} autoPlay playsInline style={{ display: 'none' }} />

      {/* Voice call overlay */}
      <AnimatePresence>
        {callState && (
          <CallingScreen
            state={callState}
            peerName={selectedSession?.customer_email || 'Customer'}
            muted={muted}
            onAccept={acceptCall}
            onEnd={() => stopCall()}
            onMute={toggleMute}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">Support Executive Panel</p>
          <h1 className="text-lg font-bold">{executive.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Online
          </span>
          <button onClick={loadSessions} className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
            <FiRefreshCw size={16} />
          </button>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-white/60 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <FiLogOut size={15} /> Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Session list */}
        <aside className="w-80 border-r border-white/10 bg-slate-900/50 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-white/70">Live sessions</h2>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">{sessions.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessLoading && sessions.length === 0 && (
              <p className="text-white/40 text-sm p-4">Loading…</p>
            )}
            {!sessLoading && sessions.length === 0 && (
              <p className="text-white/40 text-sm p-4">No active sessions.</p>
            )}
            {sessions.map(s => (
              <button key={s.conversation_id} type="button"
                onClick={() => setSelectedId(s.conversation_id)}
                className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                  selectedId === s.conversation_id ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    s.status === 'waiting' ? 'bg-amber-400/20 text-amber-300' : 'bg-emerald-400/20 text-emerald-300'
                  }`}>{s.status}</span>
                  <span className="text-[10px] text-white/30">{fmt(s.updated_at)}</span>
                </div>
                <p className="text-sm font-medium truncate">{s.conversation_id}</p>
                <p className="text-xs text-white/45 truncate">{s.customer_email || 'Anonymous'}</p>
                {s.assigned_executive && (
                  <p className="text-xs text-cyan-400/70 mt-0.5 flex items-center gap-1"><FiCheck size={10}/>{s.assigned_executive}</p>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Chat panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
              Select a session to start chatting
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between bg-slate-900/50">
                <div>
                  <p className="font-semibold">{selectedId}</p>
                  <p className="text-xs text-white/50">{selectedSession?.customer_email || 'Anonymous customer'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Incoming call indicator */}
                  {callState === 'incoming' && !callState && (
                    <motion.button
                      animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                      onClick={() => setCallState('incoming')}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-sm"
                    >
                      <FiPhoneIncoming size={15}/> Incoming call
                    </motion.button>
                  )}
                  <button
                    onClick={() => closeSession(selectedId)}
                    className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/10 transition-colors"
                  >
                    Close chat
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {error && <p className="text-red-300 text-xs">{error}</p>}
                {messages.length === 0 && (
                  <p className="text-white/30 text-sm text-center py-8">No messages yet. Customer is waiting.</p>
                )}
                {messages.map(msg => (
                  <div key={msg.id}
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.sender === 'executive'
                        ? 'ml-auto bg-cyan-500/20 border border-cyan-400/20 text-white'
                        : 'bg-white/5 border border-white/10 text-white/85'
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-white/35 mb-1">
                      {msg.sender === 'executive' ? (msg.executive_name || 'You') : 'Customer'} · {fmt(msg.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap leading-snug">{msg.message}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply bar */}
              <div className="border-t border-white/10 p-3 bg-slate-900/50 flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }}}
                  placeholder="Type a reply… (Enter to send)"
                  rows={2}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 resize-none"
                />
                <button onClick={sendReply} disabled={sending || !reply.trim()}
                  className="h-10 w-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center disabled:opacity-50 transition-colors self-end">
                  <FiSend size={16} />
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
