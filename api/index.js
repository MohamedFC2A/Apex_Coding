// api/index.js (Vercel Serverless, CommonJS)
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { requestIdMiddleware } = require('./middleware/requestId');
const { createRateLimiter } = require('./middleware/rateLimit');
const { parseAllowedOrigins } = require('./utils/security');

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
const defaultDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'];
const vercelOrigin = process.env.VERCEL_URL ? `https://${String(process.env.VERCEL_URL).trim()}` : null;
const effectiveOrigins = allowedOrigins.length > 0 ? allowedOrigins : [...defaultDevOrigins, vercelOrigin].filter(Boolean);

const corsOptionsDelegate = (req, callback) => {
  const origin = String(req.headers.origin || '').trim();
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'];

  if (!origin) return callback(null, { origin: true, methods, allowedHeaders, credentials: false });

  let allowed = false;
  try {
    const o = new URL(origin);
    const host = String(req.headers.host || '').trim();
    if (host && o.host === host) allowed = true;
    if (!allowed && o.host.endsWith('vercel.app')) allowed = true;
    if (!allowed && o.host.endsWith('.replit.dev')) allowed = true;
    if (!allowed && o.host.endsWith('.repl.co')) allowed = true;
  } catch {}

  if (!allowed && effectiveOrigins.includes('*')) allowed = true;
  if (!allowed && effectiveOrigins.includes(origin)) allowed = true;

  const opts = { origin: allowed, methods, allowedHeaders, credentials: false };
  if (allowed) return callback(null, opts);
  return callback(new Error('CORS_NOT_ALLOWED'), opts);
};

app.use(cors(corsOptionsDelegate));

// Handle preflight for all routes
app.options('*', cors(corsOptionsDelegate));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((err, req, res, next) => {
  if (err && err.message === 'CORS_NOT_ALLOWED') {
    res.status(403).json({ error: 'CORS not allowed', requestId: req.requestId });
    return;
  }
  next(err);
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
// Preview Runner proxy (Vercel)
// ================================
const normalizePreviewRunnerUrl = (raw) => String(raw || '').trim().replace(/\/+$/, '');

const getPreviewRunnerConfig = () => {
  const baseUrl = normalizePreviewRunnerUrl(process.env.PREVIEW_RUNNER_URL);
  const token = String(process.env.PREVIEW_RUNNER_TOKEN || '').trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
};

const proxyToPreviewRunner = async (req, res, { method, url, body }) => {
  const config = getPreviewRunnerConfig();
  if (!config) {
    return res.status(500).json({
      error: 'Preview runner is not configured',
      missing: ['PREVIEW_RUNNER_URL', 'PREVIEW_RUNNER_TOKEN'].filter((k) => !String(process.env[k] || '').trim()),
      requestId: req.requestId
    });
  }

  const controller = new AbortController();
  const timeoutMs = 25_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(`${config.baseUrl}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const text = await upstream.text().catch(() => '');

    if (upstream.status === 401 || upstream.status === 403) {
      return res.status(upstream.status).json({
        error: 'Unauthorized from preview runner',
        hint:
          'PREVIEW_RUNNER_TOKEN mismatch. Ensure Vercel env PREVIEW_RUNNER_TOKEN exactly matches the preview-runner env PREVIEW_RUNNER_TOKEN (no quotes/spaces), then redeploy Vercel and restart preview-runner.',
        requestId: req.requestId
      });
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (err) {
    const message = String(err?.name === 'AbortError' ? 'Preview runner timeout' : err?.message || err || 'Preview runner error');
    return res.status(502).json({
      error: message,
      hint:
        'Preview runner is unreachable. Local dev: run `cd preview-runner && docker compose up -d` and set PREVIEW_RUNNER_URL=http://localhost:8080. Vercel: PREVIEW_RUNNER_URL must be a public URL (not localhost).',
      requestId: req.requestId
    });
  } finally {
    clearTimeout(timer);
  }
};

const joinUrlPath = (baseUrl, path) => {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const p = String(path || '');
  if (!base) return p;
  if (!p) return base;
  if (p.startsWith('/')) return `${base}${p}`;
  return `${base}/${p}`;
};

const rewritePreviewSessionUrl = (runnerBaseUrl, maybeUrl) => {
  const raw = String(maybeUrl || '').trim();
  if (!raw) return raw;

  if (raw.startsWith('/')) return joinUrlPath(runnerBaseUrl, raw);

  try {
    const parsed = new URL(raw);
    const pathAndQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return joinUrlPath(runnerBaseUrl, pathAndQuery);
  } catch {
    return raw;
  }
};

app.post(['/preview/sessions', '/api/preview/sessions'], async (req, res) => {
  const config = getPreviewRunnerConfig();
  if (!config) {
    return res.status(500).json({
      error: 'Preview runner is not configured',
      missing: ['PREVIEW_RUNNER_URL', 'PREVIEW_RUNNER_TOKEN'].filter((k) => !String(process.env[k] || '').trim()),
      requestId: req.requestId
    });
  }

  const controller = new AbortController();
  const timeoutMs = 25_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(`${config.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`
      },
      body: JSON.stringify(req.body || {}),
      signal: controller.signal
    });

    const text = await upstream.text().catch(() => '');
    const contentType = upstream.headers.get('content-type') || 'application/json';

    if (upstream.status === 401 || upstream.status === 403) {
      return res.status(upstream.status).json({
        error: 'Unauthorized from preview runner',
        hint:
          'PREVIEW_RUNNER_TOKEN mismatch. Ensure Vercel env PREVIEW_RUNNER_TOKEN exactly matches the preview-runner env PREVIEW_RUNNER_TOKEN (no quotes/spaces), then redeploy Vercel and restart preview-runner.',
        requestId: req.requestId
      });
    }

    if (!upstream.ok) {
      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      return res.send(text);
    }

    // Ensure preview URL is reachable from the client by anchoring it to PREVIEW_RUNNER_URL.
    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && typeof data.url === 'string') {
          data.url = rewritePreviewSessionUrl(config.baseUrl, data.url);
          res.status(upstream.status);
          res.setHeader('Content-Type', 'application/json');
          return res.send(JSON.stringify(data));
        }
      } catch {
        // fall through
      }
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    return res.send(text);
  } catch (err) {
    const message = String(err?.name === 'AbortError' ? 'Preview runner timeout' : err?.message || err || 'Preview runner error');
    return res.status(502).json({
      error: message,
      hint:
        'Preview runner is unreachable. Local dev: run `cd preview-runner && docker compose up -d` and set PREVIEW_RUNNER_URL=http://localhost:8080. Vercel: PREVIEW_RUNNER_URL must be a public URL (not localhost).',
      requestId: req.requestId
    });
  } finally {
    clearTimeout(timer);
  }
});

app.get(['/preview/sessions/:id', '/api/preview/sessions/:id'], async (req, res) => {
  const id = String(req.params.id || '').trim();
  return proxyToPreviewRunner(req, res, { method: 'GET', url: `/api/sessions/${encodeURIComponent(id)}` });
});

app.patch(['/preview/sessions/:id', '/api/preview/sessions/:id'], async (req, res) => {
  const id = String(req.params.id || '').trim();
  return proxyToPreviewRunner(req, res, { method: 'PATCH', url: `/api/sessions/${encodeURIComponent(id)}/files`, body: req.body });
});

app.delete(['/preview/sessions/:id', '/api/preview/sessions/:id'], async (req, res) => {
  const id = String(req.params.id || '').trim();
  return proxyToPreviewRunner(req, res, { method: 'DELETE', url: `/api/sessions/${encodeURIComponent(id)}` });
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

const getLLMProvider = () => {
  const name = String(process.env.LLM_PROVIDER || 'deepseek').trim().toLowerCase();
  if (name === 'deepseek') {
    return {
      name,
      createChatCompletion: deepSeekCreateChatCompletion,
      streamChatCompletion: deepSeekStreamChatCompletion
    };
  }
  throw new Error(`Unsupported LLM provider: ${name}`);
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

// Prompts
const PLAN_SYSTEM_PROMPT = `You are an Elite Software Architect + Product Designer.

You must produce an execution-grade implementation plan for the EXISTING repository.

CRITICAL OUTPUT RULES:
1. Output ONLY raw JSON (no markdown, no code fences, no extra text).
2. JSON shape exactly:
   {"title":"...","description":"...","stack":"...","fileTree":[...],"steps":[{"id":"1","title":"...","category":"...","files":[...],"description":"..."}]}
3. Steps MUST be executable, specific, and ordered. Total steps: 4 to 8.
4. Categories allowed: config, frontend, backend, integration, testing, deployment.
5. Prefer editing existing files over creating new files.
6. Do NOT create .md/.txt documentation files unless absolutely necessary.
7. Do NOT propose switching to a different stack unless the user explicitly requests it.
8. ALWAYS generate real code (JavaScript/TypeScript) for functionality, not just comments.
9. MANDATORY: Every web project MUST include a JavaScript file (e.g., script.js, main.js, or main.tsx) to ensure interactivity. HTML/CSS alone is NOT sufficient.

REPO CONSTRAINTS (do not contradict these):
- Frontend is Vite + React + TypeScript (not Next). Use import.meta.env with VITE_ variables.
- Styling uses styled-components and Tailwind already; reuse existing patterns.
- State uses Zustand already; reuse existing stores.
- Backend is Node.js + Express (Vercel-style app in api/index.js).

PLAN QUALITY REQUIREMENTS:
- fileTree must list ALL files that will be created or modified (full paths).
- Each step description MUST include three labeled sections:
  Changes: concise bullet-like sentences describing exact edits.
  Acceptance: what must be true to consider the step done.
  Rollback: how to revert this step safely.
- Include a concise UI spec inside relevant frontend steps (colors/spacing/states: empty/loading/error).
- Security: never log secrets; avoid leaking Authorization/Cookie; keep CORS explicit.
- IMPORTANT: Break down complex tasks into smaller, manageable steps, but keep the total count low (max 8).

Now analyze the user's request and output the plan JSON.`.trim();

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

1. FILE DUPLICATION IS FORBIDDEN:
   - NEVER create the same file twice (e.g., styles.css in two locations)
   - NEVER create duplicate CSS/JS files
   - If a file exists, use [[EDIT_NODE:]] to modify it, NEVER [[START_FILE:]]
   - ONE styles.css, ONE main.js/app.js, ONE index.html

2. PROJECT STRUCTURE - STRICT:
   For static HTML sites:
   - index.html (main HTML with all structure)
   - styles.css (ALL CSS in ONE file)
   - script.js (ALL JavaScript in ONE file - MANDATORY)
   - NO nested folders for simple sites
   
   For React + Vite:
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
   - YOU MUST OUTPUT ALL 3 CORE FILES (HTML, CSS, JS) FOR STATIC SITES IN A SINGLE RESPONSE.
   - DO NOT STOP AFTER THE FIRST FILE.

6. ANTI-LAZINESS RULES:
   - Do NOT be lazy. Write the FULL code.
   - Do NOT say "Add more code here". Write it.
   - If the user asks for a landing page, build the WHOLE landing page (Hero, Features, Footer, etc).
   - A single HTML file is a FAILURE. You MUST split code into logical files.

7. FRONTEND EXCELLENCE STANDARDS (MANDATORY):
   - Mobile-First: Always build for mobile first, then scale up using media queries.
   - Fluid & Responsive: Use fluid grids, flexbox/grid, and relative units (rem/em/%) instead of fixed px.
   - Touch-Optimized: Buttons/inputs must be touch-friendly (min 44px height).
   - Accessibility-First: Use semantic HTML, proper contrast, and ARIA labels.
   - Cross-Browser: Ensure code works on Chrome, Firefox, Safari, and Edge.
   - Performance: Optimize images, minimize reflows, and use efficient CSS selectors.
   - Device-Agnostic: Ensure consistent experience across phones, tablets, and desktops.

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

STATIC SITE EXAMPLE (correct structure):
[[START_FILE: index.html]]
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Site</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- content -->
  <script src="script.js"></script>
</body>
</html>
[[END_FILE]]

[[START_FILE: styles.css]]
/* ALL styles in ONE file */
[[END_FILE]]

[[START_FILE: script.js]]
// ALL JavaScript in ONE file
document.addEventListener('DOMContentLoaded', () => {
    console.log('App loaded');
});
[[END_FILE]]

BRANDING: Include footer: © 2026 Nexus Apex | Built by Matany Labs.

REMEMBER: ONE CSS file, ONE JS file, proper structure, NEVER duplicate files. WRITE REAL CODE.`.trim();

// /ai/plan (mapped from /api/ai/plan by the middleware above)
// Using regex to reliably match both /ai/plan and /api/ai/plan regardless of Vercel rewrites
const planRouteRegex = /^\/api\/ai\/plan|^\/ai\/plan/;

app.options(planRouteRegex, cors(corsOptionsDelegate));

const planLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

app.post(planRouteRegex, planLimiter, async (req, res) => {
  console.log(`[plan] [${req.requestId}] Received request`);
  try {
    const { prompt, thinkingMode } = req.body || {};
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.log(`[plan] [${req.requestId}] Error: Prompt is required`);
      return res.status(400).json({ error: 'Prompt is required', requestId: req.requestId });
    }
    if (prompt.length > 30_000) {
      console.log(`[plan] [${req.requestId}] Error: Prompt is too long`);
      return res.status(400).json({ error: 'Prompt is too long', requestId: req.requestId });
    }
    console.log(`[plan] [${req.requestId}] prompt_length=${prompt.length}`);

    // Fallback plan when AI provider is not configured (demo mode)
    if (!process.env.DEEPSEEK_API_KEY) {
      console.log(`[plan] [${req.requestId}] Warning: DEEPSEEK_API_KEY is missing, using fallback`);
      const title = 'Landing Page (React + Vite)';
      const description = 'بناء صفحة هبوط عربية حديثة باستخدام React + Vite مع أقسام Hero و Features و CTA بتصميم متجاوب وبهيكلة واضحة.';
      const stack = 'react-vite';
      const fileTree = [
        'index.html',
        'src/main.tsx',
        'src/App.tsx',
        'src/components/Hero.tsx',
        'src/components/Features.tsx',
        'src/styles.css'
      ];
      const steps = [
        { id: '1', title: 'تهيئة index.html', category: 'config', files: ['index.html'], description: 'ملف HTML رئيسي يحمّل تطبيق React' },
        { id: '2', title: 'إنشاء نقطة دخول main.tsx', category: 'frontend', files: ['src/main.tsx'], description: 'تركيب ReactDOM وربط App' },
        { id: '3', title: 'تنظيم هيكل App.tsx', category: 'frontend', files: ['src/App.tsx'], description: 'صفحة هبوط تضم Hero و Features و Footer' },
        { id: '4', title: 'إضافة مكوّن Hero', category: 'frontend', files: ['src/components/Hero.tsx'], description: 'قسم ترحيبي وعنوان قوي وزر CTA' },
        { id: '5', title: 'إضافة مكوّن Features', category: 'frontend', files: ['src/components/Features.tsx'], description: 'عرض مزايا مختصرة ثلاثية' },
        { id: '6', title: 'إعداد أنماط أساسية', category: 'frontend', files: ['src/styles.css'], description: 'ألوان، مسافات، شبكة، خط' },
        { id: '7', title: 'تصميم متجاوب', category: 'frontend', files: ['src/styles.css'], description: 'وسائط 768px و480px لتعديل التخطيط' },
        { id: '8', title: 'دمج الهوية السفلية', category: 'frontend', files: ['src/App.tsx'], description: 'تذييل بعلامة © 2026 Nexus Apex | Built by Matany Labs.' },
        { id: '9', title: 'سلوك زر CTA', category: 'frontend', files: ['src/App.tsx'], description: 'معالجة نقر بسيطة (console أو تنقل لاحقًا)' },
        { id: '10', title: 'اختبار المتصفح', category: 'testing', files: [], description: 'فتح الصفحة والتأكد من الاستجابة والسلوك' },
        { id: '11', title: 'تحسين الأداء البسيط', category: 'frontend', files: ['src/styles.css'], description: 'تقليل الظلال والتحريك للحجم' },
        { id: '12', title: 'نشر على Vercel', category: 'deployment', files: [], description: 'يتولّى Vercel البناء من dist تلقائيًا' }
      ];
      return res.json({ title, description, stack, fileTree, steps, requestId: req.requestId });
    }

    const TIMEOUT_MS = thinkingMode ? 290_000 : 110_000;

    const request = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.0,
      messages: [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    };

    let completion;
    const provider = getLLMProvider();
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
      const stack = 'react-vite';
      const fileTree = ['index.html', 'src/main.tsx', 'src/App.tsx', 'src/styles.css'];
      const steps = [
        { id: '1', title: 'تهيئة index.html', category: 'config', files: ['index.html'], description: '' },
        { id: '2', title: 'إنشاء main.tsx', category: 'frontend', files: ['src/main.tsx'], description: '' },
        { id: '3', title: 'إنشاء App.tsx', category: 'frontend', files: ['src/App.tsx'], description: '' },
        { id: '4', title: 'إضافة styles.css', category: 'frontend', files: ['src/styles.css'], description: '' }
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

app.options(generateRouteRegex, cors(corsOptionsDelegate));

const generateLimiter = createRateLimiter({ windowMs: 60_000, max: 15 });

app.post(generateRouteRegex, generateLimiter, async (req, res) => {

  let keepAliveTimer = null;
  let abortTimer = null;

  try {
    const { prompt, thinkingMode } = req.body || {};
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).send('Prompt is required');
      return;
    }
    if (prompt.length > 80_000) {
      res.status(400).send('Prompt is too long');
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('x-request-id', req.requestId);
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    res.write(': keep-alive\n\n');

    const model = thinkingMode
      ? (process.env.DEEPSEEK_THINKING_MODEL || 'deepseek-reasoner')
      : (process.env.DEEPSEEK_MODEL || 'deepseek-chat');

    // Fallback streaming when AI provider is not configured (demo mode)
    if (!process.env.DEEPSEEK_API_KEY) {
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

      res.write(indexHtml + '\n' + mainTsx + '\n' + heroTsx + '\n' + featuresTsx + '\n' + appTsx + '\n' + stylesCss);
      res.write('\n\n');
      res.end();
      return;
    }

    // Keep-alive while upstream is "thinking" before first token.
    let hasStartedStreaming = false;
    keepAliveTimer = setInterval(() => {
      if (hasStartedStreaming) return;
      try {
        res.write(': keep-alive\n\n');
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
        { role: 'user', content: prompt }
      ],
      stream: true,
      signal: abortController.signal
    };

    const provider = getLLMProvider();
    const stream = provider.streamChatCompletion(request, { signal: abortController.signal });
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta || {};
      const contentChunk = delta?.content;
      if (typeof contentChunk !== 'string' || contentChunk.length === 0) continue;

      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        if (keepAliveTimer) clearInterval(keepAliveTimer);
      }

      // Pipe directly (raw stream). Frontend consumes as a text stream.
      res.write(contentChunk);
    }

    if (keepAliveTimer) clearInterval(keepAliveTimer);
    if (abortTimer) clearTimeout(abortTimer);
    res.end();
  } catch (error) {
    const details = getErrorDetails(error);
    console.error(`[generate] [${req.requestId}] error=${details.message}`);
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
app.all('*', (req, res) => {
  console.log(`[fallback] 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found', method: req.method, url: req.url });
});

// Vercel requires exporting the app instance (no app.listen)
module.exports = app;
