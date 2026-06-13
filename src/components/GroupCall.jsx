import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiPhoneOff, FiPhone, FiMinimize2, FiMaximize2, FiMove, FiUsers, FiUserPlus, FiChevronDown, FiChevronUp, FiMessageSquare, FiFileText, FiShare2, FiLink, FiX, FiSend, FiCheck } from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import { playRingtone } from '../common/sounds';

// Multi-party (mesh) group video call. Each participant holds one RTCPeerConnection
// per other participant. Glare-free rule: whoever is ALREADY in the room offers to
// a newcomer (who only answers). Signalling rides the existing /ws/team relay with
// data.room set, so 1:1 calls (no room) are completely unaffected.
export function useGroupCall(me, wsSend) {
  const [room, setRoom] = useState(null);     // { id, name, members } | { incoming, from, fromName }
  const [peers, setPeers] = useState({});      // email -> { name, stream }
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [chat, setChat] = useState([]);       // in-call chat: { id, name, text, mine }
  const [peerMuted, setPeerMuted] = useState({}); // email -> bool (broadcast mic state)
  const mutedRef = useRef(false);              // my live mic state (for late-joiner sync)
  const roomRef = useRef(null); roomRef.current = room;
  const pcs = useRef(new Map());               // email -> RTCPeerConnection
  const pending = useRef(new Map());           // email -> [ice]
  const localStream = useRef(null);
  const screenStream = useRef(null);
  const iceRef = useRef([{ urls: 'stun:stun.l.google.com:19302' }]);

  const send = (to, data) => wsSend({ type: 'rtc', to, data: { ...data, room: roomRef.current?.id } });

  const cleanup = useCallback(() => {
    pcs.current.forEach((pc) => pc.close()); pcs.current.clear(); pending.current.clear();
    [localStream, screenStream].forEach((r) => { r.current?.getTracks().forEach((t) => t.stop()); r.current = null; });
    setPeers({}); setRoom(null); setMuted(false); setCamOff(false); setSharing(false); setChat([]); setPeerMuted({}); mutedRef.current = false;
  }, []);

  // In-call chat: fan a message out to every peer I'm connected to (rides the
  // existing rtc relay; the hub already permits guests to send to their room).
  const sendChat = (text) => {
    const t = String(text || '').trim(); if (!t || !roomRef.current) return;
    setChat((c) => [...c, { id: `${Date.now()}-me-${c.length}`, name: me.name || 'You', text: t, mine: true }]);
    pcs.current.forEach((_, email) => send(email, { kind: 'g-chat', text: t, name: me.name || me.email }));
  };

  const ensureMedia = async () => {
    if (localStream.current) return localStream.current;
    const { iceServers } = await fetchJson('/api/voice-room/ice-servers').catch(() => ({ iceServers: iceRef.current }));
    iceRef.current = iceServers || iceRef.current;
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.current = s;
    return s;
  };

  const makePc = (email, name) => {
    const pc = new RTCPeerConnection({ iceServers: iceRef.current });
    localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current));
    pc.onicecandidate = (e) => { if (e.candidate) send(email, { kind: 'g-ice', candidate: e.candidate }); };
    pc.ontrack = (e) => setPeers((p) => ({ ...p, [email]: { name, stream: e.streams[0] } }));
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) dropPeer(email); };
    pcs.current.set(email, pc);
    return pc;
  };
  const dropPeer = (email) => { pcs.current.get(email)?.close(); pcs.current.delete(email); setPeers((p) => { const n = { ...p }; delete n[email]; return n; }); setPeerMuted((m) => { const n = { ...m }; delete n[email]; return n; }); };

  const broadcast = (data) => (roomRef.current?.members || []).filter((e) => e !== me.email).forEach((e) => send(e, data));

  // Start a call for a group chat.
  const start = async (chatId, members, name) => {
    await ensureMedia();
    const id = `grp-${chatId}-${Date.now()}`;
    setRoom({ id, name, members, host: true }); roomRef.current = { id, name, members, host: true };
    members.filter((e) => e !== me.email).forEach((e) => wsSend({ type: 'rtc', to: e, data: { room: id, kind: 'g-invite', name, members } }));
  };

  // Ring an extra person INTO the live call: they receive a group invite whose
  // member list is everyone currently connected, so on accept they g-join each
  // of us and the mesh extends. Works for both chat group calls and meetings.
  const invite = (email, name) => {
    const r = roomRef.current; if (!r || r.incoming || !email) return;
    const members = Array.from(new Set([me.email, ...pcs.current.keys()]));
    wsSend({ type: 'rtc', to: email, data: { room: r.id, kind: 'g-invite', name: r.name || name || 'Group call', members } });
  };

  const accept = async () => {
    const inc = roomRef.current; if (!inc?.incoming) return;
    await ensureMedia();
    const r = { id: inc.id, name: inc.name, members: inc.members };
    setRoom(r); roomRef.current = r;
    broadcast({ kind: 'g-join', name: me.name || me.email });   // existing members will offer to me
  };

  // Join an OPEN meeting room via its shared link — discovery via the hub
  // registry (anyone with the link can join, not just invitees).
  const joinMeeting = async (roomId, name) => {
    if (roomRef.current) return;
    await ensureMedia();
    const r = { id: roomId, name: name || 'Meeting', members: [], host: false, meeting: true };
    setRoom(r); roomRef.current = r;
    wsSend({ type: 'gcall', room: roomId, op: 'join' }); // hub returns roster + notifies occupants
  };

  // Hub room-registry events for open meeting rooms.
  const onGcall = useCallback(async (m) => {
    const r = roomRef.current;
    if (!r || m.room !== r.id) return;
    if (m.op === 'roster') {
      r.members = (m.members || []).map((x) => x.email); // existing occupants will offer to me
    } else if (m.op === 'joined') {
      const pc = makePc(m.email, m.name);               // I'm already here → I offer to the newcomer
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      send(m.email, { kind: 'g-offer', sdp: offer, name: me.name || me.email });
      send(m.email, { kind: 'g-mute', muted: mutedRef.current });   // sync my mic state to the newcomer
    } else if (m.op === 'left') {
      dropPeer(m.email);
    }
  }, [me, wsSend]);

  // Leave: meeting rooms deregister via the hub; chat calls use g-end/g-leave.
  const leave = useCallback(() => {
    const r = roomRef.current;
    if (r?.meeting) wsSend({ type: 'gcall', room: r.id, op: 'leave' });
    else broadcast({ kind: r?.host ? 'g-end' : 'g-leave' });
    cleanup();
  }, [cleanup]);

  const onRtc = useCallback(async (from, fromName, data) => {
    if (!data?.room) return; // not a group message
    const r = roomRef.current;
    if (data.kind === 'g-invite') {
      if (r) return; // already busy
      setRoom({ incoming: true, id: data.room, name: data.name, members: data.members, from, fromName });
      return;
    }
    // Host ended the whole call → tear down immediately, whether we'd joined or
    // were still ringing (this clears a stuck incoming dialer).
    if (data.kind === 'g-end' && r && data.room === r.id) { cleanup(); return; }
    if (!r || r.incoming || data.room !== r.id) return;
    if (data.kind === 'g-join') {
      // I'm already in the room → I initiate the offer to the newcomer.
      const pc = makePc(from, fromName);
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      send(from, { kind: 'g-offer', sdp: offer, name: me.name || me.email });
      send(from, { kind: 'g-mute', muted: mutedRef.current });
    } else if (data.kind === 'g-offer') {
      const pc = pcs.current.get(from) || makePc(from, fromName);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      for (const c of (pending.current.get(from) || [])) await pc.addIceCandidate(c).catch(() => {});
      pending.current.set(from, []);
      const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
      send(from, { kind: 'g-answer', sdp: ans });
      send(from, { kind: 'g-mute', muted: mutedRef.current });
    } else if (data.kind === 'g-mute') {
      setPeerMuted((mm) => ({ ...mm, [from]: Boolean(data.muted) }));
    } else if (data.kind === 'g-answer') {
      await pcs.current.get(from)?.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(() => {});
    } else if (data.kind === 'g-ice') {
      const pc = pcs.current.get(from);
      if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
      else pending.current.set(from, [...(pending.current.get(from) || []), data.candidate]);
    } else if (data.kind === 'g-leave') {
      dropPeer(from);
    } else if (data.kind === 'g-chat') {
      setChat((c) => [...c, { id: `${Date.now()}-${from}-${c.length}`, name: fromName || from, text: String(data.text || '').slice(0, 2000), mine: false }]);
    }
  }, [me, wsSend]);

  const toggleMute = () => {
    const next = !mutedRef.current; mutedRef.current = next;
    localStream.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
    pcs.current.forEach((_, email) => send(email, { kind: 'g-mute', muted: next })); // tell everyone
  };
  const toggleCam = () => { localStream.current?.getVideoTracks().forEach((t) => { t.enabled = camOff; }); setCamOff((v) => !v); };
  const toggleShare = async () => {
    if (screenStream.current) {
      screenStream.current.getTracks().forEach((t) => t.stop()); screenStream.current = null;
      const cam = localStream.current?.getVideoTracks()[0];
      pcs.current.forEach((pc) => { const s = pc.getSenders().find((x) => x.track?.kind === 'video'); if (s && cam) s.replaceTrack(cam); });
      setSharing(false); return;
    }
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStream.current = ds; const track = ds.getVideoTracks()[0];
      pcs.current.forEach((pc) => { const s = pc.getSenders().find((x) => x.track?.kind === 'video'); if (s) s.replaceTrack(track); });
      track.onended = toggleShare; setSharing(true);
    } catch { /* cancelled */ }
  };

  return { room, peers, peerMuted, muted, camOff, sharing, chat, sendChat, localStream, start, accept, invite, leave, onRtc, onGcall, joinMeeting, toggleMute, toggleCam, toggleShare, me };
}

function Tile({ stream, name, mine, speaking, micMuted }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  // A tile only gets the "speaking" highlight when its mic is actually live.
  const live = speaking && !micMuted;
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-800 aspect-video transition-shadow ${live ? 'ring-2 ring-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]' : 'ring-1 ring-white/10'}`}>
      <video ref={ref} autoPlay playsInline muted={mine} className="w-full h-full object-cover" />
      {/* Bottom-left: muted → red crossed mic; speaking → green mic; name pill */}
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[11px] text-white bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full">
        {micMuted
          ? <FiMicOff size={12} className="text-red-400" />
          : live ? <FiMic size={12} className="text-emerald-400 animate-pulse" /> : null}
        {name}{mine ? ' (you)' : ''}
      </span>
    </div>
  );
}

// Draggable picture-in-picture window shown when the call is minimized. Shows
// the active speaker; movable anywhere; hover reveals expand / leave controls.
function MiniCall({ stream, name, mine, speaking, micMuted, count, onExpand, onLeave }) {
  const vref = useRef(null);
  const drag = useRef(null);
  const [pos, setPos] = useState(() => ({
    x: (typeof window !== 'undefined' ? window.innerWidth - 256 : 20),
    y: (typeof window !== 'undefined' ? window.innerHeight - 190 : 20),
  }));
  useEffect(() => { if (vref.current && stream) vref.current.srcObject = stream; }, [stream]);
  const clamp = (x, y) => ({
    x: Math.max(6, Math.min((window.innerWidth || 9999) - 246, x)),
    y: Math.max(6, Math.min((window.innerHeight || 9999) - 184, y)),
  });
  const onDown = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* unsupported */ } };
  const onMove = (e) => { if (!drag.current) return; setPos(clamp(drag.current.ox + (e.clientX - drag.current.sx), drag.current.oy + (e.clientY - drag.current.sy))); };
  const onUp = () => { drag.current = null; };
  const live = speaking && !micMuted;
  return (
    <div style={{ left: pos.x, top: pos.y, width: 240 }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      className={`fixed z-[73] select-none cursor-move group rounded-2xl overflow-hidden shadow-2xl bg-slate-900 ${live ? 'ring-2 ring-emerald-400' : 'ring-1 ring-white/25'}`}>
      <video ref={vref} autoPlay playsInline muted={mine} className="w-full aspect-video object-cover pointer-events-none bg-slate-800" />
      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] text-white bg-black/55 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
        {micMuted ? <FiMicOff size={11} className="text-red-400" /> : live ? <FiMic size={11} className="text-emerald-400 animate-pulse" /> : null}
        {name}{mine ? ' (you)' : ''}
      </span>
      {count > 1 && <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 text-[10px] text-white bg-black/55 backdrop-blur-sm px-1.5 py-0.5 rounded-full"><FiUsers size={9} />{count}</span>}
      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onExpand} title="Expand" className="h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"><FiMaximize2 size={12} /></button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onLeave} title="Leave" className="h-7 w-7 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center"><FiPhoneOff size={12} /></button>
      </div>
      <span className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/70"><FiMove size={12} /></span>
    </div>
  );
}

// "Add people" — ring an online internal colleague (Team / Support tabs) into
// the live call, or copy the shareable link for anyone (internal or external).
function AddPeople({ roster, presence = {}, roomId, inCall, onRing, onClose, canShare = true }) {
  const [tab, setTab] = useState('team');
  const [copied, setCopied] = useState(false);
  const [rung, setRung] = useState({}); // email -> true (transient "Ringing…")
  const link = `${window.location.origin}/meet?room=${roomId}`;
  const copy = () => { try { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* blocked */ } };
  const inSet = new Set(inCall || []);
  const list = (roster || []).filter((c) => (c.side || 'team') === tab && !inSet.has(c.email));
  const ring = (c) => { onRing(c.email, c.name); setRung((r) => ({ ...r, [c.email]: true })); setTimeout(() => setRung((r) => { const n = { ...r }; delete n[c.email]; return n; }), 4000); };
  const dot = (s) => s === 'online' ? 'bg-emerald-500' : s === 'away' ? 'bg-amber-500' : s === 'busy' ? 'bg-red-500' : 'bg-slate-400';
  return (
    <div className="fixed inset-0 z-[74] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><FiUserPlus size={15} /> Add people</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><FiX size={16} /></button>
        </div>
        {/* Share link — works for internal & external guests. Hidden for support
            users (internal-only: they ring colleagues from the list below). */}
        {canShare && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1"><FiLink size={11} /> Invite by link (anyone can join)</p>
            <div className="flex gap-1.5">
              <input readOnly value={link} className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-slate-300" />
              <button onClick={copy} className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'}`}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
        )}
        {roster ? (
          <>
            <div className="flex gap-1 px-4 pt-3">
              {['team', 'support'].map((s) => (
                <button key={s} onClick={() => setTab(s)} className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize ${tab === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{s}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {list.map((c) => {
                const st = presence[c.email] || 'offline';
                const live = st === 'online' || st === 'away';
                return (
                  <div key={c.email} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot(st)}`} />
                      <span className="truncate text-sm text-slate-800 dark:text-slate-100">{c.name}<span className="text-[11px] text-slate-400"> · {c.email}</span></span>
                    </span>
                    {rung[c.email]
                      ? <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">Ringing…</span>
                      : live
                        ? <button onClick={() => ring(c)} className="shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"><FiPhone size={11} /> Ring</button>
                        : <span className="text-[11px] text-slate-400 shrink-0">offline</span>}
                  </div>
                );
              })}
              {!list.length && <p className="text-xs text-slate-400 text-center py-6">Everyone here is already in the call.</p>}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400 text-center py-6 px-4">Share the link above to invite anyone to this meeting.</p>
        )}
      </div>
    </div>
  );
}

export function GroupCallOverlay({ api, roster, presence, canShare = true }) {
  const { room, peers, peerMuted = {}, muted, camOff, sharing, chat, sendChat, localStream, accept, invite, leave, toggleMute, toggleCam, toggleShare, me } = api;
  const [min, setMin] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false); // top participant bar collapsed by default
  const [active, setActive] = useState(null);         // active-speaker email
  const [notesOpen, setNotesOpen] = useState(false);  // left sidebar
  const [chatOpen, setChatOpen] = useState(false);    // right sidebar
  const [copied, setCopied] = useState(false);
  const [seenChat, setSeenChat] = useState(0);        // for the unread chat badge
  const peersRef = useRef(peers); peersRef.current = peers;
  useEffect(() => { setMin(false); setPartsOpen(false); setActive(null); setNotesOpen(false); setChatOpen(false); setSeenChat(0); setAddOpen(false); }, [room?.id]);
  useEffect(() => { if (chatOpen) setSeenChat(chat.length); }, [chatOpen, chat.length]);
  const unread = Math.max(0, (chat?.length || 0) - seenChat);
  const copyLink = () => { try { navigator.clipboard.writeText(`${window.location.origin}/meet?room=${room.id}`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ } };
  // Ring while a group call is incoming.
  useEffect(() => { if (room?.incoming) return playRingtone(); }, [room?.incoming]);
  // Active-speaker detection: measure each remote stream's audio level; the
  // loudest above a threshold is focused, otherwise everyone stays minimized.
  useEffect(() => {
    if (!room || room.incoming) return undefined;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return undefined;
    const actx = new AC(); const nodes = new Map();
    const id = setInterval(() => {
      Object.entries(peersRef.current).forEach(([email, p]) => {
        if (nodes.has(email) || !p.stream || !p.stream.getAudioTracks().length) return;
        try { const src = actx.createMediaStreamSource(p.stream); const an = actx.createAnalyser(); an.fftSize = 512; src.connect(an); nodes.set(email, { an, data: new Uint8Array(an.frequencyBinCount) }); } catch { /* no audio */ }
      });
      let loud = null, max = 0;
      nodes.forEach(({ an, data }, email) => {
        if (!peersRef.current[email]) return;
        an.getByteTimeDomainData(data);
        let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length); if (rms > max) { max = rms; loud = email; }
      });
      setActive(max > 0.045 ? loud : null);
    }, 400);
    return () => { clearInterval(id); actx.close().catch(() => {}); };
  }, [room?.id, room?.incoming]);
  if (!room) return null;
  const rb = 'h-11 w-11 rounded-full flex items-center justify-center text-white transition-colors';

  if (room.incoming) {
    return (
      <div className="fixed inset-0 z-[72] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-2xl w-full max-w-xs">
          <p className="text-3xl mb-2">👥</p>
          <p className="font-bold text-slate-900 dark:text-white">{room.name || 'Group'} call</p>
          <p className="text-xs text-slate-400 mb-6">{room.fromName} started a group video call</p>
          <div className="flex justify-center gap-4">
            <button onClick={accept} className={`${rb} bg-emerald-600 hover:bg-emerald-700`} title="Join"><FiPhone size={18} /></button>
            <button onClick={leave} className={`${rb} bg-red-600 hover:bg-red-700`} title="Decline"><FiPhoneOff size={18} /></button>
          </div>
        </div>
      </div>
    );
  }
  const tiles = Object.entries(peers);
  const focus = active && peers[active] ? active : null;
  if (min) {
    // Floating, draggable PiP that shows whoever is speaking (or the first peer,
    // or yourself when alone). Hover for restore / leave controls.
    const fEmail = focus || tiles[0]?.[0] || null;
    const fStream = fEmail ? peers[fEmail].stream : localStream.current;
    const fName = fEmail ? (peers[fEmail].name || fEmail) : (me.name || 'You');
    return (
      <MiniCall stream={fStream} name={fName} mine={!fEmail} speaking={fEmail ? active === fEmail : !muted}
        micMuted={fEmail ? peerMuted[fEmail] : muted} count={tiles.length + 1}
        onExpand={() => setMin(false)} onLeave={leave} />
    );
  }
  return (
    <div className="fixed inset-0 z-[72] bg-black/90 backdrop-blur-sm flex flex-col p-3">
      {/* Collapsed participants bar (top-left) + Share (top-right) */}
      <div className="shrink-0 flex items-start justify-between gap-2">
        <div>
        <button onClick={() => setPartsOpen((o) => !o)} className="flex items-center gap-2 text-white/85 text-xs bg-white/10 hover:bg-white/15 rounded-full px-3 py-1.5">
          <FiUsers size={13} /> {tiles.length + 1} in {room.name || 'group'} call {partsOpen ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
        </button>
        {partsOpen && (
          <div className="mt-2 bg-slate-900/95 border border-white/10 rounded-xl p-2.5 w-64 text-xs space-y-1">
            <p className="text-white/90">{me.name || 'You'} <span className="text-white/40">(you)</span></p>
            {tiles.map(([e, p]) => (
              <p key={e} className={active === e ? 'text-emerald-300 font-semibold' : 'text-white/80'}>
                {p.name || e}{active === e ? ' · speaking' : ''}
              </p>
            ))}
          </div>
        )}
        </div>
        <div className="flex items-center gap-2">
          {/* Add more people — ring an online colleague in, or share the link */}
          <button onClick={() => setAddOpen(true)} title="Add people to the call" className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/85">
            <FiUserPlus size={13} /> Add
          </button>
          {/* Share: copies the public join link (works for internal + external
              guests). Hidden for support-portal users — internal calls only. */}
          {canShare && (
            <button onClick={copyLink} title="Copy meeting link to share" className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 ${copied ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/15 text-white/85'}`}>
              {copied ? <FiCheck size={13} /> : <FiShare2 size={13} />} {copied ? 'Link copied' : 'Share'}
            </button>
          )}
        </div>
      </div>
      {addOpen && <AddPeople roster={roster} presence={presence} roomId={room.id} canShare={canShare}
        inCall={[me.email, ...Object.keys(peers)]} onRing={(email, name) => invite(email, name)} onClose={() => setAddOpen(false)} />}

      {/* Middle row: notes (left) · stage · chat (right) */}
      <div className="flex-1 min-h-0 flex gap-2 py-2">
        {notesOpen && <NotesPanel onClose={() => setNotesOpen(false)} />}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2">
        {focus ? (
          <>
            <div className="w-full max-w-4xl flex-1 min-h-0 flex items-center justify-center">
              <div className="w-full"><Tile stream={peers[focus].stream} name={peers[focus].name || focus} speaking micMuted={peerMuted[focus]} /></div>
            </div>
            <div className="flex gap-2 overflow-x-auto shrink-0 max-w-full pb-1">
              <div className="w-32 shrink-0"><Tile stream={localStream.current} name={me.name || 'You'} mine micMuted={muted} /></div>
              {tiles.filter(([e]) => e !== focus).map(([e, p]) => <div key={e} className="w-32 shrink-0"><Tile stream={p.stream} name={p.name || e} speaking={active === e} micMuted={peerMuted[e]} /></div>)}
            </div>
          </>
        ) : (
          <div className={`grid gap-2 w-full ${tiles.length >= 3 ? 'grid-cols-3 max-w-3xl' : tiles.length >= 1 ? 'grid-cols-2 max-w-2xl' : 'grid-cols-1 max-w-md'}`}>
            <Tile stream={localStream.current} name={me.name || 'You'} mine micMuted={muted} />
            {tiles.map(([email, p]) => <Tile key={email} stream={p.stream} name={p.name || email} speaking={active === email} micMuted={peerMuted[email]} />)}
          </div>
        )}
        </div>
        {chatOpen && <ChatPanel chat={chat} onSend={sendChat} onClose={() => setChatOpen(false)} />}
      </div>
      <div className="flex justify-center gap-3 mt-1 shrink-0">
        <button onClick={toggleMute} className={`${rb} ${muted ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={muted ? 'Unmute' : 'Mute'}>{muted ? <FiMicOff size={17} /> : <FiMic size={17} />}</button>
        <button onClick={() => setChatOpen((o) => !o)} className={`${rb} relative ${chatOpen ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title="Call chat"><FiMessageSquare size={17} />{unread > 0 && !chatOpen && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}</button>
        <button onClick={() => setNotesOpen((o) => !o)} className={`${rb} ${notesOpen ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title="Notes"><FiFileText size={17} /></button>
        <button onClick={toggleCam} className={`${rb} ${camOff ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={camOff ? 'Camera on' : 'Camera off'}>{camOff ? <FiVideoOff size={17} /> : <FiVideo size={17} />}</button>
        <button onClick={toggleShare} className={`${rb} ${sharing ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={sharing ? 'Stop sharing' : 'Share screen'}><FiMonitor size={17} /></button>
        <button onClick={() => setMin(true)} className={`${rb} bg-slate-700 hover:bg-slate-600`} title="Minimize"><FiMinimize2 size={16} /></button>
        <button onClick={leave} className={`${rb} bg-red-600 hover:bg-red-700`} title="Leave"><FiPhoneOff size={17} /></button>
      </div>
    </div>
  );
}

// Left sidebar: jot notes during the call; Save persists to the team Notes tab
// (silently no-ops for guests who aren't authenticated).
function NotesPanel({ onClose }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const save = async () => {
    if (!body.trim() && !title.trim()) return;
    setStatus('saving');
    try {
      await fetchJson('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() || 'Call notes', body, kind: 'note' }) });
      setStatus('saved'); setTimeout(() => setStatus(''), 2000);
    } catch { setStatus('error'); setTimeout(() => setStatus(''), 2500); }
  };
  return (
    <div className="w-72 max-w-[42vw] shrink-0 bg-slate-900/95 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-white text-sm font-semibold flex items-center gap-1.5"><FiFileText size={14} /> Notes</span>
        <button onClick={onClose} className="text-white/60 hover:text-white"><FiX size={16} /></button>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1 min-h-0">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Jot down notes during the call…" className="flex-1 min-h-0 resize-none rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <button onClick={save} disabled={status === 'saving'} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 disabled:opacity-50">{status === 'saved' ? 'Saved ✓' : status === 'error' ? 'Save failed' : status === 'saving' ? 'Saving…' : 'Save to Notes'}</button>
      </div>
    </div>
  );
}

// Right sidebar: live chat shared by everyone in the call (mesh-relayed).
function ChatPanel({ chat, onSend, onClose }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.length]);
  const submit = () => { const t = text.trim(); if (!t) return; onSend(t); setText(''); };
  return (
    <div className="w-72 max-w-[42vw] shrink-0 bg-slate-900/95 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-white text-sm font-semibold flex items-center gap-1.5"><FiMessageSquare size={14} /> Call chat</span>
        <button onClick={onClose} className="text-white/60 hover:text-white"><FiX size={16} /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {!chat.length && <p className="text-white/40 text-xs text-center py-6">No messages yet. Everyone in the call sees what you send here.</p>}
        {chat.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
            {!m.mine && <span className="text-[10px] text-white/50 px-1">{m.name}</span>}
            <span className={`max-w-[85%] text-sm px-3 py-1.5 rounded-2xl break-words ${m.mine ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white/90'}`}>{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-white/10 flex gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Message everyone…" className="flex-1 rounded-full bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <button onClick={submit} className="h-9 w-9 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center"><FiSend size={15} /></button>
      </div>
    </div>
  );
}
