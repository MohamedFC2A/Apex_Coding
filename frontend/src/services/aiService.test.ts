import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('aiService (API mode)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generatePlan calls backend endpoint', async () => {
    vi.resetModules();
    const { aiService } = await import('./aiService');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ steps: [{ id: '1', title: 'Test step' }] })
    });
    (globalThis as any).fetch = fetchMock;

    const res = await aiService.generatePlan('test prompt', false);

    expect(fetchMock).toHaveBeenCalledWith('https://apex-coding-backend.vercel.app/api/ai/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test prompt', thinkingMode: false })
    });
    expect(res.steps).toEqual([{ id: '1', title: 'Test step' }]);
  });

  it('generateCodeStream streams raw JSON', async () => {
    vi.resetModules();
    const { aiService } = await import('./aiService');

    const encoder = new TextEncoder();
    const jsonText = JSON.stringify({
      project_files: [],
      metadata: { language: 'x', framework: 'y' },
      instructions: 'ok'
    });
    const jsonPayload = JSON.parse(jsonText);

    const sse = [
      `event: meta\ndata: ${JSON.stringify({ provider: 'deepseek', model: 'deepseek-chat' })}\n\n`,
      `event: token\ndata: ${JSON.stringify({ chunk: jsonText.slice(0, 10) })}\n\n`,
      `: keep-alive\n\n`,
      `event: token\ndata: ${JSON.stringify({ chunk: jsonText.slice(10) })}\n\n`,
      `event: json\ndata: ${JSON.stringify({ payload: jsonPayload })}\n\n`,
      `event: status\ndata: ${JSON.stringify({ phase: 'done', message: 'Complete' })}\n\n`
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
    expect(metas[0]).toMatchObject({ provider: 'vercel-backend' });
    expect(tokens.join('')).toBe(jsonText);
    expect(jsonPayloads[0]).toMatchObject({ instructions: 'ok' });
    expect(statuses.some((s) => s.phase === 'done')).toBe(true);
    expect(completed).toBe(1);
    expect(errorMessage).toBe('');
  });
});
