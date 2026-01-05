import app from './app.js';
import { config } from './config/index.js';
import { aiHealthMonitor } from './services/aiHealthMonitor.js';
import { logger } from './utils/logger.js';

const PORT = config.port;

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] [FATAL] Uncaught Exception:`, error);
  console.error('Stack trace:', error.stack);
  // Give some time to log before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] [FATAL] Unhandled Rejection at:`, promise);
  console.error('Reason:', reason);
});

// Vercel Serverless must NOT bind a port in production.
// Local dev still starts the HTTP server normally.
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, async () => {
    logger.info(`[NEXUS] Backend server running on http://localhost:${PORT}`);
    logger.info(`[NEXUS] Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[NEXUS] LLM provider: ${config.llm.provider}`);
    logger.info(
      `[NEXUS] DeepSeek: ${config.deepseek.apiKey ? '✓ Configured' : '✗ Not configured'} (fast: ${config.deepseek.fastModel}, thinking: ${config.deepseek.thinkingModel})`
    );

    // Run startup health check in background
    logger.info('[NEXUS] Running AI health check...');
    aiHealthMonitor.runStartupCheck().catch((err) => {
      console.error(`[${new Date().toISOString()}] [NEXUS] Health check failed:`, err.message);
    });
  });
}

export default app;
