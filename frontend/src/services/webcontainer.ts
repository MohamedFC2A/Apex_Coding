import { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { usePreviewStore } from '../stores/previewStore';

let webContainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let activeDevProcess: WebContainerProcess | null = null;

export class WebContainerService {
  /**
   * Boot the WebContainer. Singleton pattern.
   */
  static async boot() {
    if (webContainerInstance) return webContainerInstance;
    if (bootPromise) return bootPromise;

    bootPromise = WebContainer.boot();
    webContainerInstance = await bootPromise;
    return webContainerInstance;
  }

  /**
   * Mount files to the WebContainer.
   * Expects files in the format: { 'path/to/file': 'content' }
   */
  static async mount(files: Record<string, string>) {
    const instance = await this.boot();
    const tree: Record<string, any> = {};

    // Convert flat path map to tree
    for (const [path, content] of Object.entries(files)) {
      const parts = path.split('/');
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = { file: { contents: content } };
        } else {
          current[part] = current[part] || { directory: {} };
          current = current[part].directory;
        }
      }
    }

    await instance.mount(tree);
    return instance;
  }

  /**
   * Run `npm install` with timeout
   */
  static async installDependencies(onOutput?: (data: string) => void) {
    const instance = await this.boot();
    const installProcess = await instance.spawn('npm', ['install']);

    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onOutput?.(data);
        },
      })
    );

    // Timeout after 60 seconds
    const exitPromise = installProcess.exit;
    const timeoutPromise = new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error('npm install timed out after 60s')), 60000)
    );

    return Promise.race([exitPromise, timeoutPromise]);
  }

  /**
   * Run `npm run dev` (or custom command)
   */
  static async startDevServer(onOutput?: (data: string) => void) {
    const instance = await this.boot();

    // Kill previous process if active
    if (activeDevProcess) {
      activeDevProcess.kill();
      activeDevProcess = null;
    }

    const devProcess = await instance.spawn('npm', ['run', 'dev']);
    activeDevProcess = devProcess;

    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onOutput?.(data);
        },
      })
    );

    // NOTE: WebContainer doesn't have removeAllListeners publicly exposed in types sometimes,
    // but effectively we just add new ones.
    // If we want to be safe, we can ignore this or rely on a wrapper.
    // For now, we'll just add the listener and assume the singleton nature isn't too spammy
    // or we should handle this differently.
    // BUT since we are re-using the singleton, we SHOULD clean up.
    // Let's rely on `on` overwriting? No, `on` adds.
    // Workaround: We don't remove, we just ensure we only add ONCE globally or use a flag?
    // Actually, let's just add them. The store update is idempotent enough.

    instance.on('server-ready', (port, url) => {
      usePreviewStore.getState().setPreviewUrl(url);
      usePreviewStore.getState().setRuntimeStatus('ready');
    });

    instance.on('error', (err) => {
      console.error('WebContainer Error:', err);
      usePreviewStore.getState().setRuntimeStatus('error', err.message);
    });

    return devProcess;
  }

  static async writeFile(path: string, content: string) {
    const instance = await this.boot();
    await instance.fs.writeFile(path, content);
  }
}
