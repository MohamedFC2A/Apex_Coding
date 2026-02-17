// api/index.js (Vercel Serverless, CommonJS)
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const dotenv = require('dotenv');

// Load backend/.env first (authoritative for backend runtime), then root .env for any missing vars.
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { requestIdMiddleware } = require('./middleware/requestId');
const { createRateLimiter } = require('./middleware/rateLimit');
const { parseAllowedOrigins } = require('./utils/security');
const { getCodeSandboxApiKey, createSandboxPreview, patchSandboxFiles, hibernateSandbox } = require('./utils/codesandbox');

const app = express();

app.use(requestIdMiddleware());

app.use((req, _res, next) => {
  const origin = String(req.headers.origin || '').trim();
  const ua = String(req.headers['user-agent'] || '').trim();
  console.log(
    `[${new Date().toISOString()}] [${req.requestId}] ${req.method} ${req.url}${origin ? ` origin=${origin}` : ''}${ua ? ` ua=${ua.slice(0, 120)}` : ''}`
  );
  next();
});

const allowedOrigins = parseAllowedOrigins(process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || process.env.FRONTEND_ORIGINS);
// Simplified CORS configuration for better compatibility
const defaultDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'];
const vercelOrigin = process.env.VERCEL_URL ? `https://${String(process.env.VERCEL_URL).trim()}` : null;
const allowedOriginsList = allowedOrigins.length > 0 ? allowedOrigins : [...defaultDevOrigins, vercelOrigin].filter(Boolean);

// CORS middleware with better error handling and logging
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in whitelist
    const isAllowed = 
      allowedOriginsList.includes(origin) ||
      allowedOriginsList.includes('*') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.csb.app') ||
      origin.includes('codesandbox.io') ||
      origin.endsWith('.replit.dev') ||
      origin.endsWith('.repl.co');

    if (isAllowed) {
      callback(null, true);
    } else {
      // Log blocked origin for debugging
      console.warn(`[CORS] Blocked request from origin: ${origin}, allowed list:`, allowedOriginsList);
      callback(null, false); // Deny with false, not error
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'Accept'],
  exposedHeaders: ['Content-Type', 'X-Request-Id'],
  credentials: false,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Explicit preflight handler for all routes (handles OPTIONS requests before body parsing)
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    console.error(`[CORS Error] ${req.method} ${req.url}: ${err.message}`);
    res.status(403).json({ error: err.message, requestId: req.requestId });
    return;
  }
  next(err);
});

// Global error handler middleware (must be before catch-all route)
app.use((err, req, res, next) => {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.requestId || 'unknown';
  const errorMessage = err?.message || String(err) || 'Internal server error';
  
  console.error(`[error-handler] [${requestId}] ${req.method} ${req.url} - ${errorMessage}`, err);

  // Determine status code
  let statusCode = 500;
  if (err?.statusCode) {
    statusCode = err.statusCode;
  } else if (err?.status) {
    statusCode = err.status;
  } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    statusCode = 404;
  } else if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
    statusCode = 401;
  } else if (errorMessage.includes('forbidden') || errorMessage.includes('403')) {
    statusCode = 403;
  } else if (errorMessage.includes('bad request') || errorMessage.includes('400')) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    error: errorMessage,
    requestId,
    method: req.method,
    url: req.url,
    ...(process.env.NODE_ENV === 'development' && { stack: err?.stack })
  });
});

app.get('/', (_req, res) => {
  res.status(200).send('Apex Coding Backend is Running!');
});

// Avoid noisy 404s when the backend is hit directly in dev/proxy setups.
app.get(['/favicon.ico', '/favicon.svg'], (_req, res) => {
  res.status(204).end();
});

// Unified /api handler (allows frontend to POST to `/api` and select an action).
// Supports: { action: 'plan' | 'generate', ... }
app.post(['/', '/api'], async (req, res, next) => {
  try {
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!action) return next();

    // Re-route internally if action is provided
    if (action === 'plan') {
      // We can't easily rewrite req.url and pass to next() if the route is defined later with a different path.
      // Instead, we can just call the plan handler logic or redirect.
      // For now, let's just let the client call the specific endpoint.
      // But if we must support this:
      req.url = '/ai/plan'; 
      return next();
    }

    if (action === 'generate') {
      req.url = '/ai/generate';
      return next();
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    return next(err);
  }
});

// /test endpoint
app.all(['/test', '/api/test'], (req, res) => {
  res.json({ message: 'Backend is working', method: req.method, url: req.url });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    requestId: req.requestId
  });
});

// /download/zip (mapped from /api/download/zip by the middleware above)
app.post(['/download/zip', '/api/download/zip'], async (req, res) => {
  try {
    const { files } = req.body || {};
    if (!files) return res.status(400).json({ error: 'files is required' });

    // Lazy-load to reduce cold-start cost for non-download requests.
    const JSZip = require('jszip');
    const zip = new JSZip();
    const fileCount = addFilesToZip(zip, files);
    if (fileCount === 0) return res.status(400).json({ error: 'No files to zip' });

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=apex-project.zip');
    res.status(200).send(buffer);
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('ZIP generation error:', details.message);
    res.status(500).json({ error: 'Failed to generate ZIP' });
  }
});

// ================================
// Live Preview - CodeSandbox only
// ================================
const getCodeSandboxConfig = () => {
  const apiKey = getCodeSandboxApiKey();
  return { apiKey };
};

const toPreviewFileMapFromArray = (files) => {
  const map = {};
  const list = Array.isArray(files) ? files : [];

  for (const f of list) {
    const rawPath = String(f?.path || f?.name || '').trim();
    if (!rawPath) continue;
    const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) continue;
    map[normalized] = String(f?.content ?? '');
  }

  return map;
};

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
    requestId: req.requestId
  });
});

app.get(['/preview/diagnostics', '/api/preview/diagnostics'], async (req, res) => {
  try {
    const { apiKey: csbApiKey } = getCodeSandboxConfig();
    const isPlaceholder = csbApiKey && (
      csbApiKey.includes('REPLACE_ME') || 
      csbApiKey.length < 20 || 
      /placeholder|invalid|example/i.test(csbApiKey)
    );

    let sandboxConnection = 'checking';
    
    // Try to test CodeSandbox API connection
    if (csbApiKey && !isPlaceholder) {
      try {
        const testRes = await fetch('https://codesandbox.io/api/v1/sandboxes', {
          headers: {
            'Authorization': `Bearer ${csbApiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (testRes.ok) {
          sandboxConnection = 'ok';
        } else if (testRes.status === 401 || testRes.status === 403) {
          sandboxConnection = 'error';
        } else {
          sandboxConnection = 'error';
        }
      } catch (err) {
        sandboxConnection = 'error';
      }
    } else {
      sandboxConnection = 'error';
    }

    return res.json({
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      sandboxConnection,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Diagnostics failed',
      message: String(error?.message || error),
      requestId: req.requestId
    });
  }
});


app.get(['/preview/mock', '/api/preview/mock'], (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Preview Config Required</title>
      <style>
        body { margin: 0; padding: 0; background: #0B0F14; color: #fff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
        .card { background: #1E293B; padding: 2rem; border-radius: 12px; max-width: 480px; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        h1 { margin-top: 0; font-size: 1.5rem; color: #60A5FA; }
        p { color: #94A3B8; line-height: 1.5; margin-bottom: 1.5rem; }
        code { background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; color: #E2E8F0; }
        .steps { text-align: left; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
        .steps ol { margin: 0; padding-left: 1.2rem; }
        .steps li { margin-bottom: 0.5rem; color: #CBD5E1; }
        .btn { display: inline-block; background: #3B82F6; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: 500; transition: background 0.2s; }
        .btn:hover { background: #2563EB; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Live Preview Configuration</h1>
        <p>To see your code running live, you need to configure a preview provider.</p>
        
        <div class="steps">
          <ol>
            <li>Get a free API Key from <strong>CodeSandbox</strong>.</li>
            <li>Open the <code>.env</code> file in your project root.</li>
            <li>Replace <code>csb_v1_REPLACE_ME</code> with your actual key:
              <div style="margin-top: 0.5rem"><code>CSB_API_KEY=csb_v1_...</code></div>
            </li>
            <li>Restart the server.</li>
          </ol>
        </div>

        <a href="https://codesandbox.io/dashboard/settings/api-keys" target="_blank" class="btn">Get API Key</a>
      </div>
    </body>
    </html>
  `);
});

app.post(['/preview/sessions', '/api/preview/sessions'], async (req, res) => {
  const provider = 'codesandbox';
  const controller = new AbortController();
  const timeoutMs = 300000; // 5 minutes for cold starts
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
      return res.status(400).json({
        error: isMissing ? 'CodeSandbox API key not configured' : 'Invalid CodeSandbox API key',
        missing: ['CSB_API_KEY'],
        hint: 'Set CSB_API_KEY on the server (Vercel env or .env) and redeploy.',
        requestId: req.requestId
      });
    }

    const fileMap = toPreviewFileMapFromArray(req.body?.files);
    const fileCount = Object.keys(fileMap).length;
    if (fileCount === 0) {
      clearTimeout(timeoutId);
      return res.status(400).json({ error: 'files is required', requestId: req.requestId });
    }

    const { sandboxId, url } = await createSandboxPreview({ fileMap, timeoutMs });
    
    clearTimeout(timeoutId);
    const now = Date.now();
    return res.json({ 
      id: sandboxId, 
      url, 
      createdAt: now, 
      updatedAt: now, 
      provider
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return res.status(408).json({
        error: 'Request timeout',
        hint: 'CodeSandbox is taking too long to respond. Please try again.',
        requestId: req.requestId
      });
    }
    const message = String(err?.message || err || 'CodeSandbox preview error');
    if (/unauthorized|invalid token|401|403/i.test(message)) {
      return res.status(401).json({
        error: 'CodeSandbox unauthorized',
        hint: 'CSB_API_KEY invalid. Set a valid key (no quotes/spaces) and redeploy.',
        requestId: req.requestId
      });
    }
    // Generic catch-all for any other error to prevent 500 crash without response
    console.error(`[preview/sessions] [${req.requestId}] Error:`, err);
    return res.status(500).json({ 
      error: 'Preview failed', 
      details: message, 
      requestId: req.requestId 
    });
  }
});

app.get(['/preview/sessions/:id', '/api/preview/sessions/:id'], async (req, res) => {
  const provider = 'codesandbox';
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id is required', requestId: req.requestId });

  return res.json({
    id,
    url: `https://${encodeURIComponent(id)}-3000.csb.app`,
    requestId: req.requestId,
    provider
  });
});

app.patch(['/preview/sessions/:id', '/api/preview/sessions/:id'], async (req, res) => {
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
      /csb_?api_?key/i.test(csbApiKey) ||
      /placeholder|invalid|example/i.test(csbApiKey);
    if (keyLooksInvalid) {
      return res.status(401).json({
        error: 'CodeSandbox unauthorized',
        hint: 'CSB_API_KEY invalid. Set a valid key (no quotes/spaces) and redeploy.',
        requestId: req.requestId
      });
    }
    const sandboxId = String(req.params.id || '').trim();
    const { url } = await patchSandboxFiles({
      sandboxId,
      create: req.body?.create,
      destroy: req.body?.destroy,
      files: req.body?.files
    });
    const updatedAt = Date.now();
    return res.json({ ok: true, id: sandboxId, url, updatedAt, requestId: req.requestId, provider });
  } catch (err) {
    const message = String(err?.message || err || 'CodeSandbox preview update error');
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

app.delete(['/preview/sessions/:id', '/api/preview/sessions/:id'], async (req, res) => {
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
      /csb_?api_?key/i.test(csbApiKey) ||
      /placeholder|invalid|example/i.test(csbApiKey);
    if (keyLooksInvalid) {
      return res.status(401).json({
        error: 'CodeSandbox unauthorized',
        hint: 'CSB_API_KEY invalid. Set a valid key (no quotes/spaces) and redeploy.',
        requestId: req.requestId
      });
    }
    const sandboxId = String(req.params.id || '').trim();
    await hibernateSandbox(sandboxId);
    return res.json({ ok: true, requestId: req.requestId, provider });
  } catch (err) {
    const message = String(err?.message || err || 'CodeSandbox preview delete error');
    return res.status(502).json({ error: message, requestId: req.requestId });
  }
});

const normalizeDeepSeekBaseUrl = (raw) => {
  const base = String(raw || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
};

const getDeepSeekConfig = () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('API Key missing on Backend');
  const baseURL = normalizeDeepSeekBaseUrl(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com');
  return { apiKey, baseURL };
};

const deepSeekCreateChatCompletion = async (payload, options = {}) => {
  const { apiKey, baseURL } = getDeepSeekConfig();
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal: options.signal
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `DeepSeek request failed (${res.status})`);
  }

  return res.json();
};

async function* readSseDataMessages(readableStream) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      const lines = rawEvent.split(/\r?\n/);
      const dataLines = [];
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const rest = line.slice('data:'.length);
          dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest);
        }
      }

      if (dataLines.length > 0) yield dataLines.join('\n');
    }
  }
}

async function* deepSeekStreamChatCompletion(payload, options = {}) {
  const { apiKey, baseURL } = getDeepSeekConfig();
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ ...payload, stream: true }),
    signal: options.signal
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `DeepSeek stream failed (${res.status})`);
  }

  if (!res.body) throw new Error('DeepSeek stream failed: empty response body');

  for await (const dataText of readSseDataMessages(res.body)) {
    const text = String(dataText || '').trim();
    if (!text) continue;
    if (text === '[DONE]') break;

    try {
      const parsed = JSON.parse(text);
      yield parsed;
    } catch {
      // ignore non-JSON lines
    }
  }
};

const getLLMProvider = (overrideProvider) => {
  const name = String(overrideProvider || process.env.LLM_PROVIDER || 'deepseek').trim().toLowerCase();
  if (name === 'deepseek') {
    return {
      name,
      createChatCompletion: deepSeekCreateChatCompletion,
      streamChatCompletion: deepSeekStreamChatCompletion
    };
  }
  throw new Error(`Unsupported LLM provider: ${name}`);
};

const getPlannerRouting = (modelRouting = {}) => {
  const provider =
    String(modelRouting?.plannerProvider || process.env.LLM_PLANNER_PROVIDER || process.env.LLM_PROVIDER || 'deepseek')
      .trim()
      .toLowerCase();
  const model = String(modelRouting?.plannerModel || process.env.LLM_PLANNER_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim();
  return { provider, model };
};

const getExecutorRouting = (thinkingMode, modelRouting = {}) => {
  const provider =
    String(modelRouting?.executorProvider || process.env.LLM_EXECUTOR_PROVIDER || process.env.LLM_PROVIDER || 'deepseek')
      .trim()
      .toLowerCase();
  const model = String(
    modelRouting?.executorModel ||
      process.env.LLM_EXECUTOR_MODEL ||
      (thinkingMode ? process.env.DEEPSEEK_THINKING_MODEL : process.env.DEEPSEEK_MODEL) ||
      (thinkingMode ? 'deepseek-reasoner' : 'deepseek-chat')
  ).trim();
  return { provider, model };
};

const cleanAndParseJSON = (text) => {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty AI response');
  try {
    return JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/```json\\s*([\\s\\S]*?)\\s*```/i) || raw.match(/```\\s*([\\s\\S]*?)\\s*```/);
    if (match && match[1]) return JSON.parse(match[1]);
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw e;
  }
};

const getErrorDetails = (error) => {
  const status = error?.status || error?.response?.status;
  const message =
    error?.error?.message ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown error';
  return { status, message };
};

const normalizeZipEntryPath = (rawPath) => {
  const value = String(rawPath || '').trim();
  if (!value) return '';

  const withForwardSlashes = value.replace(/\\/g, '/');
  const withoutDriveLetter = withForwardSlashes.replace(/^[a-zA-Z]:\//, '');
  const withoutLeadingSlash = withoutDriveLetter.replace(/^\/+/, '');

  const parts = [];
  for (const segment of withoutLeadingSlash.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }

  return parts.join('/');
};

const addFilesToZip = (zip, files) => {
  let count = 0;

  const addFile = (path, content) => {
    const entryPath = normalizeZipEntryPath(path);
    if (!entryPath) return;
    zip.file(entryPath, typeof content === 'string' ? content : String(content ?? ''));
    count += 1;
  };

  const walkTree = (tree, basePath) => {
    if (!tree || typeof tree !== 'object') return;
    for (const [name, entry] of Object.entries(tree)) {
      const nextPath = basePath ? `${basePath}/${name}` : name;
      if (entry?.file && typeof entry.file.contents === 'string') {
        addFile(nextPath, entry.file.contents);
      } else if (entry?.directory) {
        walkTree(entry.directory, nextPath);
      }
    }
  };

  if (Array.isArray(files)) {
    for (const file of files) {
      if (!file) continue;
      const path = file.path || file.name;
      addFile(path, file.content);
    }
    return count;
  }

  if (files && typeof files === 'object') {
    walkTree(files, '');
    return count;
  }

  return 0;
};

const FRONTEND_PRO_QUALITY_POLICY = [
  '[FRONTEND PRO QUALITY POLICY]',
  '- Default frontend mode is adaptive multi-page vanilla (HTML/CSS/JS).',
  '- Use single-page only for simple requests; otherwise generate linked multi-page architecture.',
  '- Do not switch to React/Next/Vite unless explicitly requested by the user prompt.',
  '- For static mode, keep shared style.css + script.js and route-oriented kebab-case page files.',
  '- Use canonical folders when multi-page: pages/, components/, styles/, scripts/, assets/, data/.',
  '- Include a route map contract (site-map.json or equivalent structured mapping) for multi-page outputs.',
  '- Prevent duplicate-purpose files; prefer edit/move over creating conflicting files.',
  '- Use explicit delete/move file operations with reasons when restructuring files.',
  '- Never output TODO/placeholders in final code.',
  '- Keep JavaScript syntax-safe and avoid glued comment/code lines that can break parsing.',
  '- Add clean interactivity when relevant: menu toggle, form validation, smooth-scroll, active nav, and observer effects.',
  '- Enforce semantic HTML, responsive layout, and accessibility defaults (labels/aria/keyboard-safe interactions).',
  '- First pass must be complete and preview-ready.'
].join('\n');

const hasExplicitFrameworkRequest = (prompt) => {
  const text = String(prompt || '').toLowerCase();
  return /\breact\b|\bnext(?:\.js)?\b|\bvite\b|\btypescript app\b|\bvue\b|\bangular\b|\bsvelte\b/.test(text);
};

// Prompts
const PLAN_SYSTEM_PROMPT_FRONTEND = `You are an Elite Frontend Architect specializing in production-grade static web applications.

You must produce an EXECUTION-GRADE implementation plan. Every step must be atomic, testable, and ordered so a junior developer could follow it without questions.

CRITICAL OUTPUT RULES:
1. Output ONLY raw JSON (no markdown, no code fences, no commentary).
2. JSON shape EXACTLY:
   {"title":"...","description":"...","stack":"html-css-javascript","fileTree":[...],"steps":[{"id":"1","title":"...","category":"...","files":[...],"description":"..."}]}
3. Total steps: 4 to 6 (never fewer, never more than 7).
4. Each step must have a clear "done criteria" sentence at the end of its description.

STEP CATEGORIES (use these exact strings):
- "setup"        → Project scaffold, HTML boilerplate, meta tags, CDN links
- "layout"       → Page structure, grid/flexbox, header/footer/nav, responsive skeleton
- "components"   → Individual UI sections (hero, features, cards, testimonials, pricing, contact form, etc.)
- "interactivity"→ JavaScript behaviors (scroll effects, mobile menu, form validation, animations, modals)
- "styling"      → Visual polish: colors, typography, gradients, hover states, transitions, dark mode
- "polish"       → Accessibility audit, performance, final responsive QA, meta/SEO tags

CATEGORY RULES:
- NO "backend", "api", or "database" categories.
- First step MUST be "setup". Last step SHOULD be "polish".
- "components" step(s) must decompose the UI into named sections (e.g. Hero, Features Grid, Testimonials, Footer).

FILE TREE RULES (CRITICAL — DUPLICATES ARE FORBIDDEN):
- fileTree must list EVERY file that will be created.
- For simple sites use flat structure: index.html, style.css, script.js.
- For complex sites, use adaptive multi-page structure with canonical folders: pages/, components/, styles/, scripts/, assets/, data/.
- If multi-page is used, include site-map.json in fileTree.
- NEVER list the same filename twice (e.g. two style.css in different paths).
- Keep one shared style.css and one shared script.js by default in static mode (unless architecture explicitly needs scoped files).
- If SVG icons are needed, place in src/icons/ and list each file.
- NEVER include package.json, node_modules, or build configs unless explicitly requested.

UI DECOMPOSITION (MANDATORY):
- The plan description must name every major UI section (e.g. "Navigation bar, Hero with CTA, Feature cards grid, Testimonial carousel, Contact form, Footer").
- Each "components" step must specify which sections it implements.
- Steps must be ordered: structure first → content second → behavior third → polish last.

RESPONSIVE DESIGN (MANDATORY):
- At least one step must mention responsive breakpoints (mobile ≤480px, tablet ≤768px, desktop ≥1024px).
- Mobile-first approach: base styles for mobile, media queries scale up.
- Touch targets must be ≥44px.

INTERACTIVITY PLANNING:
- If the site has a nav menu, plan a mobile hamburger toggle.
- If there's a form, plan client-side validation.
- If there are multiple sections, plan smooth scroll navigation.
- Specify which JS behaviors each step produces.

ACCESSIBILITY:
- Plan must include semantic HTML (header, main, nav, section, footer).
- At least one step description must mention ARIA labels and contrast ratios.

REPO CONSTRAINTS:
- Stack: HTML5, Vanilla CSS, Vanilla JavaScript. NO frameworks unless explicitly requested.
- NO build tools (Vite/Webpack). NO backend API calls. NO server-side code.
- Use Lucide Icons via CDN or inline SVGs.
- Structure must be webcontainer compatible.
- LIVE PREVIEW is CRITICAL: all files must be valid, linkable HTML/CSS/JS.

${FRONTEND_PRO_QUALITY_POLICY}`.trim();

const PLAN_SYSTEM_PROMPT_FULLSTACK = `You are an Elite Full-Stack Software Architect.

You must produce an execution-grade implementation plan for a FULL-STACK application.

CRITICAL OUTPUT RULES:
1. Output ONLY raw JSON (no markdown, no code fences).
2. JSON shape exactly:
   {"title":"...","description":"...","stack":"react-express-node","fileTree":[...],"steps":[{"id":"1","title":"...","category":"...","files":[...],"description":"..."}]}
3. Steps MUST be executable, specific, and ordered. Total steps: 4 to 8.
4. Categories allowed: config, frontend, backend, integration, testing.
5. Project Structure:
   - \`frontend/\` (Vite + React)
   - \`backend/\` (Node + Express)
   - \`package.json\` (Root)
6. Steps must explicitly switch between frontend and backend tasks.

REPO CONSTRAINTS:
- Frontend: Vite + React + TypeScript (Tailwind, Zustand).
- Backend: Node.js + Express (REST API).
- API Communication: Frontend calls \`/api/...\` which proxies to Backend.
- ICONS: Use \`lucide-react\`. If custom SVGs are strictly needed, place in \`frontend/src/assets/icons/\`.

PLAN QUALITY:
- Define API endpoints clearly in backend steps.
- Ensure frontend connects to these endpoints.
- UI/UX: Mobile-First design, responsive layouts, robust error handling.`.trim();

const CODE_JSON_SYSTEM_PROMPT = `
You are an expert full-stack code generator.
Return ONLY a single valid JSON object (no markdown), with this shape:
{
  "project_files": [{ "name": "path/file.ext", "content": "..." }],
  "metadata": { "language": "string", "framework": "string" },
  "instructions": "string"
}
Rules:
- Output ONLY JSON. No code fences.
- Escape content correctly in JSON strings.
- Include complete file contents (no placeholders).
`.trim();

const CODE_STREAM_SYSTEM_PROMPT = `You are an ELITE Full-Stack Code Generator AI.

CRITICAL RULES - VIOLATION WILL BREAK THE PROJECT:

1. FILE DUPLICATION IS FORBIDDEN (ZERO TOLERANCE):
   - NEVER create the same file twice (e.g., styles.css in two locations)
   - NEVER create duplicate CSS/JS files
   - If a file exists, use [[EDIT_NODE:]] to modify it, NEVER [[START_FILE:]]
   - Prefer one shared style.css + one shared script.js for static projects
   
   DECISION TREE — before writing ANY file:
   a) Does a file with the SAME PATH already exist? → Use [[EDIT_NODE:]]
   b) Does a file with the SAME BASENAME exist at a different path? → Do NOT create it. Use [[EDIT_NODE:]] on the existing one.
   c) Does a file with the SAME PURPOSE exist (e.g., another CSS file)? → Do NOT create it. Append to the existing one via [[EDIT_NODE:]].
   d) If reorganization is needed, use [[MOVE_FILE: from -> to | reason: ...]]
   e) If stale duplicate is proven unused, use [[DELETE_FILE: path | reason: ...]]
   f) Only if NONE of the above → Use [[START_FILE:]]
   
   SINGLE-SOURCE-OF-TRUTH:
   - ALL CSS goes in ONE file (style.css or styles.css). Never split into multiple CSS files.
   - ALL JavaScript goes in ONE file (script.js or app.js). Never split into multiple JS files for simple sites.
   - If a CSS file already exists, do NOT use inline styles. Add classes to the CSS file via [[EDIT_NODE:]].
   - If you have already output style.css, do NOT output styles.css or main.css. They are the SAME file.

2. PROJECT STRUCTURE - ADAPTIVE MULTI-PAGE STATIC BY DEFAULT:
   - ALWAYS prefer static HTML/CSS/JS unless the user explicitly asks for React, Vue, Next, or a build step.
   - Use single-page only for simple requests; otherwise generate linked multi-page architecture.
   - Multi-page static conventions: pages/, components/, styles/, scripts/, assets/, data/, plus site-map.json.
   - Do NOT generate 'package.json', 'vite.config.js', or 'node_modules' usage unless explicitly requested.
   - For simple tasks, use:
     - index.html (main HTML with all structure)
     - style.css (ALL CSS in ONE file)
     - script.js (ALL JavaScript in ONE file - MANDATORY)
   - For complex tasks, keep navigation/footer links consistent with site-map.json route map.
   
   If React/Vite is EXPLICITLY requested:
   - package.json
   - src/main.tsx (entry point)
   - src/App.tsx (main component)
   - src/styles/ (styles folder if present)
   - src/components/ (components folder)

   ENV RULES (Vite):
   - Use import.meta.env.VITE_* in frontend code.
   - NEVER use process.env.NEXT_PUBLIC_* in Vite projects.

3. NEVER REWRITE FROM SCRATCH:
   - If editing, use [[EDIT_NODE:]] with [[SEARCH]]/[[REPLACE]] blocks
   - NEVER output entire file contents when editing
   - Only output the CHANGED parts

4. AUTO-CONTINUE RULES:
   If you were cut off mid-file:
   - Continue the SAME file from where you stopped
   - Use [[START_FILE: exact/same/path.ext]] to continue
   - Do NOT create a new file with different name
   - Do NOT restart the file from beginning
   - Continue from the EXACT line where you stopped
   - NEVER output status messages like "Continuing...", "Searching..."

5. OUTPUT FORMAT - STRICT:
   - Output ONLY file markers and code
   - NO explanations, NO commentary, NO status messages
   - NO markdown, NO code fences
   - NO "Here is", "I will", "Let me" phrases
   - ALWAYS implement the FULL functionality requested, specifically JavaScript/TypeScript logic. Do not leave "TODO" comments.
   - For simple static sites, output the baseline files (index.html + style.css + script.js) in one response.
   - For adaptive multi-page static sites, output all linked pages plus shared style/script and route map files.
   - DO NOT STOP AFTER THE FIRST FILE.

6. ANTI-LAZINESS RULES:
   - Do NOT be lazy. Write the FULL code.
   - Do NOT say "Add more code here". Write it.
   - If the user asks for a landing page, build the WHOLE landing page (Hero, Features, Footer, etc).
   - For non-trivial requests, a single HTML file is a FAILURE. Split into logical pages/components.

7. FRONTEND EXCELLENCE STANDARDS (MANDATORY):
   - Mobile-First: Always build for mobile first, then scale up using media queries.
   - Fluid & Responsive: Use fluid grids, flexbox/grid, and relative units (rem/em/%) instead of fixed px.
   - Touch-Optimized: Buttons/inputs must be touch-friendly (min 44px height).
   - Accessibility-First: Use semantic HTML, proper contrast, and ARIA labels.
   - Cross-Browser: Ensure code works on Chrome, Firefox, Safari, and Edge.
   - Performance: Optimize images, minimize reflows, and use efficient CSS selectors.
   - Device-Agnostic: Ensure consistent experience across phones, tablets, and desktops.

8. FIRST-PASS DELIVERY QUALITY (MANDATORY):
   - The first complete response must be production-ready, not a thin scaffold.
   - Implement full core user flows for the request with realistic states.
   - Include error handling and validation where relevant.
   - Avoid placeholder sections, fake data stubs, or TODO comments in final output.

9. DECISION-MAKING POLICY:
   - If the request is underspecified, choose strong professional defaults and continue.
   - Optimize for a reliable result that runs correctly on first preview.

10. COMMENT/CODE SAFETY:
   - Never glue comment text and executable tokens on the same line.
   - Keep a clean newline after comment-only lines before code.

FILE-MARKER PROTOCOL:
[[START_FILE: path/to/file.ext]]
<file contents>
[[END_FILE]]

EDIT PROTOCOL:
[[EDIT_NODE: path/to/file.ext]]
[[SEARCH]]
<exact text>
[[REPLACE]]
<new text>
[[END_EDIT]]
[[END_FILE]]

DELETE PROTOCOL:
[[DELETE_FILE: path/to/file.ext | reason: why deletion is safe]]

MOVE PROTOCOL:
[[MOVE_FILE: from/path.ext -> to/path.ext | reason: why move is safe]]

SAFETY RULES FOR DELETE/MOVE:
- Never delete or move sensitive root files (package.json, lock files, tsconfig, next/vite configs) unless explicitly justified and replacements are included.
- Never move files in a way that breaks imports/routes/links without emitting corresponding edits in the same response.

STATIC SITE EXAMPLE (Preferred Structure):
[[START_FILE: index.html]]
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Site</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- content -->
  <script src="script.js"></script>
</body>
</html>
[[END_FILE]]

[[START_FILE: style.css]]
/* ALL styles in ONE file */
[[END_FILE]]

[[START_FILE: script.js]]
// ALL JavaScript in ONE file
document.addEventListener('DOMContentLoaded', () => {
    console.log('App loaded');
});
[[END_FILE]]

BRANDING: Include footer: © 2026 Nexus Apex | Built by Matany Labs.

REMEMBER: Prefer simple static files (HTML/CSS/JS) over complex builds. Keep it natural and direct.

${FRONTEND_PRO_QUALITY_POLICY}`.trim();

const normalizeConstraints = (rawConstraints = {}, fallbackProjectType = null) => {
  const projectMode =
    rawConstraints?.projectMode === 'FULL_STACK' || rawConstraints?.projectMode === 'FRONTEND_ONLY'
      ? rawConstraints.projectMode
      : (fallbackProjectType === 'FULL_STACK' || fallbackProjectType === 'FRONTEND_ONLY'
          ? fallbackProjectType
          : 'FRONTEND_ONLY');

  const selectedFeatures = Array.isArray(rawConstraints?.selectedFeatures)
    ? rawConstraints.selectedFeatures.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

  const customFeatureTags = Array.isArray(rawConstraints?.customFeatureTags)
    ? rawConstraints.customFeatureTags.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    projectMode,
    selectedFeatures,
    customFeatureTags,
    enforcement: 'hard',
    qualityGateMode:
      rawConstraints?.qualityGateMode === 'strict' ||
      rawConstraints?.qualityGateMode === 'medium' ||
      rawConstraints?.qualityGateMode === 'light'
        ? rawConstraints.qualityGateMode
        : 'strict',
    siteArchitectureMode:
      rawConstraints?.siteArchitectureMode === 'adaptive_multi_page' ||
      rawConstraints?.siteArchitectureMode === 'single_page' ||
      rawConstraints?.siteArchitectureMode === 'force_multi_page'
        ? rawConstraints.siteArchitectureMode
        : 'adaptive_multi_page',
    fileControlMode:
      rawConstraints?.fileControlMode === 'safe_full' ||
      rawConstraints?.fileControlMode === 'create_edit_only'
        ? rawConstraints.fileControlMode
        : 'safe_full',
    contextIntelligenceMode:
      rawConstraints?.contextIntelligenceMode === 'balanced_graph' ||
      rawConstraints?.contextIntelligenceMode === 'light' ||
      rawConstraints?.contextIntelligenceMode === 'max'
        ? rawConstraints.contextIntelligenceMode
        : 'balanced_graph'
  };
};

const buildConstraintsBlock = (constraints, prompt = '') => {
  const featureLines = [
    ...constraints.selectedFeatures.map((feature) => `- ${feature}`),
    ...constraints.customFeatureTags.map((feature) => `- custom: ${feature}`)
  ];
  const explicitFrameworkRequested = hasExplicitFrameworkRequest(prompt);
  const frontendModeRules = constraints.projectMode === 'FRONTEND_ONLY'
    ? [
        'Frontend Defaults:',
        '- Default to adaptive multi-page vanilla static output.',
        '- Use single-page only for simple prompts; switch to multi-page when scope is broader.',
        `- Explicit framework request detected: ${explicitFrameworkRequested ? 'YES' : 'NO'}.`,
        '- Only produce React/Next/Vite structure when explicit framework request is YES.',
        '- If multi-page static is used, include route map contract (site-map.json or equivalent).',
        '',
        FRONTEND_PRO_QUALITY_POLICY
      ].join('\n')
    : '';

  return [
    '[SERVER CONSTRAINTS]',
    `Project Mode: ${constraints.projectMode}`,
    `Enforcement: ${constraints.enforcement.toUpperCase()}`,
    `Site Architecture Mode: ${constraints.siteArchitectureMode || 'adaptive_multi_page'}`,
    `File Control Mode: ${constraints.fileControlMode || 'safe_full'}`,
    `Context Intelligence Mode: ${constraints.contextIntelligenceMode || 'balanced_graph'}`,
    'Required Features:',
    featureLines.length > 0 ? featureLines.join('\n') : '- none',
    '',
    'Rules:',
    '- Respect all constraints strictly.',
    '- Do not output files that violate project mode.',
    '- Ensure selected features are implemented in code output.',
    ...(frontendModeRules ? ['', frontendModeRules] : [])
  ].join('\n');
};

const attachConstraintsToPrompt = (prompt, constraints) => {
  return `${String(prompt || '').trim()}\n\n${buildConstraintsBlock(constraints, prompt)}`.trim();
};

// /ai/plan (mapped from /api/ai/plan by the middleware above)
// Using regex to reliably match both /ai/plan and /api/ai/plan regardless of Vercel rewrites
const planRouteRegex = /^\/api\/ai\/plan|^\/ai\/plan/;

app.options(planRouteRegex, cors(corsOptions));

const planLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

app.post(planRouteRegex, planLimiter, async (req, res) => {
  console.log(`[plan] [${req.requestId}] Received request`);
  try {
    const { prompt, thinkingMode, projectType, constraints: rawConstraints, contextMeta, modelRouting } = req.body || {};
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.log(`[plan] [${req.requestId}] Error: Prompt is required`);
      return res.status(400).json({ error: 'Prompt is required', requestId: req.requestId });
    }
    if (prompt.length > 30_000) {
      console.log(`[plan] [${req.requestId}] Error: Prompt is too long`);
      return res.status(400).json({ error: 'Prompt is too long', requestId: req.requestId });
    }
    const constraints = normalizeConstraints(rawConstraints, projectType);
    const effectiveProjectType = constraints.projectMode;
    const constrainedPrompt = attachConstraintsToPrompt(prompt, constraints);

    const plannerRoute = getPlannerRouting(modelRouting);
    console.log(
      `[plan] [${req.requestId}] prompt_length=${prompt.length} mode=${thinkingMode ? 'thinking' : 'fast'} type=${effectiveProjectType} planner=${plannerRoute.provider}:${plannerRoute.model} session=${contextMeta?.sessionId || 'none'}`
    );

    // Select constraints based on projectType
    let selectedSystemPrompt = PLAN_SYSTEM_PROMPT_FULLSTACK; // Default
    if (effectiveProjectType === 'FRONTEND_ONLY') {
      selectedSystemPrompt = PLAN_SYSTEM_PROMPT_FRONTEND;
    }

    // Fallback plan when AI provider is not configured (demo mode)
    if (!process.env.DEEPSEEK_API_KEY) {
      // ... existing fallback ...
    }

    const TIMEOUT_MS = thinkingMode ? 290_000 : 110_000;

    const request = {
      model: plannerRoute.model,
      temperature: 0.0,
      messages: [
        { role: 'system', content: selectedSystemPrompt },
        { role: 'user', content: constrainedPrompt }
      ]
    };

    let completion;
    let provider;
    try {
      provider = getLLMProvider(plannerRoute.provider);
    } catch {
      provider = getLLMProvider('deepseek');
    }
    try {
      console.log(`[plan] [${req.requestId}] Requesting AI completion...`);
      completion = await Promise.race([
        provider.createChatCompletion({
          ...request,
          response_format: { type: 'json_object' }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PLAN_TIMEOUT')), TIMEOUT_MS))
      ]);
    } catch (err) {
      console.log(`[plan] [${req.requestId}] First attempt failed: ${err.message}. Retrying without json_object format...`);
      completion = await Promise.race([
        provider.createChatCompletion(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PLAN_TIMEOUT')), TIMEOUT_MS))
      ]);
    }

    let content = completion?.choices?.[0]?.message?.content || '';
    console.log(`[plan] [${req.requestId}] AI response received, content length=${content.length}`);

    content = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
    if (content.length === 0) throw new Error('Empty AI response');

    const parsed = cleanAndParseJSON(content);
    const stepsRaw = Array.isArray(parsed) ? parsed : parsed?.steps;
    const steps = Array.isArray(stepsRaw)
      ? stepsRaw
          .map((step, index) => {
            if (typeof step === 'string') {
              const title = step.trim();
              return title ? { id: String(index + 1), title, category: 'frontend', files: [], description: '' } : null;
            }
            const title = String(step?.title ?? step?.text ?? step?.step ?? '').trim();
            if (!title) return null;
            return {
              id: String(step?.id ?? index + 1),
              title,
              category: String(step?.category ?? 'frontend').toLowerCase(),
              files: Array.isArray(step?.files) ? step.files : [],
              description: String(step?.description ?? '')
            };
          })
          .filter(Boolean)
      : [];

    const title = typeof parsed?.title === 'string' ? parsed.title : 'Architecture Plan';
    console.log(`[plan] [${req.requestId}] Success`);
    return res.json({
      title,
      description: parsed?.description || '',
      stack: parsed?.stack || '',
      fileTree: Array.isArray(parsed?.fileTree) ? parsed.fileTree : [],
      steps,
      requestId: req.requestId
    });
  } catch (error) {
    if (String(error?.message || '').includes('PLAN_TIMEOUT')) {
      console.warn(`[plan] [${req.requestId}] timeout - returning demo fallback`);
      const title = 'Plan (Demo Fallback)';
      const description = 'انتهت مهلة توليد الخطة. تم إرجاع خطة سريعة بديلة.';
      const stack = 'html-css-javascript';
      const fileTree = ['index.html', 'style.css', 'script.js', 'site-map.json'];
      const steps = [
        { id: '1', title: 'تهيئة هيكل الصفحات وخريطة المسارات', category: 'setup', files: ['site-map.json'], description: '' },
        { id: '2', title: 'بناء صفحة البداية وروابط التنقل', category: 'layout', files: ['index.html'], description: '' },
        { id: '3', title: 'إضافة التصميم المتجاوب المشترك', category: 'styling', files: ['style.css'], description: '' },
        { id: '4', title: 'إضافة السلوكيات التفاعلية المشتركة', category: 'interactivity', files: ['script.js'], description: '' }
      ];
      return res.json({ title, description, stack, fileTree, steps, requestId: req.requestId });
    }
    const details = getErrorDetails(error);
    console.error(`[plan] [${req.requestId}] error=${details.message}`);
    res.status(500).json({
      error: details.message,
      title: 'Plan Generation Failed',
      steps: [{ id: '1', title: 'Error parsing AI response. Please try again.', category: 'config', files: [], description: '' }],
      requestId: req.requestId
    });
  }
});

// /generate (mapped from /api/generate)
// Live streaming (no job queue): pipes model output directly to the client.
// Matches: /api/ai/generate, /ai/generate, /api/generate, /generate, AND /ai/chat (legacy)
const generateRouteRegex = /\/api\/ai\/generate|\/ai\/generate|\/api\/generate|\/generate|\/api\/ai\/chat|\/ai\/chat/;

app.options(generateRouteRegex, cors(corsOptions));

const generateLimiter = createRateLimiter({ windowMs: 60_000, max: 15 });

app.post(generateRouteRegex, generateLimiter, async (req, res) => {

  let keepAliveTimer = null;
  let abortTimer = null;
  const writeSse = (event, data) => {
    if (res.writableEnded) return;
    const payload = String(data ?? '');
    const lines = payload.split(/\r?\n/);
    res.write(`event: ${event}\n`);
    for (const line of lines) {
      res.write(`data: ${line}\n`);
    }
    res.write('\n');
  };

  try {
    const { prompt, thinkingMode, projectType, constraints: rawConstraints, contextMeta, modelRouting } = req.body || {};
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).send('Prompt is required');
      return;
    }
    if (prompt.length > 80_000) {
      res.status(400).send('Prompt is too long');
      return;
    }

    const constraints = normalizeConstraints(rawConstraints, projectType);
    const constrainedPrompt = attachConstraintsToPrompt(prompt, constraints);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('x-request-id', req.requestId);
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    writeSse('status', 'streaming:Initializing stream');

    const executorRoute = getExecutorRouting(Boolean(thinkingMode), modelRouting);
    const model = executorRoute.model;

    console.log(
      `[generate] [${req.requestId}] model=${executorRoute.provider}:${executorRoute.model} session=${contextMeta?.sessionId || 'none'}`
    );

    // Fallback streaming when AI provider is not configured (demo mode)
    const explicitFrameworkRequested = hasExplicitFrameworkRequest(constrainedPrompt);
    if (!process.env.DEEPSEEK_API_KEY) {
      if (constraints.projectMode === 'FRONTEND_ONLY' && !explicitFrameworkRequested) {
        const siteMap = [
          '[[START_FILE: site-map.json]]',
          '{',
          '  "routes": [',
          '    { "path": "/", "file": "index.html", "title": "Home" },',
          '    { "path": "/pages/about.html", "file": "pages/about.html", "title": "About" },',
          '    { "path": "/pages/contact.html", "file": "pages/contact.html", "title": "Contact" }',
          '  ]',
          '}',
          '[[END_FILE]]'
        ].join('\n');

        const indexHtml = [
          '[[START_FILE: index.html]]',
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '  <meta charset="UTF-8" />',
          '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          '  <title>Apex Demo Site</title>',
          '  <link rel="stylesheet" href="style.css" />',
          '</head>',
          '<body>',
          '  <header class="site-header">',
          '    <a class="brand" href="index.html">Apex Demo</a>',
          '    <nav aria-label="Primary">',
          '      <a href="index.html">Home</a>',
          '      <a href="pages/about.html">About</a>',
          '      <a href="pages/contact.html">Contact</a>',
          '    </nav>',
          '  </header>',
          '  <main>',
          '    <section class="hero">',
          '      <h1>Professional Frontend Baseline</h1>',
          '      <p>Adaptive multi-page static architecture with shared CSS/JS.</p>',
          '      <a class="btn" href="pages/contact.html">Start now</a>',
          '    </section>',
          '  </main>',
          '  <footer>© 2026 Nexus Apex | Built by Matany Labs.</footer>',
          '  <script src="script.js"></script>',
          '</body>',
          '</html>',
          '[[END_FILE]]'
        ].join('\n');

        const aboutHtml = [
          '[[START_FILE: pages/about.html]]',
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '  <meta charset="UTF-8" />',
          '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          '  <title>About | Apex Demo</title>',
          '  <link rel="stylesheet" href="../style.css" />',
          '</head>',
          '<body>',
          '  <header class="site-header"><a class="brand" href="../index.html">Apex Demo</a></header>',
          '  <main><section><h1>About</h1><p>This page is linked through site-map.json.</p></section></main>',
          '  <footer>© 2026 Nexus Apex | Built by Matany Labs.</footer>',
          '  <script src="../script.js"></script>',
          '</body>',
          '</html>',
          '[[END_FILE]]'
        ].join('\n');

        const contactHtml = [
          '[[START_FILE: pages/contact.html]]',
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '  <meta charset="UTF-8" />',
          '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          '  <title>Contact | Apex Demo</title>',
          '  <link rel="stylesheet" href="../style.css" />',
          '</head>',
          '<body>',
          '  <header class="site-header"><a class="brand" href="../index.html">Apex Demo</a></header>',
          '  <main>',
          '    <section>',
          '      <h1>Contact</h1>',
          '      <form id="contactForm" novalidate>',
          '        <label for="email">Email</label>',
          '        <input id="email" name="email" type="email" required />',
          '        <button type="submit">Send</button>',
          '      </form>',
          '      <p id="formMessage" aria-live="polite"></p>',
          '    </section>',
          '  </main>',
          '  <footer>© 2026 Nexus Apex | Built by Matany Labs.</footer>',
          '  <script src="../script.js"></script>',
          '</body>',
          '</html>',
          '[[END_FILE]]'
        ].join('\n');

        const styleCss = [
          '[[START_FILE: style.css]]',
          ':root { --bg: #0c1118; --surface: #121b26; --text: #f3f7ff; --muted: #b8c4d6; --accent: #00a37a; }',
          '* { box-sizing: border-box; }',
          'body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; background: var(--bg); color: var(--text); }',
          '.site-header { display: flex; justify-content: space-between; padding: 1rem 1.25rem; background: var(--surface); }',
          '.site-header nav { display: flex; gap: 0.85rem; }',
          '.site-header a { color: var(--text); text-decoration: none; }',
          '.hero { max-width: 860px; margin: 3rem auto; padding: 0 1.25rem; }',
          '.btn { display: inline-block; padding: 0.7rem 1rem; border-radius: 8px; background: var(--accent); color: #052118; }',
          'form { display: grid; gap: 0.75rem; max-width: 420px; }',
          'input, button { min-height: 44px; border-radius: 8px; border: 1px solid #2a3a4e; padding: 0.6rem; }',
          '@media (max-width: 768px) { .site-header { flex-direction: column; gap: 0.75rem; } }',
          '[[END_FILE]]'
        ].join('\n');

        const scriptJs = [
          '[[START_FILE: script.js]]',
          '(function () {',
          '  function ready(fn) {',
          "    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);",
          '    else fn();',
          '  }',
          '  function isValidEmail(value) {',
          "    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(value || ''));",
          '  }',
          '  ready(function () {',
          "    var form = document.getElementById('contactForm');",
          "    var message = document.getElementById('formMessage');",
          '    if (!form) return;',
          "    form.addEventListener('submit', function (event) {",
          '      event.preventDefault();',
          "      var input = form.querySelector('input[type=\"email\"]');",
          '      var email = input ? input.value.trim() : "";',
          '      if (!isValidEmail(email)) {',
          "        if (message) message.textContent = 'Please enter a valid email.';",
          '        return;',
          '      }',
          "      if (message) message.textContent = 'Message sent successfully.';",
          '      form.reset();',
          '    });',
          '  });',
          '})();',
          '[[END_FILE]]'
        ].join('\n');

        writeSse('token', [siteMap, indexHtml, aboutHtml, contactHtml, styleCss, scriptJs].join('\n'));
        writeSse('status', 'done:Complete');
        res.end();
        return;
      }

      const indexHtml = [
        '[[START_FILE: index.html]]',
        '<!doctype html>',
        '<html lang=\"ar\">',
        '<head>',
        '  <meta charset=\"utf-8\" />',
        '  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />',
        '  <title>صفحة هبوط - Apex Coding</title>',
        '</head>',
        '<body>',
        '  <div id=\"root\"></div>',
        '  <script type=\"module\" src=\"/src/main.tsx\"></script>',
        '</body>',
        '</html>',
        '[[END_FILE]]'
      ].join('\n');

      const mainTsx = [
        '[[START_FILE: src/main.tsx]]',
        "import React from 'react';",
        "import ReactDOM from 'react-dom/client';",
        "import App from './App';",
        "import './styles.css';",
        "ReactDOM.createRoot(document.getElementById('root')!).render(",
        "  <React.StrictMode><App /></React.StrictMode>",
        ");",
        '[[END_FILE]]'
      ].join('\n');

      const heroTsx = [
        '[[START_FILE: src/components/Hero.tsx]]',
        "import React from 'react';",
        '',
        'export default function Hero() {',
        '  return (',
        '    <section className=\"hero\">',
        '      <div className=\"container\">',
        '        <h1 className=\"hero__title\">منصة بناء صفحات الهبوط بسرعة وذكاء</h1>',
        '        <p className=\"hero__subtitle\">حوّل أفكارك إلى صفحات هبوط احترافية خلال دقائق.</p>',
        '        <a href=\"#cta\" className=\"btn btn--primary\">ابدأ الآن</a>',
        '      </div>',
        '    </section>',
        '  );',
        '}',
        '[[END_FILE]]'
      ].join('\n');

      const featuresTsx = [
        '[[START_FILE: src/components/Features.tsx]]',
        "import React from 'react';",
        '',
        'export default function Features() {',
        '  return (',
        '    <section className=\"features\">',
        '      <div className=\"container\">',
        '        <div className=\"features__grid\">',
        '          <div className=\"card\">',
        '            <h3>سرعة</h3>',
        '            <p>ابدأ مشروعك فورًا مع هيكلة واضحة.</p>',
        '          </div>',
        '          <div className=\"card\">',
        '            <h3>تنظيم</h3>',
        '            <p>مكونات نظيفة وقابلة لإعادة الاستخدام.</p>',
        '          </div>',
        '          <div className=\"card\">',
        '            <h3>تجاوب</h3>',
        '            <p>تصميم يعمل بسلاسة على جميع الأجهزة.</p>',
        '          </div>',
        '        </div>',
        '      </div>',
        '    </section>',
        '  );',
        '}',
        '[[END_FILE]]'
      ].join('\n');

      const appTsx = [
        '[[START_FILE: src/App.tsx]]',
        "import React from 'react';",
        "import Hero from './components/Hero';",
        "import Features from './components/Features';",
        '',
        'export default function App() {',
        '  const onCta = () => {',
        "    console.log('CTA clicked');",
        '  };',
        '  return (',
        '    <div className=\"page\">',
        '      <header className=\"header\">',
        '        <div className=\"container header__row\">',
        '          <div className=\"brand\">Apex Coding</div>',
        '          <nav className=\"nav\">',
        '            <a href=\"#features\">المزايا</a>',
        '            <a href=\"#cta\">ابدأ</a>',
        '          </nav>',
        '        </div>',
        '      </header>',
        '      <main>',
        '        <Hero />',
        '        <div id=\"features\"><Features /></div>',
        '        <section id=\"cta\" className=\"cta\">',
        '          <div className=\"container\">',
        '            <h2>ابدأ الآن</h2>',
        '            <p>جرّب المنصة وأنشئ صفحتك خلال دقائق.</p>',
        '            <button className=\"btn btn--primary\" onClick={onCta}>ابدأ</button>',
        '          </div>',
        '        </section>',
        '      </main>',
        '      <footer className=\"footer\">',
        '        <div className=\"container\">',
        '          © 2026 Nexus Apex | Built by Matany Labs.',
        '        </div>',
        '      </footer>',
        '    </div>',
        '  );',
        '}',
        '[[END_FILE]]'
      ].join('\n');

      const stylesCss = [
        '[[START_FILE: src/styles.css]]',
        ':root {',
        '  --bg: #0B0F14;',
        '  --bg-2: #0F172A;',
        '  --text: #ffffff;',
        '  --muted: rgba(255,255,255,0.7);',
        '  --primary: #4F46E5;',
        '  --border: rgba(255,255,255,0.08);',
        '}',
        'html, body, #root { height: 100%; }',
        'body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; }',
        '.container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }',
        '.header { background: var(--bg-2); border-bottom: 1px solid var(--border); }',
        '.header__row { display: flex; justify-content: space-between; align-items: center; height: 64px; }',
        '.brand { font-weight: 700; letter-spacing: 0.5px; }',
        '.nav a { color: var(--muted); margin-left: 16px; text-decoration: none; }',
        '.nav a:hover { color: var(--text); }',
        '.hero { padding: 72px 0; text-align: center; }',
        '.hero__title { font-size: 42px; margin: 0 0 12px; }',
        '.hero__subtitle { color: var(--muted); margin: 0 auto 24px; max-width: 700px; }',
        '.btn { display: inline-block; padding: 12px 20px; border-radius: 10px; border: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; }',
        '.btn--primary { background: var(--primary); border-color: var(--primary); }',
        '.features { padding: 40px 0; }',
        '.features__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }',
        '.card { background: var(--bg-2); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }',
        '.cta { padding: 40px 0; text-align: center; }',
        '.footer { border-top: 1px solid var(--border); padding: 28px 0; text-align: center; color: var(--muted); }',
        '@media (max-width: 768px) {',
        '  .hero__title { font-size: 34px; }',
        '  .features__grid { grid-template-columns: 1fr; }',
        '}',
        '@media (max-width: 480px) {',
        '  .hero__title { font-size: 28px; }',
        '}',
        '[[END_FILE]]'
      ].join('\n');

      writeSse('token', indexHtml + '\n' + mainTsx + '\n' + heroTsx + '\n' + featuresTsx + '\n' + appTsx + '\n' + stylesCss);
      writeSse('status', 'done:Complete');
      res.end();
      return;
    }

    // Keep-alive while upstream is "thinking" before first token.
    let hasStartedStreaming = false;
    keepAliveTimer = setInterval(() => {
      if (hasStartedStreaming) return;
      try {
        writeSse('status', 'heartbeat:alive');
      } catch {
        // ignore
      }
    }, 10000);

    const abortController = new AbortController();
    abortTimer = setTimeout(() => {
      try {
        abortController.abort();
      } catch {
        // ignore
      }
    }, 180_000);

    const request = {
      model,
      temperature: 0.0,
      messages: [
        { role: 'system', content: CODE_STREAM_SYSTEM_PROMPT },
        { role: 'user', content: constrainedPrompt }
      ],
      stream: true,
      signal: abortController.signal
    };

    let provider;
    try {
      provider = getLLMProvider(executorRoute.provider);
    } catch {
      provider = getLLMProvider('deepseek');
    }
    const stream = provider.streamChatCompletion(request, { signal: abortController.signal });
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta || {};
      const contentChunk = delta?.content;
      if (typeof contentChunk !== 'string' || contentChunk.length === 0) continue;

      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        writeSse('status', 'streaming:Receiving tokens');
      }

      // Pipe directly (raw stream). Frontend consumes as a text stream.
      writeSse('token', contentChunk);
    }

    if (keepAliveTimer) clearInterval(keepAliveTimer);
    if (abortTimer) clearTimeout(abortTimer);
    writeSse('status', 'done:Complete');
    res.end();
  } catch (error) {
    const details = getErrorDetails(error);
    console.error(`[generate] [${req.requestId}] error=${details.message}`);
    try {
      writeSse('status', `error:${details.message}`);
    } catch {
      // ignore
    }
    res.end();
  } finally {
    if (keepAliveTimer) {
      try {
        clearInterval(keepAliveTimer);
      } catch {
        // ignore
      }
    }
    if (abortTimer) {
      try {
        clearTimeout(abortTimer);
      } catch {
        // ignore
      }
    }
  }
});

// Catch-all: explicit 404 (helps diagnose rewrites / 405 confusion on Vercel).
// This should be the last route handler before module.exports
app.all('*', (req, res) => {
  // Skip favicon and common static assets to reduce noise
  const path = req.path.toLowerCase();
  if (path.includes('favicon') || path.includes('.ico') || path.includes('.svg') || path.includes('.png') || path.includes('.jpg')) {
    return res.status(204).end();
  }
  
  console.log(`[fallback] 404 Not Found: ${req.method} ${req.url} [${req.requestId || 'no-id'}]`);
  res.status(404).json({ 
    error: 'Route not found', 
    code: 'NOT_FOUND',
    method: req.method, 
    url: req.url,
    requestId: req.requestId || 'unknown',
    hint: 'Check that the route exists and the HTTP method is correct'
  });
});

// Vercel requires exporting the app instance (no app.listen)
module.exports = app;
