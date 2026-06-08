import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  )
};

const TONES = {
  success: {
    ring: 'border-emerald-200',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-500 text-white',
    title: 'text-emerald-900',
    body: 'text-emerald-800'
  },
  error: {
    ring: 'border-rose-200',
    bg: 'bg-rose-50',
    badge: 'bg-rose-500 text-white',
    title: 'text-rose-900',
    body: 'text-rose-800'
  }
};

const FormStatus = ({ status, title, message, onDismiss }) => {
  if (!status || !['success', 'error'].includes(status)) return null;
  const tone = TONES[status];

  return (
    <AnimatePresence>
      <motion.div
        key={status + (title || '') + (message || '')}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        role={status === 'error' ? 'alert' : 'status'}
        className={`relative flex items-start gap-3 rounded-2xl border ${tone.ring} ${tone.bg} px-4 py-3 shadow-sm`}
      >
        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${tone.badge}`}>
          {ICONS[status]}
        </span>
        <div className="min-w-0 flex-1">
          {title ? <p className={`text-sm font-semibold ${tone.title}`}>{title}</p> : null}
          {message ? <p className={`mt-0.5 text-sm leading-relaxed ${tone.body}`}>{message}</p> : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-current/70 hover:text-current`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};

export default FormStatus;
