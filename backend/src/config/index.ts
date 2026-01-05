// Centralized configuration for NEXUS AI CODING backend

import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../utils/logger.js';

// Load environment variables from the current working directory .env file
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // LLM provider (DeepSeek only)
  llm: {
    provider: (process.env.LLM_PROVIDER || 'deepseek').toLowerCase(),
  },

  // DeepSeek API (V3.2)
  deepseek: {
    // Use base URL without /v1; providers will normalize for OpenAI-compatible endpoints.
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    // V3.2 model configuration
    // `DEEPSEEK_MODEL` is supported as an alias for fast mode (back-compat with simpler env templates).
    fastModel: process.env.DEEPSEEK_FAST_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat',         // Non-thinking mode
    thinkingModel: process.env.DEEPSEEK_THINKING_MODEL || 'deepseek-reasoner', // Thinking mode
  },

  // Execution limits
  execution: {
    maxTime: parseInt(process.env.MAX_EXECUTION_TIME || '30000', 10),
    cpuLimit: parseInt(process.env.CPU_LIMIT || '70', 10),
    ramLimit: parseInt(process.env.RAM_LIMIT || '60', 10),
  },
};

// Validation
/**
 * Validate critical configuration values.
 * In production we abort the process if required credentials are missing.
 * In development we only emit warnings so the server can still start for debugging.
 */
function validateConfig() {
  const missing: string[] = [];

  // Enforce DeepSeek-only provider selection
  if (config.llm.provider !== 'deepseek') {
    console.error(`❌  Invalid LLM_PROVIDER="${config.llm.provider}". This project supports only "deepseek".`);
    missing.push('LLM_PROVIDER');
  }

  // DeepSeek API key is mandatory in production
  const isProd = config.nodeEnv === 'production';
  if (isProd && !config.deepseek.apiKey) {
    missing.push('DEEPSEEK_API_KEY');
    console.error('❌  Missing DEEPSEEK_API_KEY – DeepSeek cannot start without it.');
  }
  if (!isProd && !config.deepseek.apiKey) {
    logger.warn('DEEPSEEK_API_KEY not set; DeepSeek requests will fail until configured.');
  }

  if (missing.length > 0) {
    console.error(`[CONFIG] Critical configuration missing: ${missing.join(', ')}`);
    // Exit with non‑zero code to signal failure in CI/CD pipelines
    process.exit(1);
  }
}

// Run validation immediately after config definition
validateConfig();

logger.info(`[CONFIG] Server port: ${config.port}`);
logger.info(`[CONFIG] Node environment: ${config.nodeEnv}`);
logger.info(`[CONFIG] LLM provider: ${config.llm.provider}`);
logger.info(`[CONFIG] DeepSeek API: ${config.deepseek.baseUrl}`);
logger.info(`[CONFIG] DeepSeek Fast Model: ${config.deepseek.fastModel}`);
logger.info(`[CONFIG] DeepSeek Thinking Model: ${config.deepseek.thinkingModel}`);
logger.info(`[CONFIG] DeepSeek API Key: ${config.deepseek.apiKey ? '✓ Set' : '✗ Not set'}`);
