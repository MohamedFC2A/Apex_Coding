// backend/api/index.js (Vercel Serverless, CommonJS)
const express = require('express');
const cors = require('cors');
const OpenAIImport = require('openai');
require('dotenv').config();

const OpenAI = OpenAIImport.default || OpenAIImport;

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
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4) || '/';
  }

  next();
});

app.get('/', (_req, res) => {
  res.status(200).send('Apex Coding Backend is Running!');
});

const normalizeDeepSeekBaseUrl = (raw) => {
  const base = String(raw || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
};

const getClient = () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('API Key missing on Backend');
  const baseURL = normalizeDeepSeekBaseUrl(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com');
  return new OpenAI({ baseURL, apiKey });
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

File-Marker protocol:
[[START_FILE: path/to/file.ext]]
<full file contents>
[[END_FILE]]

Rules:
- Each file MUST start with [[START_FILE: ...]] on its own line.
- Each file MUST end with [[END_FILE]] on its own line.
- Include complete file contents (no placeholders).
- Never repeat a file unless explicitly asked to continue that SAME file from a given line.

If asked to resume a cut-off file at line N:
- Output [[START_FILE: that/path]] then continue EXACTLY from line N+1 (do not repeat earlier lines) then [[END_FILE]].
`.trim();

// /ai/plan (mapped from /api/ai/plan by the middleware above)
app.post('/ai/plan', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    console.log('[plan] Generating plan for prompt:', typeof prompt === 'string' ? prompt.slice(0, 500) : prompt);
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const client = getClient();
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
      completion = await client.chat.completions.create({
        ...request,
        response_format: { type: 'json_object' }
      });
    } catch {
      completion = await client.chat.completions.create(request);
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
app.post('/ai/generate', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.0,
      messages: [
        { role: 'system', content: CODE_JSON_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    const payload = cleanAndParseJSON(content);
    res.json(payload);
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('AI Generate Error:', details.message);
    res.status(500).json({ error: details.message });
  }
});

// /ai/generate-stream (mapped from /api/ai/generate-stream)
app.post('/ai/generate-stream', async (req, res) => {
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

  try {
    const { prompt, thinkingMode, includeReasoning } = req.body || {};
    if (!prompt) {
      res.status(400);
      writeStatus('error', 'Prompt is required');
      res.end();
      return;
    }

    const client = getClient();

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

    let stream;
    try {
      stream = await client.chat.completions.create(request);
    } catch {
      stream = await client.chat.completions.create(request);
    }

    const isReasoner = model === 'deepseek-reasoner';
    const wantReasoning = Boolean(includeReasoning) && isReasoner;

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta || {};
      const reasoningChunk = delta?.reasoning_content;
      const contentChunk = delta?.content;

      if (typeof reasoningChunk === 'string' && reasoningChunk.length > 0) {
        if (wantReasoning) writeSse('thought', reasoningChunk);
      }

      if (typeof contentChunk === 'string' && contentChunk.length > 0) {
        if (!hasStartedStreaming) {
          hasStartedStreaming = true;
          clearInterval(keepAliveTimer);
          writeStatus('streaming', 'Generating…');
        }

        writeSse('token', contentChunk);
      }
    }

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
  }
});

// Vercel requires exporting the app instance (no app.listen)
module.exports = app;
