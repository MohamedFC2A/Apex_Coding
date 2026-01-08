// Vercel Serverless Function for /api/plan
const cors = require('cors');
require('dotenv').config();

// CORS middleware
const corsMiddleware = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

const normalizeDeepSeekBaseUrl = (raw) => {
  const base = String(raw || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
};

const getDeepSeekConfig = () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('API Key missing on Backend');
  const baseURL = normalizeDeepSeekBaseUrl(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com');
  return { apiKey, baseURL };
};

const deepSeekCreateChatCompletion = async (payload) => {
  const { apiKey, baseURL } = getDeepSeekConfig();
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `DeepSeek request failed (${res.status})`);
  }

  return res.json();
};

const cleanAndParseJSON = (text) => {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty AI response');
  try {
    return JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/```json\s*([\s\S]*?)\s*```/i) || raw.match(/```\s*([\s\S]*?)\s*```/);
    if (match && match[1]) return JSON.parse(match[1]);
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw e;
  }
};

const PLAN_SYSTEM_PROMPT = `You are an Elite Software Architect AI with deep expertise in ALL programming languages, frameworks, and technologies.

Your task is to analyze the user's request and create a PERFECT, COMPREHENSIVE implementation plan.

CRITICAL RULES:
1. Output ONLY raw JSON (no markdown, no code fences)
2. JSON shape: {"title":"...","description":"...","stack":"...","fileTree":[...],"steps":[{"id":"1","title":"...","category":"...","files":[...],"description":"..."}]}
3. Analyze the request deeply - understand EXACTLY what the user wants
4. Create a COMPLETE file tree showing ALL files that will be created
5. Each step must have: id, title, category (frontend/backend/config/testing/deployment), files array, description
6. Steps should be in logical order of implementation
7. Be SPECIFIC - don't say "Create components", say "Create Header component with navigation links"

STACK DETECTION:
- Detect the best technology stack based on user request
- For web apps: Next.js + TypeScript + Tailwind + Convex (if database needed)
- For static sites: HTML + CSS + JS
- For APIs: Node.js + Express
- For Python projects: Flask/FastAPI
- Always choose the BEST stack for the project

FILE TREE FORMAT:
- List ALL files with full paths: ["package.json", "src/App.tsx", "src/components/Header.tsx", ...]
- Include ALL necessary files: configs, components, pages, styles, utils, types, etc.

STEP CATEGORIES:
- "config": Setup, configuration, dependencies
- "frontend": UI components, pages, layouts, styles
- "backend": API routes, server logic, database
- "integration": Connecting frontend to backend
- "testing": Tests and validation
- "deployment": Build and deploy setup

EXAMPLE OUTPUT:
{
  "title": "E-commerce Dashboard",
  "description": "A modern e-commerce admin dashboard with product management, analytics, and user management",
  "stack": "Next.js 14, TypeScript, Tailwind CSS, Convex, Lucide Icons",
  "fileTree": [
    "package.json",
    "tsconfig.json",
    "tailwind.config.js",
    "next.config.js",
    "convex/schema.ts",
    "convex/products.ts",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/components/Sidebar.tsx",
    "src/components/ProductTable.tsx"
  ],
  "steps": [
    {"id":"1","title":"Initialize Next.js project with TypeScript and Tailwind","category":"config","files":["package.json","tsconfig.json","tailwind.config.js","next.config.js"],"description":"Set up the project foundation with all dependencies"},
    {"id":"2","title":"Create Convex schema and database functions","category":"backend","files":["convex/schema.ts","convex/products.ts"],"description":"Define database schema and CRUD operations"},
    {"id":"3","title":"Build main layout with sidebar navigation","category":"frontend","files":["src/app/layout.tsx","src/components/Sidebar.tsx"],"description":"Create the dashboard layout structure"},
    {"id":"4","title":"Create product management components","category":"frontend","files":["src/components/ProductTable.tsx","src/app/page.tsx"],"description":"Build the product listing and management UI"}
  ]
}

Now analyze the user's request and create the PERFECT implementation plan.`.trim();

module.exports = async (req, res) => {
  // Run CORS middleware
  await runMiddleware(req, res, corsMiddleware);

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body || {};
    console.log('[plan] Generating plan for prompt:', typeof prompt === 'string' ? prompt.slice(0, 500) : prompt);
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const request = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.0,
      messages: [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    };

    let completion;
    try {
      completion = await deepSeekCreateChatCompletion({
        ...request,
        response_format: { type: 'json_object' }
      });
    } catch {
      completion = await deepSeekCreateChatCompletion(request);
    }

    let content = completion?.choices?.[0]?.message?.content || '';
    console.log('[plan] Raw AI output preview:', String(content).slice(0, 800));

    content = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
    if (content.length === 0) throw new Error('Empty AI response');

    const parsed = cleanAndParseJSON(content);
    const stepsRaw = Array.isArray(parsed) ? parsed : parsed?.steps;
    const steps = Array.isArray(stepsRaw)
      ? stepsRaw
          .map((step, index) => {
            if (typeof step === 'string') {
              const title = step.trim();
              return title ? { id: String(index + 1), title, category: 'frontend', files: [], description: '' } : null;
            }
            const title = String(step?.title ?? step?.text ?? step?.step ?? '').trim();
            if (!title) return null;
            return {
              id: String(step?.id ?? index + 1),
              title,
              category: String(step?.category ?? 'frontend').toLowerCase(),
              files: Array.isArray(step?.files) ? step.files : [],
              description: String(step?.description ?? '')
            };
          })
          .filter(Boolean)
      : [];

    const title = typeof parsed?.title === 'string' ? parsed.title : 'Architecture Plan';
    const description = typeof parsed?.description === 'string' ? parsed.description : '';
    const stack = typeof parsed?.stack === 'string' ? parsed.stack : '';
    const fileTree = Array.isArray(parsed?.fileTree) ? parsed.fileTree : [];

    return res.status(200).json({ title, description, stack, fileTree, steps });
  } catch (error) {
    console.error('AI Plan Error:', error.message);
    return res.status(500).json({
      error: error.message || 'Failed to generate plan',
      title: 'Plan Generation Failed',
      steps: [{ id: '1', title: 'Error parsing AI response. Please try again.', category: 'config', files: [], description: '' }]
    });
  }
};
