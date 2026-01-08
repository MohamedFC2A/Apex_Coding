import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FileSystem, FileSystemEntry } from '@/types';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePreviewStore } from '@/stores/previewStore';
import { DEFAULT_ROOT_PACKAGE_JSON, ensureWebContainer, installDependencies, resetWebContainerState, startServer, syncFileSystem } from '@/services/webcontainer';
import { stripAnsi } from '@/utils/ansi';

type RuntimeStatus = 'idle' | 'booting' | 'mounting' | 'installing' | 'starting' | 'ready' | 'error';

type WebContainerContextValue = {
  status: RuntimeStatus;
  url: string | null;
  error: string | null;
  deployAndRun: () => Promise<void>;
  runProject: () => Promise<void>;
  restart: () => Promise<void>;
};

const WebContainerContext = createContext<WebContainerContextValue | null>(null);

const normalizeFileSystem = (files: FileSystem | []) => (Array.isArray(files) ? {} : files);

const isTreeEmpty = (tree: FileSystem) => Object.keys(tree).length === 0;

const treeContainsFileNamed = (tree: FileSystem, filename: string): boolean => {
  for (const [name, entry] of Object.entries(tree) as [string, FileSystemEntry][]) {
    if (name.toLowerCase() === filename.toLowerCase() && entry.file) return true;
    if (entry.directory && treeContainsFileNamed(entry.directory, filename)) return true;
  }
  return false;
};

const STATIC_SERVER_FILE = '.apex/static-server.cjs';
const STATIC_SERVER_CODE = `const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 5173);
const root = process.cwd();

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const resolveSafePath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalized = decoded.replace(/\\\\/g, '/');
  const withoutLeading = normalized.replace(/^\\/+/, '');
  const resolved = path.resolve(root, withoutLeading);
  if (!resolved.startsWith(root)) return null;
  return resolved;
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, headers);
  res.end(body);
};

const server = http.createServer((req, res) => {
  const safe = resolveSafePath(req.url || '/');
  if (!safe) return send(res, 400, 'Bad Request');

  let target = safe;
  try {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) target = path.join(target, 'index.html');
  } catch {
    // fall through
  }

  if (!fs.existsSync(target)) {
    const index = path.join(root, 'index.html');
    if (fs.existsSync(index)) target = index;
  }

  if (!fs.existsSync(target)) return send(res, 404, 'Not Found');

  const ext = path.extname(target).toLowerCase();
  const type = contentTypes[ext] || 'application/octet-stream';
  try {
    const buffer = fs.readFileSync(target);
    send(res, 200, buffer, { 'Content-Type': type });
  } catch (err) {
    send(res, 500, String(err && err.message ? err.message : err));
  }
});

server.listen(port, () => {
  console.log('[static] listening on', port);
});
`;

const addStaticServerFile = (tree: FileSystem): FileSystem => {
  const dotApex = tree['.apex']?.directory;
  const nextDotApex: FileSystem = {
    ...(dotApex || {}),
    'static-server.cjs': { file: { contents: STATIC_SERVER_CODE } }
  };

  return {
    ...tree,
    ['.apex']: { directory: nextDotApex }
  };
};

const createLineBuffer = (onLine: (line: string) => void) => {
  let buffer = '';
  return (chunk: string) => {
    buffer += stripAnsi(chunk);
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) onLine(trimmed);
    }
  };
};

const shouldSuppressLine = (line: string) => {
  const lower = line.toLowerCase();
  if (lower.includes('deprecated')) return true;
  if (lower.includes('npm fund')) return true;
  if (lower.includes('looking for funding')) return true;
  return false;
};

const getPackageDir = (path: string) => {
  const parts = path.split('/');
  if (parts.length <= 1) return '.';
  return parts.slice(0, -1).join('/');
};

const resolveStartCommand = (fileMap: Map<string, string>) => {
  // Improved static detection - any index.html anywhere with no package.json means serve statically
  const hasAnyIndexHtml = Array.from(fileMap.keys()).some((p) => p.toLowerCase().endsWith('index.html'));
  const hasAnyPackageJson = Array.from(fileMap.keys()).some((p) => p.toLowerCase().endsWith('package.json'));

  if (hasAnyIndexHtml && !hasAnyPackageJson) {
    return { command: 'node', args: [STATIC_SERVER_FILE], cwd: '.' };
  }

  const packagePaths = Array.from(fileMap.keys()).filter((p) => p.endsWith('package.json'));
  const preferred = ['package.json', 'frontend/package.json', 'client/package.json', 'backend/package.json'];
  packagePaths.sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });

  for (const pkgPath of packagePaths) {
    const raw = fileMap.get(pkgPath);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const scripts = parsed?.scripts || {};
      const cwd = getPackageDir(pkgPath);
      if (scripts?.start) return { command: 'npm', args: ['run', 'start'], cwd };
      if (scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
    } catch {
      // ignore parse errors
    }
  }

  const rootPackage = fileMap.get('package.json');
  if (rootPackage) {
    try {
      const parsed = JSON.parse(rootPackage);
      const scripts = parsed?.scripts || {};
      if (scripts?.start) return { command: 'npm', args: ['run', 'start'], cwd: '.' };
    } catch {
      // fall through
    }
  }

  if (fileMap.has('backend/server.js')) {
    return { command: 'node', args: ['backend/server.js'], cwd: '.' };
  }

  if (fileMap.has('backend/src/server.js')) {
    return { command: 'node', args: ['backend/src/server.js'], cwd: '.' };
  }

  return null;
};

export const WebContainerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { files, isPreviewOpen, isGenerating, appendSystemConsoleContent } = useAIStore();
  const projectId = useProjectStore((s) => s.projectId);
  const isHydrating = useProjectStore((s) => s.isHydrating);
  const { addLog, setPreviewUrl, setRuntimeStatus } = usePreviewStore();
  const stamp = () => new Date().toLocaleTimeString([], { hour12: false });

  const [status, setStatus] = useState<RuntimeStatus>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serverListenerAttachedRef = useRef(false);
  const serverStartedRef = useRef(false);
  const urlsByPortRef = useRef<Record<number, string>>({});
  const pendingRef = useRef<Promise<void> | null>(null);

  const updateStatus = useCallback(
    (next: RuntimeStatus, message?: string) => {
      setStatus(next);
      setRuntimeStatus(next, message || null);
    },
    [setRuntimeStatus]
  );

  const updateUrl = useCallback(
    (nextUrl: string | null) => {
      setUrl(nextUrl);
      setPreviewUrl(nextUrl);
    },
    [setPreviewUrl]
  );

  const attachServerReady = useCallback(async () => {
    if (serverListenerAttachedRef.current) return;
    const container = await ensureWebContainer();
    container.on('server-ready', (port, serverUrl) => {
      urlsByPortRef.current[port] = serverUrl;
      const preferredUrl =
        urlsByPortRef.current[5173] || urlsByPortRef.current[3111] || urlsByPortRef.current[3000] || serverUrl;
      updateUrl(preferredUrl);
      updateStatus('ready', `Server ready on port ${port}`);
      addLog({
        timestamp: Date.now(),
        type: 'success',
        message: `Server ready on port ${port}`,
        source: 'webcontainer'
      });
    });
    serverListenerAttachedRef.current = true;
  }, [addLog, updateStatus, updateUrl]);

  const waitForServerReady = useCallback(
    (timeoutMs: number, ports: number[]) =>
      new Promise<void>((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          const urls = urlsByPortRef.current;
          const ready = ports.some((port) => Boolean(urls[port]));
          if (ready) return resolve();
          if (Date.now() - start > timeoutMs) {
            return reject(new Error('Server startup timeout (15s). Check console logs for details.'));
          }
          setTimeout(tick, 120);
        };
        tick();
      }),
    []
  );

  const installPackages = useCallback(
    async (packagePaths: string[]) => {
      if (packagePaths.length === 0) return;
      updateStatus('installing', 'Installing dependencies...');
      appendSystemConsoleContent(`${stamp()} [webcontainer] Installing dependencies...\\n`);

      const logLine = createLineBuffer((line) => {
        if (shouldSuppressLine(line)) return;
        appendSystemConsoleContent(`${stamp()} ${line}\\n`);
        addLog({ timestamp: Date.now(), type: 'info', message: line, source: 'npm' });
      });

      for (const pkgPath of packagePaths) {
        const cwd = getPackageDir(pkgPath);
        const { exitCode } = await installDependencies(cwd, logLine);
        if (exitCode !== 0) {
          throw new Error(`npm install failed in ${cwd} (exit ${exitCode})`);
        }
      }
    },
    [addLog, appendSystemConsoleContent, updateStatus]
  );

  const bootAndRun = useCallback(
    async (forceRestart: boolean) => {
      const tree = normalizeFileSystem(files);
      if (!isPreviewOpen || isTreeEmpty(tree)) return;

      // Better static detection - any project with index.html anywhere and no package.json is static
      const hasIndexHtml = treeContainsFileNamed(tree, 'index.html');
      const hasPackageJson = treeContainsFileNamed(tree, 'package.json');
      const hasViteConfig =
        treeContainsFileNamed(tree, 'vite.config.ts') || treeContainsFileNamed(tree, 'vite.config.js');
      
      const looksStatic = hasIndexHtml && !hasPackageJson && !hasViteConfig;

      // FIXED: Only wait for package.json if it's NOT a static project AND doesn't have index.html
      if (!looksStatic && !hasPackageJson && !hasIndexHtml) {
        updateStatus('idle', 'Waiting for code files...');
        appendSystemConsoleContent(`${stamp()} [webcontainer] Waiting for project files (package.json or index.html).\\n`);
        return;
      }

      setError(null);
      if (!serverStartedRef.current || forceRestart) updateUrl(null);
      updateStatus('booting', 'Booting container...');

      await ensureWebContainer();
      await attachServerReady();
      urlsByPortRef.current = {};

      updateStatus('mounting', 'Syncing files...');
      const effectiveTree = looksStatic ? addStaticServerFile(tree) : tree;
      const { changedPackages, injectedRootPackage, invalidPackageJsonPaths, fileMap } = await syncFileSystem(effectiveTree, {
        ensureRootPackageJson: false,
        rootPackageJson: DEFAULT_ROOT_PACKAGE_JSON
      });
      
      if (injectedRootPackage) {
        appendSystemConsoleContent(`${stamp()} [webcontainer] Injected root /package.json (missing).\\n`);
      }
      
      if (invalidPackageJsonPaths.length > 0) {
        appendSystemConsoleContent(
          `${stamp()} [webcontainer] Skipped invalid package.json: ${invalidPackageJsonPaths.join(', ')}\\n`
        );
      }
      
      const fatalInvalid = invalidPackageJsonPaths.filter((p) => p !== 'package.json');
      if (fatalInvalid.length > 0) {
        throw new Error(`Invalid package.json generated: ${fatalInvalid.join(', ')}`);
      }

      const readyPackages = changedPackages.filter((path) => (fileMap.get(path) || '').trim().length > 10);
      if (!looksStatic && readyPackages.length > 0) {
        await installPackages(readyPackages);
      } else if (looksStatic) {
        appendSystemConsoleContent(`${stamp()} [webcontainer] Static HTML project detected; skipping npm install.\\n`);
      }

      if (serverStartedRef.current && !forceRestart) {
        updateStatus('ready', 'Server running.');
        return;
      }

      const startCommand = resolveStartCommand(fileMap);
      if (!startCommand) {
        updateStatus('idle', 'No start command found. Add package.json with scripts, or use static HTML.');
        return;
      }

      updateStatus('starting', 'Starting server...');
      const logLine = createLineBuffer((line) => {
        if (shouldSuppressLine(line)) return;
        addLog({ timestamp: Date.now(), type: 'info', message: line, source: 'server' });
      });

      const serverProcess = await startServer(startCommand.command, startCommand.args, {
        cwd: startCommand.cwd,
        onOutput: logLine,
        force: forceRestart
      });

      serverStartedRef.current = true;

      await Promise.race([
        waitForServerReady(15_000, [5173, 3111, 3000]),
        serverProcess.exit.then((code) => {
          throw new Error(`Server process exited (${code}). Check logs for details.`);
        })
      ]);
    },
    [
      addLog,
      appendSystemConsoleContent,
      attachServerReady,
      files,
      isHydrating,
      isPreviewOpen,
      installPackages,
      projectId,
      updateStatus,
      updateUrl
    ]
  );

  useEffect(() => {
    if (!isPreviewOpen) {
      updateStatus('idle');
      updateUrl(null);
      return;
    }

    const tree = normalizeFileSystem(files);
    if (isTreeEmpty(tree)) {
      resetWebContainerState();
      serverStartedRef.current = false;
      updateStatus('idle');
      updateUrl(null);
      return;
    }
  }, [files, isPreviewOpen, updateStatus, updateUrl]);

  const deployAndRun = useCallback(async () => {
    if (isGenerating) {
      updateStatus('idle', 'Waiting for code generation to finish...');
      appendSystemConsoleContent(`${stamp()} [webcontainer] Waiting for code generation to finish...\\n`);
      return;
    }

    const apiKeyPresent = Boolean(process.env.NEXT_PUBLIC_WC_CLIENT_ID);
    if (apiKeyPresent) {
      appendSystemConsoleContent(`${stamp()} [webcontainer] Authenticated with Enterprise API Key.\\n`);
    }

    if (pendingRef.current) return pendingRef.current;

    pendingRef.current = bootAndRun(true)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        updateStatus('error', message);
        throw err;
      })
      .finally(() => {
        pendingRef.current = null;
      });

    return pendingRef.current;
  }, [appendSystemConsoleContent, bootAndRun, isGenerating, updateStatus]);

  const runProject = useCallback(async () => {
    serverStartedRef.current = false;
    await deployAndRun();
  }, [deployAndRun]);

  const restart = runProject;

  return (
    <WebContainerContext.Provider value={{ status, url, error, deployAndRun, runProject, restart }}>
      {children}
    </WebContainerContext.Provider>
  );
};

export const useWebContainer = () => {
  const ctx = useContext(WebContainerContext);
  if (!ctx) {
    throw new Error('useWebContainer must be used within WebContainerProvider');
  }
  return ctx;
};
