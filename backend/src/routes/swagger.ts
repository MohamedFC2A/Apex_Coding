import express from 'express';

/**
 * Minimal OpenAPI (Swagger) specification for the public API.
 * This is intentionally lightweight – it documents the main endpoints
 * used by the frontend. The spec can be extended later without breaking
 * existing functionality.
 */
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'NEXUS AI CODING API',
    version: '1.0.0',
    description: 'Auto‑generated API documentation for the NEXUS AI CODING backend.'
  },
  servers: [{ url: '/api' }],
  paths: {
    '/ai/generate': {
      post: {
        summary: 'Generate code (non‑streaming)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  prompt: { type: 'string' },
                  mode: { type: 'string', enum: ['DEMO', 'PRO'] },
                  thinkingMode: { type: 'boolean' }
                },
                required: ['prompt']
              }
            }
          }
        },
        responses: {
          '200': { description: 'Generated project files' },
          '400': { description: 'Invalid request' },
          '500': { description: 'Server error' }
        }
      }
    },
    '/ai/generate-stream': {
      post: {
        summary: 'Generate code with streaming response',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object' } }
          }
        },
        responses: { '200': { description: 'SSE stream' } }
      }
    },
    '/execute/run': {
      post: {
        summary: 'Execute generated project',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object' } }
          }
        },
        responses: { '200': { description: 'Execution result' } }
      }
    },
    '/download/zip': {
      post: {
        summary: 'Download project as ZIP archive',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object' } }
          }
        },
        responses: { '200': { description: 'ZIP binary' } }
      }
    },
    '/preview/{projectId}': {
      get: {
        summary: 'Preview a file from a generated project',
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'wildcard', in: 'path', required: false, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'File content' } }
      }
    },
    '/health': {
      get: { summary: 'Health check', responses: { '200': { description: 'Service status' } } }
    }
  }
};

const router = express.Router();

// Expose the raw OpenAPI JSON – can be consumed by Swagger UI or other tools
router.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

export default router;

