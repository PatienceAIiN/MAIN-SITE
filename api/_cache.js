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
import { redisGetJson, redisSetJson, redisDel, redisIncr, isRedisConfigured } from './_redis.js';

// Evaluated lazily: import hoisting runs this module before server.js can load
// .env, so a module-scope check would permanently disable the cache in any
// environment that relies on the .env file.
const enabled = () => isRedisConfigured();

// Run `producer` but serve a cached copy when one is fresh. On any Redis error
// we silently fall back to the producer so a cache outage never breaks a request.
export const cached = async (key, ttlSeconds, producer) => {
  if (!enabled()) return producer();
  try {
    const hit = await redisGetJson(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch { /* fall through to producer */ }
  const value = await producer();
  try { await redisSetJson(key, value, ttlSeconds); } catch { /* best-effort */ }
  return value;
};

export const invalidate = async (...keys) => {
  if (!enabled() || !keys.length) return;
  try { await redisDel(...keys); } catch { /* best-effort */ }
};

// ── Version-stamped caching ───────────────────────────────────────────────────
// For query-shaped reads (ticket lists with arbitrary filters) explicit DEL
// invalidation would need wildcard scans. Instead each scope has a monotonic
// version counter baked into the cache key: any write bumps the counter, every
// reader instantly computes a new key, and stale entries simply expire by TTL.
const versionKey = (scope) => `ver:${scope}`;

export const getVersion = async (scope) => {
  if (!enabled()) return 0;
  try { return (await redisGetJson(versionKey(scope))) || 0; }
  catch { return 0; }
};

export const bumpVersion = async (...scopes) => {
  if (!enabled()) return;
  try { await Promise.all(scopes.map((scope) => redisIncr(versionKey(scope)))); }
  catch { /* best-effort */ }
};

// Key builders — keep them centralized so producers and invalidators agree.
export const cacheKeys = {
  sessionList: 'cache:support:sessions',
  messages: (conversationId) => `cache:support:msgs:${conversationId}`,
  incomingCall: 'cache:voice:incoming',
  // Ticketing
  ticketList: (ver, scope, filterHash) => `cache:tix:list:${ver}:${scope}:${filterHash}`,
  ticketDetail: (id, ver) => `cache:tix:one:${id}:${ver}`,
  ticketSuggest: (ver) => `cache:tix:suggest:${ver}`,
  ticketSettings: 'cache:tix:settings',
  clientTicket: (id, ver) => `cache:tix:client:${id}:${ver}`,
  notifications: (email) => `cache:notif:${email}`
};

// Version scopes used by the ticketing system.
export const verScopes = {
  tickets: 'tickets',                    // any ticket created/updated/deleted
  ticket: (id) => `ticket:${id}`         // a specific ticket's detail/timeline
};
