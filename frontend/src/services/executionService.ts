import axios from 'axios';
import { ExecutionResult } from '@/types';

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

const languageAliases: Record<string, string> = {
  python: 'python3',
  py: 'python3',
  'c++': 'cpp',
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  node: 'javascript',
  nodejs: 'javascript',
  go: 'go',
  golang: 'go',
  rust: 'rust',
  rs: 'rust',
  bash: 'bash',
  shell: 'bash',
  sh: 'bash'
};

const normalizeLanguage = (language: string) => {
  const normalized = (language || '').trim().toLowerCase();
  return languageAliases[normalized] || normalized || 'plaintext';
};

export const executionService = {
  async executeCode(params: { sourceCode: string; language: string }): Promise<ExecutionResult> {
    const resolvedLanguage = normalizeLanguage(params.language);

    try {
      // Special handling for JavaScript/TypeScript: execute in browser if no backend is needed
      if (resolvedLanguage === 'javascript' || resolvedLanguage === 'typescript') {
        try {
          // eslint-disable-next-line no-eval
          const result = eval(params.sourceCode); // Very basic client-side execution test
          return {
            success: true,
            output: String(result),
          };
        } catch (e: any) {
          return {
             success: false,
             output: '',
             error: e.message
          };
        }
      }

      const response = await axios.post(PISTON_URL, {
        language: resolvedLanguage,
        version: '*',
        files: [{ content: params.sourceCode }]
      });

      const data = response.data || {};
      const compileOutput = data.compile?.stderr || data.compile?.stdout || '';
      const runOutput = data.run?.stdout || '';
      const runError = data.run?.stderr || '';
      const runCode = typeof data.run?.code === 'number' ? data.run.code : 0;

      const errorOutput = [compileOutput, runError].filter(Boolean).join('\n');

      return {
        success: runCode === 0 && !compileOutput,
        output: runOutput,
        error: errorOutput || undefined
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.response?.data?.message || error.message || 'Execution failed'
      };
    }
  }
};
