'use client';

import { WebContainer } from '@webcontainer/api';

// Singleton instance
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export interface ProjectFile {
  path: string;
  name?: string;
  content: string;
}

export type RuntimeStatus = 
  | 'idle' 
  | 'booting' 
  | 'mounting' 
  | 'installing' 
  | 'starting' 
  | 'ready' 
  | 'error';

export interface WebContainerCallbacks {
  onStatusChange?: (status: RuntimeStatus, message?: string) => void;
  onServerReady?: (url: string) => void;
  onError?: (error: Error) => void;
  onOutput?: (data: string) => void;
}

const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^\/+/, '');

const detectProjectCwd = (files: ProjectFile[]): string => {
  const paths = new Set(
    files
      .map((f) => normalizePath(f.path || f.name || ''))
      .filter(Boolean)
  );

  if (paths.has('package.json')) return '/';
  if (paths.has('frontend/package.json')) return '/frontend';
  if (paths.has('app/package.json')) return '/app';
  if (paths.has('client/package.json')) return '/client';

  const nestedManifests = Array.from(paths)
    .filter((p) => p.endsWith('/package.json'))
    .sort((a, b) => a.split('/').length - b.split('/').length);

  if (nestedManifests.length > 0) {
    const first = nestedManifests[0];
    const dir = first.slice(0, -'/package.json'.length);
    return dir ? `/${dir}` : '/';
  }

  return '/';
};

/**
 * Boot WebContainer instance (singleton)
 */
export async function bootWebContainer(): Promise<WebContainer> {
  // Return existing instance
  if (webcontainerInstance) {
    return webcontainerInstance;
  }
  
  // Return in-progress boot
  if (bootPromise) {
    return bootPromise;
  }
  
  // Start boot process
  bootPromise = WebContainer.boot();
  
  try {
    webcontainerInstance = await bootPromise;
    return webcontainerInstance;
  } catch (error) {
    bootPromise = null;
    throw error;
  }
}

/**
 * Get current WebContainer instance (or null if not booted)
 */
export function getWebContainer(): WebContainer | null {
  return webcontainerInstance;
}

/**
 * Convert project files to WebContainer filesystem format
 */
export function filesToFileSystem(files: ProjectFile[]): Record<string, any> {
  const fs: Record<string, any> = {};
  
  for (const file of files) {
    const filePath = file.path || file.name || 'untitled';
    const parts = filePath.split('/').filter(Boolean);
    
    let current = fs;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!current[dir]) {
        current[dir] = { directory: {} };
      }
      current = current[dir].directory;
    }
    
    const fileName = parts[parts.length - 1];
    current[fileName] = {
      file: { contents: file.content || '' }
    };
  }
  
  return fs;
}

/**
 * Generate a basic package.json if not present
 */
export function generatePackageJson(projectName: string = 'apex-project'): string {
  return JSON.stringify({
    name: projectName,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview'
    },
    devDependencies: {
      vite: '^5.0.0'
    }
  }, null, 2);
}

/**
 * Generate a basic index.html if not present
 */
export function generateIndexHtml(title: string = 'Apex Project'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/main.js"></script>
</body>
</html>`;
}

/**
 * Generate vite.config.js
 */
export function generateViteConfig(): string {
  return `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 3000
  }
});`;
}

/**
 * Ensure project has required files for WebContainer
 */
export function ensureProjectFiles(files: ProjectFile[]): ProjectFile[] {
  const result = [...files];
  const paths = files.map(f => f.path || f.name || '');
  
  // Ensure package.json exists
  if (!paths.some(p => p.includes('package.json'))) {
    result.push({
      path: 'package.json',
      content: generatePackageJson()
    });
  }
  
  // Ensure index.html exists
  if (!paths.some(p => p.includes('index.html'))) {
    result.push({
      path: 'index.html',
      content: generateIndexHtml()
    });
  }
  
  // Ensure vite.config.js exists
  if (!paths.some(p => p.includes('vite.config'))) {
    result.push({
      path: 'vite.config.js',
      content: generateViteConfig()
    });
  }
  
  // Ensure main.js exists
  if (!paths.some(p => p === 'main.js' || p.endsWith('/main.js'))) {
    result.push({
      path: 'main.js',
      content: `console.log('Apex Project Ready!');`
    });
  }
  
  // Ensure style.css exists
  if (!paths.some(p => p.includes('style.css'))) {
    result.push({
      path: 'style.css',
      content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { 
  font-family: system-ui, sans-serif; 
  background: #0a0a0a;
  color: #fff;
  min-height: 100vh;
}`
    });
  }
  
  return result;
}

/**
 * Run npm install in WebContainer
 */
export async function installDependencies(
  container: WebContainer,
  cwd: string,
  callbacks?: WebContainerCallbacks
): Promise<boolean> {
  callbacks?.onStatusChange?.('installing', `Installing dependencies${cwd !== '/' ? ` in ${cwd}` : ''}...`);
  const spawnOptions = cwd && cwd !== '/' ? ({ cwd } as any) : undefined;
  const installProcess = await container.spawn('npm', ['install'], spawnOptions);
  
  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        callbacks?.onOutput?.(data);
      }
    })
  );
  
  const exitCode = await installProcess.exit;
  
  if (exitCode !== 0) {
    callbacks?.onError?.(new Error(`npm install failed with code ${exitCode}`));
    return false;
  }
  
  return true;
}

/**
 * Start dev server in WebContainer
 */
export async function startDevServer(
  container: WebContainer,
  cwd: string,
  callbacks?: WebContainerCallbacks
): Promise<void> {
  callbacks?.onStatusChange?.('starting', `Starting dev server${cwd !== '/' ? ` in ${cwd}` : ''}...`);
  const spawnOptions = cwd && cwd !== '/' ? ({ cwd } as any) : undefined;
  const devProcess = await container.spawn('npm', ['run', 'dev'], spawnOptions);
  
  devProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        callbacks?.onOutput?.(data);
      }
    })
  );
  
  // Listen for server ready event
  container.on('server-ready', (port, url) => {
    callbacks?.onStatusChange?.('ready', `Server running on port ${port}`);
    callbacks?.onServerReady?.(url);
  });
}

/**
 * Full workflow: mount files, install deps, start server
 */
export async function runProject(
  files: ProjectFile[],
  callbacks?: WebContainerCallbacks
): Promise<void> {
  try {
    // Boot WebContainer
    callbacks?.onStatusChange?.('booting', 'Starting WebContainer...');
    const container = await bootWebContainer();
    
    // Ensure project has required files
    const completeFiles = ensureProjectFiles(files);
    const cwd = detectProjectCwd(completeFiles);
    
    // Mount files
    callbacks?.onStatusChange?.('mounting', 'Mounting project files...');
    const fileSystem = filesToFileSystem(completeFiles);
    await container.mount(fileSystem);
    
    // Install dependencies
    const installed = await installDependencies(container, cwd, callbacks);
    if (!installed) return;
    
    // Start dev server
    await startDevServer(container, cwd, callbacks);
    
  } catch (error) {
    callbacks?.onStatusChange?.('error', (error as Error).message);
    callbacks?.onError?.(error as Error);
  }
}

/**
 * Teardown WebContainer (for cleanup)
 */
export async function teardownWebContainer(): Promise<void> {
  if (webcontainerInstance) {
    webcontainerInstance.teardown();
    webcontainerInstance = null;
    bootPromise = null;
  }
}
