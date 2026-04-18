// Simple in-memory rate limiter — no external deps, works on single-instance Render
const store = new Map();

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
};

// Run cleanup every 5 minutes to prevent memory growth
setInterval(cleanup, 5 * 60 * 1000).unref();

/**
 * @param {object} options
 * @param {number} options.windowMs   - Time window in milliseconds
 * @param {number} options.max        - Max requests per window per IP
 * @param {string} [options.message]  - Error message returned on limit hit
 */
export const rateLimit = ({ windowMs, max, message = 'Too many requests. Please try again later.' }) => {
  return (req, res, next) => {
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    return next();
  };
};
