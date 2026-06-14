// Sweep gate — keeps the background sweeps (scheduled deploys, meeting reminders,
// SLA/escalation) from waking the serverless Postgres compute when there is
// nothing to do. Each sweep records in Redis the next moment it actually needs
// to touch the DB; until then its ticks return after a cheap Redis read (Redis is
// a separate service, so it does NOT keep the Neon compute awake). This lets the
// compute autosuspend during idle periods, which is the single biggest driver of
// Neon free-tier compute usage.
//
// Safety:
//  - A 30-minute backstop CAPS every horizon, so a real DB check happens at least
//    that often — nothing is ever skipped for longer than 30 min.
//  - Producers can invalidate a hint (invalidateSweep) so newly-created work is
//    picked up on the very next tick instead of waiting for the backstop.
//  - Fails OPEN: if Redis is unconfigured or unreachable, sweeps run every tick
//    exactly as before, so correctness never depends on Redis being up.
import { redisGetJson, redisSetJson, redisDel, isRedisConfigured } from './_redis.js';

const KEY = (name) => `sweep:nextdue:${name}`;
const BACKSTOP_MS = 30 * 60 * 1000; // re-check the DB at least every 30 minutes

// True if the sweep should run its real (DB-touching) body now.
export const sweepDue = async (name) => {
  if (!isRedisConfigured()) return true;       // no Redis → behave exactly as before
  try {
    const v = await redisGetJson(KEY(name));
    if (v == null) return true;                // no hint yet → run and establish one
    return Date.now() >= Number(v);
  } catch { return true; }                     // Redis hiccup → run (safe default)
};

// Record when the sweep next needs the DB. `nextActionableMs` may be null/Infinity
// (nothing pending). Always capped to an aligned 30-min backstop so the sweeps
// converge on shared wake windows (DB wakes briefly, then sleeps again).
export const setSweepNextDue = async (name, nextActionableMs) => {
  if (!isRedisConfigured()) return;
  const aligned = Math.ceil((Date.now() + BACKSTOP_MS) / BACKSTOP_MS) * BACKSTOP_MS;
  const due = Math.min(Number.isFinite(nextActionableMs) ? Number(nextActionableMs) : Infinity, aligned);
  try { await redisSetJson(KEY(name), due, 6 * 3600); } catch { /* best-effort */ }
};

// Force the next tick to run a real check (call when new work is created/changed).
export const invalidateSweep = async (name) => {
  if (!isRedisConfigured()) return;
  try { await redisDel(KEY(name)); } catch { /* best-effort */ }
};
