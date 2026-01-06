import { ProjectFile } from '@/types';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { createProjectJSONStreamRouter } from '@/services/projectStreamRouter';

// HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = 'https://apex-coding-backend.vercel.app';

interface AIResponse {
  plan: string;
  decisionTrace?: string;
  files: ProjectFile[];
  fileStructure: { path: string; type: 'file' }[];
  stack: string;
  description: string;
}

const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

const cleanAndParseJSON = (text: string) => {
  const raw = String(text ?? '').trim();
  if (raw.length === 0) throw new Error('Empty AI response');

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```json\s*([\s\S]*?)\s*```/i) || raw.match(/```\s*([\s\S]*?)\s*```/);
    if (match?.[1]) return JSON.parse(match[1]);

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));

    throw new Error('No valid JSON found in response');
  }
};

const getErrorMessage = (err: any, fallback: string) => {
  return (
    err?.error ||
    err?.message ||
    fallback
  );
};

export const aiService = {
  async generatePlan(prompt: string, thinkingMode: boolean = false): Promise<{ steps: Array<{ id: string; title: string }> }> {
    try {
      const PLAN_URL = `${API_BASE_URL}/api/ai/plan`;

      const response = await fetch(PLAN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, thinkingMode })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Plan failed (${response.status})`);
      }

      const data: any = await response.json();
      const steps = Array.isArray(data?.steps) ? data.steps : [];
      return { steps };
    } catch (error: any) {
      console.error('Plan Error Details:', error);
      throw new Error(getErrorMessage(error, 'Failed to generate plan'));
    }
  },

  async generateCode(prompt: string): Promise<AIResponse> {
    try {
      const response = await fetch(apiUrl('/api/ai/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Generate failed (${response.status})`);
      }

      const data: any = await response.json();

      if (data?.files) {
        data.files = data.files.map((file: ProjectFile) => ({
          ...file,
          language: file.language || getLanguageFromExtension(file.path || file.name || '')
        }));
      }

      return data as AIResponse;
    } catch (error: any) {
      console.error('Generate Code Error Details:', error);
      throw new Error(getErrorMessage(error, 'Failed to generate code'));
    }
  },

  async generateCodeStream(
    prompt: string,
    onToken: (token: string) => void,
    onStatus: (phase: string, message: string) => void,
    onMeta: (meta: any) => void,
    onJSON: (payload: any) => void,
    onError: (error: string) => void,
    _onReasoning: (chunk: string) => void,
    onComplete: () => void,
    thinkingModeOrOptions:
      | boolean
      | {
          thinkingMode?: boolean;
          architectMode?: boolean;
          includeReasoning?: boolean;
          history?: any[];
        } = false
  ): Promise<void> {
    try {
      const options = typeof thinkingModeOrOptions === 'boolean' ? { thinkingMode: thinkingModeOrOptions } : thinkingModeOrOptions;
      const thinkingMode = Boolean(options.thinkingMode);
      const architectMode = Boolean(options.architectMode);
      const includeReasoning = Boolean(options.includeReasoning);

      onMeta({ provider: 'vercel-backend', baseURL: API_BASE_URL, thinkingMode, architectMode });
      onStatus('streaming', 'Generating…');

      // Streaming checkpoint extraction: capture complete `{"name": "...", "content": "..."}` objects
      // from the JSON stream without requiring the full JSON payload to parse successfully.
      const partialFileOrder: string[] = [];
      const partialFileContents = new Map<string, string>();
      const partialFileCompleted = new Set<string>();
      let lastCompletedFilePath = '';

      const checkpointRouter = createProjectJSONStreamRouter({
        onFileDiscovered: (path) => {
          const key = String(path || '').trim();
          if (!key) return;
          if (!partialFileContents.has(key)) {
            partialFileOrder.push(key);
            partialFileContents.set(key, '');
          }
        },
        onFileChunk: (path, chunk) => {
          const key = String(path || '').trim();
          if (!key) return;
          partialFileContents.set(key, (partialFileContents.get(key) || '') + chunk);
        },
        onFileComplete: (path) => {
          const key = String(path || '').trim();
          if (!key) return;
          partialFileCompleted.add(key);
          lastCompletedFilePath = key;
        }
      });

      const parseSseEvent = (rawEvent: string) => {
        const lines = rawEvent
          .split('\n')
          .map((line) => line.trimEnd())
          .filter((line) => line.length > 0 && !line.startsWith(':'));

        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trimStart());
            continue;
          }
        }

        const dataRaw = dataLines.join('\n');
        return { eventName, dataRaw };
      };

      const response = await fetch(apiUrl('/api/ai/generate-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({
          prompt,
          thinkingMode,
          architectMode,
          includeReasoning,
          history: options.history || []
        })
      });

      if (!response.ok) {
        let message = `Streaming failed (${response.status})`;
        const errorText = await response.text().catch(() => '');
        if (errorText) message = errorText;
        throw new Error(message);
      }

      const body = response.body;
      if (!body) throw new Error('Streaming failed: empty response body');

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      let gotJsonEvent = false;
      let sawAnyToken = false;
      let backendErrorMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = decoder.decode(value, { stream: true });
        if (decoded.length === 0) continue;

        // If backend sends raw chunks (not SSE framed), forward immediately.
        const looksLikeSse = /(^|\n)event:\s/.test(decoded) || /(^|\n)data:\s/.test(decoded);
        if (!looksLikeSse && buffer.length === 0) {
          // Strip SSE comment keep-alives like ": \n\n" if present.
          const cleaned = decoded.replace(/^:[^\n]*\n+/gm, '');
          if (cleaned.trim().length > 0) {
            sawAnyToken = true;
            fullText += cleaned;
            checkpointRouter.push(cleaned);
            onToken(cleaned);
          }
          continue;
        }

        buffer += decoded;

        let boundaryIndex = buffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
          const rawEvent = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          boundaryIndex = buffer.indexOf('\n\n');

          const { eventName, dataRaw } = parseSseEvent(rawEvent);
          if (!dataRaw) continue;

          let data: any;
          try {
            data = JSON.parse(dataRaw);
          } catch {
            continue;
          }

          if (eventName === 'meta') onMeta(data);
          if (eventName === 'status') {
            const phase = String(data.phase || 'streaming');
            const message = String(data.message || '');
            onStatus(phase, message);
            if (phase === 'error' && message) backendErrorMessage = message;
          }
          if (eventName === 'reasoning' && includeReasoning) _onReasoning(String(data.chunk || ''));
          if (eventName === 'token') {
            const tokenChunk = String(data.chunk || '');
            if (tokenChunk.length > 0) {
              sawAnyToken = true;
              fullText += tokenChunk;
              checkpointRouter.push(tokenChunk);
              onToken(tokenChunk);
            }
          }
          if (eventName === 'json') {
            gotJsonEvent = true;
            onJSON(data.payload);
          }
        }

        // If we have a buffer that isn't SSE-framed, treat it as raw content.
        if (!gotJsonEvent && buffer.length > 0 && !/(^|\n)event:\s/.test(buffer) && !/(^|\n)data:\s/.test(buffer)) {
          const cleaned = buffer.replace(/^:[^\n]*\n+/gm, '');
          buffer = '';
          if (cleaned.trim().length > 0) {
            sawAnyToken = true;
            fullText += cleaned;
            checkpointRouter.push(cleaned);
            onToken(cleaned);
          }
        }
      }

      onStatus('done', 'Complete');

      if (!gotJsonEvent && !sawAnyToken) {
        throw new Error('Backend connection failed or timed out');
      }

      if (!gotJsonEvent && backendErrorMessage) {
        throw new Error(backendErrorMessage);
      }

      if (!gotJsonEvent) {
        const errorMarkerIndex = fullText.indexOf('[ERROR]:');
        if (errorMarkerIndex !== -1) {
          throw new Error(fullText.slice(errorMarkerIndex + '[ERROR]:'.length).trim() || 'Backend error');
        }
        try {
          const payload = cleanAndParseJSON(fullText);
          onJSON(payload);
        } catch (e: any) {
          const completedFiles = partialFileOrder
            .filter((path) => partialFileCompleted.has(path))
            .map((path) => ({ name: path, content: partialFileContents.get(path) || '' }));

          if (completedFiles.length > 0) {
            onMeta({
              checkpoint: {
                partial: true,
                completedFiles: completedFiles.length,
                lastCompletedFilePath: lastCompletedFilePath || completedFiles[completedFiles.length - 1]?.name || ''
              }
            });
            onJSON({
              project_files: completedFiles,
              metadata: { partial: true },
              instructions: ''
            });
          } else {
            throw new Error(e?.message || 'Failed to parse streamed JSON');
          }
        }
      }

      onComplete();
    } catch (err: any) {
      onError(err?.message || 'Streaming failed');
      onComplete();
    }
  }
};
