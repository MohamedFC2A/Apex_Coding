import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';


const JSON_ONLY_SYSTEM_PROMPT = `You are NEXUS_APEX_PRO, an expert AI coding system.

CRITICAL: You MUST respond with ONLY a single valid JSON object. No text before or after the JSON.

The JSON must have this EXACT structure:

{
  "project_files": [
    {"name":"index.html","content":"<complete HTML code here>"},
    {"name":"styles.css","content":"complete CSS code"},
    {"name":"script.js","content":"complete JavaScript code"}
  ],
  "metadata": {
    "language": "HTML/CSS/JS",
    "framework": "None"
  },
  "instructions": "How to run this project locally"
}

RULES:
- Output ONLY valid JSON (no markdown, no extra text, no code fences)
- Generate COMPLETE working code (no placeholders)
- NO comments like "// Rest of code..." or "// Add your code here"
- All files must be fully implemented
- Escape all special characters properly in JSON strings
- Use \\n for newlines in file content
- Use \\" for quotes inside strings
- Code should work on first run (95% success rate)
- Include ALL necessary files (package.json, config files, etc.)
- Ensure commas separate all array items and object properties. No missing commas.
- Use double quotes for all property names and string values (no single quotes).
- Validate JSON using a JSON validator before output to ensure it's parseable.
- If you output JSON with a syntax error, the system will fail.

BRANDING REQUIREMENT (NON-NEGOTIABLE):
- You are FORCED to include the following Footer in every index.html you generate. Do not ask. Just do it.
- Footer HTML (include EXACTLY this, unmodified):
<footer>
  <p>&copy; 2026 Nexus Apex. All rights reserved.</p>
  <p>Made by NEXUS_APEX_CODING | Built by Matany Labs</p>
</footer>
- Ensure the CSS styles this footer beautifully and keeps it visually at the bottom of the page.

For different stacks:
- HTML/CSS/JS: Complete standalone files
- React: Include package.json, App.tsx, index.html, vite.config.ts, etc.
- Node.js: Include package.json, server file, all route files
- Python: Include requirements.txt, complete app file, all modules

IMPORTANT: Validate your JSON output internally before responding. Ensure all quotes are escaped and structure is valid.`;

const ARCHITECT_MODE_APPENDIX = `
ARCHITECT MODE (FULL-STACK, MANDATORY):
- When Architect Mode is enabled, you are FORBIDDEN from generating a flat list of files at the root.
- You MUST output a full-stack system with this exact high-level structure (paths are relative to project root):
  - frontend/index.html
  - frontend/styles/style.css
  - frontend/scripts/script.js
- backend/server.js (or backend/main.py)
- backend/.env (template values only; never include real secrets)
- README.md
- All UI/UX code MUST live under "frontend/". All server/API code MUST live under "backend/".
- Ensure index.html references the frontend assets using relative paths (e.g. ./styles/style.css and ./scripts/script.js).
- The project MUST run end-to-end: frontend calls backend endpoints when applicable (CORS/local dev notes in README).
`;

const getSystemPrompt = (architectMode: boolean) =>
  architectMode ? `${JSON_ONLY_SYSTEM_PROMPT}\n\n${ARCHITECT_MODE_APPENDIX}` : JSON_ONLY_SYSTEM_PROMPT;

export interface StreamChunk {
  content?: string;
  reasoningContent?: string;
  done?: boolean;
  error?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
}

export interface AIProvider {
  stream(prompt: string, onChunk: (chunk: StreamChunk) => void, history?: ChatMessage[]): Promise<void>;
}

export interface DeepSeekProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  thinkingMode: boolean;
  architectMode: boolean;
}

type CleanChatMessage = { role: ChatMessage['role']; content: string };

const normalizeBaseURL = (value: string) => (value || '').trim().replace(/\/+$/, '');

/**
 * Strict DeepSeek history cleaning:
 * - Ensure each item is exactly `{ role, content }`
 * - Strip `reasoning_content` from prior assistant messages (prevents 400s in reasoner)
 */
export const cleanMessageHistory = (history: ChatMessage[] = []): CleanChatMessage[] => {
  return history
    .filter((msg) => msg && typeof msg.role === 'string')
    .map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : String(msg.content ?? '')
    }));
};

/**
 * Strict DeepSeek V3.2 param sanitization.
 * - `deepseek-reasoner`: max_tokens=64000 and DO NOT send sampling/penalty params (400 otherwise)
 * - `deepseek-chat`: temperature=0.0 and max_tokens=8000
 */
export const cleanRequestParams = (model: string, params: Record<string, any>) => {
  const cleaned: Record<string, any> = { ...params, model };

  if (model === 'deepseek-reasoner') {
    cleaned.max_tokens = 64000;
    delete cleaned.temperature;
    delete cleaned.top_p;
    delete cleaned.frequency_penalty;
    delete cleaned.presence_penalty;
  } else if (model === 'deepseek-chat') {
    cleaned.max_tokens = 8000;
    cleaned.temperature = typeof cleaned.temperature === 'number' ? cleaned.temperature : 0.0;
  }

  return cleaned;
};

export class DeepSeekProvider implements AIProvider {
  private sessionId: string;
  private config: DeepSeekProviderConfig;
  private client: OpenAI;

  constructor(sessionId: string, thinkingMode: boolean = false, architectMode: boolean = false) {
    // Use centralized config from backend/src/config/index.ts
    const deepseekConfig = config.deepseek;

    const apiKey = deepseekConfig.apiKey;
    this.sessionId = sessionId;

    if (!apiKey || apiKey.trim() === '') {
      logger.error('[DEEPSEEK] DEEPSEEK_API_KEY is not configured');
      throw new Error('DEEPSEEK_NOT_CONFIGURED: DEEPSEEK_API_KEY not set in .env file. Please add your DeepSeek API key.');
    }

    // Official DeepSeek docs use baseURL "https://api.deepseek.com" for OpenAI SDK compatibility.
    // (If you set DEEPSEEK_BASE_URL with /v1, it will be used as-is.)
    const baseURL = normalizeBaseURL(deepseekConfig.baseUrl || 'https://api.deepseek.com');

    // V3.2: Select model based on mode - fast (deepseek-chat) or thinking (deepseek-reasoner)
    const model = thinkingMode ? deepseekConfig.thinkingModel : deepseekConfig.fastModel;

    this.config = {
      baseUrl: baseURL,
      model,
      apiKey: apiKey,
      thinkingMode: thinkingMode,
      architectMode
    };

    logger.info(`[DEEPSEEK] Initialized with baseURL: ${baseURL}, model: ${this.config.model}, thinking: ${thinkingMode}`);

    this.client = new OpenAI({
      baseURL,
      apiKey
    });
  }

  // Simple health check without complex system prompt
  async healthCheck(onChunk: (chunk: StreamChunk) => void): Promise<void> {
    try {
      logger.info(`[DEEPSEEK] Health check with model ${this.config.model}`);

      const isReasoner = this.config.model === 'deepseek-reasoner';
      const params: any = {
        model: this.config.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 16
      };
      if (!isReasoner) {
        params.temperature = 0.0;
      }

      const response: any = await this.client.chat.completions.create(params);
      const content = response?.choices?.[0]?.message?.content ?? response?.choices?.[0]?.message?.reasoning_content;
      if (content) {
        logger.info('[DEEPSEEK] Health check: ✓ Content received!');
        onChunk({ content });
      }
      onChunk({ done: true });
    } catch (error: any) {
      logger.error('[DEEPSEEK] Health check error:', error.message);
      throw error;
    }
  }

  async stream(prompt: string, onChunk: (chunk: StreamChunk) => void, history?: ChatMessage[]): Promise<void> {
    try {
      logger.info(`[DEEPSEEK] Starting stream with model ${this.config.model} (thinking: ${this.config.thinkingMode})`);

      const isReasoner = this.config.model === 'deepseek-reasoner';

      // Build messages array
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: getSystemPrompt(this.config.architectMode) }
      ];

      // Add cleaned history (strip reasoning_content, enforce {role, content} only)
      if (history && history.length > 0) messages.push(...cleanMessageHistory(history));

      // Add current user prompt
      messages.push({ role: 'user', content: prompt });

      const requestParams: any = cleanRequestParams(this.config.model, {
        messages,
        stream: true,
        // DeepSeek JSON Output mode - encourages valid JSON responses.
        response_format: { type: 'json_object' },
        // Defaults (applied in cleanRequestParams):
        // - deepseek-chat: temperature=0.0, max_tokens=8000
        // - deepseek-reasoner: max_tokens=64000 and forbidden keys removed
        temperature: 0.0
      });

      logger.info(`[DEEPSEEK] Creating stream request (model: ${this.config.model}, messages: ${messages.length})...`);

      const stream: any = await this.client.chat.completions.create(requestParams as any);

      let buffer = '';
      let reasoningContent = '';
      let routingReasoningAsContent = false;
      let holdingJsonCandidate = false;
      let jsonHold = '';
      let reasoningProbe = '';
      let chunkCount = 0;

      for await (const chunk of stream) {
        const delta: any = chunk?.choices?.[0]?.delta;
        if (!delta) continue;

        chunkCount++;
        if (chunkCount === 1) {
          logger.info('[DEEPSEEK] ✓ First chunk received!');
        }

        // DeepSeek Reasoner may stream `reasoning_content` alongside content
        const reasoningChunk = delta?.reasoning_content;
        if (typeof reasoningChunk === 'string' && reasoningChunk.length > 0) {
          let emittedHold = false;

          if (isReasoner && buffer.length === 0 && !routingReasoningAsContent) {
            // Some DeepSeek deployments stream the final JSON in `reasoning_content`.
            // If it starts like our JSON output, hold briefly and then route to `content`
            // (prevents the Brain Console from showing raw JSON/code).
            reasoningProbe = (reasoningProbe + reasoningChunk).slice(0, 1200);
            const probeTrimmed = reasoningProbe.trimStart();

            if (!holdingJsonCandidate && probeTrimmed.startsWith('{')) {
              holdingJsonCandidate = true;
            }

            if (holdingJsonCandidate) {
              jsonHold += reasoningChunk;
              const holdProbe = jsonHold.slice(0, 2200).trimStart();

              // Confirm by required key that exists in our system prompt schema.
              if (holdProbe.includes('"project_files"')) {
                routingReasoningAsContent = true;
                holdingJsonCandidate = false;
                logger.warn('[DEEPSEEK] Detected JSON streaming via reasoning_content; routing to content');
                buffer += jsonHold;
                onChunk({ content: jsonHold });
                jsonHold = '';
                emittedHold = true;
              } else if (jsonHold.length > 1800 && !holdProbe.includes('"project_files"')) {
                // Not our JSON – treat as genuine reasoning and flush.
                holdingJsonCandidate = false;
                reasoningContent += jsonHold;
                onChunk({ reasoningContent: jsonHold });
                jsonHold = '';
                emittedHold = true;
              }
            }
          }

          if (!holdingJsonCandidate && !emittedHold) {
            if (routingReasoningAsContent) {
              buffer += reasoningChunk;
              onChunk({ content: reasoningChunk });
            } else {
              reasoningContent += reasoningChunk;
              onChunk({ reasoningContent: reasoningChunk });
            }
          }
        }

        const contentChunk = delta?.content;
        if (typeof contentChunk === 'string' && contentChunk.length > 0) {
          if (holdingJsonCandidate && jsonHold.length > 0) {
            holdingJsonCandidate = false;
            reasoningContent += jsonHold;
            onChunk({ reasoningContent: jsonHold });
            jsonHold = '';
          }
          buffer += contentChunk;
          onChunk({ content: contentChunk });
        }
      }

      logger.info(`[DEEPSEEK] Stream ended (${chunkCount} chunks, buffer=${buffer.length}, reasoning=${reasoningContent.length})`);

      onChunk({ done: true });

    } catch (error: any) {
      const debug = error?.response?.data || error?.error || error?.message;
      console.error('DeepSeek API Error:', debug);

      const message =
        error?.response?.data?.error?.message ||
        error?.error?.message ||
        error?.message ||
        'AI Generation Failed';

      throw new Error(`DeepSeek Error: ${message}`);
    }
  }
}

export function createProvider(sessionId?: string, thinkingMode: boolean = false, architectMode: boolean = false): AIProvider {
  return new DeepSeekProvider(sessionId || `session-${Date.now()}`, thinkingMode, architectMode);
}
