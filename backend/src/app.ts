import express from 'express';
import cors from 'cors';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import swaggerRouter from './routes/swagger.js';
import aiRouter from './routes/ai.js';
import executeRouter from './routes/execute.js';
import downloadRouter from './routes/download.js';
import previewRouter from './routes/preview.js';
import { logger } from './utils/logger.js';

const app = express();

// Apply CORS – allow origins from FRONTEND_URL/FRONTEND_ORIGIN (comma-separated). In dev, allow all origins.
const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '');
const allowedOrigins = Array.from(
  new Set(
    [
      'http://localhost:5173',
      ...(process.env.FRONTEND_URL || '').split(','),
      ...(process.env.FRONTEND_ORIGIN || '').split(',')
    ]
      .map(normalizeOrigin)
      .filter(Boolean)
  )
);
const nodeEnv = process.env.NODE_ENV || 'development';
const allowAllOrigins = allowedOrigins.length === 0;
if (nodeEnv === 'production' && allowAllOrigins) {
  logger.warn('[CORS] FRONTEND_ORIGIN not set; allowing all origins');
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header)
      if (!origin) return callback(null, true);

      const normalized = normalizeOrigin(origin);
      if (allowAllOrigins) return callback(null, true);
      if (allowedOrigins.includes(normalized)) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Required headers for WebContainer compatibility.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Request ID middleware
app.use((req, res, next) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const requestId = (req as any).requestId;
  const startTime = Date.now();

  // Log incoming request
  logger.logRequest(req.method, req.path, requestId);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logResponse(req.method, req.path, requestId, res.statusCode, duration);
  });

  next();
});

// Apply rate limiting to all API routes
app.use('/api', apiRateLimiter);
app.use('/api/ai', aiRouter);
app.use('/api/execute', executeRouter);
app.use('/api/download', downloadRouter);
app.use('/api/preview', previewRouter);
// Expose Swagger/OpenAPI documentation
app.use('/api/docs', swaggerRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NEXUS AI CODING Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  const requestId = (req as any).requestId;
  logger.warn(`404 Not Found: ${req.method} ${req.path}`, { requestId });
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    requestId
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = (req as any).requestId;

  console.error(`[${new Date().toISOString()}] [ERROR] Unhandled error in ${req.method} ${req.path}`, {
    requestId,
    error: err.message,
    code: err.code,
    status: err.status || err.statusCode
  });

  // Print full stack trace
  if (err.stack) {
    console.error('Stack trace:', err.stack);
  }

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';

  res.status(err.status || err.statusCode || 500).json({
    error: isDev ? err.message : 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    requestId,
    ...(isDev && { stack: err.stack })
  });
});

export default app;

