/**
 * Simple in-memory rate limiter for sensitive auth routes.
 * For multi-instance production, use Redis-backed limiting.
 */
const buckets = new Map();

const prune = (entry, now) => {
  entry.hits = entry.hits.filter((t) => now - t < entry.windowMs);
};

const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 5, keyPrefix = 'rl' } = {}) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const email = (req.body?.email || '').toLowerCase().trim();
    const key = `${keyPrefix}:${ip}:${email}`;
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry) {
      entry = { hits: [], windowMs };
      buckets.set(key, entry);
    }

    prune(entry, now);

    if (entry.hits.length >= max) {
      return res.status(429).json({
        message: 'Too many requests. Please wait a few minutes and try again.',
      });
    }

    entry.hits.push(now);
    next();
  };
};

module.exports = { rateLimit };
