import { WebContainer } from '@webcontainer/api';
import { usePreviewStore } from '../stores/previewStore';

let webContainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

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
   * Run `npm install`
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

    return installProcess.exit;
  }

  /**
   * Run `npm run dev` (or custom command)
   */
  static async startDevServer(onOutput?: (data: string) => void) {
    const instance = await this.boot();
    const devProcess = await instance.spawn('npm', ['run', 'dev']);

    devProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          onOutput?.(data);
        },
      })
    );

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
