// Load environment variables
require('dotenv').config();

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

const normalizePreviewUrl = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
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

const extractPortFromScript = (script) => {
  const s = String(script || '');
  if (!s) return null;

  const m =
    /(?:^|\s)--port=(\d{2,5})(?=\s|$)/.exec(s) ||
    /(?:^|\s)--port\s+(\d{2,5})(?=\s|$)/.exec(s) ||
    /(?:^|\s)-p\s+(\d{2,5})(?=\s|$)/.exec(s);

  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 65535) return null;
  return n;
};

const scriptHasPortFlag = (script) => /(?:^|\s)(?:--port(?:=|\s)|-p\s)/.test(String(script || ''));

const scriptHasHostFlag = (script) => {
  const s = String(script || '');
  return /(?:^|\s)(?:--host(?:=|\s)|--hostname(?:=|\s)|-H\s)/.test(s);
};

const scriptLooksComplex = (script) => {
  const s = String(script || '').trim();
  if (!s) return false;

  // If the dev script orchestrates other commands, appending args with `npm run dev -- ...`
  // can break the tool (e.g. `concurrently ... -p 3000`).
  if (/[;&|]{2,}|[;&]/.test(s)) return true;
  if (/(\s|^)concurrently(\s|$)/.test(s)) return true;
  if (/(\s|^)npm-?run-?all(\s|$)/.test(s)) return true;
  if (/(\s|^)run-p(\s|$)/.test(s)) return true;
  if (/(\s|^)turbo(\s|$)/.test(s)) return true;
  if (/(\s|^)lerna(\s|$)/.test(s)) return true;
  if (/(\s|^)nx(\s|$)/.test(s)) return true;
  if (/(\s|^)pnpm(\s|$)/.test(s) && /(\s|^)-r(\s|$)|(\s|^)--recursive(\s|$)/.test(s)) return true;
  if (/npm\s+--workspace\b/.test(s) || /npm\s+--workspaces\b/.test(s)) return true;

  return false;
};

const inferDevCommandAndPort = (fileMap) => {
  const packageJsonRaw =
    (fileMap && typeof fileMap === 'object' && (fileMap['package.json'] || fileMap['./package.json'])) || '';

  if (!packageJsonRaw) {
    const fallbackPortRaw = Number(process.env.CSB_PREVIEW_PORT || process.env.PREVIEW_PORT || 3000);
    const fallbackPort = Number.isFinite(fallbackPortRaw) ? fallbackPortRaw : 3000;
    return { devCommand: 'npm run dev', port: fallbackPort };
  }

  try {
    const pkg = JSON.parse(String(packageJsonRaw));
    const scripts = pkg && typeof pkg === 'object' ? pkg.scripts || {} : {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    const hasDev = typeof scripts?.dev === 'string' && scripts.dev.trim().length > 0;
    const hasStart = typeof scripts?.start === 'string' && scripts.start.trim().length > 0;
    const hasVite = typeof deps.vite === 'string';
    const hasNext = typeof deps.next === 'string';

    const preferredPortRaw = Number(process.env.CSB_PREVIEW_PORT || process.env.PREVIEW_PORT || NaN);
    const preferredPort = Number.isFinite(preferredPortRaw) ? preferredPortRaw : null;

    const devScript = hasDev ? scripts.dev : null;
    const startScript = hasStart ? scripts.start : null;
    const portFromScript = extractPortFromScript(devScript) || extractPortFromScript(startScript);
    const port = portFromScript || preferredPort || (hasNext ? 3000 : hasVite ? 5173 : 3000);

    // When the dev script is "complex" (monorepos, runners, concurrently, etc.),
    // don't append args; just run it as-is and wait for the inferred port.
    if (hasDev && scriptLooksComplex(devScript)) {
      return { devCommand: 'npm run dev', port };
    }
    if (!hasDev && hasStart && scriptLooksComplex(startScript)) {
      return { devCommand: 'npm start', port };
    }

    if (hasDev) {
      if (hasNext) {
        const extra = [];
        if (!scriptHasHostFlag(devScript)) extra.push('--hostname', '0.0.0.0');
        if (!scriptHasPortFlag(devScript)) extra.push('--port', String(port));
        const devCommand = extra.length > 0 ? `npm run dev -- ${extra.join(' ')}` : 'npm run dev';
        return { devCommand, port };
      }
      if (hasVite) {
        const extra = [];
        if (!scriptHasHostFlag(devScript)) extra.push('--host', '0.0.0.0');
        if (!scriptHasPortFlag(devScript)) extra.push('--port', String(port));
        if (!/\b--strictPort\b/.test(String(devScript || ''))) extra.push('--strictPort');
        const devCommand = extra.length > 0 ? `npm run dev -- ${extra.join(' ')}` : 'npm run dev';
        return { devCommand, port };
      }
      return { devCommand: 'npm run dev', port };
    }

    if (hasStart) return { devCommand: 'npm start', port };
    return { devCommand: 'npm run dev', port };
  } catch {
    const fallbackPortRaw = Number(process.env.CSB_PREVIEW_PORT || process.env.PREVIEW_PORT || 3000);
    const fallbackPort = Number.isFinite(fallbackPortRaw) ? fallbackPortRaw : 3000;
    return { devCommand: 'npm run dev', port: fallbackPort };
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
  const candidatePorts = Array.from(new Set([port, 3000, 5000, 5173, 4173, 8080].filter((p) => Number.isFinite(p))));

  for (const p of candidatePorts) {
    const existing = await client.ports.get(p).catch(() => undefined);
    if (existing && existing.host) return existing;
  }

  await client.commands.runBackground(devCommand, { name: 'dev-server' });

  try {
    return await Promise.any(candidatePorts.map((p) => client.ports.waitForPort(p, { timeoutMs })));
  } catch (err) {
    const opened = await client.ports.getAll().catch(() => []);
    const best = candidatePorts.map((p) => opened.find((o) => o.port === p)).find((o) => o && o.host);
    if (best && best.host) return best;

    const any = opened.find((o) => o && o.host);
    if (any && any.host) return any;

    throw err;
  }
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
    const url = normalizePreviewUrl(portInfo?.host || client.hosts.getUrl(port));

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
    const url = normalizePreviewUrl(portInfo?.host || client.hosts.getUrl(port));

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
