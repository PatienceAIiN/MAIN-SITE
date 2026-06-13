import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGroupCall, GroupCallOverlay } from '../components/GroupCall';

// Public, no-login guest meeting page: /meet?room=<token>. The unguessable room
// token (from the shared link) is the only credential. Reuses the same WebRTC
// mesh as the portal, over a guest WebSocket scoped to that one room.
export default function GuestMeet() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  const audioOnly = params.get('audio') === '1'; // voice call → camera off
  const [name, setName] = useState('');
  const [phase, setPhase] = useState('name'); // name → connecting → incall → left
  const [err, setErr] = useState('');
  const wsRef = useRef(null);
  const handlerRef = useRef(null);
  const joinedRoomRef = useRef(false);

  const send = useCallback((obj) => { try { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(obj)); } catch { /* closing */ } }, []);
  const groupApi = useGroupCall({ email: 'guest', name: name.trim() || 'Guest' }, send);

  // Always route incoming messages to the latest hook callbacks.
  handlerRef.current = (m) => {
    if (m.type === 'gcall') groupApi.onGcall(m);
    else if (m.type === 'rtc' && m.data?.room) groupApi.onRtc(m.from, m.fromName, m.data);
  };

  const connect = () => {
    if (!name.trim()) return;
    setErr(''); setPhase('connecting');
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/team?guestRoom=${encodeURIComponent(room)}&guestName=${encodeURIComponent(name.trim())}`);
    wsRef.current = ws;
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } handlerRef.current && handlerRef.current(m); };
    ws.onopen = () => setPhase('incall');
    ws.onerror = () => setErr('Could not connect — check the link.');
    ws.onclose = () => { if (!joinedRoomRef.current) setErr((p) => p || 'Connection closed.'); };
  };

  // Once the socket is open (phase 'incall'), join the room.
  useEffect(() => {
    if (phase === 'incall' && !groupApi.room && !joinedRoomRef.current) {
      joinedRoomRef.current = true;
      groupApi.joinMeeting(room, 'Meeting', audioOnly).catch((e) => { setErr(e?.message || 'Could not start your camera/mic.'); });
    }
  }, [phase, groupApi.room, room]); // eslint-disable-line
  // Call ended (host ended / we left) → show closed screen.
  useEffect(() => { if (joinedRoomRef.current && !groupApi.room) setPhase('left'); }, [groupApi.room]);

  const wrap = (c) => <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">{c}</div>;
  if (!room) return wrap(<p className="text-slate-300">Invalid meeting link.</p>);
  if (phase === 'left') return wrap(<div className="text-center"><p className="text-2xl mb-2">👋</p><p className="text-slate-300">You've left the meeting.</p><a href="/" className="text-indigo-400 text-sm mt-3 inline-block">Go to patienceai.in</a></div>);
  if (phase === 'name') {
    return wrap(
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-7 w-full max-w-sm text-center">
        <p className="text-3xl mb-2">📹</p>
        <h1 className="text-lg font-bold mb-1">Join the meeting</h1>
        <p className="text-xs text-slate-400 mb-5">You're joining as a guest — just enter your name.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) connect(); }}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 mb-3" />
        <button onClick={connect} disabled={!name.trim()}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium py-3">Join now</button>
        {err && <p className="text-red-400 text-xs mt-3">{err}</p>}
      </div>
    );
  }
  return wrap(<div className="text-center"><p className="text-slate-400 text-sm">Connecting you to the meeting…</p>{err && <p className="text-red-400 text-xs mt-2">{err}</p>}<GroupCallOverlay api={groupApi} /></div>);
}
