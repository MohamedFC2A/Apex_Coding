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
      const response = await fetch(apiUrl('/api/ai/plan'), {
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
      const includeReasoning = Boolean(options.includeReasoning);

      onMeta({ provider: 'vercel-backend', baseURL: API_BASE_URL, thinkingMode, architectMode });
      onStatus('streaming', 'Generating…');

      const response = await fetch(apiUrl('/api/ai/generate-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (chunk.length === 0) continue;
        fullText += chunk;
        onToken(chunk);
      }

      onStatus('done', 'Complete');

      try {
        const payload = cleanAndParseJSON(fullText);
        onJSON(payload);
      } catch (e: any) {
        throw new Error(e?.message || 'Failed to parse streamed JSON');
      }

      onComplete();
    } catch (err: any) {
      onError(err?.message || 'Streaming failed');
      onComplete();
    }
  }
};
