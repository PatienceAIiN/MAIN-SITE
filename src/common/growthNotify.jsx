// Growth presence control (navbar) + centered notification center with a
// Teams-like chime. Listens to the realtime hub for new messages and incoming
// calls/meetings, and polls the connected mailbox for new mail — showing a
// centered toast and playing a tone for each.
import React, { useEffect, useRef, useState } from 'react';
import { FiVideo, FiPhoneOff, FiMessageSquare, FiMail, FiX, FiChevronDown } from 'react-icons/fi';
import { fetchJson } from './fetchJson';
import { useGrowthHub, meetUrl } from './growthHub';

/* ── Teams-like chime via WebAudio (no asset) ─────────────────────────────── */
let _ctx;
export const chime = () => {
  try {
    _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _ctx; if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    [[784, 0], [1047, 0.12]].forEach(([f, t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.22, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.4);
      o.start(now + t); o.stop(now + t + 0.42);
    });
  } catch { /* audio blocked until first interaction */ }
};

/* ── Web-push enable/disable (browser OS notifications) ───────────────────── */
const b64ToUint8 = (s) => {
  // Strip whitespace/newlines — a VAPID key pasted into an env var often carries
  // a trailing newline, which makes atob throw "not correctly encoded".
  const clean = String(s || '').trim().replace(/\s+/g, '');
  const pad = '='.repeat((4 - (clean.length % 4)) % 4);
  const raw = window.atob((clean + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};
export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notifications are not supported in this browser.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission was denied.');
  const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
  const { key } = await fetchJson('/api/colleagues?vapid=1', { credentials: 'include' });
  if (!key) throw new Error('Push is not configured on the server (missing VAPID key).');
  const appKey = b64ToUint8(key);
  let sub = await reg.pushManager.getSubscription();
  // If a stale subscription exists with a DIFFERENT key (e.g. the VAPID key was
  // rotated), drop it first — resubscribing with a new key over an old one fails
  // with "Registration failed - push service error".
  if (sub) {
    const cur = sub.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    const same = cur && cur.length === appKey.length && cur.every((b, i) => b === appKey[i]);
    if (!same) { try { await sub.unsubscribe(); } catch { /* ignore */ } sub = null; }
  }
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    } catch (e) {
      // "Registration failed - push service error" can also come from a broken
      // existing registration. Clear any leftover sub and retry once.
      try { const old = await reg.pushManager.getSubscription(); if (old) await old.unsubscribe(); } catch { /* ignore */ }
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      } catch {
        throw new Error('Could not register for push. Reload the page and try again, or check your browser notification settings.' + (e?.message ? ` (${e.message})` : ''));
      }
    }
  }
  await fetchJson('/api/colleagues', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'push_subscribe', subscription: sub.toJSON() }) });
}
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetchJson('/api/colleagues', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'push_unsubscribe', endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
  } catch { /* best effort */ }
}

/* ── Presence status toggle (navbar) ──────────────────────────────────────── */
const STATUS = {
  online: { label: 'Active', dot: 'bg-emerald-500' },
  away: { label: 'Away', dot: 'bg-amber-400' },
  busy: { label: 'On a call', dot: 'bg-red-400' },
  offline: { label: 'Appear offline', dot: 'bg-slate-400' },
};
export function PresenceControl() {
  const { presence, send, me } = useGrowthHub();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const mine = (me && presence[me.email]) || 'online';
  const set = (s) => { send({ type: 'setstatus', status: s }); send({ type: 'activity' }); setOpen(false); };
  // Auto-collapse on any click outside the dropdown (and on Escape) without
  // intercepting that click — so the click also lands on its real target.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} title="Your status"
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
        <span className={`w-2.5 h-2.5 rounded-full ${(STATUS[mine] || STATUS.online).dot}`} />
        <span className="text-xs font-medium hidden sm:inline">{(STATUS[mine] || STATUS.online).label}</span>
        <FiChevronDown size={13} />
      </button>
      {open && (
          <div className="absolute right-0 mt-1 w-44 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5">
            {['online', 'away', 'offline'].map((s) => (
              <button key={s} onClick={() => set(s)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS[s].dot}`} /> {STATUS[s].label}
              </button>
            ))}
            <p className="text-[10px] text-slate-400 px-2.5 pt-1.5">Auto-away after 15 min idle · offline when you sign out.</p>
          </div>
      )}
    </div>
  );
}

/* ── Centered notification center (messages, calls, mail) + chime ─────────── */
export function NotificationCenter() {
  const { subscribe, me } = useGrowthHub();
  const [items, setItems] = useState([]); // {id, kind, title, body, room?}
  const seen = useRef(new Set());
  const mailRef = useRef(null);

  const push = (n) => {
    setItems((c) => (c.some((x) => x.id === n.id) ? c : [...c, n]));
    chime();
    if (n.kind !== 'call') setTimeout(() => setItems((c) => c.filter((x) => x.id !== n.id)), 8000);
  };
  const dismiss = (id) => setItems((c) => c.filter((x) => x.id !== id));

  // Realtime: new messages + incoming calls/meetings.
  useEffect(() => subscribe((m) => {
    if (m.type === 'chat' && m.event === 'new' && m.message && me && m.message.sender_email !== me.email) {
      push({ id: `msg-${m.message.id}`, kind: 'message', title: `New message from ${m.message.sender_name || m.message.sender_email}`, body: m.message.deleted ? '' : (m.message.file_name ? `📎 ${m.message.file_name}` : m.message.message) });
    } else if (m.type === 'rtc' && m.data?.kind === 'meet-invite') {
      push({ id: `call-${m.data.room}`, kind: 'call', title: m.fromName || 'Incoming call', body: m.data.title || 'is calling you…', room: m.data.room });
    }
  }), [subscribe, me]);

  // Mail: poll the connected mailbox for a newer top message.
  useEffect(() => {
    let provider = null, alive = true;
    const detect = async () => {
      const [g, t] = await Promise.all([fetchJson('/api/gmail?status=1', { credentials: 'include' }).catch(() => ({})), fetchJson('/api/titan?status=1', { credentials: 'include' }).catch(() => ({}))]);
      provider = g.connected ? 'gmail' : t.connected ? 'titan' : null;
    };
    const poll = async () => {
      if (!provider || document.hidden) return;
      try {
        const d = await fetchJson(`/api/${provider}?list=1&label=INBOX`, { credentials: 'include' });
        const top = (d.messages || [])[0];
        if (top && mailRef.current && top.id !== mailRef.current && top.unread !== false) {
          push({ id: `mail-${top.id}`, kind: 'mail', title: `New mail · ${top.from ? top.from.replace(/<.*>/, '').trim() : ''}`.trim(), body: top.subject || '(no subject)' });
        }
        if (top) mailRef.current = top.id;
      } catch { /* ignore */ }
    };
    detect().then(poll);
    const id = setInterval(poll, 60000);
    return () => { alive = false; clearInterval(id); void alive; };
  }, []);

  if (!items.length) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] w-[92vw] max-w-sm space-y-2">
      {items.map((n) => (
        <div key={n.id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-3.5 flex items-start gap-3">
          <span className={`grid place-items-center h-9 w-9 rounded-full shrink-0 ${n.kind === 'call' ? 'bg-emerald-100 text-emerald-600' : n.kind === 'mail' ? 'bg-sky-100 text-sky-600' : 'bg-indigo-100 text-indigo-600'}`}>
            {n.kind === 'call' ? <FiVideo /> : n.kind === 'mail' ? <FiMail /> : <FiMessageSquare />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{n.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{n.body}</p>
            {n.kind === 'call' && (
              <div className="flex gap-2 mt-2">
                <button className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => { window.open(meetUrl(n.room), '_blank', 'noopener'); dismiss(n.id); }}><FiVideo className="inline -mt-0.5" size={12} /> Join</button>
                <button className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" onClick={() => dismiss(n.id)}><FiPhoneOff className="inline -mt-0.5" size={12} /> Dismiss</button>
              </div>
            )}
          </div>
          {n.kind !== 'call' && <button onClick={() => dismiss(n.id)} className="text-slate-300 hover:text-slate-500 shrink-0"><FiX size={15} /></button>}
        </div>
      ))}
    </div>
  );
}
