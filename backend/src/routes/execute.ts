import express from 'express';
import { executionEngine } from '../services/executionEngine.js';
import { portManager } from '../services/portManager.js';
import { ProjectStack } from '../../../shared/types.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    const { projectId, files, stack, entryPoint } = req.body;

    if (!projectId || !files || !stack) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    logger.info(`Executing project: ${projectId} with stack: ${stack}`);

    const result = await executionEngine.executeProject(
      projectId,
      files,
      stack as ProjectStack,
      entryPoint
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Execution error', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      code: error?.code
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Execution failed'
    });
  }
});

router.post('/stop', (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    executionEngine.stopExecution(projectId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Stop execution error', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      code: error?.code
    });
    res.status(500).json({ error: error.message });
  }
});

router.get('/ports', (req, res) => {
  const allocations = portManager.getAllocations();
  res.json({ allocations });
});

export default router;
