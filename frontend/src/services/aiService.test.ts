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

  it('generateCodeStream streams file-marker text', async () => {
    vi.resetModules();
    const { aiService } = await import('./aiService');

    const encoder = new TextEncoder();
    const fileStream = [
      '[[START_FILE: index.html]]',
      '<!doctype html>',
      '<html><body>Hello</body></html>',
      '[[END_FILE]]',
      ''
    ].join('\n');

    const sseEvent = (event: string, data: string) => {
      const lines = String(data ?? '').split('\n');
      return [`event: ${event}`, ...lines.map((l) => `data: ${l}`), '', ''].join('\n');
    };

    const sse = [
      sseEvent('meta', 'provider=deepseek;model=deepseek-chat;thinkingMode=false'),
      sseEvent('status', 'streaming:Generating…'),
      sseEvent('token', fileStream),
      `: keep-alive\n\n`,
      sseEvent('status', 'done:Complete')
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
    const fileEvents: any[] = [];
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
      {
        thinkingMode: false,
        architectMode: false,
        includeReasoning: false,
        history: [],
        typingMs: 0,
        onFileEvent: (ev) => fileEvents.push(ev)
      }
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(metas[0]).toMatchObject({ provider: 'vercel-backend' });
    expect(tokens.join('')).toContain('[[START_FILE: index.html]]');
    expect(fileEvents.some((e) => e.type === 'start' && String(e.path).includes('index.html'))).toBe(true);
    expect(fileEvents.some((e) => e.type === 'end' && String(e.path).includes('index.html'))).toBe(true);
    expect(jsonPayloads[0]?.metadata?.protocol).toBe('file-marker');
    expect(statuses.some((s) => s.phase === 'done')).toBe(true);
    expect(completed).toBe(1);
    expect(errorMessage).toBe('');
  });
});
