import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  FiSearch, FiSend, FiX, FiUsers, FiPlus, FiEdit2, FiTrash2, FiVideo,
  FiMic, FiMicOff, FiVideoOff, FiMonitor, FiPhoneOff, FiPhone, FiCheck,
  FiPaperclip, FiFile, FiDownload, FiCornerUpLeft
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';

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

/* ── Web-push helpers (used here and by the settings modal) ──────────────── */
const b64ToUint8 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = window.atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push is not supported in this browser');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission was denied');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { key } = await fetchJson('/api/colleagues?vapid=1');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) });
  await fetchJson('/api/colleagues', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'push_subscribe', subscription: sub.toJSON() }) });
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
    let alive = true, retryTimer;
    const connect = () => {
      if (!alive) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/team`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === 'presence') setPresence(m.users || {});
        else handlerRef.current?.(m);
      };
      ws.onclose = () => { wsRef.current = null; if (alive) retryTimer = setTimeout(connect, 3000); };
    };
    connect();

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
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const localStream = useRef(null);
  const screenStream = useRef(null);
  const remoteStream = useRef(null);
  const pendingIce = useRef([]);
  const callRef = useRef(null);
  callRef.current = call;

  const cleanup = useCallback(() => {
    pcRef.current?.close(); pcRef.current = null;
    [localStream, screenStream].forEach((r) => { r.current?.getTracks().forEach((t) => t.stop()); r.current = null; });
    remoteStream.current = null;
    pendingIce.current = [];
    setCall(null); setMuted(false); setCamOff(false); setSharing(false);
  }, []);

  const newPc = async (peer, withVideo = true) => {
    const { iceServers } = await fetchJson('/api/voice-room/ice-servers').catch(() => ({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }));
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e) => { if (e.candidate) wsSend({ type: 'rtc', to: peer, data: { kind: 'ice', candidate: e.candidate } }); };
    pc.ontrack = (e) => { remoteStream.current = e.streams[0]; if (remoteRef.current) remoteRef.current.srcObject = e.streams[0]; };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) cleanup(); };
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
      return;
    }
    if (!c || from !== c.peer) return;
    if (data.kind === 'answer' && pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(() => {});
      for (const cand of pendingIce.current) await pcRef.current.addIceCandidate(cand).catch(() => {});
      pendingIce.current = [];
      setCall({ ...c, phase: 'active' });
    } else if (data.kind === 'ice') {
      if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(data.candidate).catch(() => {});
      else pendingIce.current.push(data.candidate);
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

  return { call, startCall, acceptCall, hangup, onRtc, localRef, remoteRef, muted, camOff, sharing, toggleMute, toggleCam, toggleShare };
}

function CallOverlay({ callApi }) {
  const { call, acceptCall, hangup, localRef, remoteRef, muted, camOff, sharing, toggleMute, toggleCam, toggleShare } = callApi;
  if (!call) return null;
  const rb = 'h-11 w-11 rounded-full flex items-center justify-center text-white transition-colors';
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      {call.phase === 'incoming' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-2xl w-full max-w-xs">
          <p className="text-3xl mb-2">📞</p>
          <p className="font-bold text-slate-900 dark:text-white">{call.peerName || call.peer}</p>
          <p className="text-xs text-slate-400 mb-6">Incoming {call.video ? 'video' : 'voice'} call…</p>
          <div className="flex justify-center gap-4">
            <button onClick={acceptCall} className={`${rb} bg-emerald-600 hover:bg-emerald-700`} title="Accept"><FiPhone size={18} /></button>
            <button onClick={() => hangup()} className={`${rb} bg-red-600 hover:bg-red-700`} title="Decline"><FiPhoneOff size={18} /></button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-3xl">
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700">
            <video ref={remoteRef} autoPlay playsInline className="w-full aspect-video object-contain bg-black" />
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
            <button onClick={() => hangup()} className={`${rb} bg-red-600 hover:bg-red-700`} title="Hang up"><FiPhoneOff size={17} /></button>
          </div>
        </div>
      )}
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
    <div className={`relative ${mine ? 'ml-auto' : ''} max-w-[78%]`}
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
export default function Colleagues({ member, visible }) {
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
  const endRef = useRef(null);
  const activeChatRef = useRef(null);
  const lastTypingSent = useRef(0);

  const loadChats = useCallback(() => {
    fetchJson('/api/colleagues?chats=1').then((d) => setChats(d.chats || [])).catch(() => {});
  }, []);
  const loadColleagues = useCallback(() => {
    fetchJson('/api/colleagues?list=1').then((d) => setColleagues(d.colleagues || [])).catch(() => {});
  }, []);

  const onWsEvent = useCallback((m) => {
    if (m.type === 'chat') {
      loadChats();
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
      callApi.onRtc(m.from, m.fromName, m.data);
    }
  }, [loadChats]);  

  const { presence, send } = useTeamSocket(member.email, onWsEvent);
  const callApi = useCall(member, send);

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
    if (!activeChatId) { setMessages([]); return; }
    fetchJson(`/api/colleagues?messages=${activeChatId}`)
      .then((d) => { setMessages(d.messages || []); setHasMore(Boolean(d.hasMore)); })
      .catch(() => setMessages([]));
  }, [activeChatId]);
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
    <div className={visible ? 'flex flex-1 overflow-hidden flex-col md:flex-row' : 'hidden'}>
      {/* Left: roster + chat history */}
      <aside className="w-full md:w-80 max-h-[45vh] md:max-h-none border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
          <div className="relative">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search colleagues & chats…"
              className={`${inp} w-full !pl-8`} />
          </div>
          <button onClick={() => setGroupModal('new')} className={`${tb2} w-full flex items-center justify-center gap-1.5`}>
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
              <div className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {c.kind === 'group' && (
                  <button title="Edit group" onClick={() => setGroupModal(c)} className="p-1.5 rounded text-slate-400 hover:text-indigo-500"><FiEdit2 size={12} /></button>
                )}
                <button title="Delete chat" onClick={() => deleteChat(c)} className="p-1.5 rounded text-slate-400 hover:text-red-500"><FiTrash2 size={12} /></button>
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
                    <PresenceChip status={c.presence} />
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
              {activeChat.kind === 'dm' && ['voice', 'video'].map((k) => (
                <button key={k} onClick={() => callApi.startCall(peerEmail, chatTitle(activeChat), k === 'video')}
                  disabled={(presence[peerEmail] || 'offline') === 'offline' || Boolean(callApi.call)}
                  title={(presence[peerEmail] || 'offline') === 'offline' ? 'Colleague is offline' : `Start ${k} call`}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
                  {k === 'video' ? <FiVideo size={15} /> : <FiPhone size={15} />}
                </button>
              ))}
              {activeChat.kind === 'group' && (
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
      <CallOverlay callApi={callApi} />
    </div>
  );
}
