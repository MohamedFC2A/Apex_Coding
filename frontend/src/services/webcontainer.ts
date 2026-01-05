import { FileSystem } from '@/types';
import { configureAPIKey, FileSystemTree, WebContainer, WebContainerProcess } from '@webcontainer/api';

type FileMap = Map<string, string>;

export type SpawnError = Error & { exitCode?: number };

export const DEFAULT_ROOT_PACKAGE_JSON = JSON.stringify(
  {
    name: 'project-root',
    scripts: {
      start: 'concurrently "npm run server" "npm run client"',
      server: 'cd backend && node server.js',
      client: 'cd frontend && vite'
    },
    dependencies: {
      concurrently: '^8.0.0',
      express: '^4.18.0',
      sqlite3: '^5.1.0',
      cors: '^2.8.5',
      nodemon: '^3.0.0'
    }
  },
  null,
  2
) + '\n';

type WebContainerState = {
  bootPromise: Promise<WebContainer> | null;
  instance: WebContainer | null;
  mounted: boolean;
  fileCache: FileMap;
  packageCache: FileMap;
  serverProcess: WebContainerProcess | null;
  apiKeyConfigured: boolean;
};

const state: WebContainerState = {
  bootPromise: null,
  instance: null,
  mounted: false,
  fileCache: new Map(),
  packageCache: new Map(),
  serverProcess: null,
  apiKeyConfigured: false
};

const buildFileMap = (tree: FileSystem, basePath = '', map: FileMap = new Map()) => {
  for (const [name, entry] of Object.entries(tree)) {
    const path = basePath ? `${basePath}/${name}` : name;
    if (entry.file) {
      map.set(path, entry.file.contents ?? '');
    }
    if (entry.directory) {
      buildFileMap(entry.directory, path, map);
    }
  }
  return map;
};

const buildPackageMap = (fileMap: FileMap) => {
  const packages: FileMap = new Map();
  for (const [path, contents] of fileMap.entries()) {
    if (path.endsWith('package.json')) {
      packages.set(path, contents ?? '');
    }
  }
  return packages;
};

const isValidJSON = (raw: string) => {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
};

const sanitizePackageJsonFiles = (tree: FileSystem, rootPackageJson: string) => {
  const invalidPaths: string[] = [];

  const walk = (node: FileSystem, basePath: string): FileSystem => {
    const out: FileSystem = {};
    for (const [name, entry] of Object.entries(node)) {
      const path = basePath ? `${basePath}/${name}` : name;

      if (entry.directory) {
        out[name] = { directory: walk(entry.directory, path) };
        continue;
      }

      if (!entry.file) continue;
      const contents = entry.file.contents ?? '';

      if (name === 'package.json' && !isValidJSON(contents)) {
        invalidPaths.push(path);
        if (path === 'package.json') {
          out[name] = { file: { contents: rootPackageJson } };
        }
        continue;
      }

      out[name] = { file: { contents } };
    }
    return out;
  };

  return { tree: walk(tree, ''), invalidPaths };
};

const ensureDirectory = async (container: WebContainer, path: string) => {
  const segments = path.split('/');
  if (segments.length <= 1) return;
  const dir = segments.slice(0, -1).join('/');
  if (!dir) return;
  await container.fs.mkdir(dir, { recursive: true });
};

const streamProcessOutput = async (process: WebContainerProcess, onOutput?: (chunk: string) => void) => {
  if (!onOutput || !process.output) return;
  const reader = process.output.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (typeof value === 'string') {
      onOutput(value);
      continue;
    }
    if (value) onOutput(decoder.decode(value));
  }
};

export const ensureWebContainer = async () => {
  if (!state.bootPromise) {
    const apiKey = (import.meta as any)?.env?.VITE_WC_CLIENT_ID as string | undefined;
    if (apiKey && !state.apiKeyConfigured) {
      configureAPIKey(apiKey);
      state.apiKeyConfigured = true;
    }

    state.bootPromise = WebContainer.boot({ coep: 'require-corp' });
  }
  state.instance = await state.bootPromise;
  return state.instance;
};

export const syncFileSystem = async (
  tree: FileSystem,
  options: { ensureRootPackageJson?: boolean; rootPackageJson?: string } = {}
) => {
  const container = await ensureWebContainer();
  const shouldEnsureRoot = options.ensureRootPackageJson === true;
  const rootPackageContents = options.rootPackageJson ?? DEFAULT_ROOT_PACKAGE_JSON;
  const hasRootPackage = Boolean(tree['package.json']?.file);
  const mountTree = shouldEnsureRoot && !hasRootPackage
    ? { ...tree, ['package.json']: { file: { contents: rootPackageContents } } }
    : tree;

  const { tree: sanitizedTree, invalidPaths } = sanitizePackageJsonFiles(mountTree, rootPackageContents);
  const nextFileMap = buildFileMap(sanitizedTree);

  if (!state.mounted) {
    await container.mount(sanitizedTree as FileSystemTree);
    state.mounted = true;
    state.fileCache = nextFileMap;
    state.packageCache = buildPackageMap(nextFileMap);
    return {
      changedPackages: Array.from(state.packageCache.keys()),
      injectedRootPackage: shouldEnsureRoot && !hasRootPackage,
      invalidPackageJsonPaths: invalidPaths,
      fileMap: nextFileMap
    };
  }

  for (const [path, contents] of nextFileMap.entries()) {
    const previous = state.fileCache.get(path);
    if (previous === contents) continue;
    await ensureDirectory(container, path);
    await container.fs.writeFile(path, contents);
  }

  const nextPackages = buildPackageMap(nextFileMap);
  const changedPackages: string[] = [];
  for (const [path, contents] of nextPackages.entries()) {
    if (state.packageCache.get(path) !== contents) {
      changedPackages.push(path);
    }
  }

  state.fileCache = nextFileMap;
  state.packageCache = nextPackages;

  return { changedPackages, invalidPackageJsonPaths: invalidPaths, fileMap: nextFileMap };
};

export const runCommand = async (
  command: string,
  args: string[],
  options: { cwd?: string; onOutput?: (chunk: string) => void } = {}
) => {
  const container = await ensureWebContainer();
  let process: WebContainerProcess;
  try {
    process = await container.spawn(command, args, { cwd: options.cwd });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[webcontainer] spawn failed: ${command} ${args.join(' ')} (${message})`);
  }
  void streamProcessOutput(process, options.onOutput);
  const exitCode = await process.exit;
  return { exitCode, process };
};

export const installDependencies = async (
  cwd: string,
  onOutput?: (chunk: string) => void
) => runCommand('npm', ['install'], { cwd, onOutput });

export const startServer = async (
  command: string,
  args: string[],
  options: { cwd?: string; onOutput?: (chunk: string) => void; force?: boolean } = {}
) => {
  if (state.serverProcess && !options.force) {
    return state.serverProcess;
  }

  if (state.serverProcess && options.force) {
    try {
      state.serverProcess.kill();
    } catch {
      // Ignore teardown errors
    }
    state.serverProcess = null;
  }

  const container = await ensureWebContainer();
  let process: WebContainerProcess;
  try {
    process = await container.spawn(command, args, { cwd: options.cwd });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[webcontainer] spawn failed: ${command} ${args.join(' ')} (${message})`);
  }
  void streamProcessOutput(process, options.onOutput);
  state.serverProcess = process;
  return process;
};

export const resetWebContainerState = () => {
  if (state.serverProcess) {
    try {
      state.serverProcess.kill();
    } catch {
      // Ignore teardown errors
    }
  }
  state.mounted = false;
  state.fileCache.clear();
  state.packageCache.clear();
  state.serverProcess = null;
};
