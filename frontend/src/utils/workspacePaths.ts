import { sanitizeOperationPath } from '@/utils/fileOpGuards';

type WorkspaceRoot = 'frontend' | 'backend';

const ROOT_FILES = new Set(['readme.md']);

const FRONTEND_EXTENSIONS = new Set([
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'jsx',
  'tsx',
  'vue',
  'svelte'
]);

const BACKEND_EXTENSIONS = new Set([
  'js',
  'ts',
  'py',
  'go',
  'rb',
  'java',
  'cs',
  'php',
  'rs',
  'cpp',
  'c',
  'sql',
  'env'
]);

const FRONTEND_HINTS = ['frontend', 'client', 'components', 'pages', 'public', 'styles', 'assets', 'hooks', 'ui'];
const BACKEND_HINTS = ['backend', 'server', 'api', 'routes', 'controllers', 'models', 'db', 'database', 'middleware'];

const FRONTEND_FILES = new Set([
  'index.html',
  'main.tsx',
  'main.jsx',
  'app.tsx',
  'app.jsx',
  'vite.config.ts',
  'vite.config.js',
  'tailwind.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.ts'
]);

const BACKEND_FILES = new Set([
  'server.js',
  'server.ts',
  'server.py',
  'app.js',
  'app.ts',
  'app.py',
  'main.py',
  'requirements.txt',
  '.env',
  '.env.example'
]);

const startsWithWorkspaceRoot = (path: string) => path.startsWith('frontend/') || path.startsWith('backend/');

export const normalizeStoredPath = (value: string) => sanitizeOperationPath(value);

export const inferWorkspaceRootFromPath = (path: string): WorkspaceRoot => {
  const cleaned = normalizeStoredPath(path);
  if (!cleaned) return 'frontend';

  const lower = cleaned.toLowerCase();
  const segments = lower.split('/');
  const fileName = segments[segments.length - 1] || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';

  const hasFrontendHint =
    segments.some((segment) => FRONTEND_HINTS.includes(segment)) ||
    FRONTEND_HINTS.some((hint) => fileName.includes(hint));

  const hasBackendHint =
    segments.some((segment) => BACKEND_HINTS.includes(segment)) ||
    BACKEND_HINTS.some((hint) => fileName.includes(hint));

  const isAmbiguousScriptExt = ext === 'js' || ext === 'ts';
  if (isAmbiguousScriptExt && !hasBackendHint && !BACKEND_FILES.has(fileName)) {
    return 'frontend';
  }

  if (FRONTEND_FILES.has(fileName) || (ext && FRONTEND_EXTENSIONS.has(ext)) || hasFrontendHint) {
    return 'frontend';
  }

  if (BACKEND_FILES.has(fileName) || (ext && BACKEND_EXTENSIONS.has(ext)) || hasBackendHint) {
    return 'backend';
  }

  return 'frontend';
};

export const normalizeWorkspaceFilePath = (rawPath: string) => {
  const cleaned = normalizeStoredPath(rawPath);
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (lower.endsWith('.svg')) {
    if (lower.startsWith('frontend/src/assets/icons/')) return cleaned;
    const fileName = cleaned.split('/').pop() || 'icon.svg';
    return `frontend/src/assets/icons/${fileName}`;
  }

  if (startsWithWorkspaceRoot(cleaned)) return cleaned;

  const segments = cleaned.split('/');
  const fileName = segments[segments.length - 1] || '';
  if (segments.length === 1 && ROOT_FILES.has(fileName.toLowerCase())) return cleaned;

  return `${inferWorkspaceRootFromPath(cleaned)}/${cleaned}`;
};

export const normalizeWorkspaceDirectoryPath = (rawPath: string) => {
  const cleaned = normalizeStoredPath(rawPath).replace(/\/+$/, '');
  if (!cleaned) return '';
  if (startsWithWorkspaceRoot(cleaned)) return cleaned;
  return `${inferWorkspaceRootFromPath(cleaned)}/${cleaned}`;
};
