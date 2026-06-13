import React, { useEffect, useState } from 'react';

// Small animated spinner for "processing" button states.
export function Spinner({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// Promise-based confirmation dialog. Replaces window.confirm with a styled modal.
// Usage: if (await confirmDialog({ title, message, confirmText, danger })) { ... }
// Falls back to window.confirm if the host isn't mounted (SSR / early calls).
let _open = null;
export function confirmDialog(opts) {
  const o = typeof opts === 'string' ? { message: opts } : (opts || {});
  if (!_open) return Promise.resolve(window.confirm(o.message || 'Are you sure?'));
  return new Promise((resolve) => _open({ ...o, resolve }));
}

// Mount ONCE near the app root. Listens for confirmDialog() calls.
export function ConfirmHost() {
  const [s, setS] = useState(null);
  useEffect(() => { _open = setS; return () => { _open = null; }; }, []);
  if (!s) return null;
  const close = (v) => { try { s.resolve(v); } catch { /* noop */ } setS(null); };
  const danger = s.danger !== false; // default to destructive styling
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
      onKeyDown={(e) => { if (e.key === 'Escape') close(false); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 animate-[fadeIn_.12s_ease-out]">
        <p className="text-base font-bold text-slate-900 dark:text-white">{s.title || 'Please confirm'}</p>
        {s.message && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 whitespace-pre-wrap">{s.message}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button autoFocus onClick={() => close(false)}
            className="text-sm px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            {s.cancelText || 'Cancel'}
          </button>
          <button onClick={() => close(true)}
            className={`text-sm px-4 py-2 rounded-lg text-white font-medium ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {s.confirmText || (danger ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
