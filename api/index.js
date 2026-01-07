// api/index.js (Vercel Serverless, CommonJS)
const express = require('express');
const cors = require('cors');
const JSZip = require('jszip');
require('dotenv').config();

const app = express();

// Open CORS completely (no cookies required for this app)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);
app.options('*', cors());

// Ensure basic CORS headers for all requests (including when proxies bypass some middleware).
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// When using Vercel rewrites to route /api/* to /api/index.js, the runtime may rewrite the path.
// Prefer the original URL headers when present.
app.use((req, _res, next) => {
  const candidate =
    req.headers['x-vercel-original-url'] ||
    req.headers['x-original-url'] ||
    req.headers['x-rewrite-url'] ||
    req.headers['x-forwarded-uri'];

  if (typeof candidate === 'string' && candidate.startsWith('/')) {
    req.url = candidate;
  }

  // Strip leading /api so routes can be declared once.
  if (req.url === '/api') {
    req.url = '/';
  }
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4) || '/';
  }

  next();
});

app.get('/', (_req, res) => {
  res.status(200).send('Apex Coding Backend is Running!');
});

// Unified /api handler (allows frontend to POST to `/api` and select an action).
// Supports: { action: 'plan' | 'generate', ... }
app.post(['/', '/api'], async (req, res, next) => {
  try {
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!action) return next();

    if (action === 'plan') {
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

// /download/zip (mapped from /api/download/zip by the middleware above)
app.post(['/download/zip', '/api/download/zip'], async (req, res) => {
  try {
    const { files } = req.body || {};
    if (!files) return res.status(400).json({ error: 'files is required' });

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
const PLAN_SYSTEM_PROMPT =
  "You are a Software Architect. Output ONLY raw JSON (no markdown, no code fences) with shape {\"title\":\"...\",\"steps\":[{\"id\":\"1\",\"title\":\"...\"}]}.";

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

const CODE_STREAM_SYSTEM_PROMPT = `
You are an expert full-stack code generator.
CRITICAL OUTPUT RULES (NON-NEGOTIABLE):
- Output MUST be plain text only (no JSON, no arrays, no markdown, no code fences).
- You MUST use the File-Marker protocol for EVERY file.
- No filler text. Output ONLY file markers and file contents.
- If you output any HTML (any *.html file), you MUST include this exact footer immediately before the closing </body> tag (even for Hello World):
<footer style="text-align: center; padding: 20px; font-size: 0.8rem; color: rgba(255,255,255,0.3); border-top: 1px solid rgba(255,255,255,0.1);">
  © 2026 Nexus Apex | Built by Matany Labs.
</footer>
- Every project MUST include the Nexus Apex footer in the main layout (React/TSX App component or HTML page).
- If the user asks for a "web app" or "dashboard", you MUST generate a Next.js (App Router) + TypeScript + Tailwind project.
- Follow the Atomic Structure: src/components/, src/hooks/, src/services/, and convex/.
- If the project needs a database/auth/chat/data storage, you MUST integrate Convex:
  - Add convex to package.json.
  - Create a convex/ folder with schema + functions.
  - Wrap the app with ConvexProvider.
- Ensure package.json scripts include: { "dev": "next dev" } for Next.js projects.

File-Marker protocol:
[[START_FILE: path/to/file.ext]]
<full file contents>
[[END_FILE]]

Edit protocol (preferred for fixes):
[[EDIT_NODE: path/to/file.ext]]
<MINIMAL edits only. Prefer SEARCH/REPLACE blocks. Do NOT paste entire files unless absolutely necessary.>
[[END_FILE]]

Optional search/replace blocks (only inside [[EDIT_NODE]]):
[[EDIT_NODE: path/to/file.ext]]
[[SEARCH]]
<exact text to find>
[[REPLACE]]
<replacement text>
[[END_EDIT]]
[[END_FILE]]

Rules:
- Each file MUST start with [[START_FILE: ...]] on its own line.
- Each file MUST end with [[END_FILE]] on its own line.
- Include complete file contents (no placeholders).
- Never repeat a file unless explicitly asked to continue that SAME file from a given line.
- When modifying an existing file, use [[EDIT_NODE: ...]] instead of [[START_FILE: ...]].

If asked to resume a cut-off file at line N:
- Output [[START_FILE: that/path]] then continue EXACTLY from line N+1 (do not repeat earlier lines) then [[END_FILE]].
`.trim();

// /ai/plan (mapped from /api/ai/plan by the middleware above)
app.post('/ai/plan', async (req, res) => {
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
              return title ? { id: String(index + 1), title } : null;
            }
            const title = String(step?.title ?? step?.text ?? step?.step ?? '').trim();
            if (!title) return null;
            return { id: String(step?.id ?? index + 1), title };
          })
          .filter(Boolean)
      : [];

    const title = typeof parsed?.title === 'string' ? parsed.title : 'Architecture Plan';
    res.json({ title, steps });
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('AI Plan Error:', details.message);
    res.status(500).json({
      error: details.message,
      title: 'Plan Generation Failed',
      steps: [{ id: '1', title: 'Error parsing AI response. Please try again.' }]
    });
  }
});

// /ai/generate (mapped from /api/ai/generate)
// /generate (mapped from /api/generate)
// Live streaming (no job queue): pipes model output directly to the client.
app.post(['/ai/generate', '/generate'], async (req, res) => {
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

const handleGenerateStream = async (req, res) => {
  // 1. Force headers to prevent Vercel from buffering or closing the connection
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // CRITICAL for Vercel
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const writeSse = (event, data) => {
    res.write(`event: ${event}\n`);
    const text = String(data ?? '');
    const lines = text.split('\n');
    for (const line of lines) {
      res.write(`data: ${line}\n`);
    }
    res.write('\n');
  };

  const writeStatus = (phase, message) => writeSse('status', `${phase}:${message || ''}`);

  // 2. IMMEDIATE Keep-Alive Payload
  res.write(': keep-alive\n\n');

  let keepAliveTimer = null;
  let abortTimer = null;
  let tokenFlushTimer = null;
  let thoughtFlushTimer = null;

  try {
    const { prompt, thinkingMode, includeReasoning } = req.body || {};
    if (!prompt) {
      res.status(400);
      writeStatus('error', 'Prompt is required');
      res.end();
      return;
    }

    const model = thinkingMode
      ? (process.env.DEEPSEEK_THINKING_MODEL || 'deepseek-reasoner')
      : (process.env.DEEPSEEK_MODEL || 'deepseek-chat');

    writeSse('meta', `provider=deepseek;model=${model};thinkingMode=${Boolean(thinkingMode)}`);
    writeStatus(thinkingMode ? 'thinking' : 'streaming', thinkingMode ? 'Thinking…' : 'Generating…');

    // Keep-alive while the upstream model is still "thinking" (before first token).
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
      messages: [
        { role: 'system', content: CODE_STREAM_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      stream: true,
      signal: abortController.signal
    };

    const stream = deepSeekStreamChatCompletion(request, { signal: abortController.signal });

    const isReasoner = model === 'deepseek-reasoner';
    const wantReasoning = Boolean(includeReasoning) && isReasoner;

    // Buffer small deltas to reduce fragmented delivery / aborted requests.
    let tokenBuffer = '';
    let thoughtBuffer = '';
    const flushTokenBuffer = () => {
      if (!tokenBuffer) return;
      writeSse('token', tokenBuffer);
      tokenBuffer = '';
    };
    const flushThoughtBuffer = () => {
      if (!thoughtBuffer) return;
      if (wantReasoning) writeSse('thought', thoughtBuffer);
      thoughtBuffer = '';
    };
    const scheduleTokenFlush = () => {
      if (tokenFlushTimer) return;
      tokenFlushTimer = setTimeout(() => {
        tokenFlushTimer = null;
        try {
          flushTokenBuffer();
        } catch {
          // ignore
        }
      }, 20);
    };
    const scheduleThoughtFlush = () => {
      if (thoughtFlushTimer) return;
      thoughtFlushTimer = setTimeout(() => {
        thoughtFlushTimer = null;
        try {
          flushThoughtBuffer();
        } catch {
          // ignore
        }
      }, 30);
    };

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta || {};
      const reasoningChunk = delta?.reasoning_content;
      const contentChunk = delta?.content;

      if (typeof reasoningChunk === 'string' && reasoningChunk.length > 0) {
        thoughtBuffer += reasoningChunk;
        if (thoughtBuffer.length > 2200) flushThoughtBuffer();
        else scheduleThoughtFlush();
      }

      if (typeof contentChunk === 'string' && contentChunk.length > 0) {
        if (!hasStartedStreaming) {
          hasStartedStreaming = true;
          clearInterval(keepAliveTimer);
          writeStatus('streaming', 'Generating…');
        }

        tokenBuffer += contentChunk;
        if (tokenBuffer.length > 4096) flushTokenBuffer();
        else scheduleTokenFlush();
      }
    }

    if (tokenFlushTimer) clearTimeout(tokenFlushTimer);
    if (thoughtFlushTimer) clearTimeout(thoughtFlushTimer);
    flushThoughtBuffer();
    flushTokenBuffer();

    if (keepAliveTimer) clearInterval(keepAliveTimer);
    if (abortTimer) clearTimeout(abortTimer);
    writeStatus('done', 'Complete');
    res.end();
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('Streaming error:', details.message);
    try {
      writeStatus('error', details.message);
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
    if (tokenFlushTimer) {
      try {
        clearTimeout(tokenFlushTimer);
      } catch {
        // ignore
      }
    }
    if (thoughtFlushTimer) {
      try {
        clearTimeout(thoughtFlushTimer);
      } catch {
        // ignore
      }
    }
  }
};

// /ai/generate-stream (mapped from /api/ai/generate-stream)
app.post('/ai/generate-stream', handleGenerateStream);

// /ai/chat (mapped from /api/ai/chat)
app.post('/ai/chat', handleGenerateStream);

// Catch-all: explicit 404 (helps diagnose rewrites / 405 confusion on Vercel).
app.all('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Vercel requires exporting the app instance (no app.listen)
module.exports = app;
