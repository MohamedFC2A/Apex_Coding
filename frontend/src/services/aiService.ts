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

      // Streaming checkpoint extraction (incremental parser):
      // We track files as they complete and use that to auto-resume if the stream truncates.
      // This avoids relying on `JSON.parse()` of a potentially truncated full payload.
      const completedFiles = new Set<string>();
      const discoveredFiles = new Set<string>();
      let lastCompletedFilePath = '';
      let currentWritingFilePath = '';

      const streamTailMax = 5000;
      let streamTail = '';

      const checkpointRouter = createProjectJSONStreamRouter({
        onFileDiscovered: (path) => {
          const key = String(path || '').trim();
          if (!key) return;
          discoveredFiles.add(key);
        },
        onFileStatus: (path, status) => {
          const key = String(path || '').trim();
          if (!key) return;
          if (status === 'writing') currentWritingFilePath = key;
        },
        onFileComplete: (path) => {
          const key = String(path || '').trim();
          if (!key) return;
          completedFiles.add(key);
          lastCompletedFilePath = key;
          if (currentWritingFilePath === key) currentWritingFilePath = '';
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

      const buildResumePrompt = () => {
        const completed = Array.from(completedFiles).slice(-40);
        const discovered = Array.from(discoveredFiles).slice(-40);
        const tail = streamTail.slice(-2200);

        return [
          prompt,
          '',
          'SYSTEM: Your previous response was truncated mid-stream and did not finish a valid JSON object.',
          lastCompletedFilePath ? `Last completed file: ${lastCompletedFilePath}` : '',
          currentWritingFilePath ? `Last file in progress: ${currentWritingFilePath}` : '',
          completed.length > 0 ? `Already completed files (DO NOT repeat): ${completed.join(', ')}` : '',
          discovered.length > 0 ? `Files already discovered (avoid repeating): ${discovered.join(', ')}` : '',
          tail.length > 0 ? `Last JSON tail received (may be truncated):\n${tail}` : '',
          '',
          'Return ONLY the missing files as a single VALID JSON object with this schema:',
          '{"project_files":[{"name":"...","content":"..."}],"metadata":{"resume":true},"instructions":""}',
          '',
          'Do NOT include files already completed. Do NOT add markdown or code fences.'
        ]
          .filter(Boolean)
          .join('\n');
      };

      const runStreamOnce = async (streamPrompt: string) => {
        const response = await fetch(apiUrl('/api/ai/generate-stream'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          body: JSON.stringify({
            prompt: streamPrompt,
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
        let buffer = '';
        let gotJsonEvent = false;
        let sawAnyToken = false;
        let backendErrorMessage = '';
        let sawDoneStatus = false;

        const consumeToken = (tokenChunk: string) => {
          if (!tokenChunk) return;
          sawAnyToken = true;
          streamTail = (streamTail + tokenChunk).slice(-streamTailMax);
          checkpointRouter.push(tokenChunk);
          onToken(tokenChunk);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const decoded = decoder.decode(value, { stream: true });
          if (decoded.length === 0) continue;

          // If backend sends raw chunks (not SSE framed), forward immediately.
          const looksLikeSse = /(^|\n)event:\s/.test(decoded) || /(^|\n)data:\s/.test(decoded);
          if (!looksLikeSse && buffer.length === 0) {
            const cleaned = decoded.replace(/^:[^\n]*\n+/gm, '');
            if (cleaned.trim().length > 0) consumeToken(cleaned);
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
              if (phase === 'done') sawDoneStatus = true;
              if (phase === 'error' && message) backendErrorMessage = message;
            }
            if (eventName === 'reasoning' && includeReasoning) _onReasoning(String(data.chunk || ''));
            if (eventName === 'token') {
              const tokenChunk = String(data.chunk || '');
              if (tokenChunk.length > 0) consumeToken(tokenChunk);
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
            if (cleaned.trim().length > 0) consumeToken(cleaned);
          }
        }

        if (!sawDoneStatus) onStatus('done', 'Complete');

        if (!gotJsonEvent && backendErrorMessage) {
          throw new Error(backendErrorMessage);
        }

        if (!gotJsonEvent && !sawAnyToken) {
          throw new Error('Backend connection failed or timed out');
        }

        return { gotJsonEvent };
      };

      let finalJsonReceived = false;
      const maxResumeAttempts = 1;

      for (let attempt = 0; attempt <= maxResumeAttempts; attempt++) {
        const streamPrompt = attempt === 0 ? prompt : buildResumePrompt();
        if (attempt > 0) {
          checkpointRouter.reset();
          currentWritingFilePath = '';
          onMeta({ resume: { attempt, lastCompletedFilePath } });
          onStatus('streaming', 'Resuming…');
        }

        const { gotJsonEvent } = await runStreamOnce(streamPrompt);
        finalJsonReceived = finalJsonReceived || gotJsonEvent;

        const incomplete =
          (Boolean(currentWritingFilePath) && !completedFiles.has(currentWritingFilePath)) ||
          discoveredFiles.size > completedFiles.size;
        if (finalJsonReceived || !incomplete) break;
      }

      if (!finalJsonReceived && completedFiles.size > 0) {
        onMeta({
          checkpoint: {
            partial: true,
            completedFiles: completedFiles.size,
            lastCompletedFilePath,
            currentWritingFilePath
          }
        });
        onJSON({
          project_files: [],
          metadata: { partial: true },
          instructions: ''
        });
      }

      onComplete();
    } catch (err: any) {
      onError(err?.message || 'Streaming failed');
      onComplete();
    }
  }
};
