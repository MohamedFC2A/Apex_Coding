// Vercel Serverless Function for /api/generate
const cors = require('cors');
require('dotenv').config();

const corsMiddleware = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

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

async function* deepSeekStreamChatCompletion(payload) {
  const { apiKey, baseURL } = getDeepSeekConfig();
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ ...payload, stream: true })
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
}

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

BRANDING: Include footer: © 2026 Nexus Apex | Built by Matany Labs.

REMEMBER: ONE CSS file, ONE JS file, proper structure, NEVER duplicate files.`.trim();

module.exports = async (req, res) => {
  await runMiddleware(req, res, corsMiddleware);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': keep-alive\n\n');

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

    const request = {
      model,
      temperature: 0.0,
      messages: [
        { role: 'system', content: CODE_STREAM_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      stream: true
    };

    const stream = deepSeekStreamChatCompletion(request);
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta || {};
      const contentChunk = delta?.content;
      if (typeof contentChunk !== 'string' || contentChunk.length === 0) continue;
      res.write(contentChunk);
    }

    res.end();
  } catch (error) {
    console.error('AI Generate Error:', error.message);
    res.end();
  }
};
