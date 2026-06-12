import React, { useRef } from 'react';
import { useClickOutside } from './useClickOutside';

// Wrapper for a toggle + popover panel. Closes itself when the user clicks/taps
// outside or presses Escape. Keep the trigger button AND the panel as children
// (clicks on them are "inside" and won't close it).
export default function Dropdown({ open, onClose, className = 'relative', children }) {
  const ref = useRef(null);
  useClickOutside(ref, onClose, open);
  return <div ref={ref} className={className}>{children}</div>;
}
