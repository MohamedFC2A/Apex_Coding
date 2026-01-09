// api/index.js (Vercel Serverless, CommonJS)
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// DEBUG: Log every request immediately
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Incoming: ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers));
  next();
});

// Open CORS completely
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Handle preflight for all routes
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
const PLAN_SYSTEM_PROMPT = `You are an Elite Software Architect AI with deep expertise in ALL programming languages, frameworks, and technologies.

Your task is to analyze the user's request and create a PERFECT, COMPREHENSIVE implementation plan.

CRITICAL RULES:
1. Output ONLY raw JSON (no markdown, no code fences)
2. JSON shape: {"title":"...","description":"...","stack":"...","fileTree":[...],"steps":[{"id":"1","title":"...","category":"...","files":[...],"description":"..."}]}
3. Analyze the request deeply - understand EXACTLY what the user wants
4. Create a COMPLETE file tree showing ALL files that will be created
5. Each step must have: id, title, category (frontend/backend/config/testing/deployment), files array, description
6. Steps should be in logical order of implementation
7. Be SPECIFIC - don't say "Create components", say "Create Header component with navigation links"

STACK DETECTION:
- Detect the best technology stack based on user request
- For web apps: Next.js + TypeScript + Tailwind + Convex (if database needed)
- For static sites: HTML + CSS + JS
- For APIs: Node.js + Express
- For Python projects: Flask/FastAPI
- Always choose the BEST stack for the project

FILE TREE FORMAT:
- List ALL files with full paths: ["package.json", "src/App.tsx", "src/components/Header.tsx", ...]
- Include ALL necessary files: configs, components, pages, styles, utils, types, etc.

STEP CATEGORIES:
- "config": Setup, configuration, dependencies
- "frontend": UI components, pages, layouts, styles
- "backend": API routes, server logic, database
- "integration": Connecting frontend to backend
- "testing": Tests and validation
- "deployment": Build and deploy setup

EXAMPLE OUTPUT:
{
  "title": "E-commerce Dashboard",
  "description": "A modern e-commerce admin dashboard with product management, analytics, and user management",
  "stack": "Next.js 14, TypeScript, Tailwind CSS, Convex, Lucide Icons",
  "fileTree": [
    "package.json",
    "tsconfig.json",
    "tailwind.config.js",
    "next.config.js",
    "convex/schema.ts",
    "convex/products.ts",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/components/Sidebar.tsx",
    "src/components/ProductTable.tsx"
  ],
  "steps": [
    {"id":"1","title":"Initialize Next.js project with TypeScript and Tailwind","category":"config","files":["package.json","tsconfig.json","tailwind.config.js","next.config.js"],"description":"Set up the project foundation with all dependencies"},
    {"id":"2","title":"Create Convex schema and database functions","category":"backend","files":["convex/schema.ts","convex/products.ts"],"description":"Define database schema and CRUD operations"},
    {"id":"3","title":"Build main layout with sidebar navigation","category":"frontend","files":["src/app/layout.tsx","src/components/Sidebar.tsx"],"description":"Create the dashboard layout structure"},
    {"id":"4","title":"Create product management components","category":"frontend","files":["src/components/ProductTable.tsx","src/app/page.tsx"],"description":"Build the product listing and management UI"}
  ]
}

Now analyze the user's request and create the PERFECT implementation plan.`.trim();

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
   - script.js (ALL JavaScript in ONE file)
   - NO nested folders for simple sites
   
   For React/Next.js:
   - package.json
   - src/App.tsx (main component)
   - src/index.tsx (entry point)
   - src/styles/globals.css (ONE CSS file)
   - src/components/ (components folder)

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
[[END_FILE]]

BRANDING: Include footer: © 2026 Nexus Apex | Built by Matany Labs.

REMEMBER: ONE CSS file, ONE JS file, proper structure, NEVER duplicate files.`.trim();

// /ai/plan (mapped from /api/ai/plan by the middleware above)
// Using regex to reliably match both /ai/plan and /api/ai/plan regardless of Vercel rewrites
const planRouteRegex = /\/api\/ai\/plan|\/ai\/plan/;

app.options(planRouteRegex, cors());

app.post(planRouteRegex, async (req, res) => {
  try {
    const { prompt } = req.body || {};
    console.log('[plan] Generating plan for prompt:', typeof prompt === 'string' ? prompt.slice(0, 500) : prompt);
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const request = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.0,
      messages: [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    };

    let completion;
    try {
      completion = await deepSeekCreateChatCompletion({
        ...request,
        response_format: { type: 'json_object' }
      });
    } catch {
      completion = await deepSeekCreateChatCompletion(request);
    }

    let content = completion?.choices?.[0]?.message?.content || '';
    console.log('[plan] Raw AI output preview:', String(content).slice(0, 800));

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
    const description = typeof parsed?.description === 'string' ? parsed.description : '';
    const stack = typeof parsed?.stack === 'string' ? parsed.stack : '';
    const fileTree = Array.isArray(parsed?.fileTree) ? parsed.fileTree : [];

    res.json({ title, description, stack, fileTree, steps });
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('AI Plan Error:', details.message);
    res.status(500).json({
      error: details.message,
      title: 'Plan Generation Failed',
      steps: [{ id: '1', title: 'Error parsing AI response. Please try again.', category: 'config', files: [], description: '' }]
    });
  }
});

// /generate (mapped from /api/generate)
// Live streaming (no job queue): pipes model output directly to the client.
const generateRouteRegex = /\/api\/ai\/generate|\/ai\/generate|\/api\/generate|\/generate/;

app.options(generateRouteRegex, cors());

app.post(generateRouteRegex, async (req, res) => {
  // Force headers to prevent buffering and keep the connection open.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // Immediate heartbeat so the client sees the stream right away.
  res.write(': keep-alive\n\n');

  let keepAliveTimer = null;
  let abortTimer = null;

  try {
    const { prompt, thinkingMode } = req.body || {};
    if (!prompt) {
      res.write('Missing prompt');
      res.end();
      return;
    }

    const model = thinkingMode
      ? (process.env.DEEPSEEK_THINKING_MODEL || 'deepseek-reasoner')
      : (process.env.DEEPSEEK_MODEL || 'deepseek-chat');

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
    }, 55000);

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

    const stream = deepSeekStreamChatCompletion(request, { signal: abortController.signal });
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
    console.error('AI Generate Error:', details.message);
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
