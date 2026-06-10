// Minimal Redis client over a single persistent connection.
//
// Why not ioredis/node-redis? Zero extra dependencies and we only need a
// handful of commands (GET/SET/DEL/INCR/PUBLISH). What we DO need is
// correctness: the previous implementation opened one TCP connection per
// command and parsed replies with a regex that split on ':' and '$' — bytes
// that legally appear inside JSON payloads — so cached JSON silently came
// back as null and every read fell through to Postgres. This version keeps
// one pipelined connection and implements a proper byte-length-aware RESP
// parser, so cache hits actually hit.
import net from 'node:net';
import tls from 'node:tls';

const COMMAND_TIMEOUT_MS = 4000;

const getRedisConfig = () => {
  const rawRedisUrl = String(process.env.REDIS_URL || '').trim();
  const redisUrl = rawRedisUrl.startsWith('redis-cli -u ')
    ? rawRedisUrl.slice('redis-cli -u '.length).trim()
    : rawRedisUrl;
  if (!redisUrl) return null;

  const parsed = new URL(redisUrl);
  const useTls = parsed.protocol === 'rediss:';
  return {
    host: parsed.hostname,
    port: Number(parsed.port || (useTls ? 6380 : 6379)),
    username: parsed.username ? decodeURIComponent(parsed.username) : null,
    password: parsed.password ? decodeURIComponent(parsed.password) : null,
    db: parsed.pathname ? Number(parsed.pathname.replace('/', '') || 0) : 0,
    useTls
  };
};

const encodeCommand = (parts = []) => {
  const bulk = parts
    .map((part) => {
      const value = String(part);
      return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    })
    .join('');
  return `*${parts.length}\r\n${bulk}`;
};

// ── RESP parser ───────────────────────────────────────────────────────────────
// Reads exactly one reply from `buf` starting at `pos`.
// Returns [value, nextPos] or null when the buffer doesn't yet hold a full reply.
// Error replies are returned as Error instances (not thrown) so the dispatcher
// can reject only the matching in-flight command.
const parseReply = (buf, pos) => {
  if (pos >= buf.length) return null;
  const lineEnd = buf.indexOf('\r\n', pos);
  if (lineEnd === -1) return null;
  const type = String.fromCharCode(buf[pos]);
  const header = buf.toString('utf8', pos + 1, lineEnd);

  if (type === '+') return [header, lineEnd + 2];
  if (type === '-') return [new Error(header), lineEnd + 2];
  if (type === ':') return [Number(header), lineEnd + 2];

  if (type === '$') {
    const size = Number(header);
    if (size === -1) return [null, lineEnd + 2];
    const end = lineEnd + 2 + size;
    if (buf.length < end + 2) return null; // body + trailing \r\n not buffered yet
    return [buf.toString('utf8', lineEnd + 2, end), end + 2];
  }

  if (type === '*') {
    const count = Number(header);
    if (count === -1) return [null, lineEnd + 2];
    const items = [];
    let cursor = lineEnd + 2;
    for (let i = 0; i < count; i += 1) {
      const parsed = parseReply(buf, cursor);
      if (!parsed) return null;
      items.push(parsed[0]);
      cursor = parsed[1];
    }
    return [items, cursor];
  }

  return [new Error(`Unsupported RESP type: ${type}`), lineEnd + 2];
};

// ── Connection management ─────────────────────────────────────────────────────
// One lazily-created connection per process; commands are pipelined in order
// and replies are matched FIFO. On any socket error the connection is dropped,
// all in-flight commands reject, and the next command reconnects.
let connection = null; // { socket, buffer, pending: [{resolve, reject, timer}] }

const dropConnection = (error) => {
  if (!connection) return;
  const { socket, pending } = connection;
  connection = null;
  socket.destroy();
  for (const cmd of pending) {
    clearTimeout(cmd.timer);
    cmd.reject(error || new Error('Redis connection closed'));
  }
};

const openConnection = (config) => {
  const connector = config.useTls ? tls.connect : net.connect;
  const socket = connector({
    host: config.host,
    port: config.port,
    ...(config.useTls ? { servername: config.host } : {})
  });
  socket.setNoDelay(true);
  socket.setTimeout(0);

  const state = { socket, buffer: Buffer.alloc(0), pending: [] };

  socket.on('data', (chunk) => {
    state.buffer = Buffer.concat([state.buffer, chunk]);
    let pos = 0;
    while (state.pending.length) {
      const parsed = parseReply(state.buffer, pos);
      if (!parsed) break;
      const [value, nextPos] = parsed;
      pos = nextPos;
      const cmd = state.pending.shift();
      clearTimeout(cmd.timer);
      if (value instanceof Error) cmd.reject(value);
      else cmd.resolve(value);
    }
    if (pos > 0) state.buffer = state.buffer.subarray(pos);
  });

  socket.on('error', (error) => dropConnection(error));
  socket.on('close', () => dropConnection());

  return state;
};

const send = (state, parts) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    dropConnection(new Error('Redis command timed out'));
  }, COMMAND_TIMEOUT_MS);
  state.pending.push({ resolve, reject, timer });
  state.socket.write(encodeCommand(parts));
});

const getConnection = async () => {
  if (connection) return connection;
  const config = getRedisConfig();
  if (!config) return null;

  const state = openConnection(config);
  connection = state;

  // Handshake commands ride the same pipeline, so ordering is guaranteed.
  if (config.password) {
    await send(state, config.username ? ['AUTH', config.username, config.password] : ['AUTH', config.password]);
  }
  if (Number.isFinite(config.db) && config.db > 0) {
    await send(state, ['SELECT', String(config.db)]);
  }
  return state;
};

const runRedisCommand = async (commandParts) => {
  const state = await getConnection();
  if (!state) return null;
  return send(state, commandParts);
};

// ── Public API (signature-compatible with the previous module) ────────────────
export const redisSetJson = async (key, value, ttlSeconds = 0) => {
  const serialized = JSON.stringify(value);
  if (ttlSeconds > 0) {
    await runRedisCommand(['SET', key, serialized, 'EX', String(ttlSeconds)]);
    return;
  }
  await runRedisCommand(['SET', key, serialized]);
};

export const redisGetJson = async (key) => {
  const raw = await runRedisCommand(['GET', key]);
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
};

export const redisDel = async (...keys) => {
  if (!keys.length) return;
  await runRedisCommand(['DEL', ...keys]);
};

// Atomic counter — used for cache version stamps (see _cache.js).
export const redisIncr = async (key) => {
  const value = await runRedisCommand(['INCR', key]);
  return Number(value) || 0;
};

export const redisPublish = async (channel, payload) => {
  return runRedisCommand(['PUBLISH', channel, JSON.stringify(payload)]);
};

export const redisPing = async () => {
  const reply = await runRedisCommand(['PING']);
  return reply === 'PONG';
};

export const isRedisConfigured = () => Boolean(getRedisConfig());
