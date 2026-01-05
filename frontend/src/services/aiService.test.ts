import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  return {
    create: vi.fn()
  };
});

vi.mock('openai', () => {
  class OpenAI {
    chat = {
      completions: {
        create: hoisted.create
      }
    };
    constructor(_opts: any) {}
  }
  return { default: OpenAI };
});

import { aiService } from './aiService';

describe('aiService (serverless)', () => {
  beforeEach(() => {
    hoisted.create.mockReset();
    (import.meta as any).env = (import.meta as any).env || {};
    (import.meta as any).env.VITE_DEEPSEEK_API_KEY = 'test-key';
    (import.meta as any).env.VITE_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
    (import.meta as any).env.VITE_DEEPSEEK_MODEL = 'deepseek-chat';
  });

  it('generatePlan parses JSON', async () => {
    hoisted.create.mockResolvedValue({
      choices: [{ message: { content: '{"steps":[{"id":"1","title":"Do thing"}]}' } }]
    });

    const res = await aiService.generatePlan('test');
    expect(res.steps).toEqual([{ id: '1', title: 'Do thing' }]);
  });

  it('generateCodeStream emits tokens and final JSON', async () => {
    async function* stream() {
      yield { choices: [{ delta: { content: '{\"project_files\":[]}' } }] };
    }
    hoisted.create.mockResolvedValue(stream());

    const onToken = vi.fn();
    const onStatus = vi.fn();
    const onMeta = vi.fn();
    const onJSON = vi.fn();
    const onError = vi.fn();
    const onReasoning = vi.fn();
    const onComplete = vi.fn();

    await aiService.generateCodeStream(
      'prompt',
      onToken,
      onStatus,
      onMeta,
      onJSON,
      onError,
      onReasoning,
      onComplete,
      false
    );

    expect(onToken).toHaveBeenCalled();
    expect(onJSON).toHaveBeenCalledWith({ project_files: [] });
    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });
});

