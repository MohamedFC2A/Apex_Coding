export const runtime = 'edge';

const CODE_STREAM_SYSTEM_PROMPT = `
You are an expert full-stack code generator.
CRITICAL OUTPUT RULES (NON-NEGOTIABLE):
- Output MUST be plain text only (no JSON, no arrays, no markdown, no code fences).
- You MUST use the File-Marker protocol for EVERY file.
- No filler text. Output ONLY file markers and file contents.
- If you output any HTML (any *.html file), you MUST include this exact footer immediately before the closing </body> tag:
<footer style="text-align: center; padding: 20px; font-size: 0.8rem; color: rgba(255,255,255,0.3); border-top: 1px solid rgba(255,255,255,0.1);">
  © 2026 Nexus Apex | Built by Matany Labs.
</footer>
- Every project MUST include the Nexus Apex footer in the main layout (React/TSX App component or HTML page).
- Follow the Atomic Structure: src/components/, src/hooks/, src/services/, and convex/.

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
- When modifying an existing file, use [[EDIT_NODE: ...]] instead of [[START_FILE: ...]].
`.trim();

const normalizeDeepSeekBaseUrl = (raw: string | undefined) => {
  const base = String(raw || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
};

const sseHeaders = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: sseHeaders });
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = normalizeDeepSeekBaseUrl(process.env.DEEPSEEK_BASE_URL);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const write = (text: string) => controller.enqueue(encoder.encode(text));
      const writeSse = (event: string, data: string) => {
        write(`event: ${event}\n`);
        for (const line of String(data ?? '').split('\n')) write(`data: ${line}\n`);
        write('\n');
      };

      const keepAlive = setInterval(() => {
        try {
          write(': keep-alive\n\n');
        } catch {
          // ignore
        }
      }, 10_000);

      const abortController = new AbortController();
      const abortTimer = setTimeout(() => {
        try {
          abortController.abort();
        } catch {
          // ignore
        }
      }, 55_000);

      try {
        const body = await req.json().catch(() => ({} as any));
        const prompt = String(body?.prompt || '').trim();
        const thinkingMode = Boolean(body?.thinkingMode);
        const includeReasoning = Boolean(body?.includeReasoning);
        const model = thinkingMode
          ? (process.env.DEEPSEEK_THINKING_MODEL || 'deepseek-reasoner')
          : (process.env.DEEPSEEK_MODEL || 'deepseek-chat');

        // Immediate hello so clients render the stream right away.
        write(': keep-alive\n\n');
        writeSse('meta', `provider=deepseek;model=${model};thinkingMode=${thinkingMode}`);

        if (!prompt) {
          writeSse('status', 'error:Prompt is required');
          controller.close();
          return;
        }

        if (!apiKey) {
          writeSse('status', 'error:API Key missing on Backend');
          controller.close();
          return;
        }

        const upstream = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0.0,
            messages: [
              { role: 'system', content: CODE_STREAM_SYSTEM_PROMPT },
              { role: 'user', content: prompt }
            ],
            stream: true
          }),
          signal: abortController.signal
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '');
          writeSse('status', `error:${text || `DeepSeek stream failed (${upstream.status})`}`);
          controller.close();
          return;
        }

        writeSse(thinkingMode ? 'status' : 'status', `${thinkingMode ? 'thinking' : 'streaming'}:${thinkingMode ? 'Thinking…' : 'Generating…'}`);

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const flushSseDataMessages = async (chunkText: string) => {
          buffer += chunkText;
          let idx = buffer.indexOf('\n\n');
          while (idx !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            idx = buffer.indexOf('\n\n');

            const dataLines = raw
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice('data:'.length).trimStart());

            const dataText = dataLines.join('\n').trim();
            if (!dataText || dataText === '[DONE]') continue;

            let parsed: any = null;
            try {
              parsed = JSON.parse(dataText);
            } catch {
              continue;
            }

            const delta = parsed?.choices?.[0]?.delta || {};
            const reasoning = delta?.reasoning_content;
            const content = delta?.content;

            if (includeReasoning && typeof reasoning === 'string' && reasoning.length > 0) {
              writeSse('thought', reasoning);
            }
            if (typeof content === 'string' && content.length > 0) {
              writeSse('token', content);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const decoded = decoder.decode(value, { stream: true });
          if (decoded) await flushSseDataMessages(decoded);
        }

        writeSse('status', 'done:Complete');
        controller.close();
      } catch (e: any) {
        try {
          const message = e?.name === 'AbortError' ? 'Upstream timed out' : e?.message || 'Streaming error';
          writeSse('status', `error:${message}`);
        } catch {
          // ignore
        }
        controller.close();
      } finally {
        clearInterval(keepAlive);
        clearTimeout(abortTimer);
      }
    }
  });

  return new Response(stream, { status: 200, headers: sseHeaders });
}
