// Tiny Redis-backed read cache to spare the Neon free tier from high-frequency
// polling reads (session lists, chat messages, incoming-call checks).
//
// Design goals:
//  - Redis-OPTIONAL: if REDIS_URL is unset or Redis is unreachable, every call
//    transparently falls through to the producer (a direct DB query). Behavior
//    is then identical to before — nothing breaks.
//  - Short TTLs: cached data is only ever a couple of seconds stale, which is
//    well within the tolerance of the existing polling UI.
//  - Explicit invalidation on writes so a fresh value is served immediately
//    after a customer/executive changes something.
import { redisGetJson, redisSetJson, redisDel, isRedisConfigured } from './_redis.js';

const enabled = isRedisConfigured();

// Run `producer` but serve a cached copy when one is fresh. On any Redis error
// we silently fall back to the producer so a cache outage never breaks a request.
export const cached = async (key, ttlSeconds, producer) => {
  if (!enabled) return producer();
  try {
    const hit = await redisGetJson(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch { /* fall through to producer */ }
  const value = await producer();
  try { await redisSetJson(key, value, ttlSeconds); } catch { /* best-effort */ }
  return value;
};

export const invalidate = async (...keys) => {
  if (!enabled || !keys.length) return;
  try { await redisDel(...keys); } catch { /* best-effort */ }
};

// Key builders — keep them centralized so producers and invalidators agree.
export const cacheKeys = {
  sessionList: 'cache:support:sessions',
  messages: (conversationId) => `cache:support:msgs:${conversationId}`,
  incomingCall: 'cache:voice:incoming'
};
