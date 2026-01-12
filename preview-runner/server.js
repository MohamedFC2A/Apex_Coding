const crypto = require('crypto');
const http = require('http');

const cors = require('cors');
const Docker = require('dockerode');
const express = require('express');
const httpProxy = require('http-proxy');
const { z } = require('zod');

const { buildTarFromFiles, normalizeWorkspacePath } = require('./src/files');
const { ensureNetwork, createSessionContainer, removeContainerIfExists, waitForHttpReady, execInContainer } = require('./src/docker');

const PORT = Number(process.env.PORT || 8080);
const PREVIEW_DOMAIN = String(process.env.PREVIEW_DOMAIN || 'localhost').trim();
const PREVIEW_PROTOCOL = String(process.env.PREVIEW_PROTOCOL || 'http').trim();
const PREVIEW_PUBLIC_PORT_RAW = String(process.env.PREVIEW_PUBLIC_PORT || '').trim();
const PREVIEW_PUBLIC_PORT_PARSED = PREVIEW_PUBLIC_PORT_RAW ? Number(PREVIEW_PUBLIC_PORT_RAW) : PORT;
const PREVIEW_PUBLIC_PORT = Number.isFinite(PREVIEW_PUBLIC_PORT_PARSED) ? PREVIEW_PUBLIC_PORT_PARSED : PORT;
const API_TOKEN = String(process.env.PREVIEW_RUNNER_TOKEN || '').trim();
const SESSION_TTL_MINUTES = Number(process.env.SESSION_TTL_MINUTES || 45);
const SANDBOX_IMAGE = String(process.env.SANDBOX_IMAGE || 'apex-preview-sandbox:latest').trim();
const DOCKER_NETWORK = String(process.env.DOCKER_NETWORK || 'apex_preview').trim();
const SESSION_PORT = Number(process.env.SESSION_PORT || 3000);
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 50);
const MAX_TOTAL_BYTES = Number(process.env.MAX_TOTAL_BYTES || 25 * 1024 * 1024); // 25MB

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

const sessions = new Map(); // id -> { id, containerName, createdAt, lastAccessAt }

const app = express();
app.disable('x-powered-by');

app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '50mb' }));

const requireToken = (req, res, next) => {
  if (!API_TOKEN) return res.status(500).json({ error: 'PREVIEW_RUNNER_TOKEN is not set' });
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : '';
  if (!token || token !== API_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  return next();
};

const CreateSessionSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1),
        path: z.string().optional(),
        content: z.string()
      })
    )
    .min(1)
});

const PatchFilesSchema = z.object({
  create: z.record(z.string(), z.string()).optional().default({}),
  destroy: z.array(z.string()).optional().default([])
});

const createId = () => crypto.randomBytes(10).toString('base64url');

const sessionUrlForId = (id) => {
  const omitPort =
    (PREVIEW_PROTOCOL === 'http' && PREVIEW_PUBLIC_PORT === 80) ||
    (PREVIEW_PROTOCOL === 'https' && PREVIEW_PUBLIC_PORT === 443);
  const portPart = omitPort ? '' : `:${PREVIEW_PUBLIC_PORT}`;
  return `${PREVIEW_PROTOCOL}://${id}.${PREVIEW_DOMAIN}${portPart}/`;
};

const touchSession = (id) => {
  const s = sessions.get(id);
  if (!s) return;
  s.lastAccessAt = Date.now();
};

app.get('/api/health', (_req, res) => res.json({ ok: true, domain: PREVIEW_DOMAIN, image: SANDBOX_IMAGE }));

app.post('/api/sessions', requireToken, async (req, res) => {
  if (sessions.size >= MAX_SESSIONS) return res.status(429).json({ error: 'MAX_SESSIONS reached' });

  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

  const id = createId();
  const containerName = `apx-prev-${id}`;

  const files = parsed.data.files;
  const fileMap = {};
  let totalBytes = 0;
  for (const f of files) {
    const rawPath = f.path || f.name;
    const normalized = normalizeWorkspacePath(rawPath);
    if (!normalized) continue;
    totalBytes += Buffer.byteLength(f.content || '', 'utf8');
    if (totalBytes > MAX_TOTAL_BYTES) return res.status(413).json({ error: 'Project too large' });
    fileMap[normalized] = f.content || '';
  }
  if (Object.keys(fileMap).length === 0) return res.status(400).json({ error: 'No valid files' });

  try {
    await ensureNetwork(docker, DOCKER_NETWORK);
    await removeContainerIfExists(docker, containerName);

    const container = await createSessionContainer(docker, {
      containerName,
      image: SANDBOX_IMAGE,
      networkName: DOCKER_NETWORK,
      sessionPort: SESSION_PORT
    });

    await container.start();

    const tarStream = buildTarFromFiles({
      rootPrefix: 'workspace',
      files: {
        ...fileMap,
        '.apex-ready': '1\n'
      }
    });

    await container.putArchive(tarStream, { path: '/' });
    await waitForHttpReady({ url: `http://${containerName}:${SESSION_PORT}/`, timeoutMs: 180_000 });

    sessions.set(id, { id, containerName, createdAt: Date.now(), lastAccessAt: Date.now() });

    return res.json({ id, url: sessionUrlForId(id) });
  } catch (err) {
    // best-effort cleanup
    try {
      await removeContainerIfExists(docker, containerName);
    } catch {}
    return res.status(500).json({ error: String(err?.message || err || 'Failed to start session') });
  }
});

app.get('/api/sessions/:id', requireToken, async (req, res) => {
  const id = String(req.params.id || '').trim();
  const s = sessions.get(id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  return res.json({ id: s.id, url: sessionUrlForId(id), createdAt: s.createdAt, lastAccessAt: s.lastAccessAt });
});

app.patch('/api/sessions/:id/files', requireToken, async (req, res) => {
  const id = String(req.params.id || '').trim();
  const s = sessions.get(id);
  if (!s) return res.status(404).json({ error: 'Not found' });

  const parsed = PatchFilesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

  const create = parsed.data.create || {};
  const destroy = parsed.data.destroy || [];

  const safeCreate = {};
  let totalBytes = 0;
  for (const [rawPath, content] of Object.entries(create)) {
    const normalized = normalizeWorkspacePath(rawPath);
    if (!normalized) continue;
    totalBytes += Buffer.byteLength(String(content || ''), 'utf8');
    if (totalBytes > MAX_TOTAL_BYTES) return res.status(413).json({ error: 'Patch too large' });
    safeCreate[normalized] = String(content || '');
  }

  try {
    const container = docker.getContainer(s.containerName);

    if (Object.keys(safeCreate).length > 0) {
      const tarStream = buildTarFromFiles({ rootPrefix: 'workspace', files: safeCreate });
      await container.putArchive(tarStream, { path: '/' });
    }

    for (const rawPath of destroy) {
      const normalized = normalizeWorkspacePath(rawPath);
      if (!normalized) continue;
      await execInContainer(container, ['rm', '-rf', '--', `/workspace/${normalized}`]);
    }

    touchSession(id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err || 'Failed to apply changes') });
  }
});

app.delete('/api/sessions/:id', requireToken, async (req, res) => {
  const id = String(req.params.id || '').trim();
  const s = sessions.get(id);
  if (!s) return res.status(404).json({ error: 'Not found' });

  try {
    await removeContainerIfExists(docker, s.containerName);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err || 'Failed to stop session') });
  } finally {
    sessions.delete(id);
  }
  return res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.type('text').send('Apex Preview Runner is running.');
});

const proxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true, xfwd: true });

const getSessionIdFromHost = (host) => {
  const cleanHost = String(host || '').trim().toLowerCase();
  if (!cleanHost) return null;
  if (cleanHost === PREVIEW_DOMAIN) return null;
  if (!cleanHost.endsWith(`.${PREVIEW_DOMAIN}`)) return null;
  const sub = cleanHost.slice(0, cleanHost.length - (`.${PREVIEW_DOMAIN}`).length);
  const id = sub.split('.')[0];
  return id || null;
};

const server = http.createServer((req, res) => {
  const isApi = String(req.url || '').startsWith('/api/');
  if (isApi) return app(req, res);

  const id = getSessionIdFromHost(req.headers.host);
  if (!id) return app(req, res);

  const s = sessions.get(id);
  if (!s) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Preview session not found.');
    return;
  }

  touchSession(id);
  proxy.web(req, res, { target: `http://${s.containerName}:${SESSION_PORT}` }, (err) => {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(String(err?.message || err || 'Proxy error'));
  });
});

server.on('upgrade', (req, socket, head) => {
  const id = getSessionIdFromHost(req.headers.host);
  const s = id ? sessions.get(id) : null;
  if (!s) return socket.destroy();
  touchSession(id);
  proxy.ws(req, socket, head, { target: `http://${s.containerName}:${SESSION_PORT}` });
});

const cleanupLoop = () => {
  const now = Date.now();
  const ttlMs = Math.max(1, SESSION_TTL_MINUTES) * 60 * 1000;
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastAccessAt < ttlMs) continue;
    removeContainerIfExists(docker, s.containerName).catch(() => {});
    sessions.delete(id);
  }
};

setInterval(cleanupLoop, 30_000).unref?.();

const cleanupOrphanedContainers = async () => {
  try {
    const containers = await docker.listContainers({ all: true });
    const orphans = containers.filter((c) => c?.Labels?.['apex.preview'] === '1');
    for (const c of orphans) {
      try {
        await docker.getContainer(c.Id).remove({ force: true });
      } catch {}
    }
  } catch {}
};

void cleanupOrphanedContainers().finally(() => {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[preview-runner] listening on ${PREVIEW_PROTOCOL}://0.0.0.0:${PORT} (domain=${PREVIEW_DOMAIN})`);
  });
});
