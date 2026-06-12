// Generated call/notification sounds via Web Audio — no asset files needed.
// (Browser autoplay policy may keep the context suspended until the user has
// interacted with the page; we resume best-effort, so it works once they have.)
let ctx;
const ac = () => {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

const beep = (freq, startOffset, dur, vol = 0.16) => {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(a.destination);
  const t = a.currentTime + startOffset;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
};

// Microsoft-Teams-style incoming ringtone: a gentle rising two-note phrase that
// repeats every ~2.4s. Returns a stop() function.
export function playRingtone() {
  let stopped = false; let timer;
  const ring = () => {
    if (stopped) return;
    beep(587, 0, 0.32);     // D5
    beep(784, 0.34, 0.42);  // G5
    timer = setTimeout(ring, 2400);
  };
  ring();
  return () => { stopped = true; clearTimeout(timer); };
}

// Short ping for a new message / notification.
export function playPing() { beep(880, 0, 0.22, 0.2); }
