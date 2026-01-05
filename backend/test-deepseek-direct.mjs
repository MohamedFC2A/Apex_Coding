import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  console.error('[TEST] Missing DEEPSEEK_API_KEY. Set it in your environment (or .env) before running this test.');
  process.exit(1);
}

let baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
baseURL = baseURL.replace(/\/+$/, '');
if (!baseURL.endsWith('/v1')) baseURL = `${baseURL}/v1`;

const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

console.info('[TEST] DeepSeek API Key:', `Present (${apiKey.length} chars)`);
console.info('[TEST] Base URL:', baseURL);
console.info('[TEST] Model:', model);

console.info('[TEST] Testing streaming chat completion...');

try {
  const response = await axios.post(
    `${baseURL}/chat/completions`,
    {
      model,
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 50,
      stream: true,
    },
    {
      timeout: 30000,
      responseType: 'stream',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.info('[TEST] Stream created successfully');

  let chunkCount = 0;
  let content = '';

  response.data.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter((line) => line.trim() !== '');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const data = line.slice(6);
      if (data === '[DONE]') {
        console.info('\n[TEST] Stream finished: [DONE]');
        console.info(`[TEST] SUCCESS: Received ${chunkCount} chunks, ${content.length} chars`);
        console.info(`[TEST] Content: "${content}"`);
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        const token = delta?.content ?? delta?.reasoning_content;
        if (token) {
          chunkCount++;
          content += token;
          process.stdout.write(token);
        }
      } catch {
        // ignore non-JSON chunks
      }
    }
  });

  response.data.on('error', (err) => {
    console.error('[TEST] Stream error:', err?.message || err);
  });
} catch (error) {
  console.error('[TEST] ERROR:', error.message);
  if (error.response?.data) {
    console.error('[TEST] Response data:', error.response.data);
  }
}
