import axios from 'axios';
import { API_BASE_URL } from '@/config';
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

const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

const getErrorMessage = (err: any, fallback: string) => {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
};

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

export const aiService = {
  async generatePlan(prompt: string, thinkingMode: boolean = false): Promise<{ steps: Array<{ id: string; title: string }> }> {
    try {
      const response = await axios.post(
        apiUrl('/api/ai/plan'),
        { prompt, thinkingMode },
        { withCredentials: true }
      );

      const steps = Array.isArray(response.data?.steps) ? response.data.steps : [];
      return { steps };
    } catch (error: any) {
      console.error('Plan Error Details:', error);
      throw new Error(getErrorMessage(error, 'Failed to generate plan'));
    }
  },

  async generateCode(prompt: string): Promise<AIResponse> {
    try {
      const response = await axios.post(
        apiUrl('/api/ai/generate'),
        { prompt },
        { withCredentials: true }
      );

      const data: any = response.data;

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

      const response = await fetch(apiUrl('/api/ai/generate-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        try {
          const errorJson = await response.json();
          message = errorJson?.error || errorJson?.message || message;
        } catch {
          try {
            const errorText = await response.text();
            if (errorText) message = errorText;
          } catch {
            // ignore
          }
        }
        throw new Error(message);
      }

      const body = response.body;
      if (!body) throw new Error('Streaming failed: empty response body');

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

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
          if (eventName === 'status') onStatus(data.phase, data.message);
          if (eventName === 'reasoning' && includeReasoning) onReasoning(String(data.chunk || ''));
          if (eventName === 'token') onToken(String(data.chunk || ''));
          if (eventName === 'json') onJSON(data.payload);
        }
      }

      onStatus('done', 'Complete');
      onComplete();
    } catch (err: any) {
      onError(err?.message || 'Streaming failed');
      onComplete();
    }
  }
};
