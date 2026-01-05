// backend/server.js (Vercel Serverless, CommonJS)
// Monolithic server to avoid ESM/dist path issues on Vercel.
const express = require('express');
const cors = require('cors');
const OpenAIImport = require('openai');
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req, res) => {
  res.status(200).send('Apex Coding Backend is Running!');
});

const OpenAI = OpenAIImport.default || OpenAIImport;

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

const writeSse = (res, eventName, data) => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// 2. AI Plan Route
app.post('/api/ai/plan', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    console.log('[plan] Generating plan for prompt:', typeof prompt === 'string' ? prompt.slice(0, 500) : prompt);
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const client = getClient();
    const request = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.0,
      messages: [
        {
          role: 'system',
          content:
            "You are a Software Architect. Output ONLY raw JSON (no markdown, no code fences) with shape {\"title\":\"...\",\"steps\":[{\"id\":\"1\",\"title\":\"...\"}]}."
        },
        { role: 'user', content: prompt }
      ]
    };

    let completion;
    try {
      completion = await client.chat.completions.create({
        ...request,
        response_format: { type: 'json_object' }
      });
    } catch (err) {
      // Some OpenAI-compatible endpoints may not support response_format
      completion = await client.chat.completions.create(request);
    }

    let content = completion?.choices?.[0]?.message?.content || '';
    console.log('[plan] Raw AI output preview:', String(content).slice(0, 800));

    // Sanitize markdown fences if the model wraps JSON.
    content = String(content)
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

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
    // Fallback plan instead of crashing
    res.status(500).json({
      error: details.message,
      title: 'Plan Generation Failed',
      steps: [{ id: '1', title: 'Error parsing AI response. Please try again.' }]
    });
  }
});

const CODE_SYSTEM_PROMPT = `
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

// 3. Non-streaming generate (optional)
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.0,
      messages: [
        { role: 'system', content: CODE_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    const payload = cleanAndParseJSON(content);
    res.json(payload);
  } catch (error) {
    console.error('AI Generate Error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Generation failed' });
  }
});

// 4. Streaming generate (SSE) with keep-alive comments to prevent Vercel idle aborts.
app.post('/api/ai/generate-stream', async (req, res) => {
  try {
    const { prompt, thinkingMode, includeReasoning } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const client = getClient();

    // Vercel streaming headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const model = thinkingMode
      ? (process.env.DEEPSEEK_THINKING_MODEL || 'deepseek-reasoner')
      : (process.env.DEEPSEEK_MODEL || 'deepseek-chat');

    const ac = new AbortController();
    req.on('close', () => ac.abort());

    // Keep-alive comments so proxies don't kill the connection for inactivity.
    const keepAliveTimer = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        // ignore
      }
    }, 15000);

    req.on('close', () => clearInterval(keepAliveTimer));

    writeSse(res, 'meta', {
      provider: 'deepseek',
      model,
      baseURL: 'https://api.deepseek.com'
    });
    writeSse(res, 'status', { phase: 'streaming', message: 'Generating…' });

    const request = {
      model,
      stream: true,
      messages: [
        { role: 'system', content: CODE_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    };
    // deepseek-reasoner rejects sampling params; keep the payload minimal.
    if (model !== 'deepseek-reasoner') {
      request.temperature = 0.0;
    }

    const stream = await client.chat.completions.create(request, { signal: ac.signal });

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta || {};
      const content = delta?.content;
      if (typeof content === 'string' && content.length > 0) {
        writeSse(res, 'token', { chunk: content });
      }
      const reasoning = delta?.reasoning_content;
      if (includeReasoning && typeof reasoning === 'string' && reasoning.length > 0) {
        writeSse(res, 'reasoning', { chunk: reasoning });
      }
    }

    clearInterval(keepAliveTimer);
    writeSse(res, 'status', { phase: 'done', message: 'Complete' });
    res.end();
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('AI Stream Error:', details.message);
    if (!res.headersSent) return res.status(500).json({ error: error?.message || 'Streaming failed' });
    try {
      writeSse(res, 'status', { phase: 'error', message: details.message });
    } catch {
      // ignore
    }
    res.end();
  }
});

// IMPORTANT: Do NOT use app.listen in production for Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Local Server running on ${PORT}`));
}

module.exports = app;
