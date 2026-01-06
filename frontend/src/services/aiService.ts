import { ProjectFile } from '@/types';
import { getLanguageFromExtension } from '@/utils/stackDetector';

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
          typingMs?: number; // 0 disables typing playback (useful for tests)
          onFileEvent?: (event: {
            type: 'start' | 'chunk' | 'end';
            path: string;
            chunk?: string;
            partial?: boolean;
            line?: number;
            append?: boolean;
          }) => void;
        } = false
  ): Promise<void> {
    try {
      const options = typeof thinkingModeOrOptions === 'boolean' ? { thinkingMode: thinkingModeOrOptions } : thinkingModeOrOptions;
      const thinkingMode = Boolean(options.thinkingMode);
      const architectMode = Boolean(options.architectMode);
      const includeReasoning = Boolean(options.includeReasoning);
      const typingMsRaw = Number(options.typingMs ?? 26);
      const typingMs = Number.isFinite(typingMsRaw) ? typingMsRaw : 26;

      onMeta({ provider: 'vercel-backend', baseURL: API_BASE_URL, thinkingMode, architectMode });
      onStatus('streaming', 'Generating…');

      const parseSseEvent = (rawEvent: string) => {
        const lines = rawEvent.split(/\r?\n/);

        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith(':')) continue; // keep-alive/comment
          if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            // Preserve all content including leading spaces; only strip the single optional space after `data:`.
            const rest = line.slice('data:'.length);
            dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest);
            continue;
          }
        }

        const dataText = dataLines.join('\n');
        return { eventName, dataText };
      };

      const startToken = '[[START_FILE:';
      const endToken = '[[END_FILE]]';
      const streamTailMax = 2200;

      const completedFiles = new Set<string>();
      const partialFiles = new Set<string>();
      let lastSuccessfulFile = '';
      let lastSuccessfulLine = 0;

      const countLines = (text: string) => {
        let lines = 0;
        for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
        return lines;
      };

      const getForceCloseMarker = (path: string) => {
        const lower = (path || '').toLowerCase();
        if (lower.endsWith('.html')) return '\n<!-- [[PARTIAL_FILE_CLOSED]] -->\n';
        if (lower.endsWith('.css')) return '\n/* [[PARTIAL_FILE_CLOSED]] */\n';
        if (lower.endsWith('.md')) return '\n<!-- [[PARTIAL_FILE_CLOSED]] -->\n';
        return '\n// [[PARTIAL_FILE_CLOSED]]\n';
      };

      class FileMarkerParser {
        private scan = '';
        private inFile = false;
        private currentPath = '';
        private currentLine = 1;
        private resumeAppendPath: string | undefined;

        setResumeAppendPath(path?: string) {
          this.resumeAppendPath = path;
        }

        push(text: string) {
          if (!text) return;
          this.scan += text;
          this.drain();
        }

        private drain() {
          while (this.scan.length > 0) {
            if (!this.inFile) {
              const startIdx = this.scan.indexOf(startToken);
              if (startIdx === -1) {
                this.scan = this.scan.slice(Math.max(0, this.scan.length - (startToken.length - 1)));
                return;
              }

              const closeIdx = this.scan.indexOf(']]', startIdx);
              if (closeIdx === -1) {
                this.scan = this.scan.slice(startIdx);
                return;
              }

              const rawPath = this.scan.slice(startIdx + startToken.length, closeIdx).trim();
              this.currentPath = rawPath;
              this.inFile = true;
              this.currentLine = 1;
              this.scan = this.scan.slice(closeIdx + 2);

              options.onFileEvent?.({
                type: 'start',
                path: rawPath,
                append: Boolean(this.resumeAppendPath && rawPath === this.resumeAppendPath),
                line: 1
              });
              continue;
            }

            const endIdx = this.scan.indexOf(endToken);
            const nextStartIdx = this.scan.indexOf(startToken);

            const hasImplicitStart = nextStartIdx !== -1 && (endIdx === -1 || nextStartIdx < endIdx);
            if (hasImplicitStart) {
              this.flushContent(this.scan.slice(0, nextStartIdx));
              this.forceClose(true);
              this.scan = this.scan.slice(nextStartIdx);
              continue;
            }

            if (endIdx !== -1) {
              this.flushContent(this.scan.slice(0, endIdx));
              completedFiles.add(this.currentPath);
              options.onFileEvent?.({ type: 'end', path: this.currentPath, partial: false, line: this.currentLine });
              lastSuccessfulFile = this.currentPath;
              lastSuccessfulLine = this.currentLine;

              this.inFile = false;
              this.currentPath = '';
              this.scan = this.scan.slice(endIdx + endToken.length);
              continue;
            }

            // No marker found: flush most of the buffer but keep a tail to allow marker split across chunks.
            const keep = Math.max(startToken.length + 8, endToken.length + 8);
            if (this.scan.length <= keep) return;

            this.flushContent(this.scan.slice(0, this.scan.length - keep));
            this.scan = this.scan.slice(this.scan.length - keep);
          }
        }

        private flushContent(content: string) {
          if (!content) return;
          options.onFileEvent?.({ type: 'chunk', path: this.currentPath, chunk: content, line: this.currentLine });
          this.currentLine += countLines(content);
        }

        private forceClose(partial: boolean) {
          const marker = getForceCloseMarker(this.currentPath);
          options.onFileEvent?.({ type: 'chunk', path: this.currentPath, chunk: marker, line: this.currentLine });
          this.currentLine += countLines(marker);
          partialFiles.add(this.currentPath);
          options.onFileEvent?.({ type: 'end', path: this.currentPath, partial, line: this.currentLine });
          lastSuccessfulFile = this.currentPath;
          lastSuccessfulLine = this.currentLine;
          this.inFile = false;
          this.currentPath = '';
        }

        finalize(): { cutPath: string; cutLine: number } | null {
          if (!this.inFile) return null;
          if (this.scan.length > 0) {
            this.flushContent(this.scan);
            this.scan = '';
          }
          const cutPath = this.currentPath;
          const cutLine = this.currentLine;
          this.forceClose(true);
          return { cutPath, cutLine };
        }
      }

      class TypedStreamPlayer {
        private timer: any = null;
        private queue = '';
        private closed = false;

        constructor(
          private readonly tickMs: number,
          private readonly onEmit: (chunk: string) => void
        ) {}

        enqueue(text: string) {
          if (this.closed) return;
          if (!text) return;
          this.queue += text;
          if (this.tickMs <= 0) {
            const out = this.queue;
            this.queue = '';
            if (out) this.onEmit(out);
            return;
          }
          if (!this.timer) this.start();
        }

        private start() {
          this.timer = globalThis.setInterval(() => {
            if (this.queue.length === 0) {
              if (this.closed) this.stop();
              return;
            }

            const backlog = this.queue.length;
            const batch =
                backlog > 8000 ? 140
              : backlog > 3000 ? 80
              : backlog > 1200 ? 40
              : backlog > 300 ? 16
              : 4;

            const out = this.queue.slice(0, batch);
            this.queue = this.queue.slice(batch);
            this.onEmit(out);
          }, this.tickMs);
        }

        close() {
          this.closed = true;
          if (this.tickMs <= 0) return;
          if (this.queue.length === 0) this.stop();
        }

        flushAll() {
          if (this.queue.length > 0) {
            const out = this.queue;
            this.queue = '';
            this.onEmit(out);
          }
          this.closed = true;
          this.stop();
        }

        private stop() {
          if (this.timer) {
            globalThis.clearInterval(this.timer);
            this.timer = null;
          }
        }
      }

      let streamTail = '';

      const buildResumePrompt = (cutPath: string, cutLine: number) => {
        const completedList = Array.from(completedFiles).slice(-80).join(', ');
        const tail = streamTail.slice(-streamTailMax);
        return [
          prompt,
          '',
          'SYSTEM: You were cut off mid-stream. Resume using ONLY the File-Marker protocol.',
          `The last file ${cutPath} was cut off at line ${cutLine}. Continue the stream exactly from line ${cutLine + 1} (do not repeat earlier lines).`,
          completedList ? `DO NOT repeat these already completed files: ${completedList}` : '',
          tail ? `Last received tail (for context, may be truncated):\n${tail}` : '',
          'Output only markers + code. No filler.'
        ]
          .filter(Boolean)
          .join('\n');
      };

      const runStreamOnce = async (streamPrompt: string, resumeAppendPath?: string) => {
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
        let sawAnyToken = false;
        let sawDoneStatus = false;

        const markerParser = new FileMarkerParser();
        markerParser.setResumeAppendPath(resumeAppendPath);
        const player = new TypedStreamPlayer(typingMs, (out) => {
          markerParser.push(out);
          onToken(out);
        });

        const consumeToken = (tokenChunk: string) => {
          if (!tokenChunk) return;
          sawAnyToken = true;
          streamTail = (streamTail + tokenChunk).slice(-streamTailMax);
          player.enqueue(tokenChunk);
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
            if (cleaned.length > 0) consumeToken(cleaned);
            continue;
          }

          buffer += decoded;

          let boundaryIndex = buffer.indexOf('\n\n');
          while (boundaryIndex !== -1) {
            const rawEvent = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            boundaryIndex = buffer.indexOf('\n\n');

            const { eventName, dataText } = parseSseEvent(rawEvent);
            if (eventName === 'meta') {
              onMeta({ raw: dataText });
              continue;
            }

            if (eventName === 'status') {
              const idx = dataText.indexOf(':');
              const phase = idx === -1 ? 'streaming' : dataText.slice(0, idx);
              const message = idx === -1 ? dataText : dataText.slice(idx + 1);
              onStatus(phase, message);
              if (phase === 'done') sawDoneStatus = true;
              if (phase === 'error' && message) onError(message);
              continue;
            }

            if (eventName === 'thought' && includeReasoning) {
              _onReasoning(dataText);
              continue;
            }

            if (eventName === 'token') {
              consumeToken(dataText);
              continue;
            }
          }

          // If we have a buffer that isn't SSE-framed, treat it as raw content.
          if (buffer.length > 0 && !/(^|\n)event:\s/.test(buffer) && !/(^|\n)data:\s/.test(buffer)) {
            const cleaned = buffer.replace(/^:[^\n]*\n+/gm, '');
            buffer = '';
            if (cleaned.length > 0) consumeToken(cleaned);
          }
        }

        if (!sawDoneStatus) onStatus('done', 'Complete');

        player.flushAll();

        if (!sawAnyToken) {
          throw new Error('Backend connection failed or timed out');
        }

        return { markerParser };
      };

      const maxResumeAttempts = 1;

      const first = await runStreamOnce(prompt);
      const cut = first.markerParser.finalize();

      if (cut && maxResumeAttempts > 0) {
        onStatus('streaming', 'Resuming…');
        onMeta({ resume: { attempt: 1, file: cut.cutPath, line: cut.cutLine } });

        const resumePrompt = buildResumePrompt(cut.cutPath, cut.cutLine);
        const resumed = await runStreamOnce(resumePrompt, cut.cutPath);
        resumed.markerParser.finalize();
      }

      onJSON({
        project_files: [],
        metadata: {
          protocol: 'file-marker',
          completedFiles: completedFiles.size,
          partialFiles: partialFiles.size,
          lastSuccessfulFile,
          lastSuccessfulLine
        },
        instructions: ''
      });

      onComplete();
    } catch (err: any) {
      onError(err?.message || 'Streaming failed');
      onComplete();
    }
  }
};
