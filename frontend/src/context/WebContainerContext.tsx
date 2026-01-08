import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FileSystem, FileSystemEntry } from '@/types';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePreviewStore } from '@/stores/previewStore';
import { DEFAULT_ROOT_PACKAGE_JSON, ensureWebContainer, installDependencies, startServer, syncFileSystem } from '@/services/webcontainer';
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

const countFiles = (tree: FileSystem): number => {
  let count = 0;
  for (const [, entry] of Object.entries(tree) as [string, FileSystemEntry][]) {
    if (entry.file) count++;
    if (entry.directory) count += countFiles(entry.directory);
  }
  return count;
};

const treeContainsFileNamed = (tree: FileSystem, filename: string): boolean => {
  for (const [name, entry] of Object.entries(tree) as [string, FileSystemEntry][]) {
    if (name.toLowerCase() === filename.toLowerCase() && entry.file) return true;
    if (entry.directory && treeContainsFileNamed(entry.directory, filename)) return true;
  }
  return false;
};

const treeHasPath = (tree: FileSystem, path: string): boolean => {
  const parts = path.split('/').filter(Boolean);
  let node: FileSystem | undefined = tree;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const entry: FileSystemEntry | undefined = node ? node[part] : undefined;
    if (!entry) return false;
    const isLast = index === parts.length - 1;
    if (isLast) return Boolean(entry.file || entry.directory);
    if (!entry.directory) return false;
    node = entry.directory;
  }
  return false;
};

const treeContainsAnyCodeFile = (tree: FileSystem): boolean => {
  const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.vue', '.svelte', '.py', '.json'];
  const check = (node: FileSystem): boolean => {
    for (const [name, entry] of Object.entries(node) as [string, FileSystemEntry][]) {
      if (entry.file) {
        const lower = name.toLowerCase();
        if (codeExtensions.some(ext => lower.endsWith(ext))) return true;
      }
      if (entry.directory && check(entry.directory)) return true;
    }
    return false;
  };
  return check(tree);
};

// Flag to use simple iframe preview instead of WebContainer when API is unavailable
const USE_SIMPLE_PREVIEW = !process.env.NEXT_PUBLIC_WC_CLIENT_ID;

// ============================================================================
// GLOBAL MUTEX - PREVENTS RE-INITIALIZATION ON RE-RENDER/HOT-RELOAD
// ============================================================================
const GLOBAL_INIT_STATE = {
  authLogged: false,           // Auth message logged exactly once
  containerBooted: false,      // WebContainer booted
  serverAttached: false,       // Server listener attached
  lastPreviewUrl: null as string | null,  // Cache last working preview
  initInProgress: false,       // Prevent concurrent initialization
  healthCheckInterval: null as ReturnType<typeof setInterval> | null,
};

// Reset on page unload only (not hot reload)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    GLOBAL_INIT_STATE.authLogged = false;
    GLOBAL_INIT_STATE.containerBooted = false;
    GLOBAL_INIT_STATE.serverAttached = false;
    GLOBAL_INIT_STATE.lastPreviewUrl = null;
    GLOBAL_INIT_STATE.initInProgress = false;
    if (GLOBAL_INIT_STATE.healthCheckInterval) {
      clearInterval(GLOBAL_INIT_STATE.healthCheckInterval);
    }
  });
}

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
  // Check for static HTML project first - serve with our static server
  const hasPackageJson = Array.from(fileMap.keys()).some((p) => p.endsWith('package.json'));
  const hasIndexHtml = fileMap.has('index.html');
  const hasViteConfig = fileMap.has('vite.config.ts') || fileMap.has('vite.config.js');
  const hasNextConfig = fileMap.has('next.config.js') || fileMap.has('next.config.mjs') || fileMap.has('next.config.ts');
  
  // Static project detection: has index.html but no package.json/build tools
  if (hasIndexHtml && !hasPackageJson && !hasViteConfig && !hasNextConfig) {
    return { command: 'node', args: [STATIC_SERVER_FILE], cwd: '.' };
  }

  const packagePaths = Array.from(fileMap.keys()).filter((p) => p.endsWith('package.json'));
  
  // Priority order: src > frontend > client > root > backend (typical project structures)
  const preferred = ['src/package.json', 'frontend/package.json', 'client/package.json', 'package.json', 'backend/package.json', 'server/package.json'];
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
      const deps = { ...parsed?.dependencies, ...parsed?.devDependencies };
      const cwd = getPackageDir(pkgPath);
      
      // Detect framework type for better start command selection
      const isNextJs = deps?.next;
      const isVite = deps?.vite;
      const isReactScripts = deps?.['react-scripts'];
      const isRemix = deps?.['@remix-run/react'];
      const isAstro = deps?.astro;
      const isSvelte = deps?.svelte || deps?.['@sveltejs/kit'];
      const isVue = deps?.vue;
      const isNuxt = deps?.nuxt;
      const isExpress = deps?.express && !isNextJs && !isVite;
      
      // Framework-specific commands
      if (isNextJs) {
        if (scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
        return { command: 'npx', args: ['next', 'dev'], cwd };
      }
      if (isVite) {
        if (scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
        return { command: 'npx', args: ['vite'], cwd };
      }
      if (isReactScripts) {
        if (scripts?.start) return { command: 'npm', args: ['run', 'start'], cwd };
        return { command: 'npx', args: ['react-scripts', 'start'], cwd };
      }
      if (isRemix && scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
      if (isAstro && scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
      if (isSvelte && scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
      if (isVue || isNuxt) {
        if (scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
        if (scripts?.serve) return { command: 'npm', args: ['run', 'serve'], cwd };
      }
      if (isExpress) {
        if (scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
        if (scripts?.start) return { command: 'npm', args: ['run', 'start'], cwd };
        // Try to find main entry point
        const main = parsed?.main || 'index.js';
        if (fileMap.has(`${cwd === '.' ? '' : cwd + '/'}${main}`)) {
          return { command: 'node', args: [main], cwd };
        }
      }
      
      // Generic fallback: prefer dev > start > build
      if (scripts?.dev) return { command: 'npm', args: ['run', 'dev'], cwd };
      if (scripts?.start) return { command: 'npm', args: ['run', 'start'], cwd };
      if (scripts?.serve) return { command: 'npm', args: ['run', 'serve'], cwd };
    } catch {
      // ignore parse errors
    }
  }

  // Fallback: check for common server files
  const serverFiles = [
    'server.js', 'server.ts', 'index.js', 'app.js',
    'src/server.js', 'src/index.js', 'src/app.js',
    'backend/server.js', 'backend/index.js', 'backend/app.js',
    'backend/src/server.js', 'backend/src/index.js'
  ];
  
  for (const serverFile of serverFiles) {
    if (fileMap.has(serverFile)) {
      const dir = serverFile.includes('/') ? serverFile.split('/').slice(0, -1).join('/') : '.';
      const file = serverFile.includes('/') ? serverFile.split('/').pop() : serverFile;
      return { command: 'node', args: [file!], cwd: dir };
    }
  }

  // Last resort: if there's an index.html anywhere, serve statically
  if (hasIndexHtml) {
    return { command: 'node', args: [STATIC_SERVER_FILE], cwd: '.' };
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
      const fileCount = countFiles(tree);
      
      // Don't run if preview is closed or no files at all
      if (!isPreviewOpen) {
        updateStatus('idle', 'Preview closed');
        return;
      }
      
      if (isTreeEmpty(tree) || fileCount === 0) {
        updateStatus('idle', 'Waiting for project files...');
        return;
      }

      // Detect project type
      const hasIndexHtml = treeHasPath(tree, 'index.html');
      const hasPackageJson = treeContainsFileNamed(tree, 'package.json');
      const hasViteConfig = treeHasPath(tree, 'vite.config.ts') || treeHasPath(tree, 'vite.config.js');
      const hasNextConfig = treeHasPath(tree, 'next.config.js') || treeHasPath(tree, 'next.config.mjs') || treeHasPath(tree, 'next.config.ts');
      const hasAnyCode = treeContainsAnyCodeFile(tree);
      
      // A project is static if it has index.html and no package.json, OR no package.json and no build tools
      const looksStatic = (hasIndexHtml && !hasPackageJson && !hasViteConfig && !hasNextConfig) || 
                          (!hasPackageJson && hasAnyCode && !hasViteConfig && !hasNextConfig);

      // Allow any project that has code files to proceed - we'll figure out how to run it
      if (!looksStatic && !hasPackageJson && !hasIndexHtml && !hasAnyCode) {
        updateStatus('idle', 'Waiting for project files (package.json or index.html)...');
        appendSystemConsoleContent(`${stamp()} [webcontainer] Waiting for project files (package.json or index.html).\n`);
        return;
      }
      
      // Log what we detected
      appendSystemConsoleContent(`${stamp()} [webcontainer] Project detected: ${fileCount} files, static=${looksStatic}, hasPackageJson=${hasPackageJson}, hasIndexHtml=${hasIndexHtml}\n`);

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
        appendSystemConsoleContent(`${stamp()} [webcontainer] Injected root /package.json (missing).\n`);
      }
      
      if (invalidPackageJsonPaths.length > 0) {
        appendSystemConsoleContent(
          `${stamp()} [webcontainer] Skipped invalid package.json: ${invalidPackageJsonPaths.join(', ')}\n`
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
        appendSystemConsoleContent(`${stamp()} [webcontainer] Static HTML project detected; skipping npm install.\n`);
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
        waitForServerReady(20_000, [3000, 3111, 5173]),
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

  // Generate a data URL for simple iframe preview (no WebContainer needed)
  const generateSimplePreview = useCallback(() => {
    const tree = normalizeFileSystem(files);
    if (isTreeEmpty(tree)) return null;
    
    // Find index.html
    const findFile = (node: FileSystem, name: string): string | null => {
      for (const [key, entry] of Object.entries(node) as [string, FileSystemEntry][]) {
        if (key.toLowerCase() === name.toLowerCase() && entry.file) {
          return entry.file.contents || '';
        }
        if (entry.directory) {
          const found = findFile(entry.directory, name);
          if (found) return found;
        }
      }
      return null;
    };
    
    const indexHtml = findFile(tree, 'index.html');
    if (!indexHtml) return null;
    
    // Find CSS and JS files
    const stylesCSS = findFile(tree, 'styles.css') || findFile(tree, 'style.css') || '';
    const scriptJS = findFile(tree, 'script.js') || findFile(tree, 'main.js') || findFile(tree, 'app.js') || '';
    
    // Inject CSS and JS into HTML
    let finalHtml = indexHtml;
    
    // Replace CSS link with inline styles
    if (stylesCSS) {
      finalHtml = finalHtml.replace(
        /<link[^>]*href=["'](?:.*\/)?styles?\.css["'][^>]*>/gi,
        `<style>${stylesCSS}</style>`
      );
      // Also add styles if no link tag found
      if (!finalHtml.includes('<style>')) {
        finalHtml = finalHtml.replace('</head>', `<style>${stylesCSS}</style></head>`);
      }
    }
    
    // Replace JS script with inline script
    if (scriptJS) {
      finalHtml = finalHtml.replace(
        /<script[^>]*src=["'](?:.*\/)?(?:script|main|app)\.js["'][^>]*><\/script>/gi,
        `<script>${scriptJS}</script>`
      );
      // Also add script if no script tag found
      if (!finalHtml.includes('<script>') && scriptJS.trim()) {
        finalHtml = finalHtml.replace('</body>', `<script>${scriptJS}</script></body>`);
      }
    }
    
    return `data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`;
  }, [files]);

  const deployAndRun = useCallback(async () => {
    // GUARD: Prevent concurrent initialization
    if (GLOBAL_INIT_STATE.initInProgress) {
      return pendingRef.current || Promise.resolve();
    }
    
    if (isGenerating) {
      updateStatus('idle', 'Waiting for code generation to finish...');
      return;
    }

    const apiKeyPresent = Boolean(process.env.NEXT_PUBLIC_WC_CLIENT_ID);
    
    // PRIORITY 1: Use simple iframe preview (most reliable, no external deps)
    const simpleUrl = generateSimplePreview();
    if (simpleUrl) {
      updateUrl(simpleUrl);
      GLOBAL_INIT_STATE.lastPreviewUrl = simpleUrl;
      updateStatus('ready', 'Preview ready');
      // Only log once
      if (!GLOBAL_INIT_STATE.authLogged) {
        appendSystemConsoleContent(`${stamp()} [preview] Preview ready.\n`);
        GLOBAL_INIT_STATE.authLogged = true;
      }
      return;
    }
    
    // PRIORITY 2: If simple preview failed but we have cached URL, use it
    if (GLOBAL_INIT_STATE.lastPreviewUrl) {
      updateUrl(GLOBAL_INIT_STATE.lastPreviewUrl);
      updateStatus('ready', 'Preview ready (cached)');
      return;
    }
    
    // PRIORITY 3: WebContainer (only if API key present and simple preview unavailable)
    if (apiKeyPresent && !USE_SIMPLE_PREVIEW) {
      // Log auth EXACTLY ONCE
      if (!GLOBAL_INIT_STATE.authLogged) {
        appendSystemConsoleContent(`${stamp()} [webcontainer] Authenticated with Enterprise API Key.\n`);
        GLOBAL_INIT_STATE.authLogged = true;
      }
    }

    if (pendingRef.current) return pendingRef.current;

    GLOBAL_INIT_STATE.initInProgress = true;
    
    pendingRef.current = bootAndRun(true)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        updateStatus('error', message);
        // SELF-RECOVERY: Try simple preview on error
        const fallbackUrl = generateSimplePreview();
        if (fallbackUrl) {
          updateUrl(fallbackUrl);
          updateStatus('ready', 'Preview ready (fallback)');
          setError(null);
        }
      })
      .finally(() => {
        pendingRef.current = null;
        GLOBAL_INIT_STATE.initInProgress = false;
      });

    return pendingRef.current;
  }, [appendSystemConsoleContent, bootAndRun, generateSimplePreview, isGenerating, updateStatus, updateUrl]);

  const runProject = useCallback(async () => {
    serverStartedRef.current = false;
    await deployAndRun();
  }, [deployAndRun]);

  // Auto-detect file changes and trigger re-run when preview is open
  // FIXED: Debounced, guarded, and prevents re-initialization loops
  const lastFileHashRef = useRef<string>('');
  
  useEffect(() => {
    if (!isPreviewOpen) {
      updateStatus('idle');
      // Don't clear URL - keep cached for instant restore
      return;
    }

    const tree = normalizeFileSystem(files);
    const fileCount = countFiles(tree);
    
    if (isTreeEmpty(tree) || fileCount === 0) {
      serverStartedRef.current = false;
      updateStatus('idle');
      return;
    }
    
    // OPTIMIZATION: Only trigger if files actually changed (hash check)
    const fileHash = JSON.stringify(Object.keys(tree).sort()).slice(0, 200);
    if (fileHash === lastFileHashRef.current && status === 'ready') {
      return; // No change, skip re-run
    }
    lastFileHashRef.current = fileHash;
    
    // GUARD: Don't re-run if already running or generating
    if (pendingRef.current || isGenerating || GLOBAL_INIT_STATE.initInProgress) {
      return;
    }
    
    // Debounced trigger - 800ms to batch rapid file updates
    const timer = setTimeout(() => {
      if (!GLOBAL_INIT_STATE.initInProgress) {
        void deployAndRun().catch(() => {});
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [files, isPreviewOpen, isGenerating, updateStatus, status, deployAndRun]);

  const restart = runProject;

  // STEP 5: HEALTH CHECK & SELF-RECOVERY
  // Periodically check if preview is supposed to be running but isn't
  useEffect(() => {
    if (!isPreviewOpen) return;
    
    // Health check every 5 seconds
    const healthCheck = setInterval(() => {
      // If preview should be open but no URL and not initializing, recover
      if (isPreviewOpen && !url && status === 'idle' && !GLOBAL_INIT_STATE.initInProgress && !isGenerating) {
        const tree = normalizeFileSystem(files);
        const fileCount = countFiles(tree);
        
        if (fileCount > 0) {
          console.log('[HealthCheck] Preview not running, attempting recovery...');
          void deployAndRun().catch(() => {});
        }
      }
    }, 5000);
    
    GLOBAL_INIT_STATE.healthCheckInterval = healthCheck;
    
    return () => {
      clearInterval(healthCheck);
      if (GLOBAL_INIT_STATE.healthCheckInterval === healthCheck) {
        GLOBAL_INIT_STATE.healthCheckInterval = null;
      }
    };
  }, [isPreviewOpen, url, status, isGenerating, files, deployAndRun]);

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
