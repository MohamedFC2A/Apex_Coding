import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getViteEnv } from '@/utils/env';

describe('aiService (API mode)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
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

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('/api/ai/plan');
    const options = call[1];
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    const payload = JSON.parse(options.body);
    expect(payload.thinkingMode).toBe(false);
    expect(String(payload.prompt)).toContain('test prompt');
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

describe('env utils', () => {
  it('getViteEnv trims and returns undefined for empty values', () => {
    expect(getViteEnv('VITE_WC_CLIENT_ID', { VITE_WC_CLIENT_ID: '   ' })).toBeUndefined();
    expect(getViteEnv('VITE_WC_CLIENT_ID', { VITE_WC_CLIENT_ID: '  abc  ' })).toBe('abc');
    expect(getViteEnv('VITE_WC_CLIENT_ID', {})).toBeUndefined();
    expect(getViteEnv('VITE_WC_CLIENT_ID', { VITE_WC_CLIENT_ID: 123 as any })).toBeUndefined();
  });
});
