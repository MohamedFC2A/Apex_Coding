import { ProjectFile } from '@/types';
import { apiUrl, getApiBaseUrl } from '@/services/apiBase';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

interface AIResponse {
  plan: string;
  decisionTrace?: string;
  files: ProjectFile[];
  fileStructure: { path: string; type: 'file' }[];
  stack: string;
  description: string;
}

const getErrorMessage = (err: any, fallback: string) => {
  return (
    err?.error ||
    err?.message ||
    fallback
  );
};

export const aiService = {
  async generatePlan(prompt: string, thinkingMode: boolean = false): Promise<{ steps: Array<{ id: string; title: string }> }> {
    const { canMakeRequest, incrementRequests, tier } = useSubscriptionStore.getState();
    
    if (!canMakeRequest()) {
      throw new Error(`Daily limit reached. You have 0 requests remaining on the ${tier} plan. Upgrade to PRO for more requests.`);
    }
    
    try {
      const PLAN_URL = apiUrl('/ai/plan');

      const postOnce = async () => {
        const controller = new AbortController();
        // FIXED: Increased from 12s to 60s for plan generation
        const timer = globalThis.setTimeout(() => controller.abort(), 60_000);
        try {
          return await fetch(PLAN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ prompt, thinkingMode })
          });
        } finally {
          globalThis.clearTimeout(timer as any);
        }
      };

      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await postOnce();
          if (response.ok) break;
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            await new Promise((r) => globalThis.setTimeout(r as any, 1000));
            continue;
          }
          break;
        } catch (e: any) {
          if (attempt >= 2) throw new Error('Plan generation timeout - please try again');
          await new Promise((r) => globalThis.setTimeout(r as any, 1000));
        }
      }

      if (!response) throw new Error('Plan failed');

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Plan failed (${response.status})`);
      }

      const data: any = await response.json();
      const steps = Array.isArray(data?.steps) ? data.steps : [];
      
      incrementRequests();
      
      return { steps };
    } catch (error: any) {
      console.error('Plan Error Details:', error);
      throw new Error(getErrorMessage(error, 'Failed to generate plan'));
    }
  },

  async generateCode(prompt: string): Promise<AIResponse> {
    void prompt;
    throw new Error('generateCode() is deprecated; use generateCodeStream()');
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
          typingMs?: number;
          onFileEvent?: (event: {
            type: 'start' | 'chunk' | 'end';
            path: string;
            mode?: 'create' | 'edit';
            chunk?: string;
            partial?: boolean;
            line?: number;
            append?: boolean;
          }) => void;
        } = false
  ): Promise<void> {
    const { canMakeRequest, incrementRequests, tier } = useSubscriptionStore.getState();
    
    if (!canMakeRequest()) {
      onError(`Daily limit reached. You have 0 requests remaining on the ${tier} plan. Upgrade to PRO for more requests.`);
      return;
    }
    
    incrementRequests();
    
    try {
      const options = typeof thinkingModeOrOptions === 'boolean' ? { thinkingMode: thinkingModeOrOptions } : thinkingModeOrOptions;
      const thinkingMode = Boolean(options.thinkingMode);
      const architectMode = Boolean(options.architectMode);
      const includeReasoning = Boolean(options.includeReasoning);
      const typingMsRaw = Number(options.typingMs ?? 26);
      const typingMs = Number.isFinite(typingMsRaw) ? typingMsRaw : 26;

      onMeta({ provider: 'vercel-backend', baseURL: getApiBaseUrl(), thinkingMode, architectMode });
      onStatus('streaming', 'Generating…');

      const parseSseEvent = (rawEvent: string) => {
        const lines = rawEvent.split(/\r?\n/);

        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith(':')) continue;
          if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            const rest = line.slice('data:'.length);
            dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest);
            continue;
          }
        }

        const dataText = dataLines.join('\n');
        return { eventName, dataText };
      };

      const startToken = '[[START_FILE:';
      const editToken = '[[EDIT_FILE:';
      const editNodeToken = '[[EDIT_NODE:';
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
        private currentMode: 'create' | 'edit' = 'create';
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
              const editIdx = this.scan.indexOf(editToken);
              const editNodeIdx = this.scan.indexOf(editNodeToken);
              const nextIdx =
                [startIdx, editIdx, editNodeIdx].filter((v) => v !== -1).sort((a, b) => a - b)[0] ?? -1;

              if (nextIdx === -1) {
                const keep = Math.max(startToken.length - 1, editToken.length - 1, editNodeToken.length - 1);
                this.scan = this.scan.slice(Math.max(0, this.scan.length - keep));
                return;
              }

              const isEdit = (editIdx !== -1 && editIdx === nextIdx) || (editNodeIdx !== -1 && editNodeIdx === nextIdx);
              const token = startIdx === nextIdx ? startToken : isEdit && editNodeIdx === nextIdx ? editNodeToken : editToken;
              const closeIdx = this.scan.indexOf(']]', nextIdx);
              if (closeIdx === -1) {
                this.scan = this.scan.slice(nextIdx);
                return;
              }

              const rawPath = this.scan.slice(nextIdx + token.length, closeIdx).trim();
              this.currentPath = rawPath;
              this.inFile = true;
              this.currentLine = 1;
              this.currentMode = isEdit ? 'edit' : 'create';
              this.scan = this.scan.slice(closeIdx + 2);

              options.onFileEvent?.({
                type: 'start',
                path: rawPath,
                mode: this.currentMode,
                append: Boolean(this.resumeAppendPath && rawPath === this.resumeAppendPath),
                line: 1
              });
              continue;
            }

            const endIdx = this.scan.indexOf(endToken);
            const nextStartIdx = this.scan.indexOf(startToken);
            const nextEditIdx = this.scan.indexOf(editToken);
            const nextMarkerIdx =
              nextStartIdx === -1
                ? nextEditIdx
                : nextEditIdx === -1
                  ? nextStartIdx
                  : Math.min(nextStartIdx, nextEditIdx);

            const hasImplicitStart = nextMarkerIdx !== -1 && (endIdx === -1 || nextMarkerIdx < endIdx);
            if (hasImplicitStart) {
              this.flushContent(this.scan.slice(0, nextMarkerIdx));
              this.forceClose(true);
              this.scan = this.scan.slice(nextMarkerIdx);
              continue;
            }

            if (endIdx !== -1) {
              this.flushContent(this.scan.slice(0, endIdx));
              completedFiles.add(this.currentPath);
              options.onFileEvent?.({ type: 'end', path: this.currentPath, mode: this.currentMode, partial: false, line: this.currentLine });
              lastSuccessfulFile = this.currentPath;
              lastSuccessfulLine = this.currentLine;

              this.inFile = false;
              this.currentPath = '';
              this.scan = this.scan.slice(endIdx + endToken.length);
              continue;
            }

            const keep = Math.max(startToken.length + 8, editToken.length + 8, endToken.length + 8);
            if (this.scan.length <= keep) return;

            this.flushContent(this.scan.slice(0, this.scan.length - keep));
            this.scan = this.scan.slice(this.scan.length - keep);
          }
        }

        private flushContent(content: string) {
          if (!content) return;
          options.onFileEvent?.({ type: 'chunk', path: this.currentPath, mode: this.currentMode, chunk: content, line: this.currentLine });
          this.currentLine += countLines(content);
        }

        private forceClose(partial: boolean) {
          const marker = getForceCloseMarker(this.currentPath);
          options.onFileEvent?.({ type: 'chunk', path: this.currentPath, mode: this.currentMode, chunk: marker, line: this.currentLine });
          this.currentLine += countLines(marker);
          partialFiles.add(this.currentPath);
          options.onFileEvent?.({ type: 'end', path: this.currentPath, mode: this.currentMode, partial, line: this.currentLine });
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
        const controller = new AbortController();
        const response = await fetch(apiUrl('/ai/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          signal: controller.signal,
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
        let streamErrored = false;

        // FIXED: Increased stall timeout from 35s to 120s (2 minutes)
        const stallMsRaw = Number((options as any).stallTimeoutMs ?? 120_000);
        const stallMs = Number.isFinite(stallMsRaw) ? Math.max(30_000, stallMsRaw) : 120_000;
        let lastUsefulAt = Date.now();
        let stallTimer: any = null;

        const kickStallTimer = () => {
          lastUsefulAt = Date.now();
          if (!stallTimer) {
            stallTimer = globalThis.setInterval(() => {
              if (!sawAnyToken) return;
              const idleFor = Date.now() - lastUsefulAt;
              if (idleFor < stallMs) return;
              try {
                controller.abort();
              } catch {
                // ignore
              }
            }, 2000);
          }
        };

        const markerParser = new FileMarkerParser();
        markerParser.setResumeAppendPath(resumeAppendPath);
        const player = new TypedStreamPlayer(typingMs, (out) => {
          markerParser.push(out);
          onToken(out);
        });

        const consumeToken = (tokenChunk: string) => {
          if (!tokenChunk) return;
          sawAnyToken = true;
          kickStallTimer();
          streamTail = (streamTail + tokenChunk).slice(-streamTailMax);
          player.enqueue(tokenChunk);
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const decoded = decoder.decode(value, { stream: true });
            if (decoded.length === 0) continue;

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
                if (dataText.trim().length > 0) kickStallTimer();
                continue;
              }

              if (eventName === 'status') {
                const idx = dataText.indexOf(':');
                const phase = idx === -1 ? 'streaming' : dataText.slice(0, idx);
                const message = idx === -1 ? dataText : dataText.slice(idx + 1);
                onStatus(phase, message);
                if (dataText.trim().length > 0) kickStallTimer();
                if (phase === 'done') sawDoneStatus = true;
                if (phase === 'error' && message) onError(message);
                continue;
              }

              if (eventName === 'thought' && includeReasoning) {
                if (dataText.trim().length > 0) kickStallTimer();
                _onReasoning(dataText);
                continue;
              }

              if (eventName === 'token') {
                consumeToken(dataText);
                continue;
              }
            }

            if (buffer.length > 0 && !/(^|\n)event:\s/.test(buffer) && !/(^|\n)data:\s/.test(buffer)) {
              const cleaned = buffer.replace(/^:[^\n]*\n+/gm, '');
              buffer = '';
              if (cleaned.length > 0) consumeToken(cleaned);
            }
          }
        } catch (e: any) {
          streamErrored = true;
          if (!sawAnyToken) throw e;
        }

        if (!sawDoneStatus) onStatus('done', 'Complete');

        player.flushAll();
        if (stallTimer) {
          globalThis.clearInterval(stallTimer);
          stallTimer = null;
        }

        if (!sawAnyToken) {
          throw new Error('Backend connection failed or timed out');
        }

        if (streamErrored) {
          onStatus('streaming', 'Connection stalled; attempting resume…');
        }

        return { markerParser };
      };

      const maxResumeAttempts = 2;

      let first: { markerParser: any } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          first = await runStreamOnce(prompt);
          break;
        } catch (e: any) {
          if (attempt >= 2) throw e;
          onStatus('streaming', 'Retrying…');
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (!first) throw new Error('Streaming failed');
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
