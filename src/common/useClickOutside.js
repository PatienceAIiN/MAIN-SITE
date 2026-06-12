import { useEffect } from 'react';

// Close a dropdown/popover when the user clicks (or taps, or presses Escape)
// anywhere outside `ref`. Pass `active` so the listener only runs while open.
export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    const onKey = (e) => { if (e.key === 'Escape') onOutside(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onOutside, active]);
}
