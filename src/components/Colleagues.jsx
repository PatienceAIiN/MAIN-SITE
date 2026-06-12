import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  FiSearch, FiSend, FiX, FiUsers, FiPlus, FiEdit2, FiTrash2, FiVideo,
  FiMic, FiMicOff, FiVideoOff, FiMonitor, FiPhoneOff, FiPhone, FiCheck,
  FiPaperclip, FiFile, FiDownload, FiCornerUpLeft, FiMessageSquare, FiMinimize2, FiMaximize2
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import { useGroupCall, GroupCallOverlay } from './GroupCall';
import { playRingtone, playPing } from '../common/sounds';

// Colleague chat workspace: searchable roster with live presence, 1:1 and
// group chats (create / rename / delete), typing indicators, web-push and
// WebRTC video calls with screen sharing. The component stays mounted (hidden
// when another tab is active) so presence, pushes and incoming calls keep
// working portal-wide.

const inp = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none';
const tb = 'text-[11px] px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:opacity-90 disabled:opacity-40';
const tb2 = 'text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
const fmtT = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '';
const fmtSize = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
export const lastSeenText = (v) => {
  if (!v) return 'Offline';
  const mins = Math.floor((Date.now() - new Date(v).getTime()) / 60000);
  if (mins < 1) return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins}m ago`;
  if (mins < 24 * 60) return `Last seen ${Math.floor(mins / 60)}h ago`;
  return `Last seen ${fmtT(v)}`;
};
const MAX_FILE = 10 * 1024 * 1024;

const PRESENCE = {
  online: { label: 'Active', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  away: { label: 'Away', dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  busy: { label: 'In call', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800' },
  offline: { label: 'Offline', dot: 'bg-slate-300 dark:bg-slate-600', chip: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' }
};
const PresenceChip = ({ status }) => {
  const p = PRESENCE[status] || PRESENCE.offline;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${p.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} /> {p.label}
    </span>
  );
};

// Animated unread chip — shown on chats/colleagues and the portal Colleagues tab.
const Badge = ({ n }) => n ? (
  <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse shadow">{n > 9 ? '9+' : n}</span>
) : null;

/* ── Web-push helpers (used here and by the settings modal) ──────────────── */
const b64ToUint8 = (s) => {
  // Strip whitespace/newlines first — a VAPID key pasted into an env var often
  // carries a trailing newline, which makes atob throw "not correctly encoded".
  const clean = String(s || '').trim().replace(/\s+/g, '');
  const pad = '='.repeat((4 - (clean.length % 4)) % 4);
  const raw = window.atob((clean + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push is not supported in this browser');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission was denied');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { key } = await fetchJson('/api/colleagues?vapid=1');
  const appKey = b64ToUint8(key);
  let sub = await reg.pushManager.getSubscription();
  // If a stale subscription exists with a DIFFERENT key (e.g. the VAPID key was
  // rotated), drop it first — resubscribing with a new key over an old one
  // fails with "Registration failed - push service error".
  if (sub) {
    const cur = sub.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    const same = cur && cur.length === appKey.length && cur.every((b, i) => b === appKey[i]);
    if (!same) { try { await sub.unsubscribe(); } catch { /* ignore */ } sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
  await fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'push_subscribe', subscription: sub.toJSON() }) });
  // Instant confirmation so the user knows push is actually working now.
  try {
    await reg.showNotification('🔔 Notifications enabled', {
      body: "You'll now get alerts for new messages and calls — even when this tab is closed.",
      icon: '/favicon-32.png', badge: '/favicon-32.png', tag: 'pa-push-enabled'
    });
  } catch { /* showNotification unsupported — subscription still saved */ }
}

export async function isPushSubscribed() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    return Boolean(await reg?.pushManager.getSubscription());
  } catch { return false; }
}

export async function disablePushNotifications() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push_unsubscribe', endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
  } catch { /* best-effort */ }
}

/* ── WebSocket hook: presence + realtime events + activity reporting ─────── */
function useTeamSocket(memberEmail, onEvent) {
  const wsRef = useRef(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const [presence, setPresence] = useState({});

  useEffect(() => {
    let alive = true, retryTimer, hadConnected = false;
    const connect = () => {
      if (!alive) return;
      // Drop any stale socket first (e.g. a half-open one after the network cut).
      try { wsRef.current && wsRef.current.readyState <= 1 && wsRef.current.close(); } catch { /* ignore */ }
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/team`);
      wsRef.current = ws;
      ws.onopen = () => {
        // On a *reconnect* (network restored / tab woke), pull fresh state so the
        // user sees live data again without manually refreshing the page.
        if (hadConnected) handlerRef.current?.({ type: 'reconnected' });
        hadConnected = true;
      };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === 'presence') setPresence(m.users || {});
        else handlerRef.current?.(m);
      };
      ws.onclose = () => { wsRef.current = null; if (alive) retryTimer = setTimeout(connect, 3000); };
    };
    connect();

    // Reconnect immediately when the network comes back or the tab is refocused,
    // instead of waiting out the 3s retry — so live presence/calls/chat resume.
    const wake = () => {
      if (!alive) return;
      if (document.visibilityState === 'hidden') return;
      if (!wsRef.current || wsRef.current.readyState > 1) { clearTimeout(retryTimer); connect(); }
    };
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    // Manual presence override from the portal header (online/away/offline).
    const onSetStatus = (e) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'setstatus', status: e.detail })); };
    window.addEventListener('pa-set-status', onSetStatus);

    // Report user activity (throttled) so the server can flip online ↔ away.
    let last = 0;
    const act = () => {
      const now = Date.now();
      if (now - last > 30000 && wsRef.current?.readyState === 1) {
        last = now;
        wsRef.current.send(JSON.stringify({ type: 'activity' }));
      }
    };
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, act, { passive: true }));
    return () => {
      alive = false;
      clearTimeout(retryTimer);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pa-set-status', onSetStatus);
      document.removeEventListener('visibilitychange', wake);
      events.forEach((ev) => window.removeEventListener(ev, act));
      wsRef.current?.close();
    };
  }, [memberEmail]);

  const send = useCallback((obj) => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(obj));
  }, []);
  return { presence, send };
}

/* ── Video call (WebRTC + screen share) ──────────────────────────────────── */
function useCall(me, wsSend) {
  // call: null | { phase:'incoming'|'outgoing'|'active', peer, peerName, offer? }
  const [call, setCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [chat, setChat] = useState([]); // in-call chat messages
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const localStream = useRef(null);
  const screenStream = useRef(null);
  const remoteStream = useRef(null);
  const pendingIce = useRef([]);
  const callRef = useRef(null);
  callRef.current = call;
  const connectedRef = useRef(false);   // pc reached 'connected' at least once
  const timerRef = useRef(null);        // ring (no-answer) / connect watchdog
  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  // Once a call goes active, end it (notifying the peer) if media never connects.
  const armConnectWatchdog = () => { clearTimer(); timerRef.current = setTimeout(() => { if (!connectedRef.current) hangup(true); }, 30000); };

  const cleanup = useCallback(() => {
    clearTimer();
    const pc = pcRef.current; pcRef.current = null;   // null first so the state
    pc && (pc.onconnectionstatechange = null);        // handler can't re-enter
    pc?.close();
    [localStream, screenStream].forEach((r) => { r.current?.getTracks().forEach((t) => t.stop()); r.current = null; });
    remoteStream.current = null;
    pendingIce.current = [];
    connectedRef.current = false;
    setCall(null); setMuted(false); setCamOff(false); setSharing(false); setChat([]);
  }, []);

  const newPc = async (peer, withVideo = true) => {
    const { iceServers } = await fetchJson('/api/voice-room/ice-servers').catch(() => ({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }));
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e) => { if (e.candidate) wsSend({ type: 'rtc', to: peer, data: { kind: 'ice', candidate: e.candidate } }); };
    pc.ontrack = (e) => { remoteStream.current = e.streams[0]; if (remoteRef.current) remoteRef.current.srcObject = e.streams[0]; };
    // Never silently kill a still-negotiating call (that left the other side
    // stuck on the dialer). Only end once it had connected and then dropped, and
    // always notify the peer so both sides clear together. 'closed' is ignored —
    // it's us tearing down. A connect watchdog handles never-connects.
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (pc.connectionState === 'connected') { connectedRef.current = true; clearTimer(); }
      else if (pc.connectionState === 'failed' && connectedRef.current) hangup(true);
    };
    const stream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
    localStream.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    if (localRef.current) localRef.current.srcObject = stream;
    pcRef.current = pc;
    return pc;
  };

  // withVideo=false → voice-only call (no camera captured on either side)
  const startCall = async (peer, peerName, withVideo = true) => {
    try {
      setCall({ phase: 'outgoing', peer, peerName, video: withVideo });
      const pc = await newPc(peer, withVideo);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsSend({ type: 'rtc', to: peer, data: { kind: 'offer', sdp: offer, video: withVideo } });
      // No-answer watchdog: cancel (and notify the callee) if unanswered.
      clearTimer();
      timerRef.current = setTimeout(() => { if (callRef.current?.phase === 'outgoing') hangup(true); }, 45000);
    } catch (e) { window.alert(`Could not start the call: ${e.message}`); cleanup(); }
  };

  const acceptCall = async () => {
    const c = callRef.current;
    if (!c?.offer) return;
    try {
      const pc = await newPc(c.peer, c.video !== false);
      await pc.setRemoteDescription(new RTCSessionDescription(c.offer));
      for (const cand of pendingIce.current) await pc.addIceCandidate(cand).catch(() => {});
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend({ type: 'rtc', to: c.peer, data: { kind: 'answer', sdp: answer } });
      setCall({ ...c, phase: 'active' });
      armConnectWatchdog();
    } catch (e) { window.alert(`Could not answer the call: ${e.message}`); hangup(); }
  };

  const hangup = useCallback((notify = true) => {
    const c = callRef.current;
    if (notify && c) wsSend({ type: 'rtc', to: c.peer, data: { kind: c.phase === 'incoming' ? 'decline' : 'hangup' } });
    cleanup();
  }, [wsSend, cleanup]);

  const onRtc = useCallback(async (from, fromName, data) => {
    const c = callRef.current;
    if (data.kind === 'offer') {
      if (c) { wsSend({ type: 'rtc', to: from, data: { kind: 'decline', busy: true } }); return; }
      setCall({ phase: 'incoming', peer: from, peerName: fromName, offer: data.sdp, video: data.video !== false });
      // Auto-dismiss the ringing dialer if the caller never connects/cancels.
      clearTimer();
      timerRef.current = setTimeout(() => { if (callRef.current?.phase === 'incoming') cleanup(); }, 45000);
      return;
    }
    if (!c || from !== c.peer) return;
    if (data.kind === 'answer' && pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(() => {});
      for (const cand of pendingIce.current) await pcRef.current.addIceCandidate(cand).catch(() => {});
      pendingIce.current = [];
      setCall({ ...c, phase: 'active' });
      armConnectWatchdog();
    } else if (data.kind === 'ice') {
      if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(data.candidate).catch(() => {});
      else pendingIce.current.push(data.candidate);
    } else if (data.kind === 'chat') {
      setChat((m) => [...m, { mine: false, text: data.text, name: fromName, at: Date.now() }]);
    } else if (data.kind === 'hangup' || data.kind === 'decline') {
      cleanup();
    }
  }, [wsSend, cleanup]);

  const toggleMute = () => {
    localStream.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted((m) => !m);
  };
  const toggleCam = () => {
    localStream.current?.getVideoTracks().forEach((t) => { t.enabled = camOff; });
    setCamOff((v) => !v);
  };
  const videoSender = () => pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');

  const stopShare = useCallback(async () => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    const camTrack = localStream.current?.getVideoTracks()[0];
    if (camTrack) await videoSender()?.replaceTrack(camTrack);
    if (localRef.current) localRef.current.srcObject = localStream.current;
    setSharing(false);
  }, []);

  const toggleShare = async () => {
    if (screenStream.current) return stopShare();
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStream.current = ds;
      const track = ds.getVideoTracks()[0];
      await videoSender()?.replaceTrack(track);
      if (localRef.current) localRef.current.srcObject = ds;
      track.onended = stopShare; // browser "Stop sharing" bar
      setSharing(true);
    } catch { /* user cancelled the picker */ }
  };

  // Attach captured streams to the <video> elements whenever the in-call UI is
  // mounted. The callee renders no <video> during the 'incoming' phase, so the
  // imperative srcObject assignments in newPc/ontrack can run before the refs
  // exist (or ontrack can race the mount) — this effect re-binds on phase change.
  useEffect(() => {
    if (!call || call.phase === 'incoming') return;
    if (localRef.current) localRef.current.srcObject = screenStream.current || localStream.current;
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream.current;
  }, [call, sharing]);

  // Tell the hub we're busy while on a call so colleagues see an "In call" chip
  // and can't dial in; clears the moment the call ends.
  useEffect(() => { wsSend({ type: 'callstate', busy: Boolean(call) && call.phase !== 'incoming' }); }, [call, wsSend]);

  const sendChat = (text) => {
    const c = callRef.current; if (!c || !text.trim()) return;
    wsSend({ type: 'rtc', to: c.peer, data: { kind: 'chat', text: text.trim() } });
    setChat((m) => [...m, { mine: true, text: text.trim(), at: Date.now() }]);
  };

  return { call, startCall, acceptCall, hangup, onRtc, localRef, remoteRef, muted, camOff, sharing, toggleMute, toggleCam, toggleShare, chat, sendChat, me };
}

function CallOverlay({ callApi }) {
  const { call, acceptCall, hangup, localRef, remoteRef, muted, camOff, sharing, toggleMute, toggleCam, toggleShare, chat, sendChat, me } = callApi;
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [draft, setDraft] = useState('');
  const chatEndRef = useRef(null);
  const callRef = useRef(call);
  callRef.current = call;
  const noteRef = useRef('');
  noteRef.current = noteText;
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, chatOpen]);
  useEffect(() => { if (!call) { setMinimized(false); setFullscreen(false); setChatOpen(false); setNotesOpen(false); setNoteText(''); } }, [call]);
  // Ring while a 1:1 call is incoming; stop on accept/decline.
  useEffect(() => { if (call?.phase === 'incoming') return playRingtone(); }, [call?.phase]);

  // End the call AND, if notes were taken, save+email the Minutes of Meeting.
  const endCall = () => {
    const c = callRef.current; const text = noteRef.current.trim();
    if (text && c) {
      fetchJson('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `MoM — call with ${c.peerName || c.peer}`, body: text, kind: 'mom', emailTo: [c.peer, me?.email].filter(Boolean) }) }).catch(() => {});
    }
    hangup();
  };
  if (!call) return null;
  const rb = 'h-11 w-11 rounded-full flex items-center justify-center text-white transition-colors';
  const unread = chat.length;

  if (call.phase === 'incoming') {
    return (
      <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-2xl w-full max-w-xs">
          <p className="text-3xl mb-2">📞</p>
          <p className="font-bold text-slate-900 dark:text-white">{call.peerName || call.peer}</p>
          <p className="text-xs text-slate-400 mb-6">Incoming {call.video ? 'video' : 'voice'} call…</p>
          <div className="flex justify-center gap-4">
            <button onClick={acceptCall} className={`${rb} bg-emerald-600 hover:bg-emerald-700`} title="Accept"><FiPhone size={18} /></button>
            <button onClick={() => hangup()} className={`${rb} bg-red-600 hover:bg-red-700`} title="Decline"><FiPhoneOff size={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  // Minimized → small floating pill, call keeps running.
  if (minimized) {
    return (
      <button onClick={() => setMinimized(false)} title="Return to call"
        className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl animate-pulse">
        <FiPhone size={15} /> <span className="text-xs font-semibold">{call.video ? 'Video' : 'Voice'} call · {call.peerName || call.peer}</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`flex gap-3 w-full ${fullscreen ? 'max-w-full h-full' : 'max-w-3xl'}`}>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className={`relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 ${fullscreen ? 'flex-1' : ''}`}>
            {/* top-right window controls */}
            <div className="absolute top-2 right-2 z-10 flex gap-1.5">
              <button onClick={() => setChatOpen((o) => !o)} title="Chat" className="relative h-8 w-8 rounded-lg bg-black/50 hover:bg-black/70 text-white flex items-center justify-center">
                <FiMessageSquare size={14} />
                {!chatOpen && unread > 0 && <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
              </button>
              <button onClick={() => setFullscreen((f) => !f)} title={fullscreen ? 'Exit fullscreen' : 'Enlarge'} className="h-8 w-8 rounded-lg bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"><FiMaximize2 size={14} /></button>
              <button onClick={() => setMinimized(true)} title="Minimize (keep call running)" className="h-8 w-8 rounded-lg bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"><FiMinimize2 size={14} /></button>
            </div>
            <video ref={remoteRef} autoPlay playsInline className={`w-full ${fullscreen ? 'h-full' : 'aspect-video'} object-contain bg-black`} />
            {(call.phase === 'outgoing' || !call.video) && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                {call.phase === 'outgoing' ? `Calling ${call.peerName || call.peer}…` : `🎙 Voice call · ${call.peerName || call.peer}`}
              </div>
            )}
            <video ref={localRef} autoPlay playsInline muted className="absolute bottom-3 right-3 w-36 aspect-video object-cover rounded-lg border border-slate-600 bg-black" />
          </div>
          <div className="flex justify-center gap-3 mt-4">
            <button onClick={toggleMute} className={`${rb} ${muted ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <FiMicOff size={17} /> : <FiMic size={17} />}
            </button>
            {call.video && <>
              <button onClick={toggleCam} className={`${rb} ${camOff ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={camOff ? 'Camera on' : 'Camera off'}>
                {camOff ? <FiVideoOff size={17} /> : <FiVideo size={17} />}
              </button>
              <button onClick={toggleShare} className={`${rb} ${sharing ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={sharing ? 'Stop sharing' : 'Share screen'}>
                <FiMonitor size={17} />
              </button>
            </>}
            <button onClick={() => setChatOpen((o) => !o)} className={`${rb} ${chatOpen ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title="Chat"><FiMessageSquare size={17} /></button>
            <button onClick={() => setNotesOpen((o) => !o)} className={`${rb} ${notesOpen ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title="Meeting notes"><FiEdit2 size={16} /></button>
            <button onClick={endCall} className={`${rb} bg-red-600 hover:bg-red-700`} title="Hang up"><FiPhoneOff size={17} /></button>
          </div>
        </div>

        {/* In-call chat (Google-Meet style) */}
        {chatOpen && (
          <div className="w-72 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900 dark:text-white">In-call chat</p>
              <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiX size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
              {!chat.length && <p className="text-xs text-slate-400 text-center py-6">No messages yet.</p>}
              {chat.map((m, i) => (
                <div key={i} className={`w-fit max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${m.mine ? 'ml-auto bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'}`}>
                  {!m.mine && m.name && <p className="text-[9px] opacity-50 mb-0.5">{m.name}</p>}
                  {m.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); sendChat(draft); setDraft(''); }} className="p-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none" />
              <button type="submit" className="h-9 w-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center"><FiSend size={14} /></button>
            </form>
          </div>
        )}

        {/* In-call meeting note-taker — saved + emailed as MoM when the call ends */}
        {notesOpen && (
          <div className="w-72 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Meeting notes</p>
              <button onClick={() => setNotesOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiX size={15} /></button>
            </div>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Jot minutes here… emailed to both participants &amp; saved in Notes when the call ends."
              className="flex-1 min-h-[220px] w-full text-sm bg-transparent text-slate-800 dark:text-slate-100 p-3 focus:outline-none resize-none" />
            <p className="px-3 py-2 text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-800">Auto-saved as Minutes of Meeting on hang-up.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── File message: inline preview + popup modal ──────────────────────────── */
const fileUrl = (m, dl) => `/api/colleagues?file=${m.id}${dl ? '&download=1' : ''}`;

function FilePreviewModal({ msg, onClose }) {
  const t = msg.file_type || '';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{msg.file_name}
            <span className="font-normal text-slate-400 ml-2 text-xs">{fmtSize(msg.file_size || 0)} · {msg.sender_name} · {fmtT(msg.created_at)}</span>
          </p>
          <span className="flex items-center gap-2 shrink-0">
            <a href={fileUrl(msg, true)} download={msg.file_name} title="Download"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiDownload size={16} /></a>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiX size={16} /></button>
          </span>
        </div>
        <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-b-2xl">
          {t.startsWith('image/') ? <img src={fileUrl(msg)} alt={msg.file_name} className="max-w-full max-h-[70vh] rounded-lg" />
            : t.startsWith('video/') ? <video src={fileUrl(msg)} controls className="max-w-full max-h-[70vh] rounded-lg" />
            : t.startsWith('audio/') ? <audio src={fileUrl(msg)} controls className="w-full" />
            : (t.includes('pdf') || t.startsWith('text/')) ? <iframe title={msg.file_name} src={fileUrl(msg)} className="w-full h-[70vh] rounded-lg bg-white" />
            : (
              <div className="text-center py-10">
                <FiFile size={34} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">No inline preview for this file type.</p>
                <a href={fileUrl(msg, true)} download={msg.file_name}
                  className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium">
                  <FiDownload size={13} /> Download {fmtSize(msg.file_size || 0)}
                </a>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function FileBubble({ m, onOpen }) {
  if ((m.file_type || '').startsWith('image/')) {
    return <img src={fileUrl(m)} alt={m.file_name} onClick={onOpen}
      className="max-h-44 max-w-full rounded-lg cursor-pointer hover:opacity-90 mt-0.5" />;
  }
  return (
    <button onClick={onOpen} className="flex items-center gap-2 text-left mt-0.5 hover:opacity-80">
      <FiFile size={18} className="shrink-0 opacity-70" />
      <span className="min-w-0">
        <span className="block text-xs font-medium truncate underline underline-offset-2">{m.file_name}</span>
        <span className="block text-[10px] opacity-60">{fmtSize(m.file_size || 0)} · click to preview</span>
      </span>
    </button>
  );
}

/* ── Swipe-to-reply wrapper (touch + mouse drag, works in dm & group) ────── */
function SwipeReply({ children, onReply, mine }) {
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const begin = (x, y) => { start.current = { x, y }; };
  const move = (x, y) => {
    if (!start.current) return;
    const ddx = x - start.current.x;
    if (Math.abs(y - start.current.y) > 40) { start.current = null; setDx(0); return; }
    if (ddx > 0) setDx(Math.min(ddx, 72)); // swipe right only
  };
  const end = () => {
    if (dx > 48) onReply();
    start.current = null; setDx(0);
  };
  return (
    <div className={`relative ${mine ? 'ml-auto' : 'mr-auto'} w-fit max-w-[78%]`}
      onTouchStart={(e) => begin(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={end}
      onMouseDown={(e) => begin(e.clientX, e.clientY)}
      onMouseMove={(e) => e.buttons === 1 && move(e.clientX, e.clientY)}
      onMouseUp={end} onMouseLeave={() => { start.current = null; setDx(0); }}>
      {dx > 8 && (
        <FiCornerUpLeft size={16}
          className={`absolute -left-6 top-1/2 -translate-y-1/2 transition-opacity ${dx > 48 ? 'text-indigo-500' : 'text-slate-300'}`} />
      )}
      <div style={{ transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform 150ms' }}>
        {children}
      </div>
    </div>
  );
}

/* ── Group chat create / edit modal ──────────────────────────────────────── */
function GroupModal({ colleagues, chat, onClose, onSaved }) {
  const [name, setName] = useState(chat?.name || '');
  const [picked, setPicked] = useState(() => new Set(chat ? chat.member_list : []));
  const [err, setErr] = useState('');
  const toggle = (email) => setPicked((s) => { const n = new Set(s); n.has(email) ? n.delete(email) : n.add(email); return n; });
  const save = async () => {
    setErr('');
    try {
      const body = chat
        ? { action: 'update_chat', chatId: chat.id, name: name.trim() || 'Group chat', memberEmails: [...picked] }
        : { action: 'create_chat', kind: 'group', name: name.trim() || 'Group chat', memberEmails: [...picked] };
      const d = await fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSaved(d.chat);
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2"><FiUsers size={14} /> {chat ? 'Edit group' : 'New group chat'}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiX size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" className={`${inp} w-full`} />
          <div className="max-h-52 overflow-y-auto space-y-1 rounded-xl border border-slate-100 dark:border-slate-800 p-2">
            {colleagues.map((c) => (
              <button key={c.email} onClick={() => toggle(c.email)}
                className={`w-full flex items-center justify-between text-left text-xs px-2.5 py-2 rounded-lg ${picked.has(c.email) ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
                <span className="truncate">{c.name} <span className="text-slate-400">· {(c.team_role || '').replace(/_/g, ' ')}</span></span>
                {picked.has(c.email) && <FiCheck size={13} />}
              </button>
            ))}
            {!colleagues.length && <p className="text-xs text-slate-400 p-2">No active colleagues yet.</p>}
          </div>
          {err && <p className="text-red-500 text-xs">{err}</p>}
          <button onClick={save} disabled={!picked.size} className={`${tb} w-full !py-2.5`}>{chat ? 'Save changes' : 'Create group'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function Colleagues({ member, visible, onUnread, canManageRoster = true, fullscreen = false, onClose }) {
  const [colleagues, setColleagues] = useState([]);
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(null); // message being edited
  const [groupModal, setGroupModal] = useState(null); // false-y | 'new' | chat object
  const [preview, setPreview] = useState(null); // file message in popup
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // message being replied to
  const [typing, setTyping] = useState({}); // chatId -> {email,name,at}
  const [unread, setUnread] = useState({}); // chatId -> count of unseen messages
  const endRef = useRef(null);
  const activeChatRef = useRef(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const lastTypingSent = useRef(0);

  const loadChats = useCallback(() => {
    fetchJson('/api/colleagues?chats=1').then((d) => setChats(d.chats || [])).catch(() => {});
  }, []);
  const loadColleagues = useCallback(() => {
    fetchJson('/api/colleagues?list=1').then((d) => setColleagues(d.colleagues || [])).catch(() => {});
  }, []);

  const loadMessages = useCallback((chatId) => {
    if (!chatId) { setMessages([]); return; }
    fetchJson(`/api/colleagues?messages=${chatId}`)
      .then((d) => { setMessages(d.messages || []); setHasMore(Boolean(d.hasMore)); })
      .catch(() => setMessages([]));
  }, []);
  const onWsEvent = useCallback((m) => {
    if (m.type === 'chat') {
      loadChats();
      const mine = m.message?.sender_email === member.email;
      const viewing = visibleRef.current && m.chatId === activeChatRef.current;
      // Bump the unread badge for messages arriving while you're not looking at
      // that chat — so the chip shows even from other portal tabs.
      if (!mine && !viewing && m.event !== 'edit' && !m.message?.deleted) {
        setUnread((u) => ({ ...u, [m.chatId]: (u[m.chatId] || 0) + 1 }));
        playPing(); // notify sound for an incoming message
      }
      if (m.chatId === activeChatRef.current) {
        setMessages((prev) => {
          const i = prev.findIndex((x) => x.id === m.message.id);
          if (i >= 0) { const next = [...prev]; next[i] = m.message; return next; }
          return [...prev, m.message];
        });
      }
    } else if (m.type === 'chat_meta') {
      loadChats();
      if (m.event === 'deleted' && m.chatId === activeChatRef.current) setActiveChatId(null);
    } else if (m.type === 'typing') {
      setTyping((t) => ({ ...t, [m.chatId]: { email: m.email, name: m.name, at: Date.now() } }));
    } else if (m.type === 'perms_updated') {
      // admin changed this member's role/permissions/repo grants — portal refetches instantly
      window.dispatchEvent(new Event('pa-perms-updated'));
    } else if (m.type === 'rtc') {
      if (m.data?.room) groupApi.onRtc(m.from, m.fromName, m.data); // group (mesh) call
      else callApi.onRtc(m.from, m.fromName, m.data);               // 1:1 call
    } else if (m.type === 'reconnected') {
      // Network/tab came back — refetch so missed messages/roster show live.
      loadChats(); loadColleagues();
      if (activeChatRef.current) loadMessages(activeChatRef.current);
    }
  }, [loadChats, loadColleagues, loadMessages, member.email]);

  // Clear a chat's unread badge once you're actually viewing it; report the
  // running total up to the portal so it can badge the "Colleagues" button.
  useEffect(() => { if (visible && activeChatId) setUnread((u) => (u[activeChatId] ? { ...u, [activeChatId]: 0 } : u)); }, [visible, activeChatId, messages]);
  const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);
  useEffect(() => { onUnread?.(totalUnread); }, [totalUnread, onUnread]);
  // Per-colleague unread (for DM rows in the roster), keyed by peer email.
  const dmUnread = useMemo(() => {
    const map = {};
    chats.forEach((c) => { if (c.kind === 'dm' && unread[c.id]) { const p = dmPeer(c); if (p) map[p] = unread[c.id]; } });
    return map;
  }, [chats, unread]);

  const { presence, send } = useTeamSocket(member.email, onWsEvent);
  const callApi = useCall(member, send);
  const groupApi = useGroupCall(member, send);

  useEffect(() => { loadColleagues(); loadChats(); }, [loadColleagues, loadChats]);
  // presence changes: instant chip update + refetch for fresh last_seen_at
  useEffect(() => {
    setColleagues((cs) => cs.map((c) => ({ ...c, presence: presence[c.email] || 'offline' })));
    const t = setTimeout(loadColleagues, 800);
    return () => clearTimeout(t);
  }, [presence, loadColleagues]);
  // typing indicators expire after 3s
  useEffect(() => {
    const i = setInterval(() => setTyping((t) => {
      const now = Date.now();
      const next = Object.fromEntries(Object.entries(t).filter(([, v]) => now - v.at < 3000));
      return Object.keys(next).length === Object.keys(t).length ? t : next;
    }), 1000);
    return () => clearInterval(i);
  }, []);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;
  activeChatRef.current = activeChatId;

  useEffect(() => {
    setReplyTo(null); setEditing(null);
    loadMessages(activeChatId);
  }, [activeChatId, loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, activeChatId]);

  const loadOlder = async () => {
    if (!messages.length) return;
    const d = await fetchJson(`/api/colleagues?messages=${activeChatId}&before=${messages[0].id}`).catch(() => null);
    if (d) { setMessages((prev) => [...d.messages, ...prev]); setHasMore(Boolean(d.hasMore)); }
  };

  const dmPeer = (chat) => chat?.kind === 'dm' ? (chat.member_list || []).find((e) => e !== member.email) : null;
  const chatTitle = (chat) => {
    if (!chat) return '';
    if (chat.kind === 'group') return chat.name || 'Group chat';
    const peer = dmPeer(chat);
    return colleagues.find((c) => c.email === peer)?.name || peer;
  };

  const openDm = async (email) => {
    const d = await fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_chat', kind: 'dm', memberEmails: [email] }) }).catch(() => null);
    if (d?.chat) { loadChats(); setActiveChatId(d.chat.id); }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeChat) return;
    setInput('');
    if (editing) {
      const id = editing.id; setEditing(null);
      await fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit_message', id, message: text }) }).catch(() => {});
      return;
    }
    const quoted = replyTo; setReplyTo(null);
    await fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', chatId: activeChat.id, message: text, replyTo: quoted?.id }) }).catch(() => {});
  };

  const deleteMessage = (id) => fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete_message', id }) }).catch(() => {});

  const uploadFile = async (file) => {
    if (!file || !activeChat) return;
    if (file.size > MAX_FILE) { window.alert('File is too large — the limit is 10 MB.'); return; }
    setUploading(true);
    try {
      const res = await fetch(`/api/colleagues/upload?chatId=${activeChat.id}&fileName=${encodeURIComponent(file.name)}`, {
        method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Upload failed (${res.status})`);
    } catch (e) { window.alert(e.message); }
    finally { setUploading(false); }
  };

  const deleteChat = async (chat) => {
    if (!window.confirm(chat.kind === 'group' ? `Delete group "${chatTitle(chat)}" for everyone?` : 'Delete this conversation?')) return;
    await fetchJson('/api/colleagues', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: chat.id }) }).catch(() => {});
    if (activeChatId === chat.id) setActiveChatId(null);
    loadChats();
  };

  const onType = (val) => {
    setInput(val);
    const now = Date.now();
    if (activeChat && now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      send({ type: 'typing', chatId: activeChat.id, to: activeChat.member_list });
    }
  };

  const q = search.trim().toLowerCase();
  // Toggle which side's colleagues the roster shows (Team vs Support).
  const [sideTab, setSideTab] = useState('team');
  const filteredColleagues = useMemo(() => colleagues.filter((c) =>
    (c.side || 'team') === sideTab &&
    (!q || c.name?.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.team_role || '').includes(q))), [colleagues, q, sideTab]);
  const filteredChats = useMemo(() => chats.filter((c) =>
    !q || chatTitle(c).toLowerCase().includes(q)), [chats, q, colleagues]);  

  const activeTyping = typing[activeChatId];
  const peerEmail = dmPeer(activeChat);

  return (
    <>
    {/* CallOverlay lives OUTSIDE the visibility gate — and the whole component is
        kept mounted (never under display:none) by the portals — so an incoming
        call rings fullscreen no matter which screen/tab the user is on. */}
    <CallOverlay callApi={callApi} />
    <GroupCallOverlay api={groupApi} />
    <div className={visible
      ? (fullscreen ? 'fixed inset-0 z-40 bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row' : 'flex flex-1 overflow-hidden flex-col md:flex-row')
      : 'hidden'}>
      {fullscreen && onClose && (
        <button onClick={onClose} title="Close colleagues"
          className="absolute top-2 right-3 z-50 p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white/80 dark:bg-slate-800/80 shadow">
          <FiX size={18} />
        </button>
      )}
      {/* Left: roster + chat history */}
      <aside className="w-full md:w-80 max-h-[45vh] md:max-h-none border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
          <div className="relative">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search colleagues & chats…"
              className={`${inp} w-full !pl-8`} />
          </div>
          <button onClick={() => setGroupModal('new')} disabled={!canManageRoster}
            title={canManageRoster ? 'Create a group chat' : 'Read-only roster access — ask an admin for the roster permission'}
            className={`${tb2} w-full flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed`}>
            <FiPlus size={12} /> New group chat
          </button>
          {/* Toggle which side's colleagues to show — Team and Support are kept
              separate; both remain reachable for chat / call / video / screenshare. */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {['team', 'support'].map((s) => (
              <button key={s} onClick={() => setSideTab(s)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${sideTab === s ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Chats */}
          {filteredChats.length > 0 && <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Chats</p>}
          {filteredChats.map((c) => (
            <div key={c.id} className={`group flex items-center gap-2 px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/60 cursor-pointer ${activeChatId === c.id ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              onClick={() => setActiveChatId(c.id)}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                  {c.kind === 'group' ? <FiUsers size={11} className="text-indigo-400 shrink-0" /> : (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${(PRESENCE[presence[dmPeer(c)] || 'offline']).dot}`} />
                  )}
                  <span className="truncate">{chatTitle(c)}</span>
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {typing[c.id] && c.id !== activeChatId ? `${typing[c.id].name} is typing…`
                    : c.last_message ? `${c.last_sender ? c.last_sender.split(' ')[0] + ': ' : ''}${c.last_deleted ? 'message deleted' : c.last_message}` : 'No messages yet'}
                </p>
              </div>
              {unread[c.id] > 0 && <span className="group-hover:hidden shrink-0"><Badge n={unread[c.id]} /></span>}
              <div className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {c.kind === 'group' && canManageRoster && (
                  <button title="Edit group" onClick={() => setGroupModal(c)} className="p-1.5 rounded text-slate-400 hover:text-indigo-500"><FiEdit2 size={12} /></button>
                )}
                {(c.kind !== 'group' || canManageRoster) && (
                  <button title="Delete chat" onClick={() => deleteChat(c)} className="p-1.5 rounded text-slate-400 hover:text-red-500"><FiTrash2 size={12} /></button>
                )}
              </div>
            </div>
          ))}
          {/* Colleagues — Team and Support kept in separate groups (never mixed),
              but both are fully reachable for chat / call / video / screenshare. */}
          {[{ key: 'team', label: 'Team' }, { key: 'support', label: 'Support' }].map(({ key, label }) => {
            const group = filteredColleagues.filter((c) => (c.side || 'team') === key);
            if (!group.length) return null;
            return (
              <div key={key}>
                <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400">{label} ({group.length})</p>
                {group.map((c) => (
                  <button key={c.email} onClick={() => openDm(c.email)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{(c.team_role || 'member').replace(/_/g, ' ')} · {c.email}</p>
                      {c.presence === 'offline' && c.last_seen_at && (
                        <p className="text-[10px] text-slate-400/80 truncate">{lastSeenText(c.last_seen_at)}</p>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Badge n={dmUnread[c.email]} />
                      <PresenceChip status={c.presence} />
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
          {!filteredColleagues.length && <p className="text-xs text-slate-400 text-center py-5">No colleagues match.</p>}
        </div>
      </aside>

      {/* Right: chat panel */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        {activeChat ? (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0">
              {/* Close icon — top-left as requested */}
              <button onClick={() => setActiveChatId(null)} title="Close chat"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                <FiX size={16} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{chatTitle(activeChat)}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {activeTyping ? <span className="text-indigo-500">{activeTyping.name} is typing…</span>
                    : activeChat.kind === 'group'
                      ? `${(activeChat.member_list || []).length} members`
                      : (presence[peerEmail] || 'offline') === 'offline'
                        ? lastSeenText(colleagues.find((c) => c.email === peerEmail)?.last_seen_at)
                        : (PRESENCE[presence[peerEmail]]).label}
                </p>
              </div>
              {activeChat.kind === 'dm' && ['voice', 'video'].map((k) => {
                const peerStatus = presence[peerEmail] || 'offline';
                const disabled = peerStatus === 'offline' || peerStatus === 'busy' || Boolean(callApi.call);
                return (
                  <button key={k} onClick={() => callApi.startCall(peerEmail, chatTitle(activeChat), k === 'video')}
                    disabled={disabled}
                    title={peerStatus === 'offline' ? 'Colleague is offline' : peerStatus === 'busy' ? 'Colleague is on another call' : callApi.call ? 'You are already on a call' : `Start ${k} call`}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
                    {k === 'video' ? <FiVideo size={15} /> : <FiPhone size={15} />}
                  </button>
                );
              })}
              {activeChat.kind === 'group' && (
                <button onClick={() => groupApi.start(activeChat.id, activeChat.member_list || [], chatTitle(activeChat))}
                  disabled={Boolean(groupApi.room)} title="Start group video call"
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
                  <FiVideo size={15} />
                </button>
              )}
              {activeChat.kind === 'group' && canManageRoster && (
                <button onClick={() => setGroupModal(activeChat)} title="Edit group" className={tb2}><FiEdit2 size={12} /></button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
              {hasMore && <button onClick={loadOlder} className={`${tb2} mx-auto block`}>Load older messages</button>}
              {messages.map((m) => {
                const mine = m.sender_email === member.email;
                return (
                  <SwipeReply key={m.id} mine={mine} onReply={() => !m.deleted && setReplyTo(m)}>
                  <div className={`group rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-white border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100'}`}>
                    <p className={`text-[10px] mb-0.5 flex items-center gap-2 ${mine ? 'text-white/40 dark:text-slate-500' : 'text-slate-400'}`}>
                      {m.sender_name || m.sender_email} · {fmtT(m.created_at)}{m.edited && !m.deleted ? ' · edited' : ''}
                      {!m.deleted && (
                        <span className="hidden group-hover:inline-flex gap-1.5">
                          <button title="Reply" onClick={() => setReplyTo(m)} className="hover:opacity-70"><FiCornerUpLeft size={10} /></button>
                          {mine && <>
                            <button title="Edit" onClick={() => { setEditing(m); setInput(m.message); }} className="hover:opacity-70"><FiEdit2 size={10} /></button>
                            <button title="Delete" onClick={() => deleteMessage(m.id)} className="hover:opacity-70"><FiTrash2 size={10} /></button>
                          </>}
                        </span>
                      )}
                    </p>
                    {m.reply_to && !m.deleted && (
                      <div className={`mb-1 px-2 py-1 rounded-lg border-l-2 text-[11px] ${mine
                        ? 'border-white/40 bg-white/10 dark:border-slate-400 dark:bg-slate-900/10'
                        : 'border-indigo-400 bg-slate-50 dark:bg-slate-800/60'}`}>
                        <span className="font-semibold">{m.reply_name}</span>
                        <span className="block truncate opacity-70">{m.reply_text}</span>
                      </div>
                    )}
                    {m.deleted
                      ? <p className="italic opacity-50 text-xs">message deleted</p>
                      : m.file_name
                        ? <FileBubble m={m} onOpen={() => setPreview(m)} />
                        : <p className="whitespace-pre-wrap leading-snug">{m.message}</p>}
                  </div>
                  </SwipeReply>
                );
              })}
              {!messages.length && <p className="text-xs text-slate-400 text-center py-8">Say hello 👋</p>}
              <div ref={endRef} />
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              {editing && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-2">
                  Editing message <button onClick={() => { setEditing(null); setInput(''); }} className="underline">cancel</button>
                </p>
              )}
              {replyTo && !editing && (
                <div className="mb-1.5 px-3 py-1.5 rounded-lg border-l-2 border-indigo-400 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2">
                  <FiCornerUpLeft size={12} className="text-indigo-400 shrink-0" />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{replyTo.sender_name}</span>: {replyTo.file_name ? `📎 ${replyTo.file_name}` : replyTo.message}
                  </p>
                  <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><FiX size={13} /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label title="Attach file (max 10 MB)"
                  className={`h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${uploading ? 'opacity-40 pointer-events-none animate-pulse' : ''}`}>
                  <FiPaperclip size={15} className="text-slate-500 dark:text-slate-300" />
                  <input type="file" className="hidden" onChange={(e) => { uploadFile(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <textarea value={input} onChange={(e) => onType(e.target.value)} rows={2}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Message… (Enter to send)"
                  className={`${inp} flex-1 resize-none !text-sm !py-2.5`} />
                <button onClick={sendMessage} disabled={!input.trim()}
                  className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 flex items-center justify-center disabled:opacity-40">
                  <FiSend size={15} className="text-white dark:text-slate-900" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm gap-2">
            <FiUsers size={26} className="text-slate-300 dark:text-slate-600" />
            Pick a colleague to start chatting — or create a group
          </div>
        )}
      </main>

      {groupModal && (
        <GroupModal colleagues={colleagues} chat={groupModal === 'new' ? null : groupModal}
          onClose={() => setGroupModal(null)}
          onSaved={(chat) => { setGroupModal(null); loadChats(); if (chat?.id) setActiveChatId(chat.id); }} />
      )}
      {preview && <FilePreviewModal msg={preview} onClose={() => setPreview(null)} />}
    </div>
    </>
  );
}
