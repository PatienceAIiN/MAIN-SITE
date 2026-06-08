import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ShareIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const CheckIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const ShareButton = ({
  title,
  text,
  url,
  label = 'Share',
  variant = 'solid', // 'solid' | 'outline' | 'ghost'
  size = 'md', // 'sm' | 'md'
  className = ''
}) => {
  const [state, setState] = useState('idle'); // 'idle' | 'copied' | 'shared'

  const handleClick = async () => {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    const sharePayload = { title, text, url: shareUrl };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(sharePayload);
        setState('shared');
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setState('copied');
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setState('copied');
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // user dismissed sheet
      try {
        await navigator.clipboard.writeText(shareUrl);
        setState('copied');
      } catch {
        setState('idle');
      }
    }

    setTimeout(() => setState('idle'), 2000);
  };

  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  let toneClass;
  if (variant === 'outline') {
    toneClass = 'border border-[#d1d1d1] bg-white text-[#1a1a1a] hover:border-[#1a1a1a]';
  } else if (variant === 'ghost') {
    toneClass = 'border border-transparent bg-transparent text-current hover:bg-black/5';
  } else {
    toneClass = 'border border-[#1a1a1a] bg-[#1a1a1a] text-white hover:bg-black';
  }

  const done = state !== 'idle';
  const liveLabel = state === 'shared' ? 'Shared' : state === 'copied' ? 'Link copied' : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Share ${title || 'this page'}`}
      className={`inline-flex items-center gap-2 rounded-full font-semibold uppercase tracking-[0.12em] transition-colors ${sizeClass} ${toneClass} ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            className={`flex items-center justify-center ${iconSize}`}
          >
            <CheckIcon className={iconSize} />
          </motion.span>
        ) : (
          <motion.span
            key="share"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            className={`flex items-center justify-center ${iconSize}`}
          >
            <ShareIcon className={iconSize} />
          </motion.span>
        )}
      </AnimatePresence>
      <span>{liveLabel}</span>
    </button>
  );
};

export default ShareButton;
