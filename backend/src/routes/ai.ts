import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { createProvider, ChatMessage, cleanMessageHistory, cleanRequestParams } from '../services/aiProviders.js';
import { validateAndRepairJSON } from '../utils/jsonRepair.js';
import { config } from '../config/index.js';
import { aiHealthMonitor } from '../services/aiHealthMonitor.js';

const router = express.Router();

const getSafeErrorMessage = (error: any) =>
  error?.response?.data?.error?.message || error?.message || 'Unknown AI Error';

const normalizeDeepSeekBaseURL = (value: string) => {
  let base = (value || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  if (base.endsWith('/v1')) base = base.slice(0, -3);
  return base || 'https://api.deepseek.com';
};

const PLAN_SYSTEM_PROMPT = `You are NEXUS_MISSION_CONTROL, an expert software planning engine.

Return ONLY valid JSON with this exact shape:

{
  "steps": [
    { "id": "1", "title": "Short actionable step" }
  ]
}

RULES:
- Output ONLY JSON (no markdown, no code fences, no extra text)
- 6 to 12 steps max
- Each title must be concise (max ~70 chars), imperative, and implementation-oriented
- Do not include file contents; only describe steps

ARCHITECT MODE:
- Plan for a full-stack system with a mandatory folder split:
  - frontend/ (UI)
  - backend/ (API/server)
  - README.md at root
- Include at least one step for: scaffold folders, wire frontend->backend API, and document setup`;

router.post('/plan', async (req, res) => {
  const requestId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    const { prompt, thinkingMode = false, history = [] } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!config.deepseek.apiKey || config.deepseek.apiKey.trim() === '') {
      return res.status(503).json({
        error: 'DeepSeek is not configured. Please add DEEPSEEK_API_KEY to your .env file.',
        code: 'DEEPSEEK_NOT_CONFIGURED'
      });
    }

    const modelUsed = thinkingMode ? config.deepseek.thinkingModel : config.deepseek.fastModel;
    const client = new OpenAI({
      baseURL: normalizeDeepSeekBaseURL(config.deepseek.baseUrl),
      apiKey: config.deepseek.apiKey
    });

    const messages = [
      { role: 'system' as const, content: PLAN_SYSTEM_PROMPT },
      ...cleanMessageHistory(history as ChatMessage[]),
      { role: 'user' as const, content: prompt }
    ];

    const params: any = cleanRequestParams(modelUsed, {
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.0,
      max_tokens: 8000
    });

    const completion: any = await client.chat.completions.create(params as any);
    const content: string = completion?.choices?.[0]?.message?.content || '';

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to parse plan JSON: ${msg}`);
    }

    const stepsRaw = Array.isArray(parsed) ? parsed : parsed?.steps;
    if (!Array.isArray(stepsRaw)) {
      throw new Error('Invalid plan response: missing "steps" array');
    }

    const steps = stepsRaw
      .map((s: any, index: number) => ({
        id: String(s?.id ?? index + 1),
        title: String(s?.title ?? s?.text ?? s?.step ?? '').trim()
      }))
      .filter((s: any) => s.title.length > 0);

    res.json({ requestId, model: modelUsed, steps });
  } catch (error: any) {
    logger.error(`[${requestId}] Plan generation failed`, {
      message: error?.message,
      status: error?.status || error?.response?.status,
      data: error?.response?.data,
      code: error?.code
    });

    // Debug visibility per requirements
    console.error('DeepSeek API Error:', error?.response?.data || error?.message);

    res.status(error?.response?.status || error?.status || 500).json({
      success: false,
      message: error?.response?.data?.error?.message || error?.message || 'Plan generation failed'
    });
  }
});

router.post('/generate', async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { prompt, thinkingMode = false, architectMode = false, history = [] } = req.body;

    if (!prompt) {
      logger.error(`[${requestId}] Missing prompt in request`);
      return res.status(400).json({ error: 'Prompt is required' });
    }

    logger.info(`[${requestId}] Non-streaming generation: DeepSeek (thinkingMode: ${thinkingMode})`);

    try {
      // DeepSeek-only provider
      const provider = createProvider(requestId, thinkingMode, architectMode);

      // Collect streaming response
      let buffer = '';
      let reasoningBuffer = '';
      let streamError: string | null = null;

      // Cast history to ChatMessage[] (already filtered in provider for thinking mode)
      const chatHistory: ChatMessage[] = history;

      await new Promise<void>((resolve, reject) => {
        provider.stream(prompt, (chunk) => {
          if (chunk.error) {
            streamError = chunk.error;
            reject(new Error(chunk.error));
            return;
          }

          if (chunk.content) {
            buffer += chunk.content;
          }

          if (chunk.reasoningContent) {
            reasoningBuffer += chunk.reasoningContent;
          }

          if (chunk.done) {
            resolve();
          }
        }, chatHistory).catch(reject);
      });

      if (streamError) {
        throw new Error(streamError);
      }

      logger.info(`[${requestId}] Collected ${buffer.length} chars (reasoning: ${reasoningBuffer.length}), validating JSON...`);

      // Validate and repair JSON
      const result = validateAndRepairJSON(buffer);

      if (result.success && result.data) {
        // Ensure metadata exists
        if (!result.data.metadata) {
          result.data.metadata = { language: 'Unknown', framework: 'Unknown' };
        }

        // Convert to old format for compatibility
        const response: Record<string, any> = {
          plan: result.data.instructions || 'Generated by NEXUS AI CODING',
          decisionTrace: '[AI DECISION TRACE]\nProvider: deepseek' + (thinkingMode ? ' (Thinking)' : ''),
          fileStructure: (result.data.project_files || []).map((f: any) => ({
            path: f.name,
            type: 'file' as const
          })),
          files: (result.data.project_files || []).map((f: any) => ({
            path: f.name,
            content: f.content,
            language: getLanguageFromExtension(f.name)
          })),
          stack: result.data.metadata?.language || 'Unknown',
          description: result.data.instructions || 'Generated project'
        };

        // Include reasoning content if available (for thinking mode)
        if (reasoningBuffer.length > 0) {
          response.reasoningContent = reasoningBuffer;
        }

        logger.info(`[${requestId}] Successfully generated ${response.files.length} files`);
        res.json(response);
      } else {
        throw new Error(result.error || 'Failed to parse JSON response from AI');
      }

    } catch (providerError: any) {
      const errorMessage = getSafeErrorMessage(providerError);
      logger.error(`[${requestId}] Provider error: ${errorMessage}`);

      // Return specific error for missing DeepSeek configuration
      if (errorMessage.includes('DEEPSEEK_NOT_CONFIGURED')) {
        return res.status(503).json({
          error: 'DeepSeek is not configured. Please add DEEPSEEK_API_KEY to your .env file.',
          code: 'DEEPSEEK_NOT_CONFIGURED'
        });
      }

      if (errorMessage.includes('ECONNREFUSED') || providerError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          error: 'Cannot connect to DeepSeek API. Please check your network connection.',
          code: 'AI_CONN_REFUSED'
        });
      }

      throw providerError;
    }

  } catch (error: any) {
    const errorMessage = getSafeErrorMessage(error);
    logger.error(`[${requestId}] Generation error: ${errorMessage}`);

    res.status(500).json({
      error: errorMessage,
      success: false,
      code: 'GENERATION_ERROR'
    });
  }
});

// Helper function to get language from extension
function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'txt': 'plaintext'
  };
  return languageMap[ext || ''] || 'plaintext';
}

// Streaming endpoint with typed SSE events
router.post('/generate-stream', async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { prompt, thinkingMode = false, architectMode = false, history = [], includeReasoning } = req.body;
    // Default to streaming reasoning when in thinking mode for better UX
    const streamReasoning = includeReasoning ?? thinkingMode;

    if (!prompt) {
      logger.error(`[${requestId}] Missing prompt in request`);
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // V3.2: Use fastModel or thinkingModel based on mode
    const modelUsed = thinkingMode ? config.deepseek.thinkingModel : config.deepseek.fastModel;
    const chatHistory: ChatMessage[] = history;
    logger.info(`[${requestId}] Starting DeepSeek code generation (model: ${modelUsed}, thinkingMode: ${thinkingMode}, history: ${chatHistory.length})`);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Request-ID', requestId);

    // Send initial meta event with provider info
    res.write(`event: meta\ndata: ${JSON.stringify({
      requestId,
      provider: 'deepseek',
      model: modelUsed,
      thinkingMode,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Send initial status with proper phase
    const modeLabel = thinkingMode ? 'DeepSeek (Thinking)' : 'DeepSeek';
    res.write(`event: status\ndata: ${JSON.stringify({
      phase: 'thinking',
      message: `${modeLabel} is thinking...`
    })}\n\n`);

    let retryCount = 0;
    const maxRetries = 2;
    let lastError: string | null = null;
    let errorCode: string | null = null;

    const attemptGeneration = async (): Promise<boolean> => {
      try {
        logger.info(`[${requestId}] Creating DeepSeek provider (attempt ${retryCount + 1}/${maxRetries + 1})`);
        const provider = createProvider(requestId, thinkingMode, architectMode);
        let buffer = '';
        let reasoningBuffer = '';
        let hasReceivedTokens = false;
        let streamTimeout: NodeJS.Timeout;
        let lastChunkTime = Date.now();

        if (retryCount > 0) {
          logger.info(`[${requestId}] Retry attempt ${retryCount}/${maxRetries}`);
          res.write(`event: status\ndata: ${JSON.stringify({
            phase: 'thinking',
            message: `Retrying (${retryCount}/${maxRetries})...`
          })}\n\n`);
        }

        // Set a timeout that resets on each chunk
        const resetTimeout = () => {
          clearTimeout(streamTimeout);
          streamTimeout = setTimeout(() => {
            const elapsed = Date.now() - lastChunkTime;
            lastError = `No response from AI for ${Math.floor(elapsed / 1000)}s (timeout)`;
            errorCode = 'AI_TIMEOUT';
            logger.error(`[${requestId}] Stream timeout: ${elapsed}ms since last chunk`);
          }, 45000); // 45s timeout between chunks
        };

        resetTimeout();

        return new Promise<boolean>((resolve) => {
          provider.stream(prompt, (chunk) => {
            lastChunkTime = Date.now();
            resetTimeout(); // Reset timeout on each chunk

            if (chunk.error) {
              clearTimeout(streamTimeout);
              lastError = chunk.error;
              errorCode = 'PROVIDER_ERROR';
              logger.error(`[${requestId}] Provider error: ${chunk.error}`);
              resolve(false);
              return;
            }

            // Handle reasoning content (chain-of-thought from thinking mode)
            if (chunk.reasoningContent) {
              reasoningBuffer += chunk.reasoningContent;
              // Optionally stream reasoning to client if requested
              if (streamReasoning) {
                res.write(`event: reasoning\ndata: ${JSON.stringify({ chunk: chunk.reasoningContent })}\n\n`);
              }
            }

            if (chunk.content) {
              if (!hasReceivedTokens) {
                hasReceivedTokens = true;
                logger.info(`[${requestId}] First token received, switching to streaming phase`);
                res.write(`event: status\ndata: ${JSON.stringify({
                  phase: 'streaming',
                  message: 'Generating code...'
                })}\n\n`);
              }
              buffer += chunk.content;
              res.write(`event: token\ndata: ${JSON.stringify({ chunk: chunk.content })}\n\n`);
            }

            if (chunk.done) {
              clearTimeout(streamTimeout);
              logger.info(`[${requestId}] Stream complete, validating JSON (${buffer.length} chars)`);

              // Validate and repair JSON
              res.write(`event: status\ndata: ${JSON.stringify({
                phase: 'validating',
                message: 'Validating response...'
              })}\n\n`);

              const result = validateAndRepairJSON(buffer);

              if (result.success && result.data) {
                // Ensure metadata exists
                if (!result.data.metadata) {
                  result.data.metadata = { language: 'Unknown', framework: 'Unknown' };
                }

                // Validate project_files exists and is not empty
                if (!result.data.project_files || result.data.project_files.length === 0) {
                  lastError = 'AI generated empty project (no files)';
                  errorCode = 'EMPTY_PROJECT';
                  logger.warn(`[${requestId}] Empty project_files array`);
                  resolve(false);
                  return;
                }

                // Validate each file has name and content
                const invalidFiles = result.data.project_files.filter((f: any) => !f.name || !f.content);
                if (invalidFiles.length > 0) {
                  lastError = `AI generated incomplete files (${invalidFiles.length} files missing content)`;
                  errorCode = 'INCOMPLETE_FILES';
                  logger.warn(`[${requestId}] ${invalidFiles.length} files missing name or content`);
                  resolve(false);
                  return;
                }

                logger.info(`[${requestId}] Successfully generated ${result.data.project_files.length} files (reasoning: ${reasoningBuffer.length} chars)`);

                // Include reasoning content in payload if available
                const payload: Record<string, any> = { ...result.data };
                if (reasoningBuffer.length > 0) {
                  payload.reasoningContent = reasoningBuffer;
                }

                res.write(`event: json\ndata: ${JSON.stringify({ payload })}\n\n`);
                res.write(`event: status\ndata: ${JSON.stringify({
                  phase: 'done',
                  message: `Generated ${result.data.project_files.length} files successfully`
                })}\n\n`);
                res.end();
                resolve(true);
              } else {
                lastError = result.error || 'Failed to parse JSON response from AI';
                errorCode = 'JSON_INVALID';
                logger.error(`[${requestId}] JSON validation failed: ${lastError}`);
                logger.error(`[${requestId}] Buffer preview:`, buffer.substring(0, 500));
                resolve(false);
              }
            }
          }, chatHistory).catch((err) => {
            clearTimeout(streamTimeout);
            const errorMessage = getSafeErrorMessage(err);
            lastError = errorMessage || 'Unexpected stream error';
            errorCode = 'STREAM_ERROR';
            logger.error(`[${requestId}] Stream caught error: ${errorMessage}`);
            resolve(false);
          });
        });

      } catch (providerError: any) {
        logger.error(`[${requestId}] Provider initialization error:`, providerError.message);
        lastError = providerError.message || 'Failed to initialize AI provider';

        // Extract error code from message if present
        if (providerError.message?.includes('DEEPSEEK_NOT_CONFIGURED')) {
          errorCode = 'DEEPSEEK_NOT_CONFIGURED';
        } else if (providerError.message?.includes('ECONNREFUSED')) {
          errorCode = 'AI_CONN_REFUSED';
        }

        return false;
      }
    };

    // Main generation attempt (no retry for config errors)
    const success = await attemptGeneration();

    if (success) {
      logger.info(`[${requestId}] Generation completed successfully`);
      return; // Successfully completed
    }

    // If failed, check if it's a retryable error
    const isRetryable = errorCode !== 'DEEPSEEK_NOT_CONFIGURED' &&
      errorCode !== 'AI_CONN_REFUSED' &&
      retryCount < maxRetries;

    if (isRetryable) {
      // Retry for transient errors
      while (retryCount < maxRetries) {
        retryCount++;
        const backoffDelay = 1000 * retryCount; // 1s, 2s

        logger.warn(`[${requestId}] Retry ${retryCount}/${maxRetries} after error: ${lastError}. Waiting ${backoffDelay}ms...`);
        res.write(`event: status\ndata: ${JSON.stringify({
          phase: 'thinking',
          message: `Retrying in ${backoffDelay / 1000}s... (${retryCount}/${maxRetries})`
        })}\n\n`);

        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        const retrySuccess = await attemptGeneration();
        if (retrySuccess) {
          logger.info(`[${requestId}] Generation completed successfully on retry ${retryCount}`);
          return;
        }
      }
    }

    // All attempts failed
    logger.error(`[${requestId}] Generation failed. Error code: ${errorCode}, Message: ${lastError}`);
    res.write(`event: error\ndata: ${JSON.stringify({
      error: lastError || 'Failed to generate code',
      code: errorCode || 'UNKNOWN_ERROR',
      provider: 'deepseek',
      model: modelUsed,
      timestamp: new Date().toISOString()
    })}\n\n`);
    res.end();

  } catch (error: any) {
    const errorMessage = getSafeErrorMessage(error);
    logger.error(`[${requestId}] Unexpected streaming error: ${errorMessage}`);

    res.write(`event: error\ndata: ${JSON.stringify({
      error: errorMessage,
      code: 'SERVER_ERROR',
      timestamp: new Date().toISOString()
    })}\n\n`);
    res.end();
  }
});

// Health check endpoint for all AI providers
router.get('/health', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    providers: {} as Record<string, { status: string; latency?: number; error?: string }>
  };

  // Normalize DeepSeek base URL to OpenAI-compatible /v1 endpoints
  const deepseekBaseUrl = config.deepseek.baseUrl.endsWith('/v1')
    ? config.deepseek.baseUrl
    : config.deepseek.baseUrl.replace(/\/+$/, '') + '/v1';

  // Check DeepSeek provider - fast model + thinking model
  if (config.deepseek.apiKey) {
    const fastStart = Date.now();
    try {
      await axios.post(
        `${deepseekBaseUrl}/chat/completions`,
        {
          model: config.deepseek.fastModel,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        },
        {
          timeout: 10000,
          headers: { Authorization: `Bearer ${config.deepseek.apiKey}` }
        }
      );
      results.providers.DEEPSEEK_FAST = {
        status: 'healthy',
        latency: Date.now() - fastStart
      };
    } catch (error: any) {
      results.providers.DEEPSEEK_FAST = {
        status: 'unhealthy',
        error: error.response?.status === 401 ? 'Invalid API key' : error.message
      };
    }

    const thinkingStart = Date.now();
    try {
      await axios.post(
        `${deepseekBaseUrl}/chat/completions`,
        {
          model: config.deepseek.thinkingModel,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        },
        {
          timeout: 10000,
          headers: { Authorization: `Bearer ${config.deepseek.apiKey}` }
        }
      );
      results.providers.DEEPSEEK_THINKING = {
        status: 'healthy',
        latency: Date.now() - thinkingStart
      };
    } catch (error: any) {
      results.providers.DEEPSEEK_THINKING = {
        status: 'unhealthy',
        error: error.response?.status === 401 ? 'Invalid API key' : error.message
      };
    }
  } else {
    results.providers.DEEPSEEK_FAST = {
      status: 'not_configured',
      error: 'DEEPSEEK_API_KEY not set in .env'
    };
    results.providers.DEEPSEEK_THINKING = {
      status: 'not_configured',
      error: 'DEEPSEEK_API_KEY not set in .env'
    };
  }

  // Determine overall status
  const healthyProviders = Object.values(results.providers).filter(p => p.status === 'healthy');
  results as any;

  res.json({
    ...results,
    overall: healthyProviders.length > 0 ? 'operational' : 'no_healthy_providers',
    healthyCount: healthyProviders.length,
    totalProviders: Object.keys(results.providers).length
  });
});

// Test specific provider endpoint
router.post('/test-provider', async (req, res) => {
  const { provider, url, apiKey, model } = req.body;

  const result = {
    provider,
    status: 'unknown',
    latency: 0,
    error: null as string | null
  };

  const start = Date.now();

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    await axios.post(
      url,
      {
        model: model || 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      },
      { timeout: 15000, headers }
    );

    result.status = 'healthy';
    result.latency = Date.now() - start;
  } catch (error: any) {
    result.status = 'unhealthy';
    result.error = error.response?.data?.error?.message || error.message;
    result.latency = Date.now() - start;
  }

  res.json(result);
});

// Check all available models/modes (with caching and refresh option)
router.get('/check-models', async (req, res) => {
  const requestId = `check-${Date.now()}`;
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  logger.info(`[${requestId}] Check models requested (refresh: ${forceRefresh})`);

  try {
    // Get cached or fresh results from health monitor
    const cached = forceRefresh
      ? await aiHealthMonitor.checkAllProviders(true)
      : aiHealthMonitor.getCachedResults();

    // Format response
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      requestId,
      cached: !forceRefresh && (Date.now() - cached.lastCheck < 60000),
      cacheAge: cached.lastCheck ? Math.floor((Date.now() - cached.lastCheck) / 1000) : null,
      modes: {}
    };

    // DeepSeek results
    if (cached.DEEPSEEK) {
      results.modes.DEEPSEEK = {
        ...cached.DEEPSEEK,
        configured: config.deepseek.apiKey && config.deepseek.apiKey.trim() !== '',
        provider: config.llm.provider,
        endpoint: config.deepseek.baseUrl,
        models: {
          fast: config.deepseek.fastModel,
          thinking: config.deepseek.thinkingModel
        },
        thinkingModeAvailable: cached.DEEPSEEK.checks?.thinking === true
      };
    }

    // Overall health
    const healthyModes = Object.values(results.modes).filter((m: any) => m.status === 'healthy');
    results.overall = healthyModes.length > 0 ? 'operational' : 'no_healthy_modes';
    results.healthyCount = healthyModes.length;
    results.totalConfigured = Object.values(results.modes).filter((m: any) => m.configured || m.status !== 'not_configured').length;

    logger.info(`[${requestId}] Check complete: ${results.healthyCount}/${results.totalConfigured} modes healthy`);
    res.json(results);

  } catch (error: any) {
    logger.error(`[${requestId}] Check models failed:`, error.message);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message,
      requestId
    });
  }
});

// Get available models info (without testing)
router.get('/models', (req, res) => {
  const models = {
    timestamp: new Date().toISOString(),
    modes: {
      DEEPSEEK: {
        name: 'DEEPSEEK',
        description: 'DeepSeek V3.2 API',
        configured: config.deepseek.apiKey && config.deepseek.apiKey.trim() !== '',
        provider: config.llm.provider,
        endpoint: config.deepseek.baseUrl,
        models: {
          fast: config.deepseek.fastModel,
          thinking: config.deepseek.thinkingModel
        },
        features: ['code_generation', 'streaming', 'thinking_mode', 'reasoning', 'chain_of_thought'],
        requiresApiKey: true,
        apiKeySet: config.deepseek.apiKey && config.deepseek.apiKey.trim() !== ''
      }
    }
  };

  res.json(models);
});

export default router;
