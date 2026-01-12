const { setTimeout: delay } = require('timers/promises');

async function ensureNetwork(docker, networkName) {
  const networks = await docker.listNetworks();
  if (networks.some((n) => n && n.Name === networkName)) return;
  await docker.createNetwork({ Name: networkName, CheckDuplicate: true, Driver: 'bridge' });
}

async function removeContainerIfExists(docker, containerName) {
  try {
    const container = docker.getContainer(containerName);
    await container.inspect();
    try {
      await container.stop({ t: 2 });
    } catch {}
    await container.remove({ force: true });
  } catch {
    // ignore
  }
}

async function createSessionContainer(docker, { containerName, image, networkName, sessionPort }) {
  const cmd = [
    'bash',
    '-lc',
    [
      'set -e',
      'mkdir -p /workspace',
      'echo "[sandbox] waiting for /workspace/.apex-ready…" >&2',
      'while [ ! -f /workspace/.apex-ready ]; do sleep 0.1; done',
      'cd /workspace',
      'corepack enable >/dev/null 2>&1 || true',
      'if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile || pnpm install; fi',
      'if [ -f yarn.lock ]; then yarn install --frozen-lockfile || yarn install; fi',
      'if [ -f package-lock.json ]; then npm ci || npm install; fi',
      'if [ ! -f pnpm-lock.yaml ] && [ ! -f yarn.lock ] && [ ! -f package-lock.json ]; then npm install; fi',
      'echo "[sandbox] starting dev server…" >&2',
      'npm run dev'
    ].join('; ')
  ];

  const memoryMbRaw = Number(process.env.SESSION_MEMORY_MB || process.env.SESSION_MEMORY || 1024);
  const memoryMb = Number.isFinite(memoryMbRaw) ? Math.max(256, Math.floor(memoryMbRaw)) : 1024;
  const nanoCpusRaw = Number(process.env.SESSION_NANOCPUS || 1_500_000_000);
  const nanoCpus = Number.isFinite(nanoCpusRaw) ? Math.max(250_000_000, Math.floor(nanoCpusRaw)) : 1_500_000_000;

  const hostConfig = {
    AutoRemove: true,
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges'],
    Memory: memoryMb * 1024 * 1024,
    NanoCpus: nanoCpus,
    PidsLimit: 512
  };

  const networkingConfig = {
    EndpointsConfig: {
      [networkName]: {
        Aliases: [containerName]
      }
    }
  };

  return docker.createContainer({
    name: containerName,
    Image: image,
    Cmd: cmd,
    Labels: {
      'apex.preview': '1'
    },
    Env: [
      `HOST=0.0.0.0`,
      `PORT=${sessionPort}`,
      `API_PORT=3001`,
      `CI=1`
    ],
    ExposedPorts: {
      [`${sessionPort}/tcp`]: {}
    },
    HostConfig: hostConfig,
    NetworkingConfig: networkingConfig
  });
}

async function waitForHttpReady({ url, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      // Many dev servers are "ready" even if they return a non-2xx response on `/` (e.g. Vite can return 403
      // when Host headers don't match its allowed list during early startup).
      if (res.status < 500) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await delay(750);
  }
  throw lastErr || new Error('Timed out waiting for dev server');
}

async function execInContainer(container, cmd) {
  const exec = await container.exec({
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    Cmd: cmd
  });
  const stream = await exec.start({ hijack: true, stdin: false });
  await new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

module.exports = {
  ensureNetwork,
  removeContainerIfExists,
  createSessionContainer,
  waitForHttpReady,
  execInContainer
};
