const getClientIp = (req) => {
  const xff = String(req.headers['x-forwarded-for'] || '').trim();
  if (xff) return xff.split(',')[0].trim();
  return String(req.socket?.remoteAddress || '').trim() || 'unknown';
};

const createRateLimiter = (options = {}) => {
  const windowMsRaw = Number(options.windowMs ?? process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const maxRaw = Number(options.max ?? process.env.RATE_LIMIT_MAX ?? 30);
  const windowMs = Number.isFinite(windowMsRaw) ? Math.max(1000, windowMsRaw) : 60_000;
  const max = Number.isFinite(maxRaw) ? Math.max(1, maxRaw) : 30;

  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const key = `${ip}:${req.path}`;
    const entry = hits.get(key) || { start: now, count: 0 };

    if (now - entry.start >= windowMs) {
      entry.start = now;
      entry.count = 0;
    }

    entry.count += 1;
    hits.set(key, entry);

    if (entry.count > max) {
      res.status(429).json({ error: 'Rate limit exceeded', requestId: req.requestId });
      return;
    }

    next();
  };
};

module.exports = { createRateLimiter };

