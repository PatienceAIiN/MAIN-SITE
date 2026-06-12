import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGroupCall, GroupCallOverlay } from '../components/GroupCall';

// Public, no-login guest meeting page at /meet?room=<token>. The unguessable room
// token (from the shared link) is the only credential. Reuses the same WebRTC
// mesh as the portal, over a guest WebSocket scoped to that one room.
export default function GuestMeet() {
  const room = new URLSearchParams(window.location.search).get('room');
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [left, setLeft] = useState(false);
  const [err, setErr] = useState('');
  const wsRef = useRef(null);
  const apiRef = useRef(null);

  const send = useCallback((obj) => { try { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(obj)); } catch { /* closing */ } }, []);
  const groupApi = useGroupCall({ email: 'guest', name: name.trim() || 'Guest' }, send);
  apiRef.current = groupApi;

  const join = () => {
    setErr('');
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/team?guestRoom=${encodeURIComponent(room)}&guestName=${encodeURIComponent(name.trim() || 'Guest')}`);
    wsRef.current = ws;
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.type === 'gcall') apiRef.current.onGcall(m); else if (m.type === 'rtc' && m.data?.room) apiRef.current.onRtc(m.from, m.fromName, m.data); };
    ws.onopen = () => {
      setJoined(true);
      Promise.resolve(apiRef.current.joinMeeting(room, 'Meeting')).catch((e2) => { console.error('[guest] joinMeeting failed:', e2?.message); setErr(e2?.message || 'Could not start your camera/mic.'); });
    };
    ws.onerror = () => setErr('Could not connect. Check the link and your camera/mic permissions.');
  };

  // When the call ends (leave/host-end), show a friendly closed screen.
  useEffect(() => { if (joined && !groupApi.room) setLeft(true); }, [joined, groupApi.room]);

  const wrap = (children) => (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">{children}</div>
  );
  if (!room) return wrap(<p className="text-slate-300">Invalid meeting link.</p>);
  if (left) return wrap(<div className="text-center"><p className="text-2xl mb-2">👋</p><p className="text-slate-300">You've left the meeting.</p><a href="/" className="text-indigo-400 text-sm mt-3 inline-block">Go to patienceai.in</a></div>);
  if (!joined) {
    return wrap(
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-7 w-full max-w-sm text-center">
        <p className="text-3xl mb-2">📹</p>
        <h1 className="text-lg font-bold mb-1">Join the meeting</h1>
        <p className="text-xs text-slate-400 mb-5">You're joining as a guest. Enter your name to continue.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) join(); }}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 mb-3" />
        <button onClick={join} disabled={!name.trim()}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium py-3">Join now</button>
        {err && <p className="text-red-400 text-xs mt-3">{err}</p>}
      </div>
    );
  }
  // In-call: the GroupCallOverlay (fixed, fullscreen) renders the mesh grid.
  return wrap(<div className="text-center"><p className="text-slate-400 text-sm">Connecting you to the meeting…</p>{err && <p className="text-red-400 text-xs mt-2">{err}</p>}<GroupCallOverlay api={groupApi} /></div>);
}
