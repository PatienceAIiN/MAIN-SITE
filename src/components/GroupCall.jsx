import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiPhoneOff, FiPhone, FiMinimize2, FiUsers, FiChevronDown, FiChevronUp } from 'react-icons/fi';
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
    setPeers({}); setRoom(null); setMuted(false); setCamOff(false); setSharing(false);
  }, []);

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
  const dropPeer = (email) => { pcs.current.get(email)?.close(); pcs.current.delete(email); setPeers((p) => { const n = { ...p }; delete n[email]; return n; }); };

  const broadcast = (data) => (roomRef.current?.members || []).filter((e) => e !== me.email).forEach((e) => send(e, data));

  // Start a call for a group chat.
  const start = async (chatId, members, name) => {
    await ensureMedia();
    const id = `grp-${chatId}-${Date.now()}`;
    setRoom({ id, name, members, host: true }); roomRef.current = { id, name, members, host: true };
    members.filter((e) => e !== me.email).forEach((e) => wsSend({ type: 'rtc', to: e, data: { room: id, kind: 'g-invite', name, members } }));
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
    } else if (data.kind === 'g-offer') {
      const pc = pcs.current.get(from) || makePc(from, fromName);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      for (const c of (pending.current.get(from) || [])) await pc.addIceCandidate(c).catch(() => {});
      pending.current.set(from, []);
      const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
      send(from, { kind: 'g-answer', sdp: ans });
    } else if (data.kind === 'g-answer') {
      await pcs.current.get(from)?.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(() => {});
    } else if (data.kind === 'g-ice') {
      const pc = pcs.current.get(from);
      if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
      else pending.current.set(from, [...(pending.current.get(from) || []), data.candidate]);
    } else if (data.kind === 'g-leave') {
      dropPeer(from);
    }
  }, [me, wsSend]);

  const toggleMute = () => { localStream.current?.getAudioTracks().forEach((t) => { t.enabled = muted; }); setMuted((m) => !m); };
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

  return { room, peers, muted, camOff, sharing, localStream, start, accept, leave, onRtc, onGcall, joinMeeting, toggleMute, toggleCam, toggleShare, me };
}

function Tile({ stream, name, muted, mine, speaking }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-800 aspect-video transition-shadow ${speaking ? 'ring-2 ring-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]' : 'ring-1 ring-white/10'}`}>
      <video ref={ref} autoPlay playsInline muted={mine || muted} className="w-full h-full object-cover" />
      <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] text-white bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full">
        {speaking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}{name}{mine ? ' (you)' : ''}
      </span>
    </div>
  );
}

export function GroupCallOverlay({ api }) {
  const { room, peers, muted, camOff, sharing, localStream, accept, leave, toggleMute, toggleCam, toggleShare, me } = api;
  const [min, setMin] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false); // top participant bar collapsed by default
  const [active, setActive] = useState(null);         // active-speaker email
  const peersRef = useRef(peers); peersRef.current = peers;
  useEffect(() => { setMin(false); setPartsOpen(false); setActive(null); }, [room?.id]);
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
  if (min) {
    return (
      <button onClick={() => setMin(false)} className="fixed bottom-4 right-4 z-[72] flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl animate-pulse">
        <FiVideo size={15} /> <span className="text-xs font-semibold">Group call · {Object.keys(peers).length + 1}</span>
      </button>
    );
  }
  const tiles = Object.entries(peers);
  const focus = active && peers[active] ? active : null;
  return (
    <div className="fixed inset-0 z-[72] bg-black/90 backdrop-blur-sm flex flex-col p-3">
      {/* Collapsed participants bar (top) — opens on click */}
      <div className="shrink-0">
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

      {/* Stage: focus the active speaker; otherwise everyone stays minimized */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 py-2">
        {focus ? (
          <>
            <div className="w-full max-w-4xl flex-1 min-h-0 flex items-center justify-center">
              <div className="w-full"><Tile stream={peers[focus].stream} name={peers[focus].name || focus} speaking /></div>
            </div>
            <div className="flex gap-2 overflow-x-auto shrink-0 max-w-full pb-1">
              <div className="w-32 shrink-0"><Tile stream={localStream.current} name={me.name || 'You'} mine /></div>
              {tiles.filter(([e]) => e !== focus).map(([e, p]) => <div key={e} className="w-32 shrink-0"><Tile stream={p.stream} name={p.name || e} /></div>)}
            </div>
          </>
        ) : (
          <div className={`grid gap-2 w-full ${tiles.length >= 3 ? 'grid-cols-3 max-w-3xl' : tiles.length >= 1 ? 'grid-cols-2 max-w-2xl' : 'grid-cols-1 max-w-md'}`}>
            <Tile stream={localStream.current} name={me.name || 'You'} mine />
            {tiles.map(([email, p]) => <Tile key={email} stream={p.stream} name={p.name || email} />)}
          </div>
        )}
      </div>
      <div className="flex justify-center gap-3 mt-1 shrink-0">
        <button onClick={toggleMute} className={`${rb} ${muted ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={muted ? 'Unmute' : 'Mute'}>{muted ? <FiMicOff size={17} /> : <FiMic size={17} />}</button>
        <button onClick={toggleCam} className={`${rb} ${camOff ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={camOff ? 'Camera on' : 'Camera off'}>{camOff ? <FiVideoOff size={17} /> : <FiVideo size={17} />}</button>
        <button onClick={toggleShare} className={`${rb} ${sharing ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={sharing ? 'Stop sharing' : 'Share screen'}><FiMonitor size={17} /></button>
        <button onClick={() => setMin(true)} className={`${rb} bg-slate-700 hover:bg-slate-600`} title="Minimize"><FiMinimize2 size={16} /></button>
        <button onClick={leave} className={`${rb} bg-red-600 hover:bg-red-700`} title="Leave"><FiPhoneOff size={17} /></button>
      </div>
    </div>
  );
}
