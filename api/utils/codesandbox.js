const { compressToBase64 } = require('lz-string');

const DEFAULT_CSB_DEFINE_ENDPOINT = 'https://codesandbox.io/api/v1/sandboxes/define?json=1';

const encodeDefineParameters = (definition) => {
  const json = JSON.stringify(definition);
  return compressToBase64(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const toSandboxFilesObject = (fileMap) => {
  const out = {};
  const entries = fileMap && typeof fileMap === 'object' ? Object.entries(fileMap) : [];
  for (const [rawPath, rawContent] of entries) {
    const path = String(rawPath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path) continue;
    out[path] = { content: String(rawContent ?? '') };
  }
  return out;
};

const inferTasksJson = (fileMap) => {
  const packageJsonRaw =
    (fileMap && typeof fileMap === 'object' && (fileMap['package.json'] || fileMap['./package.json'])) || '';
  if (!packageJsonRaw) return null;

  try {
    const pkg = JSON.parse(String(packageJsonRaw));
    const hasDevScript = Boolean(pkg && pkg.scripts && typeof pkg.scripts.dev === 'string' && pkg.scripts.dev.trim());
    if (!hasDevScript) return null;

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const hasVite = typeof deps.vite === 'string';
    const hasNext = typeof deps.next === 'string';

    let command = 'npm run dev';
    if (hasVite) command = 'npm run dev -- --host 0.0.0.0 --port 3000';
    if (hasNext) command = 'npm run dev -- -H 0.0.0.0 -p 3000';

    return {
      setupTasks: [{ name: 'Install dependencies', command: 'npm install' }],
      tasks: {
        dev: {
          name: 'Dev server',
          command,
          runAtStart: true
        }
      }
    };
  } catch {
    return null;
  }
};

const withOptionalCodeSandboxDefaults = (fileMap) => {
  const next = { ...(fileMap && typeof fileMap === 'object' ? fileMap : {}) };

  const hasTasks = Object.prototype.hasOwnProperty.call(next, '.codesandbox/tasks.json');
  if (!hasTasks) {
    const tasks = inferTasksJson(next);
    if (tasks) next['.codesandbox/tasks.json'] = JSON.stringify(tasks, null, 2);
  }

  return next;
};

const createDefineSandbox = async ({ fileMap, template = 'node', apiToken }) => {
  const effectiveFileMap = withOptionalCodeSandboxDefaults(fileMap);
  const files = toSandboxFilesObject(effectiveFileMap);

  const parameters = encodeDefineParameters({ files, template });
  const endpoint = String(process.env.CSB_DEFINE_ENDPOINT || DEFAULT_CSB_DEFINE_ENDPOINT).trim();

  const headers = { 'Content-Type': 'application/json' };
  const token = String(apiToken || '').trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ parameters })
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(text || `CodeSandbox define failed (${res.status})`);
  }

  try {
    const parsed = JSON.parse(text);
    const sandboxId = parsed?.sandbox_id || parsed?.sandboxId || parsed?.id;
    if (typeof sandboxId === 'string' && sandboxId.trim()) return sandboxId.trim();
  } catch {}

  // Some variants return the id as plain text.
  const maybe = String(text || '').trim();
  if (maybe && /^[a-z0-9-]+$/i.test(maybe)) return maybe;

  throw new Error('CodeSandbox define returned an unknown response');
};

const buildEmbedUrl = (sandboxId) => {
  const id = String(sandboxId || '').trim();
  return `https://codesandbox.io/embed/${encodeURIComponent(id)}?view=preview&hidenavigation=1&hidedevtools=1&runonclick=1`;
};

module.exports = { createDefineSandbox, buildEmbedUrl };

