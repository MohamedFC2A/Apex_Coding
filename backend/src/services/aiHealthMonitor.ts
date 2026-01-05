import { logger } from '../utils/logger.js';
import { DeepSeekProvider } from './aiProviders.js';
import { config } from '../config/index.js';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'not_configured';
  latency?: number;
  error?: string;
  errorCode?: string;
  timestamp: number;
  checks: {
    fast?: boolean;     // Fast mode (deepseek-chat)
    thinking?: boolean; // Thinking mode (deepseek-reasoner)
  };
}

interface CachedResults {
  DEEPSEEK?: HealthCheckResult;
  lastCheck: number;
}

class AIHealthMonitor {
  private cache: CachedResults = { lastCheck: 0 };
  private readonly CACHE_TTL = 60000; // 60 seconds
  private isChecking = false;

  async checkAllProviders(forceRefresh = false): Promise<CachedResults> {
    // Return cached results if still valid
    if (!forceRefresh && Date.now() - this.cache.lastCheck < this.CACHE_TTL) {
      logger.info('[HealthMonitor] Returning cached results');
      return this.cache;
    }

    // Prevent concurrent checks
    if (this.isChecking) {
      logger.info('[HealthMonitor] Check already in progress, returning current cache');
      return this.cache;
    }

    this.isChecking = true;
    logger.info('[HealthMonitor] Starting comprehensive health check...');

    const results: CachedResults = {
      lastCheck: Date.now()
    };

    // DeepSeek-only provider
    results.DEEPSEEK = await this.checkDeepSeek();

    this.cache = results;
    this.isChecking = false;

    logger.info('[HealthMonitor] Health check completed', {
      DEEPSEEK: results.DEEPSEEK?.status
    });

    return results;
  }

  private async checkDeepSeek(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      status: 'not_configured',
      timestamp: startTime,
      checks: {}
    };

    // Check if DeepSeek is configured
    if (!config.deepseek.apiKey || config.deepseek.apiKey.trim() === '') {
      result.error = 'DEEPSEEK_API_KEY not configured';
      logger.info('[HealthMonitor] DEEPSEEK: not configured (no API key)');
      return result;
    }

    try {
      logger.info(`[HealthMonitor] Checking DEEPSEEK provider (fast: ${config.deepseek.fastModel}, thinking: ${config.deepseek.thinkingModel})...`);
      
      // Test 1: Fast mode (non-thinking, e.g., deepseek-chat)
      const fastProvider = new DeepSeekProvider(`health-check-fast-${Date.now()}`, false);
      let fastContent = false;

      const fastPromise = new Promise<void>((resolve, reject) => {
        let firstChunkReceived = false;
        
        const timeout = setTimeout(() => {
          // Timeout but if we received some content, consider it successful
          if (fastContent || firstChunkReceived) {
            logger.info('[HealthMonitor] DEEPSEEK fast mode: received content, considering healthy (early exit)');
            resolve();
          } else {
            reject(new Error(`DEEPSEEK fast mode (${config.deepseek.fastModel}) check timeout (30s)`));
          }
        }, 30000);

        fastProvider.healthCheck((chunk) => {
          if (chunk.error) {
            clearTimeout(timeout);
            reject(new Error(chunk.error));
            return;
          }
          if (chunk.content && !firstChunkReceived) {
            firstChunkReceived = true;
            fastContent = true;
            // Early success - as soon as we get first content chunk, consider it healthy
            logger.info('[HealthMonitor] DEEPSEEK fast mode: first chunk received, check passed');
            clearTimeout(timeout);
            resolve();
          }
          if (chunk.done) {
            clearTimeout(timeout);
            if (fastContent || firstChunkReceived) {
              resolve();
            }
          }
        }).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      await fastPromise;
      result.checks.fast = fastContent;

      // Test 2: Thinking mode (deepseek-reasoner)
      const thinkingProvider = new DeepSeekProvider(`health-check-thinking-${Date.now()}`, true);
      let thinkingContent = false;

      const thinkingPromise = new Promise<void>((resolve, reject) => {
        let firstChunkReceived = false;
        
        const timeout = setTimeout(() => {
          // Timeout but if we received some content, consider it successful
          if (thinkingContent || firstChunkReceived) {
            logger.info('[HealthMonitor] DEEPSEEK thinking mode: received content, considering healthy (early exit)');
            resolve();
          } else {
            reject(new Error(`DEEPSEEK thinking mode (${config.deepseek.thinkingModel}) check timeout (30s)`));
          }
        }, 30000);

        thinkingProvider.healthCheck((chunk) => {
          if (chunk.error) {
            clearTimeout(timeout);
            reject(new Error(chunk.error));
            return;
          }
          if (chunk.content && !firstChunkReceived) {
            firstChunkReceived = true;
            thinkingContent = true;
            // Early success - as soon as we get first content chunk, consider it healthy
            logger.info('[HealthMonitor] DEEPSEEK thinking mode: first chunk received, check passed');
            clearTimeout(timeout);
            resolve();
          }
          if (chunk.done) {
            clearTimeout(timeout);
            if (thinkingContent || firstChunkReceived) {
              resolve();
            }
          }
        }).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      await thinkingPromise;
      result.checks.thinking = thinkingContent;

      result.status = (fastContent && thinkingContent) ? 'healthy' : 'unhealthy';
      result.latency = Date.now() - startTime;

      if (result.status === 'healthy') {
        logger.info(`[HealthMonitor] DEEPSEEK: healthy (${result.latency}ms, fast: ${fastContent}, thinking: ${thinkingContent})`);
      } else {
        result.error = `Partial success: fast=${fastContent}, thinking=${thinkingContent}`;
        logger.warn(`[HealthMonitor] DEEPSEEK: partially healthy - ${result.error}`);
      }

    } catch (error: any) {
      result.status = 'unhealthy';
      result.latency = Date.now() - startTime;
      result.error = error.message;
      result.errorCode = error.code || error.status?.toString();
      
      logger.error(`[HealthMonitor] DEEPSEEK: unhealthy - ${error.message}`, {
        baseURL: config.deepseek.baseUrl,
        code: error.code,
        status: error.status,
        latency: result.latency
      });
    }

    return result;
  }

  getCachedResults(): CachedResults {
    return this.cache;
  }

  async runStartupCheck(): Promise<void> {
    logger.info('[HealthMonitor] Running startup health check...');
    try {
      await this.checkAllProviders(true);
      logger.info('[HealthMonitor] Startup check completed');
    } catch (error: any) {
      logger.error('[HealthMonitor] Startup check failed:', error.message);
    }
  }
}

// Export singleton instance
export const aiHealthMonitor = new AIHealthMonitor();
