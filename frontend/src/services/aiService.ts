import { ProjectFile } from '@/types';
import { apiUrl, getApiBaseUrl } from '@/services/apiBase';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { usePreviewStore } from '@/stores/previewStore';
import type { GenerationConstraints } from '@/types/constraints';
import { buildAIOrganizationPolicyBlock, mergePromptWithConstraints } from '@/services/constraintPromptBuilder';
import { buildContextBundle } from '@/services/contextRetrievalEngine';
import { parseFileOpEventPayload } from '@/services/fileOpEvents';

interface AIResponse {
  plan: string;
  decisionTrace?: string;
  files: ProjectFile[];
  fileStructure: { path: string; type: 'file' }[];
  stack: string;
  description: string;
}

export type StreamFileEvent =
  | {
      type: 'start' | 'chunk' | 'end';
      path: string;
      mode?: 'create' | 'edit';
      chunk?: string;
      partial?: boolean;
      line?: number;
      append?: boolean;
    }
  | {
      type: 'delete';
      path: string;
      reason?: string;
      safetyCheckPassed?: boolean;
    }
  | {
      type: 'move';
      path: string;
      toPath: string;
      reason?: string;
      safetyCheckPassed?: boolean;
    };

const buildModelRoutingPayload = (thinkingMode: boolean, architectMode: boolean = false) => {
  return {
    plannerProvider: 'deepseek',
    plannerModel: 'deepseek-chat',
    executorProvider: 'deepseek',
    executorModel: thinkingMode ? 'deepseek-reasoner' : 'deepseek-chat',
    fallbackPolicy: 'planner->executor->default',
    multiAgent: {
      enabled: true,
      activation: 'architect_only',
      strictGate: 'strict',
      visibility: 'compact',
      specialistSet: 'planner_html_css_js_v1',
      architectMode: Boolean(architectMode)
    }
  };
};

const buildContextMetaPayload = (extra?: Record<string, unknown>) => {
  const ai = useAIStore.getState();
  const decisionMemory = (ai.compressionSnapshot?.summaryBlocks || [])
    .flatMap((block) => block.keyDecisions || [])
    .slice(0, 16);
  return {
    budget: ai.contextBudget,
    compressionSummary: ai.compressionSnapshot,
    sessionId: ai.currentSessionId,
    decisionMemory,
    ...(extra || {})
  };
};

const summarizeTopFolders = (paths: string[]) => {
  const buckets = new Map<string, number>();
  for (const path of paths) {
    const normalized = String(path || '').replace(/\\/g, '/').trim();
    if (!normalized) continue;
    const root = normalized.split('/')[0] || normalized;
    buckets.set(root, (buckets.get(root) || 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `${name}(${count})`)
    .join(', ');
};

const hasExplicitFrameworkRequest = (prompt: string) => {
  const text = String(prompt || '').toLowerCase();
  return /\breact\b|\bnext(?:\.js)?\b|\bvite\b|\btypescript app\b|\bvue\b|\bangular\b|\bsvelte\b/.test(text);
};

const getErrorMessage = (err: any, fallback: string) => {
  return (
    err?.error ||
    err?.message ||
    fallback
  );
};

export const aiService = {
  async getProviderStatus(): Promise<{ configured: boolean; code?: string; hint?: string | null; provider?: string }> {
    const response = await fetch(apiUrl('/ai/provider-status'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`Provider status failed (${response.status})`);
    }
    const data: any = await response.json();
    return {
      configured: Boolean(data?.configured),
      code: typeof data?.code === 'string' ? data.code : undefined,
      hint: typeof data?.hint === 'string' ? data.hint : null,
      provider: typeof data?.provider === 'string' ? data.provider : undefined
    };
  },

  async generatePlan(
    prompt: string,
    thinkingMode: boolean = false,
    abortSignal?: AbortSignal,
    projectType?: 'FULL_STACK' | 'FRONTEND_ONLY' | null,
    constraints?: GenerationConstraints,
    architectMode: boolean = false
  ): Promise<{ title?: string; description?: string; stack?: string; fileTree?: string[]; steps: Array<{ id: string; title: string; category?: string; files?: string[]; description?: string }> }> {
    try {
      const PLAN_URL = apiUrl('/ai/plan');
      const isAbortLike = (err: any) =>
        err?.abortedByUser || err?.message === 'ABORTED_BY_USER' || err?.name === 'AbortError';

        const postOnce = async () => {
          const controller = new AbortController();
          let abortedByUser = false;
          const timeoutMs = thinkingMode ? 600_000 : 300_000; // Increased timeout for Replit/Vercel
          const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

          const externalAbortListener = () => {
            abortedByUser = true;
            try {
              controller.abort();
            } catch {
              // ignore
            }
          };

          if (abortSignal) {
            if (abortSignal.aborted) {
              externalAbortListener();
            } else {
              abortSignal.addEventListener('abort', externalAbortListener, { once: true });
            }
          }

          let planningRules = `
 [SYSTEM PERSONA]
 You are Apex Coding V2.1 EXECUTION ENGINE.
Your goal is 100% Execution Completeness.

STRICT PLANNING RULES:
1. Plan 3-5 atomic executable tasks.
2. Execute exactly ONE task at a time.
3. NO skipping tasks.
4. Each task must be a single logical step.
5. Ensure the plan covers the entire user request.`.trim();

          const selectedProjectType = constraints?.projectMode || projectType;
          const normalizedProjectType = (selectedProjectType === 'FULL_STACK' ? 'FULL_STACK' : 'FRONTEND_ONLY') as GenerationConstraints['projectMode'];
          const organizationPolicyBlock = buildAIOrganizationPolicyBlock(normalizedProjectType);
          const enhancedRequestPrompt = constraints
            ? mergePromptWithConstraints(prompt, constraints)
            : prompt;
          const explicitFrameworkRequested = hasExplicitFrameworkRequest(enhancedRequestPrompt);

          // Add projectType-specific guidelines
          if (selectedProjectType === 'FRONTEND_ONLY') {
            planningRules += `

[PROJECT TYPE: FRONTEND ONLY]
STRUCTURE:
- Default to adaptive multi-page static output (vanilla HTML/CSS/JS).
- Use single-page only when the request is simple and clearly scoped.
- Auto-switch to multi-page when request implies: multiple services/products, legal pages, blog/docs/faq, or dashboard-like flows.
- Only switch to React/Next/Vite when explicitly requested by the user prompt.
- NO backend APIs, databases, server-side code, or authentication.
- Prefer canonical static folders when multi-page: pages/, components/, styles/, scripts/, assets/, data/.
- Keep shared style.css + script.js as defaults unless architecture requires scoped files.
- Use route-oriented kebab-case naming for static pages.
- Do NOT create package.json or build configs unless explicitly requested.
- Explicit framework request detected: ${explicitFrameworkRequested ? 'YES' : 'NO'}.
- Include a route map contract (site-map.json or equivalent structured mapping) when multi-page output is used.

COMPONENT DECOMPOSITION:
- Break the UI into named sections: Header/Nav, Hero, Content Sections, Footer.
- Each plan step must name which UI sections it builds.
- Steps must be ordered: scaffold → structure → components → behavior → polish.

FILE DEDUPLICATION:
- NEVER create two files that serve the same purpose (e.g., styles.css AND main.css).
- If a file already exists at a path, edit it instead of creating a new one.
- Check for existing files before creating new ones.

RESPONSIVE & ACCESSIBILITY:
- Plan mobile-first: base styles for mobile, scale up via media queries.
- Include responsive breakpoints: mobile ≤480px, tablet ≤768px, desktop ≥1024px.
- Use semantic HTML5 elements (header, main, nav, section, footer).
- Include ARIA labels for interactive elements and ensure contrast ratios.

INTERACTIVITY:
- Specify which JavaScript behaviors each step produces.
- Plan mobile hamburger menu if nav exists.
- Plan form validation if forms exist.
- Plan smooth scroll navigation if multiple sections exist.

QUALITY:
- Each step must be atomic, testable, and independently verifiable in live preview.
- Optimize for instant preview — all files must be valid, linkable HTML/CSS/JS.
- Enforce complete-first-pass delivery with no placeholder TODOs.`;
          } else if (selectedProjectType === 'FULL_STACK') {
            planningRules += `

[PROJECT TYPE: FULL STACK]
- Create both frontend and backend components
- Include API endpoints and database integration
- Plan database schema design
- Implement proper authentication if needed
- Separate frontend and backend tasks logically
- Include API documentation or integration steps`;
          }

        const enhancedPlanPrompt = `${planningRules}\n\n${organizationPolicyBlock}\n\n[USER REQUEST]\n${enhancedRequestPrompt}`;

          try {
            return await fetch(PLAN_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                prompt: enhancedPlanPrompt,
                thinkingMode,
                architectMode,
                projectType: selectedProjectType,
                constraints,
                contextMeta: buildContextMetaPayload(),
                modelRouting: buildModelRoutingPayload(thinkingMode, architectMode)
              })
            });
          } catch (e: any) {
            if (abortedByUser) {
              const err = Object.assign(new Error('ABORTED_BY_USER'), { name: 'AbortError', abortedByUser: true });
              throw err;
            }
            throw e;
          } finally {
            if (abortSignal) {
              try {
                abortSignal.removeEventListener('abort', externalAbortListener);
              } catch {
                // ignore
              }
            }
            globalThis.clearTimeout(timer as any);
          }
        };

      let response: Response | null = null;
      let lastError: any = null;
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
          if (isAbortLike(e)) throw e;
          lastError = e;
          if (attempt >= 2) {
            const message = String(lastError?.message || '').toLowerCase();
            if (message.includes('failed to fetch') || message.includes('networkerror')) {
              throw new Error(`Cannot reach backend (${getApiBaseUrl()}). Check if API server is running.`);
            }
            if (message.includes('timeout') || message.includes('abort')) {
              throw new Error('Plan generation timeout - please try again');
            }
            throw new Error(getErrorMessage(lastError, 'Failed to generate plan'));
          }
          await new Promise((r) => globalThis.setTimeout(r as any, 1000));
        }
      }

      if (!response) throw new Error('Plan failed');

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        if (response.status === 404) throw new Error('Backend not found (404). Check API URL.');
        if (response.status === 504) throw new Error('Gateway Timeout (504). AI is taking too long.');
        if (response.status === 503 && /LLM_NOT_CONFIGURED/i.test(text)) {
          throw new Error('LLM_NOT_CONFIGURED: Backend AI provider is not configured. Set valid DEEPSEEK_API_KEY.');
        }
        throw new Error(text || `Plan failed (${response.status})`);
      }

      const data: any = await response.json();
      const steps = Array.isArray(data?.steps) ? data.steps : [];
      const title = typeof data?.title === 'string' ? data.title : undefined;
      const description = typeof data?.description === 'string' ? data.description : undefined;
      const stack = typeof data?.stack === 'string' ? data.stack : undefined;
      const fileTree = Array.isArray(data?.fileTree) ? data.fileTree : undefined;

      return { title, description, stack, fileTree, steps };
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
          abortSignal?: AbortSignal;
          onFileEvent?: (event: StreamFileEvent) => void;
          resumeContext?: {
            completedFiles: string[];
            lastSuccessfulFile: string | null;
            lastSuccessfulLine: number;
          };
          constraints?: GenerationConstraints;
        } = false
  ): Promise<void> {
    const { canMakeRequest, incrementRequests, tier } = useSubscriptionStore.getState();
    
    if (!canMakeRequest()) {
      onError(`Daily limit reached. You have 0 requests remaining on the ${tier} plan. Upgrade to PRO for more requests.`);
      return;
    }
    
    try {
      const options = typeof thinkingModeOrOptions === 'boolean' ? { thinkingMode: thinkingModeOrOptions } : thinkingModeOrOptions;
      const thinkingMode = Boolean(options.thinkingMode);
      const architectMode = Boolean(options.architectMode);
      const includeReasoning = Boolean(options.includeReasoning);
      const abortSignal = (options as any).abortSignal as AbortSignal | undefined;
      const constraints = options.constraints;
      const typingMsRaw = Number(options.typingMs ?? 26);
      const typingMs = Number.isFinite(typingMsRaw) ? typingMsRaw : 26;
      const resumeContext = options.resumeContext;

      // Inject Deep Context
      const projectState = useProjectStore.getState();
      const aiState = useAIStore.getState();
      const previewState = usePreviewStore.getState();
      const contextBundle = buildContextBundle({
        files: projectState.files,
        activeFile: projectState.activeFile,
        recentPreviewErrors: previewState.logs.slice(-24).map((entry) => String(entry.message || '')),
        prompt,
        mode: constraints?.contextIntelligenceMode || 'balanced_graph',
        maxFiles: 24
      });
      const retrievalTrace = contextBundle.retrievalTrace;
      const normalizedFiles = contextBundle.files.map((item) => item.path);

      const selectedProjectMode: GenerationConstraints['projectMode'] =
        constraints?.projectMode ||
        (projectState.projectType === 'FULL_STACK' ? 'FULL_STACK' : 'FRONTEND_ONLY');
      const foldersDigest = summarizeTopFolders(normalizedFiles);
      const recentPreviewErrors = previewState.logs
        .slice(-20)
        .map((line) => String(line.message || '').trim())
        .filter(Boolean)
        .slice(-8);

      const context = {
        files: normalizedFiles,
        foldersDigest,
        stack: projectState.stack,
        projectDescription: projectState.description,
        currentPlan: aiState.planSteps.map((s: any) => ({
          title: s.title,
          completed: s.completed,
          category: s.category
        })),
        activeFile: projectState.activeFile,
        previewRuntimeStatus: previewState.runtimeStatus,
        previewRuntimeMessage: previewState.runtimeMessage,
        recentPreviewErrors
      };

      let completedFiles = new Set<string>();
      if (resumeContext?.completedFiles) {
        completedFiles = new Set<string>(resumeContext.completedFiles);
      }

      const constrainedPrompt = constraints ? mergePromptWithConstraints(prompt, constraints) : prompt;
      const explicitFrameworkRequested = hasExplicitFrameworkRequest(constrainedPrompt);
      const frontendStrictModeBanner =
        selectedProjectMode === 'FRONTEND_ONLY'
          ? [
              '[FRONTEND STRICT MODE]',
              '- Default architecture: adaptive multi-page vanilla HTML/CSS/JS.',
              '- Use single-page only for simple requests; otherwise split into linked pages.',
              '- Keep shared styling/behavior centralized unless architecture requires scoped files.',
              '- Do not produce React/Next/Vite scaffolding unless explicitly requested.',
              `- Explicit framework request detected: ${explicitFrameworkRequested ? 'YES' : 'NO'}.`,
              '- Follow strict quality gate: structure + naming + routing + a11y + responsive + syntax-safe JS.'
            ].join('\n')
          : '';

      const enhancedPrompt = `
[SYSTEM PERSONA]
You are the Apex Coding V2.1 EXECUTION ENGINE.
Your success is measured ONLY by Execution completeness (%) and Preview Runner Compatibility.

NEGATIVE CONSTRAINTS (NEVER DO THIS):
- NEVER output partial files (e.g., "// ... rest of code").
- NEVER use SEARCH/REPLACE blocks or diff markers.
- NEVER output HTML without valid, functional JS.
- NEVER skip any planned task.
- NEVER declare completion without verification.

EXECUTION RULES:
1. **ATOMIC EXECUTION**:
   - Execute exactly ONE task at a time.
   - After execution, WAIT for verification.
   - If verification fails: Repair -> Re-execute.

2. **WEB PROJECT REQUIREMENTS (PREVIEW RUNNER READY)**:
   - **STRUCTURE**:
     - If project mode is FRONTEND_ONLY: default to adaptive multi-page vanilla frontend architecture.
     - Use single-page only for simple requests; otherwise create linked pages with coherent navigation.
     - Keep shared style.css and script.js defaults for static mode unless scoped files are clearly justified.
     - Only generate React/Next/Vite structure when explicitly requested by the user.
     - If project mode is FULL_STACK, use fullstack structure:
       - \`backend/\` (Node.js API)
       - \`frontend/\` (Vite + React + TS)
       - Root config files (\`package.json\`, \`vite.config.ts\`, etc.)
   - **DEPENDENCIES**: All imports must resolve. Include ALL dependencies in \`package.json\`.
   - **LIVE PREVIEW**: The project is executed in a Docker-based preview runner (not StackBlitz). Do NOT add StackBlitz/WebContainer scripts.
   - **DEV SERVER**: \`npm run dev\` must start the frontend on \`0.0.0.0:3000\` (use \`--host 0.0.0.0 --port 3000 --strictPort\` for Vite, or \`next dev -H 0.0.0.0 -p 3000\` for Next).
   - **FULLSTACK** (if backend exists): backend listens on \`0.0.0.0:3001\` and frontend dev server proxies \`/api\` to the backend during dev.

3. **FULL FILE OUTPUT**:
   - ALWAYS output the FULL content of the file.
   - If a file is too large, split it into modules.

4. **VALID HTML/CSS/JS**:
   - HTML: Semantic tags, accessibility friendly.
   - CSS: Responsive, mobile-first (TailwindCSS preferred).
   - JS: Error-free, console-log debugging enabled.
   - **NO BABEL ERRORS**: Use modern ES Modules syntax.
   - Always keep a newline after \`// comments\` before next statement; never glue comment text with code tokens.

5. **AUTOMATIC RESUME**:
   - If cut off, I will send "CONTINUE [FILE] [LINE]".
   - You MUST continue EXACTLY from that byte.

6. **NON-BLOCKING UI**:
   - Use \`requestAnimationFrame\` for animations.
   - Debounce heavy input handlers.
   - Never lock user input unless VERIFIED_COMPLETE.

7. **AGENT RESPONSIBILITIES (MANDATORY)**:
   - Act as a full AI agent for this workspace: analyze architecture, write code, fix runtime issues, and refactor structure.
   - Before declaring done, proactively validate likely preview/runtime risks and apply fixes in the same pass.
   - Keep folders organized and avoid duplicate files with conflicting purposes.

8. **FIRST-PASS QUALITY BAR (MANDATORY)**:
   - The first delivery must be strong and complete, not a rough scaffold.
   - Implement end-to-end behavior for the requested core use-cases.
   - Add practical validation/error states and realistic empty/loading handling where relevant.
   - Avoid placeholder sections or TODO comments in final output.
   - Prefer robust defaults and clean architecture when requirements are implicit.

9. **DECISION POLICY**:
   - If the prompt is underspecified, make the best professional assumptions and proceed.
   - Optimize for a reliable, production-ready baseline in the initial pass.

${buildAIOrganizationPolicyBlock(selectedProjectMode)}
${frontendStrictModeBanner ? `\n\n${frontendStrictModeBanner}` : ''}

[PROJECT CONTEXT]
Project Name: ${projectState.projectName}
Stack: ${projectState.stack || 'Not detected'}
Description: ${projectState.description || 'None'}
Active File: ${projectState.activeFile || 'None'}
Top Folders: ${context.foldersDigest || 'None'}
Context Budget: ${Number(aiState.contextBudget?.utilizationPct || 0).toFixed(1)}%
Preview Runtime: ${context.previewRuntimeStatus}${context.previewRuntimeMessage ? ` (${context.previewRuntimeMessage})` : ''}

[PLAN STATUS]
${context.currentPlan.map((s: any, i: number) => `${i + 1}. [${s.completed ? 'x' : ' '}] ${s.title} (${s.category || 'general'})`).join('\n')}

[FILE STRUCTURE]
${context.files.slice(0, 100).join('\n')}${context.files.length > 100 ? '\n...(truncated)' : ''}

[COMPLETED FILES]
${Array.from(completedFiles).join('\n')}

[RECENT PREVIEW SIGNALS]
${context.recentPreviewErrors.length > 0 ? context.recentPreviewErrors.join('\n') : 'None'}

[CONTEXT RETRIEVAL TRACE]
Strategy: ${retrievalTrace.strategy}
Selected: ${retrievalTrace.selected.slice(0, 40).map((item) => `${item.path} (${item.score})`).join(', ') || 'none'}

[USER REQUEST]
${constrainedPrompt}
`.trim();

      onMeta({ provider: 'vercel-backend', baseURL: getApiBaseUrl(), thinkingMode, architectMode });
      onStatus('streaming', 'Generating…');

      // ALWAYS use enhancedPrompt to enforce strict rules and context
      const streamPrompt = enhancedPrompt;

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

      const patchToken = '[[PATCH_FILE:';
      const startToken = '[[START_FILE:';
      const editToken = '[[EDIT_FILE:';
      const editNodeToken = '[[EDIT_NODE:';
      const deleteToken = '[[DELETE_FILE:';
      const moveToken = '[[MOVE_FILE:';
      const endToken = '[[END_FILE]]';
      const streamTailMax = 2200;

      const partialFiles = new Set<string>();
      let lastSuccessfulFile = resumeContext?.lastSuccessfulFile || '';
      let lastSuccessfulLine = resumeContext?.lastSuccessfulLine || 0;
      let requestCharged = false;

      const countLines = (text: string) => {
        let lines = 0;
        for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
        return lines;
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
              const patchIdx = this.scan.indexOf(patchToken);
              const editIdx = this.scan.indexOf(editToken);
              const editNodeIdx = this.scan.indexOf(editNodeToken);
              const deleteIdx = this.scan.indexOf(deleteToken);
              const moveIdx = this.scan.indexOf(moveToken);
              const nextIdx =
                [patchIdx, startIdx, editIdx, editNodeIdx, deleteIdx, moveIdx]
                  .filter((v) => v !== -1)
                  .sort((a, b) => a - b)[0] ?? -1;

              if (nextIdx === -1) {
                const keep = Math.max(
                  patchToken.length - 1,
                  startToken.length - 1,
                  editToken.length - 1,
                  editNodeToken.length - 1,
                  deleteToken.length - 1,
                  moveToken.length - 1
                );
                this.scan = this.scan.slice(Math.max(0, this.scan.length - keep));
                return;
              }

              if (deleteIdx === nextIdx) {
                const closeIdx = this.scan.indexOf(']]', nextIdx);
                if (closeIdx === -1) {
                  this.scan = this.scan.slice(nextIdx);
                  return;
                }
                const payload = this.scan.slice(nextIdx + deleteToken.length, closeIdx).trim();
                const parsed = this.parsePathWithReason(payload);
                if (parsed.path) {
                  options.onFileEvent?.({
                    type: 'delete',
                    path: parsed.path,
                    reason: parsed.reason,
                    safetyCheckPassed: false
                  });
                }
                this.scan = this.scan.slice(closeIdx + 2);
                continue;
              }

              if (moveIdx === nextIdx) {
                const closeIdx = this.scan.indexOf(']]', nextIdx);
                if (closeIdx === -1) {
                  this.scan = this.scan.slice(nextIdx);
                  return;
                }
                const payload = this.scan.slice(nextIdx + moveToken.length, closeIdx).trim();
                const parsed = this.parseMovePayload(payload);
                if (parsed.from && parsed.to) {
                  options.onFileEvent?.({
                    type: 'move',
                    path: parsed.from,
                    toPath: parsed.to,
                    reason: parsed.reason,
                    safetyCheckPassed: false
                  });
                }
                this.scan = this.scan.slice(closeIdx + 2);
                continue;
              }

              const isPatch = patchIdx !== -1 && patchIdx === nextIdx;
              const isEdit = (editIdx !== -1 && editIdx === nextIdx) || (editNodeIdx !== -1 && editNodeIdx === nextIdx);
              const token = isPatch
                ? patchToken
                : startIdx === nextIdx
                  ? startToken
                  : isEdit && editNodeIdx === nextIdx
                    ? editNodeToken
                    : editToken;
              const closeIdx = this.scan.indexOf(']]', nextIdx);
              if (closeIdx === -1) {
                this.scan = this.scan.slice(nextIdx);
                return;
              }

              const payload = this.scan.slice(nextIdx + token.length, closeIdx).trim();
              const patchPayload = isPatch ? this.parsePatchPayload(payload) : null;
              const rawPath = patchPayload?.path || payload;
              this.currentPath = rawPath;
              this.inFile = true;
              this.currentLine = 1;
              this.currentMode = patchPayload?.mode || (isEdit ? 'edit' : 'create');
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
            const nextPatchIdx = this.scan.indexOf(patchToken);
            const nextStartIdx = this.scan.indexOf(startToken);
            const nextEditIdx = this.scan.indexOf(editToken);
            const nextEditNodeIdx = this.scan.indexOf(editNodeToken);
            const nextDeleteIdx = this.scan.indexOf(deleteToken);
            const nextMoveIdx = this.scan.indexOf(moveToken);
            const nextMarkerIdx =
              [nextPatchIdx, nextStartIdx, nextEditIdx, nextEditNodeIdx, nextDeleteIdx, nextMoveIdx]
                .filter((v) => v !== -1)
                .sort((a, b) => a - b)[0] ?? -1;

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

            const keep = Math.max(
              patchToken.length + 8,
              startToken.length + 8,
              editToken.length + 8,
              editNodeToken.length + 8,
              deleteToken.length + 8,
              moveToken.length + 8,
              endToken.length + 8
            );
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
          // Keep file text untouched. Partial metadata is enough for recovery/repair.
          partialFiles.add(this.currentPath);
          options.onFileEvent?.({ type: 'end', path: this.currentPath, mode: this.currentMode, partial, line: this.currentLine });
          lastSuccessfulFile = this.currentPath;
          lastSuccessfulLine = this.currentLine;
          this.inFile = false;
          this.currentPath = '';
        }

        private parsePathWithReason(payload: string): { path: string; reason?: string } {
          const text = String(payload || '').trim();
          if (!text) return { path: '' };
          const parts = text.split('|').map((item) => item.trim()).filter(Boolean);
          const path = parts[0] || '';
          const reasonPart = parts.slice(1).join(' | ');
          const reason = reasonPart ? reasonPart.replace(/^reason\s*[:=]\s*/i, '').trim() : undefined;
          return { path, reason };
        }

        private parsePatchPayload(payload: string): { path: string; mode?: 'create' | 'edit'; reason?: string } {
          const text = String(payload || '').trim();
          if (!text) return { path: '' };
          const parts = text.split('|').map((item) => item.trim()).filter(Boolean);
          const path = parts[0] || '';
          let mode: 'create' | 'edit' | undefined;
          let reason: string | undefined;
          for (const part of parts.slice(1)) {
            const modeMatch = part.match(/^mode\s*[:=]\s*(create|edit)\s*$/i);
            if (modeMatch) {
              mode = modeMatch[1].toLowerCase() as 'create' | 'edit';
              continue;
            }
            if (/^reason\s*[:=]/i.test(part)) {
              reason = part.replace(/^reason\s*[:=]\s*/i, '').trim();
            }
          }
          return { path, mode, reason };
        }

        private parseMovePayload(payload: string): { from: string; to: string; reason?: string } {
          const text = String(payload || '').trim();
          if (!text) return { from: '', to: '' };
          const [routePart, ...rest] = text.split('|');
          const reasonPart = rest.join(' | ').trim();
          const reason = reasonPart ? reasonPart.replace(/^reason\s*[:=]\s*/i, '').trim() : undefined;
          const route = String(routePart || '').trim();
          const arrowIndex = route.indexOf('->');
          if (arrowIndex === -1) return { from: '', to: '', reason };
          const from = route.slice(0, arrowIndex).trim();
          const to = route.slice(arrowIndex + 2).trim();
          return { from, to, reason };
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
        
        // Get just the filename from the path for strict matching
        const cutFileName = cutPath.split('/').pop() || cutPath;
        
        return [
          streamPrompt,
          '',
          '=== CRITICAL AUTO-CONTINUE INSTRUCTION ===',
          '',
          `YOU WERE CUT OFF WHILE WRITING: ${cutPath}`,
          `CONTINUE THIS EXACT FILE FROM LINE ${cutLine + 1}`,
          '',
          'ABSOLUTE RULES:',
          `1. Output [[PATCH_FILE: ${cutPath} | mode: edit]] and continue from line ${cutLine + 1}`,
          `2. DO NOT create a NEW file - continue the SAME file: ${cutPath}`,
          `3. DO NOT create ${cutFileName} in a different folder`,
          '4. DO NOT restart the file from the beginning',
          '5. DO NOT output any text except [[PATCH_FILE:...]], code, and [[END_FILE]]',
          '6. NO "Continuing...", NO "Here is", NO explanations',
          '',
          completedList ? `ALREADY COMPLETED (do NOT repeat): ${completedList}` : '',
          '',
          'LAST CODE RECEIVED (continue from here):',
          tail ? tail : '(no tail available)',
          '',
          `NOW OUTPUT: [[PATCH_FILE: ${cutPath} | mode: edit]] then continue the code from line ${cutLine + 1}`
        ]
          .filter(Boolean)
          .join('\n');
      };

      // Filter to remove protocol noise from AI output
      const filterProtocolNoise = (text: string): string => {
        // Remove common noise patterns that AI might output
        const noisePatterns = [
          /^Searching\.{0,3}$/gm,
          /^Replacing\.{0,3}$/gm,
          /^Found \d+ match(es)?.*$/gm,
          /^Replaced .* with .*$/gm,
          /^Processing\.{0,3}$/gm,
          /^Working\.{0,3}$/gm,
          /^Continuing\.{0,3}$/gm
        ];
        let result = text;
        for (const pattern of noisePatterns) {
          result = result.replace(pattern, '');
        }
        return result;
      };

      const runStreamOnce = async (streamPrompt: string, resumeAppendPath?: string) => {
        const controller = new AbortController();
        let abortedByUser = false;
        let sawAnyToken = false;
        let sawAnyStreamSignal = false;
        let sawFileOpEvent = false;

        const externalAbortListener = () => {
          abortedByUser = true;
          try {
            controller.abort();
          } catch {
            // ignore
          }
        };

        if (abortSignal) {
          if (abortSignal.aborted) {
            externalAbortListener();
          } else {
            abortSignal.addEventListener('abort', externalAbortListener, { once: true });
          }
        }

        try {
        const contextFileCount = Math.max(1, Number(context?.files?.length || 1));
        const preTokenDefault = Math.round((thinkingMode ? 80_000 : 40_000) * Math.min(2.2, Math.max(1, contextFileCount / 30)));
        const preTokenTimeoutMs = Number((options as any).preTokenTimeoutMs ?? preTokenDefault);
        let preTokenTimer: any = null;
        const startPreTokenTimer = () => {
          if (preTokenTimer) return;
          preTokenTimer = globalThis.setTimeout(() => {
            try {
              if (!sawAnyStreamSignal) controller.abort();
            } catch {
              // ignore
            }
          }, preTokenTimeoutMs);
        };
        const stopPreTokenTimer = () => {
          if (preTokenTimer) {
            globalThis.clearTimeout(preTokenTimer);
            preTokenTimer = null;
          }
        };
        startPreTokenTimer();
        let response: Response;
        try {
          response = await fetch(apiUrl('/ai/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            signal: controller.signal,
            body: JSON.stringify({
              prompt: streamPrompt,
              thinkingMode,
              architectMode,
              includeReasoning,
              context,
              contextBundle,
              history: options.history || [],
              constraints,
              contextMeta: buildContextMetaPayload({ retrievalTrace }),
              modelRouting: buildModelRoutingPayload(thinkingMode, architectMode)
            })
          });
        } catch (e: any) {
          if (abortedByUser) {
            const err = Object.assign(new Error('ABORTED_BY_USER'), { name: 'AbortError', abortedByUser: true });
            throw err;
          }
          throw e;
        }

        if (!response.ok) {
          let message = `Streaming failed (${response.status})`;
          const errorText = await response.text().catch(() => '');
          if (response.status === 404) message = 'Backend not found (404). Check API URL.';
          else if (response.status === 504) message = 'Gateway Timeout (504). AI is taking too long.';
          else if (response.status === 503 && /LLM_NOT_CONFIGURED/i.test(errorText)) {
            message = 'LLM_NOT_CONFIGURED: Backend AI provider is not configured. Set valid DEEPSEEK_API_KEY.';
          }
          else if (errorText) message = errorText;
          throw new Error(message);
        }

        const body = response.body;
        if (!body) throw new Error('Streaming failed: empty response body');

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sawDoneStatus = false;
        let streamErrored = false;

        const contextMultiplier = Math.min(2.4, Math.max(1, contextFileCount / 45));
        const defaultStall = Math.round((thinkingMode ? 120_000 : 60_000) * contextMultiplier);
        const stallMsRaw = Number((options as any).stallTimeoutMs ?? defaultStall);
        const stallMs = Number.isFinite(stallMsRaw)
          ? Math.max(thinkingMode ? 30_000 : 15_000, stallMsRaw)
          : defaultStall;
        let lastUsefulAt = Date.now();
        let stallTimer: any = null;

        const kickStallTimer = () => {
          lastUsefulAt = Date.now();
          if (!stallTimer) {
            stallTimer = globalThis.setInterval(() => {
              if (!sawAnyToken && !sawAnyStreamSignal) return;
              const writingPath = String(useAIStore.getState().writingFilePath || '').toLowerCase();
              const fileTypeBoost = writingPath.endsWith('.svg') || writingPath.endsWith('.tsx') ? 1.35 : 1;
              const adaptiveStall = Math.round(stallMs * fileTypeBoost);
              const idleFor = Date.now() - lastUsefulAt;
              const idleThreshold = sawAnyToken ? adaptiveStall : Math.round(adaptiveStall * 1.2);
              if (idleFor < idleThreshold) return;
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
          if (!sawFileOpEvent) {
            markerParser.push(out);
          }
          onToken(out);
        });

        const consumeToken = (tokenChunk: string) => {
          if (!tokenChunk) return;
          // Filter out protocol noise from AI output (e.g., "Searching...", "Replacing...")
          const cleanedChunk = filterProtocolNoise(tokenChunk);
          if (!cleanedChunk.trim()) return; // Skip if chunk is only noise
          if (!requestCharged) {
            incrementRequests();
            requestCharged = true;
          }
          sawAnyToken = true;
          stopPreTokenTimer();
          kickStallTimer();
          streamTail = (streamTail + cleanedChunk).slice(-streamTailMax);
          player.enqueue(cleanedChunk);
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const decoded = decoder.decode(value, { stream: true });
            if (decoded.length === 0) continue;
            sawAnyStreamSignal = true;
            stopPreTokenTimer();

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
                sawAnyStreamSignal = true;
                stopPreTokenTimer();
                if (dataText.trim().length > 0) kickStallTimer();
                continue;
              }

              if (eventName === 'status') {
                const idx = dataText.indexOf(':');
                const phase = idx === -1 ? 'streaming' : dataText.slice(0, idx);
                const message = idx === -1 ? dataText : dataText.slice(idx + 1);
                onStatus(phase, message);
                sawAnyStreamSignal = true;
                stopPreTokenTimer();
                if (dataText.trim().length > 0) kickStallTimer();
                if (phase === 'done') sawDoneStatus = true;
                if (phase === 'error' && message) onError(message);
                continue;
              }

              if (eventName === 'thought' && includeReasoning) {
                sawAnyStreamSignal = true;
                stopPreTokenTimer();
                if (dataText.trim().length > 0) kickStallTimer();
                _onReasoning(dataText);
                continue;
              }

              if (eventName === 'file_op') {
                sawAnyStreamSignal = true;
                stopPreTokenTimer();
                if (dataText.trim().length > 0) kickStallTimer();
                const parsedEvent = parseFileOpEventPayload(dataText);
                if (parsedEvent) {
                  sawFileOpEvent = true;
                  if (!requestCharged) {
                    incrementRequests();
                    requestCharged = true;
                  }
                  sawAnyToken = true;
                  options.onFileEvent?.(parsedEvent);
                }
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
          if (abortedByUser) {
            const err = Object.assign(new Error('ABORTED_BY_USER'), { name: 'AbortError', abortedByUser: true });
            throw err;
          }
          if (!sawAnyToken) throw e;
        }

        if (!sawDoneStatus) onStatus('done', 'Complete');

        player.flushAll();
        if (stallTimer) {
          globalThis.clearInterval(stallTimer);
          stallTimer = null;
        }

        if (!sawAnyToken) {
          throw new Error('No response from backend (timeout). Please try again.');
        }

        if (streamErrored) {
          onStatus('streaming', 'Connection stalled; attempting resume…');
        }

        return { markerParser, sawFileOpEvent };
        } finally {
          if (abortSignal) {
            try {
              abortSignal.removeEventListener('abort', externalAbortListener);
            } catch {
              // ignore
            }
          }
        }
      };

      const maxResumeAttempts = 5;

      let first: { markerParser: any; sawFileOpEvent: boolean } | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          first = await runStreamOnce(streamPrompt);
          break;
        } catch (e: any) {
          if (e?.abortedByUser || e?.message === 'ABORTED_BY_USER' || e?.name === 'AbortError') throw e;
          if (attempt >= 3) throw e;
          onStatus('streaming', 'Retrying…');
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (!first) throw new Error('Streaming failed');
      let cut = first.sawFileOpEvent ? null : first.markerParser.finalize();
      let resumeAttempt = 0;
      while (cut && resumeAttempt < maxResumeAttempts) {
        resumeAttempt += 1;
        onStatus('recovering', `Resuming… (attempt ${resumeAttempt}/${maxResumeAttempts})`);
        onMeta({ resume: { attempt: resumeAttempt, file: cut.cutPath, line: cut.cutLine } });

        const resumePrompt = buildResumePrompt(cut.cutPath, cut.cutLine);
        const resumed = await runStreamOnce(resumePrompt, cut.cutPath);
        cut = resumed.sawFileOpEvent ? null : resumed.markerParser.finalize();

        if (cut && resumeAttempt < maxResumeAttempts) {
          const backoffMs = 550 * resumeAttempt;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }

      onJSON({
        project_files: [],
        metadata: {
          protocol: first?.sawFileOpEvent ? 'file-op-v2' : 'file-marker',
          completedFiles: completedFiles.size,
          partialFiles: partialFiles.size,
          lastSuccessfulFile,
          lastSuccessfulLine
        },
        instructions: ''
      });

      onComplete();
      } catch (err: any) {
      const userAborted = Boolean(err?.abortedByUser || err?.message === 'ABORTED_BY_USER');
      if (userAborted) {
        onStatus('done', 'Stopped');
        onComplete();
        return;
      }

      let errorMessage = String(err?.message || 'Streaming failed');
      if (err?.name === 'AbortError') {
        errorMessage =
          'STREAM_TIMEOUT: generation stream stalled or timed out. Please retry (or reduce prompt/context size).';
      }

      onError(errorMessage);
      onComplete();
    }
  }
};
