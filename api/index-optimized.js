const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { createSandboxPreview, patchSandboxPreview, deleteSandboxPreview } = require('./utils/codesandbox');
const { toPreviewFileMapFromArray } = require('./utils/previewFiles');

const app = express();

// Enhanced middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
    : true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Enhanced rate limiting
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message, requestId: '' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: message,
      requestId: req.requestId,
      retryAfter: Math.round(windowMs / 1000)
    });
  }
});

// Different limits for different endpoints
const previewLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  20, // 20 requests per 15 minutes
  'Too many preview requests. Please wait before creating another preview.'
);

const patchLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  100, // 100 patches per minute
  'Too many update requests. Please slow down.'
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    requestId: req.requestId 
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Apex Coding API',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      preview: '/api/preview/*',
      ai: '/api/ai/*'
    },
    requestId: req.requestId
  });
});

// Preview configuration endpoint
app.get(['/preview/config', '/api/preview/config'], (req, res) => {
  const { apiKey: csbApiKey } = getCodeSandboxConfig();
  const isPlaceholder = csbApiKey && (
    csbApiKey.includes('REPLACE_ME') || 
    csbApiKey.length < 20 || 
    /placeholder|invalid|example/i.test(csbApiKey)
  );

  return res.json({
    provider: 'codesandbox',
    configured: Boolean(csbApiKey) && !isPlaceholder,
    missing: (!csbApiKey || isPlaceholder) ? ['CSB_API_KEY'] : [],
    baseUrl: 'https://codesandbox.io',
    tokenPresent: Boolean(csbApiKey),
    tokenLast4: csbApiKey ? csbApiKey.slice(-4) : null,
    tokenValid: !isPlaceholder,
    requestId: req.requestId,
    features: {
      retryLogic: true,
      timeoutHandling: true,
      errorRecovery: true
    }
  });
});

// Mock preview HTML
app.get(['/preview/mock', '/api/preview/mock'], (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Preview Configuration Required</title>
      <style>
        body { 
          margin: 0; 
          padding: 0; 
          background: #0B0F14; 
          color: #fff; 
          font-family: system-ui, sans-serif; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          height: 100vh; 
        }
        .card { 
          background: #1E293B; 
          padding: 2rem; 
          border-radius: 12px; 
          max-width: 480px; 
          text-align: center; 
          border: 1px solid rgba(255,255,255,0.1); 
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); 
        }
        h1 { margin-top: 0; font-size: 1.5rem; color: #60A5FA; }
        p { color: #94A3B8; line-height: 1.5; margin-bottom: 1.5rem; }
        code { background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; color: #E2E8F0; }
        .steps { text-align: left; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
        .steps ol { margin: 0; padding-left: 1.2rem; }
        .steps li { margin-bottom: 0.5rem; color: #CBD5E1; }
        .btn { display: inline-block; background: #3B82F6; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: 500; transition: background 0.2s; }
        .btn:hover { background: #2563EB; }
        .status { display: inline-block; padding: 0.25rem 0.75rem; background: rgba(239, 68, 68, 0.2); color: #f87171; border-radius: 9999px; font-size: 0.875rem; margin-bottom: 1rem; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="status">Configuration Required</div>
        <h1>Live Preview Setup</h1>
        <p>To see your code running live, you need to configure the preview provider.</p>
        
        <div class="steps">
          <ol>
            <li>Get a free API Key from <strong>CodeSandbox</strong>.</li>
            <li>Open the <code>.env</code> file in your project root.</li>
            <li>Replace <code>csb_v1_REPLACE_ME</code> with your actual key:
              <div style="margin-top: 0.5rem"><code>CSB_API_KEY=csb_v1_...</code></div>
            </li>
            <li>Restart the development server.</li>
          </ol>
        </div>

        <a href="https://codesandbox.io/dashboard/settings/api-keys" target="_blank" class="btn">Get API Key</a>
      </div>
    </body>
    </html>
  `);
});

// Enhanced session creation with better error handling
app.post(['/preview/sessions', '/api/preview/sessions'], previewLimiter, async (req, res) => {
  const provider = 'codesandbox';
  const startTime = Date.now();
  const controller = new AbortController();
  
  // Progressive timeout based on request headers
  const retryCount = parseInt(req.headers['x-preview-retry'] || '0');
  const baseTimeout = 180000; // 3 minutes base
  const retryPenalty = retryCount * 30000; // Add 30s per retry
  const timeoutMs = Math.min(baseTimeout + retryPenalty, 300000); // Max 5 minutes
  
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const { apiKey: csbApiKey } = getCodeSandboxConfig();
    
    // Check for missing or placeholder key
    const isMissing = !csbApiKey;
    const isPlaceholder = csbApiKey && (
      csbApiKey.includes('REPLACE_ME') || 
      csbApiKey.length < 20 || 
      /placeholder|invalid|example/i.test(csbApiKey)
    );

    if (isMissing || isPlaceholder) {
      clearTimeout(timeoutId);
      const message = isMissing ? 'CodeSandbox API key not configured' : 'Invalid CodeSandbox API key';
      return res.status(422).json({
        id: 'mock-session',
        url: `${req.protocol}://${req.get('host')}/api/preview/mock`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        provider: 'mock',
        message,
        requestId: req.requestId,
        setupRequired: true
      });
    }

    const fileMap = toPreviewFileMapFromArray(req.body?.files);
    const fileCount = Object.keys(fileMap).length;
    if (fileCount === 0) {
      clearTimeout(timeoutId);
      return res.status(400).json({ 
        error: 'files is required', 
        requestId: req.requestId 
      });
    }

    // Enhanced retry logic with exponential backoff
    let attemptCount = 0;
    const maxAttempts = Math.min(3 + retryCount, 5); // More attempts on retries
    let lastError;
    
    while (attemptCount < maxAttempts) {
      try {
        const attemptTimeout = timeoutMs - (attemptCount * 20000); // Reduce timeout per attempt
        
        const { sandboxId, url } = await createSandboxPreview({ 
          fileMap, 
          timeoutMs: attemptTimeout,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const processingTime = Date.now() - startTime;
        
        return res.json({ 
          id: sandboxId, 
          url, 
          createdAt: Date.now(), 
          updatedAt: Date.now(), 
          provider,
          retryCount: attemptCount,
          processingTime,
          requestId: req.requestId
        });
      } catch (err) {
        lastError = err;
        attemptCount++;
        
        // Don't retry on authentication or invalid request errors
        if (/unauthorized|invalid token|401|403|400/i.test(err.message)) {
          break;
        }
        
        if (attemptCount < maxAttempts) {
          // Exponential backoff with jitter
          const baseDelay = 1000 * Math.pow(2, attemptCount - 1);
          const jitter = Math.random() * 1000;
          const delay = Math.min(baseDelay + jitter, 10000);
          
          console.log(`[Preview] Retry ${attemptCount}/${maxAttempts} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    clearTimeout(timeoutId);
    const message = String(lastError?.message || lastError || 'CodeSandbox preview error');
    
    if (/unauthorized|invalid token|401|403/i.test(message)) {
      return res.status(401).json({
        error: 'CodeSandbox unauthorized',
        hint: 'CSB_API_KEY invalid. Set a valid key (no quotes/spaces) and redeploy.',
        requestId: req.requestId
      });
    }
    
    return res.status(502).json({ 
      error: message, 
      requestId: req.requestId,
      retryAttempt: attemptCount - 1,
      maxRetries: maxAttempts
    });
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err.name === 'AbortError') {
      return res.status(408).json({
        error: 'Request timeout',
        hint: `The preview server took too long to respond (timeout: ${Math.round(timeoutMs/1000)}s). Please try again.`,
        requestId: req.requestId,
        timeout: timeoutMs
      });
    }
    
    console.error('[Preview] Unexpected error:', err);
    return res.status(500).json({ 
      error: 'Internal server error', 
      requestId: req.requestId 
    });
  }
});

// Get session info
app.get(['/preview/sessions/:id', '/api/preview/sessions/:id'], async (req, res) => {
  const provider = 'codesandbox';
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id is required', requestId: req.requestId });
  
  if (id === 'mock-session') {
    return res.json({
      id: 'mock-session',
      url: `${req.protocol}://${req.get('host')}/api/preview/mock`,
      requestId: req.requestId,
      provider: 'mock'
    });
  }

  return res.json({
    id,
    url: `https://${encodeURIComponent(id)}-3000.csb.app`,
    requestId: req.requestId,
    provider
  });
});

// Enhanced patch endpoint
app.patch(['/preview/sessions/:id', '/api/preview/sessions/:id'], patchLimiter, async (req, res) => {
  const id = String(req.params.id || '').trim();
  
  if (id === 'mock-session') {
    return res.json({ 
      ok: true, 
      id: 'mock-session', 
      url: `${req.protocol}://${req.get('host')}/api/preview/mock`, 
      updatedAt: Date.now(), 
      provider: 'mock',
      requestId: req.requestId
    });
  }

  const provider = 'codesandbox';
  try {
    const { apiKey: csbApiKey } = getCodeSandboxConfig();
    if (!csbApiKey) {
      return res.status(400).json({
        error: 'Missing CodeSandbox API key',
        missing: ['CSB_API_KEY'],
        hint: 'Set CSB_API_KEY on the server (Vercel env or .env) and redeploy.',
        requestId: req.requestId
      });
    }
    
    const keyLooksInvalid =
      csbApiKey.length < 20 ||
      csbApiKey.includes('REPLACE_ME') ||
      /placeholder|invalid|example/i.test(csbApiKey);

    if (keyLooksInvalid) {
      return res.status(400).json({
        error: 'Invalid CodeSandbox API key',
        hint: 'CSB_API_KEY appears to be a placeholder. Set a real key and redeploy.',
        requestId: req.requestId
      });
    }

    const { create, destroy, files } = req.body || {};
    if (!create && !destroy && !files) {
      return res.status(400).json({
        error: 'Request body must include create, destroy, or files',
        requestId: req.requestId
      });
    }

    const result = await patchSandboxPreview(id, { create, destroy, files });
    return res.json({
      ok: true,
      id,
      url: result.url || `https://${encodeURIComponent(id)}-3000.csb.app`,
      updatedAt: Date.now(),
      provider,
      requestId: req.requestId
    });
  } catch (err) {
    const message = String(err?.message || err || 'Patch failed');
    if (/unauthorized|invalid token|401|403/i.test(message)) {
      return res.status(401).json({
        error: 'CodeSandbox unauthorized',
        hint: 'CSB_API_KEY invalid. Set a valid key (no quotes/spaces) and redeploy.',
        requestId: req.requestId
      });
    }
    return res.status(502).json({ error: message, requestId: req.requestId });
  }
});

// Delete session
app.delete(['/preview/sessions/:id', '/api/preview/sessions/:id'], async (req, res) => {
  const id = String(req.params.id || '').trim();
  
  if (id === 'mock-session') {
    return res.json({ ok: true, requestId: req.requestId, provider: 'mock' });
  }

  try {
    await deleteSandboxPreview(id);
    return res.json({ ok: true, id, requestId: req.requestId });
  } catch (err) {
    console.error(`Failed to delete session ${id}:`, err);
    return res.json({ ok: true, id, requestId: req.requestId }); // Still return ok
  }
});

// Utility functions
const getCodeSandboxApiKey = () => {
  const key = process.env.CSB_API_KEY?.trim();
  if (!key) return null;
  // Remove any surrounding quotes
  return key.replace(/^["']|["']$/g, '');
};

const getCodeSandboxConfig = () => {
  const apiKey = getCodeSandboxApiKey();
  return { apiKey };
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    requestId: req.requestId
  });
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Apex Coding API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Preview config: http://localhost:${PORT}/api/preview/config`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;
