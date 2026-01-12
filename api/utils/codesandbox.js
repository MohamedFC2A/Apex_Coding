const path = require('path');

const { CodeSandbox } = require('@codesandbox/sdk');

const normalizeToken = (raw) => {
  const token = String(raw || '').trim();
  if (token.length >= 2 && ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'")))) {
    return token.slice(1, -1).trim();
  }
  return token;
};

const getCodeSandboxApiKey = () => {
  return normalizeToken(process.env.CSB_API_KEY || process.env.CSB_API_TOKEN || process.env.CODESANDBOX_API_TOKEN);
};

let sdkSingleton = null;
let sdkSingletonKey = null;

const getSdk = () => {
  const apiKey = getCodeSandboxApiKey();
  if (!apiKey) throw new Error('Missing CodeSandbox API key (CSB_API_KEY)');

  if (!sdkSingleton || sdkSingletonKey !== apiKey) {
    sdkSingleton = new CodeSandbox(apiKey);
    sdkSingletonKey = apiKey;
  }

  return sdkSingleton;
};

const normalizeWorkspacePath = (raw) => {
  const p = String(raw || '').replace(/\\/g, '/').trim();
  if (!p) return null;
  const noLead = p.startsWith('/') ? p.slice(1) : p;
  if (!noLead) return null;
  if (noLead.includes('\0')) return null;
  const posix = path.posix.normalize(noLead);
  if (!posix || posix === '.' || posix.startsWith('..') || posix.includes('/../')) return null;
  return posix;
};

const withCodeSandboxTasksFile = (fileMap, { devCommand, port }) => {
  const next = { ...(fileMap && typeof fileMap === 'object' ? fileMap : {}) };
  if (!next['.codesandbox/tasks.json']) {
    next['.codesandbox/tasks.json'] = JSON.stringify(
      {
        setupTasks: ['npm install'],
        tasks: {
          dev: {
            name: 'Dev Server',
            command: devCommand,
            preview: { port },
            runAtStart: true
          }
        }
      },
      null,
      2
    );
  }
  return next;
};

const inferDevCommandAndPort = (fileMap) => {
  const port = 3000;

  const packageJsonRaw =
    (fileMap && typeof fileMap === 'object' && (fileMap['package.json'] || fileMap['./package.json'])) || '';

  if (!packageJsonRaw) return { devCommand: 'npm run dev', port };

  try {
    const pkg = JSON.parse(String(packageJsonRaw));
    const scripts = pkg && typeof pkg === 'object' ? pkg.scripts || {} : {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    const hasDev = typeof scripts?.dev === 'string' && scripts.dev.trim().length > 0;
    const hasStart = typeof scripts?.start === 'string' && scripts.start.trim().length > 0;
    const hasVite = typeof deps.vite === 'string';
    const hasNext = typeof deps.next === 'string';

    if (hasDev) {
      if (hasNext) return { devCommand: `npm run dev -- -H 0.0.0.0 -p ${port}`, port };
      if (hasVite) return { devCommand: `npm run dev -- --host 0.0.0.0 --port ${port}`, port };
      return { devCommand: 'npm run dev', port };
    }

    if (hasStart) return { devCommand: 'npm start', port };
    return { devCommand: 'npm run dev', port };
  } catch {
    return { devCommand: 'npm run dev', port };
  }
};

const toBatchWriteEntries = (fileMap) => {
  const entries = [];
  const input = fileMap && typeof fileMap === 'object' ? Object.entries(fileMap) : [];

  for (const [rawPath, rawContent] of input) {
    const normalized = normalizeWorkspacePath(rawPath);
    if (!normalized) continue;
    entries.push({ path: normalized, content: String(rawContent ?? '') });
  }

  return entries;
};

const isDependencyManifest = (p) => {
  const normalized = String(p || '').replace(/\\/g, '/').trim();
  return (
    normalized === 'package.json' ||
    normalized === 'package-lock.json' ||
    normalized === 'pnpm-lock.yaml' ||
    normalized === 'yarn.lock'
  );
};

const ensureDevServerRunning = async ({ client, devCommand, port, timeoutMs }) => {
  const existing = await client.ports.get(port).catch(() => undefined);
  if (existing && existing.host) return existing;

  await client.commands.runBackground(devCommand, { name: 'dev-server' });
  return client.ports.waitForPort(port, { timeoutMs });
};

const createSandboxPreview = async ({ fileMap, timeoutMs = 180_000 }) => {
  const sdk = getSdk();
  const { devCommand, port } = inferDevCommandAndPort(fileMap);
  const effectiveFileMap = withCodeSandboxTasksFile(fileMap, { devCommand, port });

  const sandbox = await sdk.sandboxes.create({
    hibernationTimeoutSeconds: 60 * 45,
    automaticWakeupConfig: { http: true, websocket: true },
    privacy: 'public-hosts'
  });

  const client = await sandbox.connect();
  try {
    await client.setup.waitUntilComplete().catch(() => {});
    await client.fs.batchWrite(toBatchWriteEntries(effectiveFileMap));
    await client.commands.run('npm install', { name: 'npm install' }).catch(() => {});

    const portInfo = await ensureDevServerRunning({ client, devCommand, port, timeoutMs });
    const url = portInfo?.host || client.hosts.getUrl(port);

    return { sandboxId: sandbox.id, url, port };
  } finally {
    client.dispose();
  }
};

const patchSandboxFiles = async ({
  sandboxId,
  create = {},
  destroy = [],
  files,
  timeoutMs = 90_000
}) => {
  if (!sandboxId) throw new Error('sandboxId is required');
  const sdk = getSdk();

  const sandbox = await sdk.sandboxes.resume(sandboxId);
  const client = await sandbox.connect();

  try {
    const createEntries = [];
    for (const [rawPath, content] of Object.entries(create || {})) {
      const normalized = normalizeWorkspacePath(rawPath);
      if (!normalized) continue;
      createEntries.push({ path: normalized, content: String(content ?? '') });
    }

    if (createEntries.length > 0) {
      await client.fs.batchWrite(createEntries);
    }

    for (const rawPath of Array.isArray(destroy) ? destroy : []) {
      const normalized = normalizeWorkspacePath(rawPath);
      if (!normalized) continue;
      await client.fs.remove(normalized).catch(() => {});
    }

    const fileMapForInference = files && Array.isArray(files) ? files : null;
    const inferredMap =
      fileMapForInference &&
      Object.fromEntries(
        fileMapForInference
          .map((f) => [String(f?.path || f?.name || '').trim(), String(f?.content ?? '')])
          .filter(([p]) => p)
      );

    const { devCommand, port } = inferDevCommandAndPort(inferredMap);

    const shouldInstall = Object.keys(create || {}).some(isDependencyManifest) || (Array.isArray(destroy) && destroy.some(isDependencyManifest));
    if (shouldInstall) {
      await client.commands.run('npm install', { name: 'npm install' }).catch(() => {});
    }

    const portInfo = await ensureDevServerRunning({ client, devCommand, port, timeoutMs });
    const url = portInfo?.host || client.hosts.getUrl(port);

    return { sandboxId, url, port };
  } finally {
    client.dispose();
  }
};

const hibernateSandbox = async (sandboxId) => {
  if (!sandboxId) return;
  const sdk = getSdk();
  await sdk.sandboxes.hibernate(String(sandboxId)).catch(() => {});
};

module.exports = { getCodeSandboxApiKey, createSandboxPreview, patchSandboxFiles, hibernateSandbox };
