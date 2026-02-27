import { ProjectFile } from '@/types';
import { apiUrl, getApiBaseUrl } from '@/services/apiBase';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { usePreviewStore } from '@/stores/previewStore';
import type { GenerationConstraints, GenerationProfile } from '@/types/constraints';
import { buildAIOrganizationPolicyBlock, mergePromptWithConstraints } from '@/services/constraintPromptBuilder';
import { buildContextBundle } from '@/services/contextRetrievalEngine';
import { summarizeMemorySnapshot } from '@/services/memoryEngine';
import { parseFileOpEventPayload } from '@/services/fileOpEvents';
import type { WorkspaceAnalysisReport } from '@/types/context';
import type { StrictWritePolicy } from '@/services/workspaceIntelligence';
import { sanitizeOperationPath, stripTrailingFileMarkerFragment } from '@/utils/fileOpGuards';
import { hasExplicitFrameworkRequest, resolveGenerationProfile } from '@/utils/generationProfile';

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

const buildModelRoutingPayload = (thinkingMode: boolean, multiAgentEnabled: boolean = false) => {
  return {
    plannerProvider: 'deepseek',
    plannerModel: 'deepseek-chat',
    executorProvider: 'deepseek',
    executorModel: thinkingMode ? 'deepseek-reasoner' : 'deepseek-chat',
    fallbackPolicy: 'planner->executor->default',
    multiAgent: {
      enabled: Boolean(multiAgentEnabled),
      activation: 'manual_toggle',
      strictGate: 'strict',
      visibility: 'compact',
      specialistSet: 'planner_html_css_js_v1'
    }
  };
};

const buildContextMetaPayload = (extra?: Record<string, unknown>) => {
  const ai = useAIStore.getState();
  const decisionMemory = (ai.compressionSnapshot?.summaryBlocks || [])
    .flatMap((block) => block.keyDecisions || [])
    .slice(0, 16);
  const memorySummary = summarizeMemorySnapshot(ai.memorySnapshot);
  return {
    budget: ai.contextBudget,
    compressionSummary: ai.compressionSnapshot,
    sessionId: ai.currentSessionId,
    decisionMemory,
    memorySummary,
    memorySnapshot: ai.memorySnapshot || null,
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

const getErrorMessage = (err: any, fallback: string) => {
  return (
    err?.error ||
    err?.message ||
    fallback
  );
};

const BACKEND_CHAT_PROMPT_LIMIT = 80_000;
const BACKEND_PLAN_PROMPT_LIMIT = 30_000;
const CLIENT_PROMPT_SAFETY_MARGIN = 0.9;

const trimPromptForBackend = (rawPrompt: string, backendLimit: number) => {
  const prompt = String(rawPrompt || '');
  const safeLimit = Math.max(2_000, Math.floor(Number(backendLimit || 0) * CLIENT_PROMPT_SAFETY_MARGIN));
  if (prompt.length <= safeLimit) {
    return { prompt, truncated: false, omittedChars: 0, safeLimit };
  }

  const marker =
    `\n\n[PROMPT_TRIMMED_FOR_TRANSPORT]\n` +
    `Some middle context was omitted to fit backend request limits.\n` +
    `Prioritize the latest request details and end constraints.\n\n`;
  const available = Math.max(1_000, safeLimit - marker.length);
  const headSize = Math.floor(available * 0.62);
  const tailSize = Math.max(300, available - headSize);
  const head = prompt.slice(0, headSize);
  const tail = prompt.slice(Math.max(headSize, prompt.length - tailSize));
  const compact = `${head}${marker}${tail}`;
  const finalPrompt = compact.length > safeLimit ? compact.slice(0, safeLimit) : compact;

  return {
    prompt: finalPrompt,
    truncated: true,
    omittedChars: Math.max(0, prompt.length - finalPrompt.length),
    safeLimit
  };
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
    projectType?: 'FRONTEND_ONLY' | null,
    constraints?: GenerationConstraints,
    architectMode: boolean = false,
    multiAgentEnabled: boolean = false
  ): Promise<{ title?: string; description?: string; stack?: string; fileTree?: string[]; steps: Array<{ id: string; title: string; category?: string; files?: string[]; description?: string }> }> {
    try {
      const PLAN_URL = apiUrl('/ai/plan');
      const isAbortLike = (err: any) =>
        err?.abortedByUser || err?.message === 'ABORTED_BY_USER' || err?.name === 'AbortError';

        const postOnce = async () => {
          const controller = new AbortController();
          let abortedByUser = false;
          const timeoutMs = thinkingMode ? 300_000 : 180_000;
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

          const selectedProjectType: GenerationConstraints['projectMode'] =
            projectType === 'FRONTEND_ONLY' ? projectType : 'FRONTEND_ONLY';
          const organizationPolicyBlock = buildAIOrganizationPolicyBlock(selectedProjectType);
          const transportPrompt = trimPromptForBackend(prompt, BACKEND_PLAN_PROMPT_LIMIT);
          const enhancedRequestPrompt = constraints
            ? mergePromptWithConstraints(transportPrompt.prompt, constraints)
            : transportPrompt.prompt;
          const explicitFrameworkRequested = hasExplicitFrameworkRequest(enhancedRequestPrompt);
          const generationProfile = resolveGenerationProfile({
            requested: constraints?.generationProfile,
            prompt: enhancedRequestPrompt,
            filePaths: useProjectStore.getState().files.map((file) => file.path || file.name || '')
          });

          // Add projectType-specific guidelines
          if (selectedProjectType === 'FRONTEND_ONLY') {
            if (generationProfile === 'framework') {
              planningRules += `

[PROJECT TYPE: FRONTEND ONLY / FRAMEWORK PROFILE]
STRUCTURE:
- Prefer framework-oriented frontend architecture (React/Next/Vite) based on request.
- Never generate backend/server/database/auth files.
- Use reusable components, route pages, and typed utility modules.
- Keep folder conventions: src/app or src/pages, src/components, src/styles, src/lib/utils, public/.
- Explicit framework request detected: ${explicitFrameworkRequested ? 'YES (honor it)' : 'NO (choose best framework baseline)'}.

COMPONENT DECOMPOSITION:
- Break the UI into named sections and reusable components.
- Each plan step must specify target components/pages and affected files.

QUALITY:
- Each step must be atomic, testable, and preview-verifiable.
- Enforce complete-first-pass delivery with no placeholder TODOs.`;
            } else {
              planningRules += `

[PROJECT TYPE: FRONTEND ONLY]
STRUCTURE:
- Default to adaptive multi-page static output (vanilla HTML/CSS/JS).
- Use single-page only when the request is simple and clearly scoped.
- Auto-switch to multi-page when request implies: multiple services/products, legal pages, blog/docs/faq, or dashboard-like flows.
- Never switch to React/Next/Vite or any framework scaffold.
- NO backend APIs, databases, server-side code, or authentication.
- Prefer canonical static folders when multi-page: pages/, components/, styles/, scripts/, assets/, data/.
- Keep shared style.css + script.js as defaults unless architecture requires scoped files.
- Use route-oriented kebab-case naming for static pages.
- Do NOT create package.json or build configs.
- Explicit framework request detected: ${explicitFrameworkRequested ? 'YES (switch profile if needed)' : 'NO'}.
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
            }
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
                multiAgentEnabled,
                constraints,
                contextMeta: buildContextMetaPayload(),
                modelRouting: buildModelRoutingPayload(thinkingMode, multiAgentEnabled)
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
      for (let attempt = 0; attempt < 2; attempt++) {
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
          if (attempt >= 1) {
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
          multiAgentEnabled?: boolean;
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
          workspaceAnalysis?: WorkspaceAnalysisReport | null;
          writePolicy?: StrictWritePolicy | null;
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
      const multiAgentEnabled = Boolean(options.multiAgentEnabled);
      const includeReasoning = Boolean(options.includeReasoning);
      const abortSignal = (options as any).abortSignal as AbortSignal | undefined;
      const constraints = options.constraints;
      const workspaceAnalysis = options.workspaceAnalysis || null;
      const writePolicy = options.writePolicy || null;
      const typingMsRaw = Number(options.typingMs ?? 26);
      const typingMs = Number.isFinite(typingMsRaw) ? typingMsRaw : 26;
      const resumeContext = options.resumeContext;
      const transportPrompt = trimPromptForBackend(prompt, BACKEND_CHAT_PROMPT_LIMIT);
      const effectivePrompt = transportPrompt.prompt;

      // Inject Deep Context
      const projectState = useProjectStore.getState();
      const aiState = useAIStore.getState();
      const previewState = usePreviewStore.getState();
      const contextBundle = buildContextBundle({
        files: projectState.files,
        activeFile: projectState.activeFile,
        recentPreviewErrors: previewState.logs.slice(-24).map((entry) => String(entry.message || '')),
        prompt: effectivePrompt,
        memoryHints: aiState.memorySnapshot?.ledger?.decisions?.map((item) => item.summary) || [],
        mode: constraints?.contextIntelligenceMode || 'balanced_graph',
        maxFiles: constraints?.contextIntelligenceMode === 'strict_full' ? 40 : 24,
        maxChars: 120_000,
        workspaceAnalysis
      });
      const retrievalTrace = contextBundle.retrievalTrace;
      const normalizedFiles = contextBundle.files.map((item) => item.path);

      const selectedProjectMode: GenerationConstraints['projectMode'] = constraints?.projectMode || 'FRONTEND_ONLY';
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

      const constrainedPrompt = constraints ? mergePromptWithConstraints(effectivePrompt, constraints) : effectivePrompt;
      const explicitFrameworkRequested = hasExplicitFrameworkRequest(constrainedPrompt);
      const generationProfile = resolveGenerationProfile({
        requested: constraints?.generationProfile,
        prompt: constrainedPrompt,
        filePaths: projectState.files.map((file) => file.path || file.name || '')
      });
      const frontendStrictModeBanner =
        selectedProjectMode === 'FRONTEND_ONLY'
          ? [
              '[FRONTEND STRICT MODE]',
              generationProfile === 'framework'
                ? '- Framework profile enabled: choose React/Next/Vite structure that best matches request + existing workspace.'
                : '- Static profile enabled: adaptive multi-page vanilla HTML/CSS/JS by default.',
              generationProfile === 'framework'
                ? '- Keep frontend-only boundaries, but allow framework scaffolding and modular architecture.'
                : '- Use single-page only for simple requests; otherwise split into linked pages.',
              '- Decide the full target file map first, then implement files in deterministic order.',
              generationProfile === 'framework'
                ? '- Keep folder organization: src/app|pages, src/components, src/styles, src/lib, public.'
                : '- Keep folder-first organization: pages/, components/, styles/, scripts/, assets/, data/.',
              generationProfile === 'framework'
                ? `- Explicit framework request detected: ${explicitFrameworkRequested ? 'YES (honor it)' : 'NO (auto-select best fit)'}.`
                : `- Explicit framework request detected: ${explicitFrameworkRequested ? 'YES (switching to framework profile)' : 'NO'}.`,
              '- Follow strict quality gate: structure + naming + routing + a11y + responsive + syntax-safe JS.'
            ].join('\n')
          : '';

      const architectureExecutionRules =
        generationProfile === 'framework'
          ? [
              '- If project mode is FRONTEND_ONLY: use a framework-friendly frontend architecture when request/workspace indicates it.',
              '- Use reusable typed components, predictable routing, and modular style organization.',
              '- Never generate backend/server/database/auth files.'
            ].join('\n')
          : [
              '- If project mode is FRONTEND_ONLY: default to adaptive multi-page vanilla frontend architecture.',
              '- For FRONTEND_ONLY static profile: lock a full file plan before writing code and execute file patches in a stable sequence.',
              '- Use single-page only for simple requests; otherwise create linked pages with coherent navigation.',
              '- Keep shared style.css and script.js defaults for static mode unless scoped files are clearly justified.',
              '- Never generate React/Next/Vite structure in static profile.'
            ].join('\n');

      const enhancedPrompt = `
[SYSTEM PERSONA]
You are the Apex Coding V2.1 EXECUTION ENGINE.
Your success is measured ONLY by Execution completeness (%) and Preview Runner Compatibility.

NEGATIVE CONSTRAINTS (NEVER DO THIS):
- ⛔ NEVER open a [[PATCH_FILE:...]] block and immediately close it with [[END_FILE]] without real code inside. ZERO EMPTY FILES.
- NEVER output partial files (e.g., "// ... rest of code" or "/* styles here */").
- NEVER use SEARCH/REPLACE blocks or diff markers.
- NEVER skip any planned task.
- NEVER create two files that serve the same purpose (e.g. do NOT create styles.css if style.css already exists).
- NEVER create CSS/JS files with forbidden names: styles.css, main.css, global.css, app.css, app.js, main.js, index.js.

EXECUTION RULES:
1. **ZERO EMPTY FILES (RULE #0 — HIGHEST PRIORITY)**:
   - Every [[PATCH_FILE:...]] block MUST contain complete, functional code before [[END_FILE]].
   - Before opening a file block, have the FULL content ready to write.
   - An empty file block or a file with only a comment is a CRITICAL FAILURE.

2. **MANDATORY FILE ORDER (HTML → CSS → JS)**:
   - For static sites: output index.html FIRST, then style.css, then script.js.
   - NEVER write style.css or script.js before index.html.
   - For multi-page sites: output ALL .html pages first, then the single shared style.css, then the single shared script.js.

3. **WEB PROJECT REQUIREMENTS (PREVIEW RUNNER READY)**:
   - **STRUCTURE**:
${architectureExecutionRules
  .split('\n')
  .map((line) => `     ${line}`)
  .join('\n')}
     - **LIVE PREVIEW**: The project is executed in a Docker-based preview runner (not StackBlitz). Do NOT add StackBlitz/WebContainer scripts.

4. **SURGICAL EDIT POLICY**:
   - When modifying an EXISTING project, ONLY emit files that ACTUALLY CHANGE.
   - Do NOT re-emit unchanged files. Leave them completely alone.
   - For each changed file, output the FULL updated content of THAT file.
   - Use [[PATCH_FILE: path | mode: edit]] for existing files, [[PATCH_FILE: path | mode: create]] for new files.

5. **VALID HTML/CSS/JS**:
   - HTML: Semantic tags (header, main, nav, section, footer), accessibility friendly, ARIA labels.
   - CSS: Responsive, mobile-first (base for mobile, scale up with media queries).
   - JS: Error-free, modern ES6+ syntax. No console.log in production logic.
   - Always keep a newline after \`// comments\` before next statement; never glue comment text with code tokens.

6. **AUTOMATIC RESUME**:
   - If cut off, continue the SAME file from where you stopped.
   - Use [[PATCH_FILE: exact/same/path.ext | mode: edit]] to continue.
   - Do NOT create a new file with a different name. Do NOT restart from beginning.

7. **NON-BLOCKING UI**:
   - Use \`requestAnimationFrame\` for animations.
   - Debounce heavy input handlers.

8. **AGENT RESPONSIBILITIES (MANDATORY)**:
   - Act as a full AI agent for this workspace: analyze architecture, write code, fix runtime issues, and refactor structure.
   - Before declaring done, proactively validate likely preview/runtime risks and apply fixes in the same pass.
   - Keep folders organized and avoid duplicate files with conflicting purposes.

9. **FIRST-PASS QUALITY BAR (MANDATORY)**:
   - The first delivery must be strong and complete, not a rough scaffold.
   - Implement end-to-end behavior for the requested core use-cases.
   - Avoid placeholder sections or TODO comments in final output.
   - Prefer robust defaults and clean architecture when requirements are implicit.

10. **CANONICAL FILE MAP (MANDATORY)**:
   - The [REQUIRED FILE MAP] section below lists every file path from the plan.
   - You MUST write files using EXACTLY those paths — no renaming, no adding undeclared paths.
   - Write files in the ORDER they appear in the file map (HTML pages first, then CSS, then JS).
   - To add an undeclared helper file: [[PATCH_FILE: path | mode: create | reason: justification]].
   - If a path is NOT in the FILE MAP, DO NOT create it — patch an existing file instead.
   - NEVER create a second file serving the same purpose as an existing one.

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

[REQUIRED FILE MAP]
${(() => {
  const planFileTree = aiState.planSteps.flatMap((s: any) => Array.isArray(s.files) ? s.files : []);
  const uniqueFiles = [...new Set(planFileTree)].filter(Boolean);
  return uniqueFiles.length > 0
    ? uniqueFiles.join('\n')
    : context.files.slice(0, 80).join('\n') || 'Auto-detect from plan';
})()}

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

      onMeta({ provider: 'vercel-backend', baseURL: getApiBaseUrl(), thinkingMode, architectMode, multiAgentEnabled });
      if (transportPrompt.truncated) {
        onStatus(
          'streaming',
          `Prompt trimmed automatically (${transportPrompt.omittedChars} chars omitted) to satisfy backend size limits.`
        );
      }
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
              const rawPath = sanitizeOperationPath(patchPayload?.path || payload);
              if (!rawPath) {
                this.scan = this.scan.slice(closeIdx + 2);
                continue;
              }
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
          const path = sanitizeOperationPath(parts[0] || '');
          const reasonPart = parts.slice(1).join(' | ');
          const reason = reasonPart ? reasonPart.replace(/^reason\s*[:=]\s*/i, '').trim() : undefined;
          return { path, reason };
        }

        private parsePatchPayload(payload: string): { path: string; mode?: 'create' | 'edit'; reason?: string } {
          const text = String(payload || '').trim();
          if (!text) return { path: '' };
          const parts = text.split('|').map((item) => item.trim()).filter(Boolean);
          const path = sanitizeOperationPath(parts[0] || '');
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
          const from = sanitizeOperationPath(route.slice(0, arrowIndex).trim());
          const to = sanitizeOperationPath(route.slice(arrowIndex + 2).trim());
          return { from, to, reason };
        }

        finalize(): { cutPath: string; cutLine: number } | null {
          if (!this.inFile) return null;
          if (this.scan.length > 0) {
            this.flushContent(stripTrailingFileMarkerFragment(this.scan));
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
        let sawUsefulOutput = false;
        let sawFileOpEvent = false;
        let preTokenTimer: any = null;

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
        const preTokenDefault = Math.round((thinkingMode ? 360_000 : 240_000) * Math.min(2.4, Math.max(1, contextFileCount / 30)));
        const preTokenTimeoutMs = Number((options as any).preTokenTimeoutMs ?? preTokenDefault);
        const startPreTokenTimer = () => {
          if (preTokenTimer) return;
          preTokenTimer = globalThis.setTimeout(() => {
            try {
              if (!sawUsefulOutput) controller.abort();
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
              multiAgentEnabled,
              includeReasoning,
              context,
              contextBundle,
              workspaceAnalysis,
              writePolicy,
              history: options.history || [],
              constraints,
              contextMeta: buildContextMetaPayload({ retrievalTrace }),
              modelRouting: buildModelRoutingPayload(thinkingMode, multiAgentEnabled)
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
        const defaultStall = Math.round((thinkingMode ? 360_000 : 240_000) * contextMultiplier);
        const stallMsRaw = Number((options as any).stallTimeoutMs ?? defaultStall);
        const stallMs = Number.isFinite(stallMsRaw)
          ? Math.max(thinkingMode ? 120_000 : 90_000, stallMsRaw)
          : defaultStall;
        let lastUsefulAt = Date.now();
        let stallTimer: any = null;

        const kickStallTimer = () => {
          lastUsefulAt = Date.now();
          if (!stallTimer) {
            stallTimer = globalThis.setInterval(() => {
              if (!sawAnyToken && !sawFileOpEvent) return;
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
          sawUsefulOutput = true;
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
                sawUsefulOutput = true;
                stopPreTokenTimer();
                if (dataText.trim().length > 0) kickStallTimer();
                _onReasoning(dataText);
                continue;
              }

              if (eventName === 'file_op') {
                stopPreTokenTimer();
                if (dataText.trim().length > 0) kickStallTimer();
                const parsedEvent = parseFileOpEventPayload(dataText);
                if (parsedEvent) {
                  sawFileOpEvent = true;
                  sawUsefulOutput = true;
                  stopPreTokenTimer();
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
          if (preTokenTimer) {
            try {
              globalThis.clearTimeout(preTokenTimer);
            } catch {
              // ignore
            }
            preTokenTimer = null;
          }
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
          if (e?.abortedByUser || e?.message === 'ABORTED_BY_USER') throw e;
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
