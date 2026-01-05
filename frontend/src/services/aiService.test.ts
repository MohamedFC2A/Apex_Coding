import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

import axios from 'axios';

describe('aiService (API mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generatePlan calls backend endpoint', async () => {
    vi.resetModules();
    process.env.VITE_BACKEND_URL = 'https://backend.example.com';
    const { aiService } = await import('./aiService');

    (axios.post as any).mockResolvedValueOnce({
      data: { steps: [{ id: '1', title: 'Test step' }] }
    });

    const res = await aiService.generatePlan('test prompt', false);

    expect(axios.post).toHaveBeenCalledWith(
      'https://backend.example.com/api/ai/plan',
      { prompt: 'test prompt', thinkingMode: false },
      { withCredentials: true }
    );
    expect(res.steps).toEqual([{ id: '1', title: 'Test step' }]);
  });

  it('generateCodeStream parses SSE events', async () => {
    vi.resetModules();
    process.env.VITE_BACKEND_URL = 'https://backend.example.com';
    const { aiService } = await import('./aiService');

    const encoder = new TextEncoder();
    const sse = [
      'event: meta\ndata: {"model":"deepseek-chat"}\n\n',
      'event: token\ndata: {"chunk":"abc"}\n\n',
      'event: json\ndata: {"payload":{"project_files":[],"metadata":{"language":"x","framework":"y"},"instructions":"ok"}}\n\n'
    ].join('');

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse));
        controller.close();
      }
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream
    });
    (globalThis as any).fetch = fetchMock;

    const tokens: string[] = [];
    const metas: any[] = [];
    const statuses: any[] = [];
    const jsonPayloads: any[] = [];
    let completed = 0;
    let errorMessage = '';

    await aiService.generateCodeStream(
      'prompt',
      (t) => tokens.push(t),
      (phase, message) => statuses.push({ phase, message }),
      (m) => metas.push(m),
      (p) => jsonPayloads.push(p),
      (e) => {
        errorMessage = e;
      },
      () => {},
      () => {
        completed += 1;
      },
      { thinkingMode: false, architectMode: false, includeReasoning: false, history: [] }
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(metas[0]).toMatchObject({ model: 'deepseek-chat' });
    expect(tokens).toEqual(['abc']);
    expect(jsonPayloads[0]).toMatchObject({ instructions: 'ok' });
    expect(statuses.some((s) => s.phase === 'done')).toBe(true);
    expect(completed).toBe(1);
    expect(errorMessage).toBe('');
  });
});
