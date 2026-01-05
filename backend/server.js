// backend/server.js (Vercel Serverless, CommonJS)
// Monolithic server to avoid ESM/dist path issues on Vercel.
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req, res) => {
  res.status(200).send('Apex Coding Backend is Running!');
});

const normalizeDeepSeekBaseUrl = (raw) => {
  const base = String(raw || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
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

const getDeepSeekClient = () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('API Key missing on Backend');
  const baseURL = normalizeDeepSeekBaseUrl(process.env.DEEPSEEK_BASE_URL);
  return { apiKey, baseURL };
};

// 2. AI Plan Route
app.post('/api/ai/plan', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const { apiKey, baseURL } = getDeepSeekClient();

    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        temperature: 0.0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a Software Architect. Return ONLY raw JSON with shape {"steps":[{"id":"1","title":"..."}]}. No markdown.'
          },
          { role: 'user', content: `Create a project plan for: ${prompt}` }
        ]
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const content = response?.data?.choices?.[0]?.message?.content || '';
    const parsed = cleanAndParseJSON(content);
    const stepsRaw = Array.isArray(parsed) ? parsed : parsed?.steps;
    const steps = Array.isArray(stepsRaw) ? stepsRaw : [];

    res.json({ steps });
  } catch (error) {
    console.error('AI Plan Error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Plan generation failed' });
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

    const { apiKey, baseURL } = getDeepSeekClient();
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        temperature: 0.0,
        messages: [
          { role: 'system', content: CODE_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ]
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const content = response?.data?.choices?.[0]?.message?.content || '';
    const payload = cleanAndParseJSON(content);
    res.json(payload);
  } catch (error) {
    console.error('AI Generate Error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Generation failed' });
  }
});

// 4. Streaming generate (SSE -> client)
app.post('/api/ai/generate-stream', async (req, res) => {
  let upstream = null;

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const { apiKey, baseURL } = getDeepSeekClient();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    res.write(`event: meta\ndata: ${JSON.stringify({ provider: 'deepseek', model, baseURL })}\n\n`);
    res.write(`event: status\ndata: ${JSON.stringify({ phase: 'thinking', message: 'Thinking…' })}\n\n`);

    const ac = new AbortController();
    req.on('close', () => ac.abort());

    upstream = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model,
        temperature: 0.0,
        stream: true,
        messages: [
          { role: 'system', content: CODE_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ]
      },
      {
        responseType: 'stream',
        signal: ac.signal,
        headers: { Authorization: `Bearer ${apiKey}` }
      }
    );

    res.write(`event: status\ndata: ${JSON.stringify({ phase: 'streaming', message: 'Generating…' })}\n\n`);

    let buffer = '';
    let fullText = '';

    upstream.data.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice('data:'.length).trim();
        if (data === '[DONE]') return;

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = parsed?.choices?.[0]?.delta || {};
        const reasoning = delta?.reasoning_content;
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          res.write(`event: reasoning\ndata: ${JSON.stringify({ chunk: reasoning })}\n\n`);
        }

        const content = delta?.content;
        if (typeof content === 'string' && content.length > 0) {
          fullText += content;
          res.write(`event: token\ndata: ${JSON.stringify({ chunk: content })}\n\n`);
        }
      }
    });

    upstream.data.on('end', () => {
      try {
        res.write(`event: status\ndata: ${JSON.stringify({ phase: 'validating', message: 'Validating…' })}\n\n`);
        const payload = cleanAndParseJSON(fullText);
        res.write(`event: json\ndata: ${JSON.stringify({ payload })}\n\n`);
        res.write(`event: status\ndata: ${JSON.stringify({ phase: 'done', message: 'Complete' })}\n\n`);
        res.end();
      } catch (e) {
        res.write(`event: status\ndata: ${JSON.stringify({ phase: 'error', message: 'Invalid JSON from AI' })}\n\n`);
        res.end();
      }
    });

    upstream.data.on('error', (err) => {
      if (ac.signal.aborted) return;
      console.error('DeepSeek stream error:', err?.message || err);
      res.write(`event: status\ndata: ${JSON.stringify({ phase: 'error', message: 'Upstream stream error' })}\n\n`);
      res.end();
    });
  } catch (error) {
    console.error('AI Stream Error:', error?.message || error);
    if (!res.headersSent) return res.status(500).json({ error: error?.message || 'Streaming failed' });
    try {
      res.write(`event: status\ndata: ${JSON.stringify({ phase: 'error', message: error?.message || 'Streaming failed' })}\n\n`);
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
