import express from 'express';
import { projectManager } from '../services/projectManager.js';

const router = express.Router();

router.get('/:projectId/*', async (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = (req.params as any)[0] || 'index.html';

    const content = await projectManager.readProjectFile(projectId, filePath);
    
    // Set appropriate content type
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(content);
  } catch (error: any) {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
