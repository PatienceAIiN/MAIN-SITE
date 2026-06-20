import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiPhoneOff, FiPhone, FiMinimize2, FiMaximize2, FiMove, FiUsers, FiUserPlus, FiChevronDown, FiChevronUp, FiMessageSquare, FiFileText, FiShare2, FiLink, FiX, FiSend, FiCheck, FiExternalLink } from 'react-icons/fi';
import { Room, RoomEvent, Track } from 'livekit-client';
import { fetchJson } from '../common/fetchJson';
import { playRingtone } from '../common/sounds';

// Group video call powered by LiveKit (a media server / SFU). Every participant
// publishes ONE up-stream to LiveKit, which forwards it to everyone else — so it
// scales smoothly to many people, works reliably across phones + networks, and
// avoids the old mesh's CPU/bandwidth blow-up. The /ws/team relay is still used
// only to "ring" a colleague into a call (the incoming-call popup); all audio &
// video flow through LiveKit. 1:1 calls are unaffected (separate code path).
export function useGroupCall(me, wsSend) {
  const [room, setRoom] = useState(null);          // meta: { id, name, members, host?, meeting? } | { incoming, ... }
  const [peers, setPeers] = useState({});          // identity -> { name, email, videoTrack, micMuted, camOff }
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [chat, setChat] = useState([]);            // { id, name, text, mine }
  const roomRef = useRef(null); roomRef.current = room;
  const lkRef = useRef(null);                       // LiveKit Room instance
  const audioEls = useRef(new Map());              // identity -> [HTMLAudioElement] (remote audio sinks)

  const emailOf = (identity) => String(identity || '').split('__')[0];
  const send = (to, data) => wsSend({ type: 'rtc', to, data: { ...data, room: roomRef.current?.id } });
  const addChat = (m) => setChat((c) => [...c, { id: `${Date.now()}-${m.mine ? 'me' : m.from || 'x'}-${c.length}`, ...m }]);

  // Recompute the visible state from the live LiveKit room (cheap; tracks are
  // stable object refs so tiles don't re-attach/flicker).
  const refresh = () => {
    const lk = lkRef.current; if (!lk) return;
    const np = {};
    lk.remoteParticipants.forEach((p) => {
      const share = p.getTrackPublication(Track.Source.ScreenShare);
      const cam = p.getTrackPublication(Track.Source.Camera);
      const vt = share?.videoTrack || cam?.videoTrack || null;
      np[p.identity] = { name: p.name || emailOf(p.identity), email: emailOf(p.identity), videoTrack: vt, micMuted: !p.isMicrophoneEnabled, camOff: !vt };
    });
    setPeers(np);
    const lp = lk.localParticipant;
    const lShare = lp.getTrackPublication(Track.Source.ScreenShare);
    const lCam = lp.getTrackPublication(Track.Source.Camera);
    const lvt = lShare?.videoTrack || lCam?.videoTrack || null;
    setLocalVideoTrack(lvt);
    setMuted(!lp.isMicrophoneEnabled);
    setCamOff(!lvt);
    setSharing(!!lShare?.videoTrack);
  };

  const attachAudio = (track, participant) => {
    if (track.kind !== Track.Kind.Audio || participant?.isLocal) return;
    try {
      const el = track.attach();           // LiveKit creates an <audio> that handles autoplay
      el.setAttribute('data-lk-audio', participant.identity);
      document.body.appendChild(el);
      const arr = audioEls.current.get(participant.identity) || [];
      arr.push(el); audioEls.current.set(participant.identity, arr);
    } catch { /* ignore */ }
  };
  const detachAudioFor = (identity) => {
    (audioEls.current.get(identity) || []).forEach((el) => { try { el.remove(); } catch { /* gone */ } });
    audioEls.current.delete(identity);
  };

  const cleanup = useCallback(() => {
    try { lkRef.current?.disconnect(); } catch { /* already gone */ }
    lkRef.current = null;
    audioEls.current.forEach((arr) => arr.forEach((el) => { try { el.remove(); } catch { /* gone */ } }));
    audioEls.current.clear();
    setPeers({}); setLocalVideoTrack(null); setRoom(null); setMuted(false); setCamOff(false); setSharing(false); setChat([]);
  }, []);

  const connectRoom = async (roomId, audioOnly) => {
    if (lkRef.current) return;
    const { url, token } = await fetchJson(`/api/livekit?room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(me.name || me.email || 'Guest')}`);
    if (!url || !token) throw new Error('Video service is not configured.');
    // adaptiveStream + dynacast keep bandwidth/CPU low (esp. on phones).
    const lk = new Room({ adaptiveStream: true, dynacast: true });
    lkRef.current = lk;
    lk.on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, (p) => { detachAudioFor(p.identity); refresh(); })
      .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => { attachAudio(track, participant); refresh(); })
      .on(RoomEvent.TrackUnsubscribed, (track) => { try { track.detach().forEach((e) => e.remove()); } catch { /* ignore */ } refresh(); })
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.ParticipantNameChanged, refresh)
      .on(RoomEvent.DataReceived, (payload, participant) => {
        try { const d = JSON.parse(new TextDecoder().decode(payload)); if (d?.text) addChat({ from: participant?.identity, name: participant?.name || emailOf(participant?.identity), text: String(d.text).slice(0, 2000), mine: false }); } catch { /* non-chat data */ }
      })
      .on(RoomEvent.Disconnected, () => cleanup());
    await lk.connect(url, token);
    await lk.localParticipant.setMicrophoneEnabled(true).catch(() => {});
    if (!audioOnly) await lk.localParticipant.setCameraEnabled(true).catch(() => {});
    lk.startAudio?.().catch(() => {});
    refresh();
  };

  const sendChat = (text) => {
    const t = String(text || '').trim(); const lk = lkRef.current; if (!t || !lk) return;
    addChat({ name: me.name || 'You', text: t, mine: true });
    try { lk.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ text: t })), { reliable: true }); } catch { /* ignore */ }
    const rid = roomRef.current?.id;
    if (rid && rid.startsWith('mtg-')) fetch('/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'transcript', room: rid, line: `${me.name || 'Guest'}: ${t}` }) }).catch(() => {});
  };

  // Start a call from a group chat: connect, then ring the members in.
  const start = async (chatId, members, name) => {
    const id = `grp-${chatId}-${Date.now()}`;
    setRoom({ id, name, members, host: true }); roomRef.current = { id, name, members, host: true };
    await connectRoom(id, false);
    members.filter((e) => e !== me.email).forEach((e) => wsSend({ type: 'rtc', to: e, data: { room: id, kind: 'g-invite', name, members } }));
  };
  // Ring an extra colleague into the live call.
  const invite = (email, name) => {
    const r = roomRef.current; if (!r || r.incoming || !email) return;
    wsSend({ type: 'rtc', to: email, data: { room: r.id, kind: 'g-invite', name: r.name || name || 'Group call', members: r.members || [] } });
  };
  const accept = async () => {
    const inc = roomRef.current; if (!inc?.incoming) return;
    const r = { id: inc.id, name: inc.name, members: inc.members || [] };
    setRoom(r); roomRef.current = r;
    await connectRoom(inc.id, false);
  };
  // Join an open meeting room via its shared link (anyone with the link).
  const joinMeeting = async (roomId, name, audioOnly = false) => {
    if (roomRef.current && !roomRef.current.incoming) return;
    const r = { id: roomId, name: name || 'Meeting', members: [], meeting: true };
    setRoom(r); roomRef.current = r;
    await connectRoom(roomId, audioOnly);
  };
  const leave = useCallback(() => {
    const r = roomRef.current;
    if (r && !r.meeting) (r.members || []).filter((e) => e !== me.email).forEach((e) => wsSend({ type: 'rtc', to: e, data: { room: r.id, kind: 'g-end' } }));
    cleanup();
    // eslint-disable-next-line
  }, [cleanup]);

  // WS relay: only the ring/incoming-popup signalling — media is all LiveKit.
  const onRtc = useCallback((from, fromName, data) => {
    if (!data?.room) return;
    const r = roomRef.current;
    if (data.kind === 'g-invite') {
      if (r) return; // already busy
      const inc = { incoming: true, id: data.room, name: data.name, members: data.members, from, fromName };
      setRoom(inc); roomRef.current = inc; return;
    }
    if (data.kind === 'g-end' && r && data.room === r.id && r.incoming) cleanup();
  }, [cleanup]);
  const onGcall = useCallback(() => {}, []); // LiveKit handles discovery; hub no longer needed for media

  const toggleMute = () => { const lk = lkRef.current; if (!lk) return; lk.localParticipant.setMicrophoneEnabled(!lk.localParticipant.isMicrophoneEnabled).then(refresh).catch(() => {}); };
  const setMic = (on) => { const lk = lkRef.current; if (!lk || lk.localParticipant.isMicrophoneEnabled === on) return; lk.localParticipant.setMicrophoneEnabled(on).then(refresh).catch(() => {}); };
  const toggleCam = () => { const lk = lkRef.current; if (!lk) return; lk.localParticipant.setCameraEnabled(!lk.localParticipant.isCameraEnabled).then(refresh).catch(() => {}); };
  const toggleShare = async () => { const lk = lkRef.current; if (!lk) return; try { const on = !!lk.localParticipant.getTrackPublication(Track.Source.ScreenShare); await lk.localParticipant.setScreenShareEnabled(!on); refresh(); } catch { /* cancelled */ } };

  useEffect(() => () => cleanup(), [cleanup]); // tidy up if the component unmounts mid-call

  return { room, peers, localVideoTrack, muted, camOff, sharing, chat, sendChat, start, accept, invite, leave, onRtc, onGcall, joinMeeting, toggleMute, setMic, toggleCam, toggleShare, me };
}

// Attach a LiveKit video track to a <video>; handles local mirror + camera-off.
function Tile({ videoTrack, name, mine, micMuted, camOff, pinned, onPin }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    if (videoTrack) { try { videoTrack.attach(el); } catch { /* ignore */ } return () => { try { videoTrack.detach(el); } catch { /* ignore */ } }; }
    el.srcObject = null; return undefined;
  }, [videoTrack]);
  const initial = ((name || '?').trim().charAt(0) || '?').toUpperCase();
  const off = camOff || !videoTrack;
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-slate-800 aspect-video ring-1 ring-white/10 w-full h-full">
      {/* Own preview is mirrored (selfie view); remote people are shown true-to-life. */}
      <video ref={ref} autoPlay playsInline muted={mine} className={`w-full h-full object-cover ${mine ? 'scale-x-[-1]' : ''} ${off ? 'invisible' : ''}`} />
      {off && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-700 to-slate-900">
          <span className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-indigo-600 text-white grid place-items-center text-xl sm:text-2xl font-bold select-none">{initial}</span>
          <FiVideoOff size={15} className="text-white/40" />
        </div>
      )}
      {onPin && (
        <button onClick={onPin} title={pinned ? 'Unpin' : 'Pin / enlarge'}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition">
          {pinned ? <FiMinimize2 size={13} /> : <FiMaximize2 size={13} />}
        </button>
      )}
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[11px] text-white bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded-full max-w-[90%] truncate">
        {micMuted && <FiMicOff size={12} className="text-red-400 shrink-0" />}
        {off && <FiVideoOff size={12} className="text-amber-400 shrink-0" />}
        <span className="truncate">{name}{mine ? ' (you)' : ''}</span>
      </span>
    </div>
  );
}

// Draggable picture-in-picture window shown when the call is minimized.
function MiniCall({ videoTrack, name, mine, micMuted, camOff, count, onExpand, onLeave }) {
  const vref = useRef(null);
  const drag = useRef(null);
  const [pos, setPos] = useState(() => ({
    x: (typeof window !== 'undefined' ? window.innerWidth - 256 : 20),
    y: (typeof window !== 'undefined' ? window.innerHeight - 190 : 20),
  }));
  useEffect(() => {
    const el = vref.current; if (!el) return undefined;
    if (videoTrack) { try { videoTrack.attach(el); } catch { /* ignore */ } return () => { try { videoTrack.detach(el); } catch { /* ignore */ } }; }
    el.srcObject = null; return undefined;
  }, [videoTrack]);
  const clamp = (x, y) => ({
    x: Math.max(6, Math.min((window.innerWidth || 9999) - 246, x)),
    y: Math.max(6, Math.min((window.innerHeight || 9999) - 184, y)),
  });
  const onDown = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* unsupported */ } };
  const onMove = (e) => { if (!drag.current) return; setPos(clamp(drag.current.ox + (e.clientX - drag.current.sx), drag.current.oy + (e.clientY - drag.current.sy))); };
  const onUp = () => { drag.current = null; };
  const initial = ((name || '?').trim().charAt(0) || '?').toUpperCase();
  const off = camOff || !videoTrack;
  return (
    <div style={{ left: pos.x, top: pos.y, width: 240 }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      className="fixed z-[73] select-none cursor-move group rounded-2xl overflow-hidden shadow-2xl bg-slate-900 ring-1 ring-white/25">
      <video ref={vref} autoPlay playsInline muted={mine} className={`w-full aspect-video object-cover pointer-events-none bg-slate-800 ${mine ? 'scale-x-[-1]' : ''} ${off ? 'invisible' : ''}`} />
      {off && <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900"><span className="h-12 w-12 rounded-full bg-indigo-600 text-white grid place-items-center text-lg font-bold">{initial}</span></div>}
      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] text-white bg-black/55 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
        {micMuted && <FiMicOff size={11} className="text-red-400" />}
        {off && <FiVideoOff size={11} className="text-amber-400" />}
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

// "Add people" — ring an online colleague into the call, or copy the share link.
function AddPeople({ roster, presence = {}, roomId, inCall, onRing, onClose, canShare = true }) {
  const [tab, setTab] = useState('team');
  const [copied, setCopied] = useState(false);
  const [rung, setRung] = useState({});
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
  const { room, peers, localVideoTrack, muted, camOff, sharing, chat, sendChat, accept, invite, leave, toggleMute, setMic, toggleCam, toggleShare, me } = api;
  const [min, setMin] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [seenChat, setSeenChat] = useState(0);
  const [note, setNote] = useState({ title: '', body: '' });
  const noteRef = useRef(note); noteRef.current = note;
  const roomRef = useRef(room); roomRef.current = room;
  const peersRef = useRef(peers); peersRef.current = peers;
  const pipRef = useRef(null);
  const pttRef = useRef(false);
  const mutedNowRef = useRef(muted); mutedNowRef.current = muted;
  const setMicRef = useRef(setMic); setMicRef.current = setMic;
  useEffect(() => { setMin(false); setPartsOpen(false); setPinned(null); setNotesOpen(false); setChatOpen(false); setSeenChat(0); setAddOpen(false); setNote({ title: '', body: '' }); }, [room?.id]);

  // Push-to-talk: hold Space to unmute, release to mute. Ignored while typing.
  useEffect(() => {
    if (!room || room.incoming) return undefined;
    const typing = () => { const el = document.activeElement; return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); };
    const down = (e) => { if (e.code !== 'Space' || e.repeat || typing()) return; e.preventDefault(); if (mutedNowRef.current && !pttRef.current) { pttRef.current = true; setMicRef.current?.(true); } };
    const up = (e) => { if (e.code !== 'Space' || !pttRef.current) return; e.preventDefault(); pttRef.current = false; setMicRef.current?.(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); pttRef.current = false; };
  }, [room?.id, room?.incoming]);

  // On leave, save + email the Minutes of Meeting (if notes were taken).
  const endWithMom = useCallback(() => {
    const r = roomRef.current; const n = noteRef.current;
    if (n.body.trim() || n.title.trim()) {
      const emails = [...new Set([...(r?.members || []), ...Object.values(peersRef.current || {}).map((p) => p.email), me?.email].filter((e) => e && String(e).includes('@')))];
      fetchJson('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: n.title.trim() || `MoM — ${r?.name || 'Group meeting'}`, body: n.body, kind: 'mom', emailTo: emails }) }).catch(() => {});
    }
    leave();
  }, [leave, me]);
  useEffect(() => { if (chatOpen) setSeenChat(chat.length); }, [chatOpen, chat.length]);
  const unread = Math.max(0, (chat?.length || 0) - seenChat);
  const copyLink = () => { try { navigator.clipboard.writeText(`${window.location.origin}/meet?room=${room.id}`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* blocked */ } };
  useEffect(() => { if (room?.incoming) return playRingtone(); }, [room?.incoming]);
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
  const pinValid = pinned && (pinned === 'me' || peers[pinned]) ? pinned : null;
  const allKeys = ['me', ...tiles.map(([e]) => e)];
  const cols = Math.max(1, Math.ceil(Math.sqrt(allKeys.length)));
  const togglePin = (k) => setPinned((p) => (p === k ? null : k));
  const trackOf = (k) => (k === 'me' ? localVideoTrack : peers[k]?.videoTrack);
  const pipSupported = typeof document !== 'undefined' && document.pictureInPictureEnabled;
  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
      const k = pinValid && pinValid !== 'me' ? pinValid : (tiles[0]?.[0] || 'me');
      const track = trackOf(k);
      if (!track?.mediaStreamTrack || !pipRef.current) return;
      pipRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
      await pipRef.current.play().catch(() => {});
      await pipRef.current.requestPictureInPicture();
    } catch { /* PiP unsupported or dismissed */ }
  };
  const renderTile = (k) => (k === 'me'
    ? <Tile key="me" videoTrack={localVideoTrack} name={me.name || 'You'} mine micMuted={muted} camOff={camOff} pinned={pinValid === 'me'} onPin={() => togglePin('me')} />
    : <Tile key={k} videoTrack={peers[k]?.videoTrack} name={peers[k]?.name || k} micMuted={peers[k]?.micMuted} camOff={peers[k]?.camOff} pinned={pinValid === k} onPin={() => togglePin(k)} />);
  if (min) {
    const mEmail = pinValid && pinValid !== 'me' ? pinValid : (pinValid === 'me' ? null : (tiles[0]?.[0] || null));
    return (
      <MiniCall videoTrack={mEmail ? peers[mEmail]?.videoTrack : localVideoTrack} name={mEmail ? (peers[mEmail]?.name || mEmail) : (me.name || 'You')} mine={!mEmail}
        micMuted={mEmail ? peers[mEmail]?.micMuted : muted} camOff={mEmail ? peers[mEmail]?.camOff : camOff} count={tiles.length + 1}
        onExpand={() => setMin(false)} onLeave={endWithMom} />
    );
  }
  return (
    <div className="fixed inset-0 z-[72] bg-black/90 backdrop-blur-sm flex flex-col p-2 sm:p-3">
      <div className="shrink-0 flex items-start justify-between gap-2 flex-wrap">
        <div>
        <button onClick={() => setPartsOpen((o) => !o)} className="flex items-center gap-2 text-white/85 text-xs bg-white/10 hover:bg-white/15 rounded-full px-3 py-1.5">
          <FiUsers size={13} /> {tiles.length + 1} in {room.name || 'group'} call {partsOpen ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
        </button>
        {partsOpen && (
          <div className="mt-2 bg-slate-900/95 border border-white/10 rounded-xl p-2.5 w-64 max-w-[80vw] text-xs space-y-1">
            <p className="text-white/90">{me.name || 'You'} <span className="text-white/40">(you)</span></p>
            {tiles.map(([e, p]) => (
              <p key={e} className="text-white/80 flex items-center gap-1.5">
                {p.name || e}
                {p.micMuted && <FiMicOff size={10} className="text-red-400" />}
                {p.camOff && <FiVideoOff size={10} className="text-amber-400" />}
              </p>
            ))}
          </div>
        )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAddOpen(true)} title="Add people to the call" className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/85">
            <FiUserPlus size={13} /> Add
          </button>
          {canShare && (
            <button onClick={copyLink} title="Copy meeting link to share" className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 ${copied ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/15 text-white/85'}`}>
              {copied ? <FiCheck size={13} /> : <FiShare2 size={13} />} {copied ? 'Link copied' : 'Share'}
            </button>
          )}
        </div>
      </div>
      {addOpen && <AddPeople roster={roster} presence={presence} roomId={room.id} canShare={canShare}
        inCall={[me.email, ...Object.values(peers).map((p) => p.email)]} onRing={(email, name) => invite(email, name)} onClose={() => setAddOpen(false)} />}

      {/* Stage (notes + tiles + chat). Panels stack below the stage on phones. */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-2 py-2">
        {notesOpen && <NotesPanel note={note} setNote={setNote} room={room} onClose={() => setNotesOpen(false)} />}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 overflow-auto">
        {pinValid ? (
          <>
            <div className="w-full max-w-5xl flex-1 min-h-0 flex items-center justify-center">
              <div className="w-full max-h-full">{renderTile(pinValid)}</div>
            </div>
            <div className="flex gap-2 overflow-x-auto shrink-0 max-w-full pb-1">
              {allKeys.filter((k) => k !== pinValid).map((k) => <div key={k} className="w-28 sm:w-32 shrink-0">{renderTile(k)}</div>)}
            </div>
          </>
        ) : (
          <div className="grid gap-2 w-full place-content-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 360}px` }}>
            {allKeys.map((k) => renderTile(k))}
          </div>
        )}
        </div>
        {chatOpen && <ChatPanel chat={chat} onSend={sendChat} onClose={() => setChatOpen(false)} />}
      </div>
      <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
       <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
        <button onClick={toggleMute} className={`${rb} ${muted ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={muted ? 'Unmute (or hold Space to talk)' : 'Mute'}>{muted ? <FiMicOff size={17} /> : <FiMic size={17} />}</button>
        <button onClick={() => setChatOpen((o) => !o)} className={`${rb} relative ${chatOpen ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={unread > 0 && !chatOpen ? `${unread} new message(s)` : 'Call chat'}>
          <FiMessageSquare size={17} />
          {unread > 0 && !chatOpen && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
            </span>
          )}
        </button>
        <button onClick={() => setNotesOpen((o) => !o)} className={`${rb} ${notesOpen ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title="Notes"><FiFileText size={17} /></button>
        <button onClick={toggleCam} className={`${rb} ${camOff ? 'bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={camOff ? 'Camera on' : 'Camera off'}>{camOff ? <FiVideoOff size={17} /> : <FiVideo size={17} />}</button>
        <button onClick={toggleShare} className={`${rb} ${sharing ? 'bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'}`} title={sharing ? 'Stop sharing' : 'Share screen'}><FiMonitor size={17} /></button>
        {pipSupported && <button onClick={togglePip} className={`${rb} bg-slate-700 hover:bg-slate-600`} title="Picture-in-Picture (pop out video)"><FiExternalLink size={16} /></button>}
        <button onClick={() => setMin(true)} className={`${rb} bg-slate-700 hover:bg-slate-600`} title="Minimize"><FiMinimize2 size={16} /></button>
        <button onClick={endWithMom} className={`${rb} bg-red-600 hover:bg-red-700`} title="Leave"><FiPhoneOff size={17} /></button>
       </div>
       <p className="text-[10px] text-white/35">{muted ? 'Hold ' : ''}<kbd className="px-1 rounded bg-white/10 text-white/60">Space</kbd>{muted ? ' to talk' : ' held = talking'}</p>
      </div>
      <video ref={pipRef} muted playsInline style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
    </div>
  );
}

// Notes sidebar — jot minutes; saved + emailed as MoM (auto on leave too).
function NotesPanel({ note, setNote, room, onClose }) {
  const { title, body } = note;
  const [status, setStatus] = useState('');
  const save = async () => {
    if (!body.trim() && !title.trim()) return;
    setStatus('saving');
    try {
      const emails = [...new Set([...(room?.members || [])].filter(Boolean))];
      await fetchJson('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() || `MoM — ${room?.name || 'Group meeting'}`, body, kind: 'mom', emailTo: emails }) });
      setStatus('saved'); setTimeout(() => setStatus(''), 2000);
    } catch { setStatus('error'); setTimeout(() => setStatus(''), 2500); }
  };
  return (
    <div className="w-full sm:w-72 sm:max-w-[42vw] shrink-0 max-h-48 sm:max-h-none bg-slate-900/95 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-white text-sm font-semibold flex items-center gap-1.5"><FiFileText size={14} /> Meeting notes</span>
        <button onClick={onClose} className="text-white/60 hover:text-white"><FiX size={16} /></button>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1 min-h-0">
        <input value={title} onChange={(e) => setNote((n) => ({ ...n, title: e.target.value }))} placeholder="Title" className="rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <textarea value={body} onChange={(e) => setNote((n) => ({ ...n, body: e.target.value }))} placeholder="Jot the minutes here… emailed to everyone in the call & saved to Notes when you leave." className="flex-1 min-h-0 resize-none rounded-lg bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <button onClick={save} disabled={status === 'saving'} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 disabled:opacity-50">{status === 'saved' ? 'Saved & emailed ✓' : status === 'error' ? 'Save failed' : status === 'saving' ? 'Saving…' : 'Save & email MoM now'}</button>
        <p className="text-[10px] text-white/40 text-center">Also auto-saved & emailed when you leave the call.</p>
      </div>
    </div>
  );
}

// Render message text with clickable links (open in a new browser tab).
const linkify = (text) => String(text).split(/(https?:\/\/[^\s]+)/g).map((part, i) => (
  /^https?:\/\//.test(part)
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-indigo-200 break-all hover:text-white">{part}</a>
    : <span key={i}>{part}</span>
));
function LinkPreview({ url }) {
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="mt-1 flex items-center gap-2 max-w-[85%] rounded-xl border border-white/15 bg-slate-800/80 px-2.5 py-1.5 hover:bg-slate-700 transition">
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`} alt="" className="h-5 w-5 rounded shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-white truncate">{host}</span>
        <span className="block text-[10px] text-white/50 truncate">{url}</span>
      </span>
      <FiLink size={12} className="text-white/50 shrink-0" />
    </a>
  );
}

// Chat sidebar — shared with everyone in the call (LiveKit data channel).
function ChatPanel({ chat, onSend, onClose }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.length]);
  const submit = () => { const t = text.trim(); if (!t) return; onSend(t); setText(''); };
  return (
    <div className="w-full sm:w-72 sm:max-w-[42vw] shrink-0 max-h-56 sm:max-h-none bg-slate-900/95 border border-white/10 rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-white text-sm font-semibold flex items-center gap-1.5"><FiMessageSquare size={14} /> Call chat</span>
        <button onClick={onClose} className="text-white/60 hover:text-white"><FiX size={16} /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {!chat.length && <p className="text-white/40 text-xs text-center py-6">No messages yet. Everyone in the call sees what you send here.</p>}
        {chat.map((m) => {
          const firstUrl = (String(m.text).match(/https?:\/\/[^\s]+/) || [])[0];
          return (
            <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
              {!m.mine && <span className="text-[10px] text-white/50 px-1">{m.name}</span>}
              <span className={`max-w-[85%] text-sm px-3 py-1.5 rounded-2xl break-words whitespace-pre-wrap ${m.mine ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white/90'}`}>{linkify(m.text)}</span>
              {firstUrl && <LinkPreview url={firstUrl} />}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-white/10 flex gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Message everyone…" className="flex-1 rounded-full bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        <button onClick={submit} className="h-9 w-9 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center"><FiSend size={15} /></button>
      </div>
    </div>
  );
}
