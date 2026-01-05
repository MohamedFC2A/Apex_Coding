import axios from 'axios';
import { ProjectFile } from '@/types';
import { getLanguageFromExtension } from '@/utils/stackDetector';

interface AIResponse {
  plan: string;
  decisionTrace?: string;
  files: ProjectFile[];
  fileStructure: { path: string; type: 'file' }[];
  stack: string;
  description: string;
}

const API_BASE = '/api';

const FILE_NODE_RULES = [
  'FILE NODE RULES (MANDATORY):',
  '- In each project_files entry, output the \"name\" field before \"content\".',
  '- Never emit file content before the file name is declared.',
  '- If a file is named without a folder (e.g. \"style.css\"), decide frontend/ vs backend/ and include the full path.',
  '- Declare folder-prefixed paths as soon as you decide them so the UI can materialize folders in real time.',
  '- OVERWRITE MODE: Always output full file contents from scratch; never assume prior content will be appended.'
].join('\\n');

const WEB_CONTAINER_RULES = [
  'WEB CONTAINER FULL-STACK REQUIREMENTS:',
  '- You are a Full-Stack Generator using WebContainers.',
  '- Always generate a folder structure with /backend and /frontend.',
  '- Backend must use express with sqlite3 or better-sqlite3. Never use MongoDB Atlas.',
  '- Backend must listen on port 3000 or 3111.',
  '- You MUST generate a root-level package.json at /package.json (project root).',
  '- Root /package.json MUST include scripts:',
  '  - \"start\": \"concurrently \\\"npm run server\\\" \\\"npm run client\\\"\"',
  '  - \"server\": \"cd backend && node server.js\"',
  '  - \"client\": \"cd frontend && vite\"',
  '- Root /package.json MUST include dependencies: concurrently, express, sqlite3, cors, nodemon.',
  '- Root /package.json MUST match this template (fill only safe extras):',
  '{',
  '  \"name\": \"project-root\",',
  '  \"scripts\": {',
  '    \"start\": \"concurrently \\\\\\\"npm run server\\\\\\\" \\\\\\\"npm run client\\\\\\\"\",',
  '    \"server\": \"cd backend && node server.js\",',
  '    \"client\": \"cd frontend && vite\"',
  '  },',
  '  \"dependencies\": {',
  '    \"concurrently\": \"^8.0.0\",',
  '    \"express\": \"^4.18.0\",',
  '    \"sqlite3\": \"^5.1.0\",',
  '    \"cors\": \"^2.8.5\",',
  '    \"nodemon\": \"^3.0.0\"',
  '  }',
  '}',
  '- Ensure frontend/index.html includes Tailwind CDN in <head>: <script src=\"https://cdn.tailwindcss.com\"></script>.',
  '- Never output plain unstyled HTML. Use modern premium classes (e.g. bg-slate-900 text-white, glass-effect).'
  ,
  'BACKEND SERVE RULE (MANDATORY):',
  '- backend/server.js MUST serve the frontend build immediately to avoid \"Cannot GET /\".',
  '- Add exactly this (CommonJS) snippet to backend/server.js:',
  '  const path = require(\"path\");',
  '  app.use(express.static(path.join(__dirname, \"../frontend\")));',
  '  app.get(\"*\", (req, res) => {',
  '    res.sendFile(path.join(__dirname, \"../frontend/index.html\"));',
  '  });'
].join('\\n');

const ARCHITECT_MODE_RULES = [
  'ARCHITECT MODE OUTPUT ORDER:',
  '- Start by declaring the folder structure through file paths (frontend/, backend/, README.md) before any file content streams.',
  '- In Architect Mode, declare /package.json first (root), then backend/, then frontend/.',
  '- Keep UI code under frontend/ and server code under backend/.'
].join('\\n');

const applyFileNodeRules = (prompt: string, architectMode: boolean) => {
  if (!prompt.trim()) return prompt;
  const rules = architectMode
    ? `${FILE_NODE_RULES}\\n${WEB_CONTAINER_RULES}\\n${ARCHITECT_MODE_RULES}`
    : `${FILE_NODE_RULES}\\n${WEB_CONTAINER_RULES}`;
  return `${rules}\\n\\n${prompt}`;
};

export const aiService = {
  async generatePlan(prompt: string, thinkingMode: boolean = false): Promise<{ steps: Array<{ id: string; title: string }> }> {
    try {
      const response = await axios.post(`${API_BASE}/ai/plan`, {
        prompt,
        thinkingMode
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error(error.message || 'Failed to generate plan');
    }
  },

  async generateCode(prompt: string): Promise<AIResponse> {
    try {
      const preparedPrompt = applyFileNodeRules(prompt, false);
      const response = await axios.post(`${API_BASE}/ai/generate`, {
        prompt: preparedPrompt
      });
      
      const data = response.data;
      
      // Ensure files have language property
      if (data.files) {
        data.files = data.files.map((file: ProjectFile) => ({
          ...file,
          language: file.language || getLanguageFromExtension(file.path || '')
        }));
      }
      
      return data;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Failed to generate code. Please ensure the AI service is running.');
    }
  },

  async generateCodeStream(
    prompt: string,
    onToken: (token: string) => void,
    onStatus: (phase: string, message: string) => void,
    onMeta: (meta: any) => void,
    onJSON: (payload: any) => void,
    onError: (error: string) => void,
    onReasoning: (chunk: string) => void,
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
      const includeReasoning = options.includeReasoning;
      const history = options.history;
      const preparedPrompt = applyFileNodeRules(prompt, architectMode);

      const response = await fetch(`${API_BASE}/ai/generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: preparedPrompt, thinkingMode, architectMode, includeReasoning, history }),
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      // Track the current SSE event type across lines. Reset on empty line per SSE spec.
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Stream ended - ensure loading state is reset
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer for the next iteration
        buffer = lines.pop() || '';

        for (const line of lines) {
          // An empty line signals the end of an SSE event – reset the event type
          if (line.trim() === '') {
            currentEvent = 'message';
            continue;
          }

          if (line.startsWith('event: ')) {
            // Update the current event type for subsequent data lines
            currentEvent = line.slice(7).trim();
            continue;
          }

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);
              
              // Dispatch based on the current event type
              if (currentEvent === 'token' && parsed.chunk) {
                onToken(parsed.chunk);
              } else if (currentEvent === 'status') {
                onStatus(parsed.phase, parsed.message);
              } else if (currentEvent === 'meta') {
                onMeta(parsed);
              } else if (currentEvent === 'json' && parsed.payload) {
                onJSON(parsed.payload);
              } else if (currentEvent === 'reasoning' && parsed.chunk) {
                // Handle reasoning/chain-of-thought chunks from thinking mode
                onReasoning(parsed.chunk);
              } else if (currentEvent === 'error') {
                onError(parsed.error || 'Unknown error');
              }
            } catch (e) {
              // Propagate JSON parsing errors to the UI for better visibility
              const errMsg = e instanceof Error ? e.message : String(e);
              onError(`Failed to parse SSE data: ${errMsg}`);
            }
          }
        }
      }
    } catch (error: any) {
      onError(error.message || 'Streaming failed');
      onComplete(); // Ensure loading state resets on error
    }
  }
};
