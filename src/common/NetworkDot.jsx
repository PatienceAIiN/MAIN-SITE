import React, { useEffect, useState } from 'react';

// Realtime connection indicator: green when the device is online and the server
// is reachable, red when offline / unreachable. Reacts instantly to the
// browser online/offline events and re-checks the server every 20s.
export default function NetworkDot({ className = '' }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    let alive = true;
    const set = (v) => { if (alive) setOnline(v); };
    const onUp = () => set(true);
    const onDown = () => set(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    // Confirm the server is actually reachable (not just "has a network").
    const ping = async () => {
      if (!navigator.onLine) { set(false); return; }
      try {
        await fetch('/favicon-32.png', { method: 'HEAD', cache: 'no-store' });
        set(true);
      } catch { set(false); }
    };
    ping();
    const t = setInterval(ping, 20000);
    return () => { alive = false; clearInterval(t); window.removeEventListener('online', onUp); window.removeEventListener('offline', onDown); };
  }, []);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={online ? 'Connected — live' : 'Offline — reconnecting…'}>
      <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'} ${online ? '' : 'animate-pulse'}`}
        style={online ? { boxShadow: '0 0 0 3px rgba(16,185,129,0.18)' } : { boxShadow: '0 0 0 3px rgba(239,68,68,0.18)' }} />
      <span className={`text-[10px] font-medium ${online ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{online ? 'Live' : 'Offline'}</span>
    </span>
  );
}
