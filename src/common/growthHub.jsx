// Page-level realtime hub for the Growth portal. Owns a SINGLE /ws/team
// WebSocket for the whole portal so presence and incoming call/meeting invites
// work on every tab — not just inside the Connect tab. Components subscribe to
// raw events; presence is exposed as live state.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { fetchJson } from './fetchJson';

const HubCtx = createContext(null);
export const useGrowthHub = () => useContext(HubCtx) || { presence: {}, send: () => {}, subscribe: () => () => {}, me: null };
export const meetUrl = (room) => `${window.location.origin}/meet?room=${room}`;

export function GrowthHubProvider({ children }) {
  const wsRef = useRef(null);
  const subs = useRef(new Set());
  const [presence, setPresence] = useState({});
  const [me, setMe] = useState(null);
  useEffect(() => { fetchJson('/api/team-members/me', { credentials: 'include' }).then((d) => setMe(d.member)).catch(() => {}); }, []);

  useEffect(() => {
    let alive = true, retry;
    const connect = () => {
      if (!alive) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/team`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === 'presence') setPresence(m.users || {});
        subs.current.forEach((fn) => { try { fn(m); } catch { /* subscriber error */ } });
      };
      ws.onclose = () => { wsRef.current = null; if (alive) retry = setTimeout(connect, 3000); };
    };
    connect();
    // Activity heartbeat so the server keeps us "online" while the portal is open.
    let last = 0;
    const act = () => { const n = Date.now(); if (n - last > 30000 && wsRef.current?.readyState === 1) { last = n; wsRef.current.send(JSON.stringify({ type: 'activity' })); } };
    const evs = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    evs.forEach((ev) => window.addEventListener(ev, act, { passive: true }));
    return () => { alive = false; clearTimeout(retry); evs.forEach((ev) => window.removeEventListener(ev, act)); wsRef.current?.close(); };
  }, []);

  const send = useCallback((o) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(o)); }, []);
  const subscribe = useCallback((fn) => { subs.current.add(fn); return () => subs.current.delete(fn); }, []);

  return <HubCtx.Provider value={{ presence, send, subscribe, me }}>{children}</HubCtx.Provider>;
}
