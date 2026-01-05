import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from './aiService';

// Helper to create a mock ReadableStream reader
function createMockReader(chunks: Uint8Array[]) {
  let index = 0;
  return {
    read(): Promise<{ done: boolean; value?: Uint8Array }> {
      if (index < chunks.length) {
        const value = chunks[index];
        index++;
        return Promise.resolve({ done: false, value });
      }
      return Promise.resolve({ done: true });
    },
    releaseLock() { }
  };
}

describe('aiService.generateCodeStream SSE parsing', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    vi.restoreAllMocks();
  });

  it('should correctly dispatch token, status, meta, and json events', async () => {
    // Mock callbacks
    const onToken = vi.fn();
    const onStatus = vi.fn();
    const onMeta = vi.fn();
    const onJSON = vi.fn();
    const onError = vi.fn();
    const onReasoning = vi.fn();
    const onComplete = vi.fn();

    // Prepare SSE chunks
    const sseChunks = [
      // token event
      new TextEncoder().encode('event: token\n' + 'data: {"chunk":"Hello"}\n\n'),
      // status event
      new TextEncoder().encode('event: status\n' + 'data: {"phase":"thinking","message":"Thinking..."}\n\n'),
      // meta event
      new TextEncoder().encode('event: meta\n' + 'data: {"requestId":"req-1","provider":"deepseek","model":"deepseek-chat","thinkingMode":false}\n\n'),
      // json event
      new TextEncoder().encode('event: json\n' + 'data: {"payload":{"project_files":[]}}\n\n')
    ];

    // Mock fetch to return a response with our mock reader
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => createMockReader(sseChunks)
      }
    } as any;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    // Call generateCodeStream
    await aiService.generateCodeStream(
      'test prompt',
      onToken,
      onStatus,
      onMeta,
      onJSON,
      onError,
      onReasoning,
      onComplete,
      false
    );

    // Verify callbacks were called with expected data
    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith('Hello');

    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith('thinking', 'Thinking...');

    expect(onMeta).toHaveBeenCalledTimes(1);
    expect(onMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        provider: 'deepseek',
        model: 'deepseek-chat',
        thinkingMode: false
      })
    );

    expect(onJSON).toHaveBeenCalledTimes(1);
    expect(onJSON).toHaveBeenCalledWith({ project_files: [] });

    expect(onError).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should correctly dispatch reasoning events for thinking mode', async () => {
    // Mock callbacks
    const onToken = vi.fn();
    const onStatus = vi.fn();
    const onMeta = vi.fn();
    const onJSON = vi.fn();
    const onError = vi.fn();
    const onReasoning = vi.fn();
    const onComplete = vi.fn();

    // Prepare SSE chunks with reasoning events
    const sseChunks = [
      // reasoning event (chain-of-thought)
      new TextEncoder().encode('event: reasoning\n' + 'data: {"chunk":"Let me think about this..."}\n\n'),
      // another reasoning chunk
      new TextEncoder().encode('event: reasoning\n' + 'data: {"chunk":" The user wants a counter app."}\n\n'),
      // status event
      new TextEncoder().encode('event: status\n' + 'data: {"phase":"streaming","message":"Generating code..."}\n\n'),
      // token event
      new TextEncoder().encode('event: token\n' + 'data: {"chunk":"{"}\n\n'),
    ];

    // Mock fetch
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => createMockReader(sseChunks)
      }
    } as any;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    // Call generateCodeStream with thinking mode
    await aiService.generateCodeStream(
      'test prompt',
      onToken,
      onStatus,
      onMeta,
      onJSON,
      onError,
      onReasoning,
      onComplete,
      true
    );

    // Verify reasoning callbacks were called
    expect(onReasoning).toHaveBeenCalledTimes(2);
    expect(onReasoning).toHaveBeenCalledWith('Let me think about this...');
    expect(onReasoning).toHaveBeenCalledWith(' The user wants a counter app.');

    // Verify stream completion
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
