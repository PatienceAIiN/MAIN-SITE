const getRedisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
};

const run = async (command) => {
  const cfg = getRedisConfig();
  if (!cfg) return null;

  const response = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{ command }])
  });

  if (!response.ok) {
    throw new Error(`Redis REST error (${response.status})`);
  }

  const body = await response.json();
  return body?.[0]?.result ?? null;
};

export const redisSetJson = async (key, value, ttlSeconds = 0) => {
  const serialized = JSON.stringify(value);
  await run(['SET', key, serialized]);
  if (ttlSeconds > 0) {
    await run(['EXPIRE', key, String(ttlSeconds)]);
  }
};

export const redisGetJson = async (key) => {
  const raw = await run(['GET', key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const redisPublish = async (channel, payload) => {
  await run(['PUBLISH', channel, JSON.stringify(payload)]);
};
