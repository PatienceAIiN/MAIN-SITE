import net from 'node:net';
import tls from 'node:tls';

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

const parseSimpleRedisReply = (raw = '') => {
  if (!raw) return null;
  const type = raw[0];
  if (type === '+') return raw.slice(1).split('\r\n')[0];
  if (type === ':') return Number(raw.slice(1).split('\r\n')[0]);
  if (type === '$') {
    const firstBreak = raw.indexOf('\r\n');
    const size = Number(raw.slice(1, firstBreak));
    if (size < 0) return null;
    return raw.slice(firstBreak + 2, firstBreak + 2 + size);
  }
  if (type === '-') {
    throw new Error(raw.slice(1).split('\r\n')[0]);
  }
  return null;
};

const runRedisCommand = async (commandParts) => {
  const config = getRedisConfig();
  if (!config) return null;

  const connect = config.useTls ? tls.connect : net.connect;

  return new Promise((resolve, reject) => {
    const socket = connect(config.port, config.host, () => {
      const queue = [];
      if (config.password) {
        if (config.username) queue.push(['AUTH', config.username, config.password]);
        else queue.push(['AUTH', config.password]);
      }
      if (Number.isFinite(config.db) && config.db > 0) {
        queue.push(['SELECT', String(config.db)]);
      }
      queue.push(commandParts);

      socket.write(queue.map(encodeCommand).join(''));
    });

    socket.setTimeout(4000);

    let response = '';
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      const lines = response.split('\r\n');
      if (lines.filter((line) => line.startsWith('+') || line.startsWith('-') || line.startsWith(':') || line.startsWith('$')).length >= (config.password ? (config.db > 0 ? 3 : 2) : (config.db > 0 ? 2 : 1))) {
        socket.end();
      }
    });

    socket.on('timeout', () => {
      socket.destroy(new Error('Redis command timed out'));
    });

    socket.on('error', (error) => {
      reject(error);
    });

    socket.on('close', () => {
      try {
        const replies = response
          .split(/(?=[+\-:$])/g)
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => `${part}${part.endsWith('\r\n') ? '' : '\r\n'}`)
          .map(parseSimpleRedisReply);

        resolve(replies.at(-1) ?? null);
      } catch (error) {
        reject(error);
      }
    });
  });
};

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
  if (!raw) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
};

export const redisPublish = async (channel, payload) => {
  return runRedisCommand(['PUBLISH', channel, JSON.stringify(payload)]);
};
