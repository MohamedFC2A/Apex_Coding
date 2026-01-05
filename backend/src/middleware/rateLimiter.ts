/**
 * Simple in‑memory rate limiter middleware.
 *
 * It tracks request counts per IP address within a configurable time window.
 * The defaults mirror typical production settings (100 requests per 15 minutes).
 * Environment variables allow overriding:
 *   RATE_LIMIT_WINDOW_MS – window size in milliseconds (default 900000)
 *   RATE_LIMIT_MAX       – max requests per window (default 100)
 */
type RateRecord = { count: number; resetTime: number };

const rateStore = new Map<string, RateRecord>();

export const apiRateLimiter = (req: any, res: any, next: any) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
  const max = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

  let record = rateStore.get(ip);
  if (!record || now > record.resetTime) {
    // Start a new window
    record = { count: 1, resetTime: now + windowMs };
    rateStore.set(ip, record);
  } else {
    record.count += 1;
  }

  // Set standard rate‑limit headers
  const remaining = Math.max(0, max - record.count);
  res.setHeader('RateLimit-Limit', String(max));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

  if (record.count > max) {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
    return;
  }

  next();
};

