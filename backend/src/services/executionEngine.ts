import { spawn, exec } from 'child_process';
import { ProjectFile, ExecutionResult, ProjectStack } from '../../../shared/types.js';
import { portManager } from './portManager.js';
import { projectManager } from './projectManager.js';
import { getSafeSpawnOptions, validateCommand } from '../utils/sandbox.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class ExecutionEngine {
  async executeProject(
    projectId: string,
    files: ProjectFile[],
    stack: ProjectStack,
    entryPoint?: string
  ): Promise<ExecutionResult> {
    try {
      logger.info(`Executing project ${projectId} with stack ${stack}`);

      switch (stack) {
        case 'html-css-js' as ProjectStack:
          return await this.executeHtmlCssJs(files);
        case 'react-vite' as ProjectStack:
          return await this.executeReactVite(projectId, files);
        case 'node-express' as ProjectStack:
          return await this.executeNodeExpress(projectId, files, entryPoint);
        case 'python-flask' as ProjectStack:
        case 'python-fastapi' as ProjectStack:
          return await this.executePython(projectId, files, stack, entryPoint);
        default:
          return {
            success: false,
            error: `Unsupported stack: ${stack}`,
            output: ''
          };
      }
    } catch (error: any) {
      logger.error('Execution failed', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        code: error?.code
      });
      return {
        success: false,
        error: error.message || 'Execution failed',
        output: ''
      };
    }
  }

  private async executeHtmlCssJs(files: ProjectFile[]): Promise<ExecutionResult> {
    // For HTML/CSS/JS, we just return the files and let the frontend handle it
    const htmlFile = files.find(f => f.path?.endsWith('.html') || f.path === 'index.html');
    const cssFiles = files.filter(f => f.path?.endsWith('.css'));
    const jsFiles = files.filter(f => f.path?.endsWith('.js'));

    let htmlContent = htmlFile?.content || '<html><body><h1>No HTML file found</h1></body></html>';

    // Inject CSS
    for (const cssFile of cssFiles) {
      htmlContent = htmlContent.replace(
        '</head>',
        `<style>${cssFile.content}</style></head>`
      );
    }

    // Inject JS
    for (const jsFile of jsFiles) {
      htmlContent = htmlContent.replace(
        '</body>',
        `<script>${jsFile.content}</script></body>`
      );
    }

    return {
      success: true,
      output: htmlContent
    };
  }

  private async executeReactVite(projectId: string, files: ProjectFile[]): Promise<ExecutionResult> {
    const projectDir = await projectManager.createProject(projectId, files);
    const port = portManager.allocatePort(projectId, 'vite');

    // Create package.json if not exists
    const hasPackageJson = files.some(f => f.path === 'package.json');
    if (!hasPackageJson) {
      const packageJson = {
        name: projectId,
        version: '1.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          '@types/react': '^18.2.43',
          '@types/react-dom': '^18.2.17',
          '@vitejs/plugin-react': '^4.2.1',
          typescript: '^5.3.3',
          vite: '^5.0.8'
        }
      };
      await fs.writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
    }

    // Create vite.config if not exists
    const hasViteConfig = files.some(f => f.path?.includes('vite.config'));
    if (!hasViteConfig) {
      const viteConfig = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: ${port}
  }
})`;
      await fs.writeFile(path.join(projectDir, 'vite.config.ts'), viteConfig);
    }

    return new Promise((resolve) => {
      // Install dependencies
      const installProcess = spawn('npm', ['install'], {
        cwd: projectDir,
        shell: true
      });

      let installOutput = '';
      installProcess.stdout?.on('data', (data) => {
        installOutput += data.toString();
      });

      installProcess.on('close', (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: 'Failed to install dependencies',
            output: installOutput
          });
          return;
        }

        // Start dev server
        const devProcess = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
          cwd: projectDir,
          shell: true
        });

        portManager.registerProcess(port, devProcess);

        let output = '';
        devProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        // Wait for server to be ready
        setTimeout(() => {
          resolve({
            success: true,
            port,
            url: `http://0.0.0.0:${port}`,
            output
          });
        }, 3000);
      });
    });
  }

  private async executeNodeExpress(
    projectId: string,
    files: ProjectFile[],
    entryPoint?: string
  ): Promise<ExecutionResult> {
    const projectDir = await projectManager.createProject(projectId, files);
    const port = portManager.allocatePort(projectId, 'node');

    // Find entry point
    const entry = entryPoint || 
      files.find(f => f.path === 'server.js' || f.path === 'index.js' || f.path === 'app.js')?.path ||
      'index.js';

    // Update port in code
    const entryFile = files.find(f => f.path === entry);
    if (entryFile) {
      let updatedContent = entryFile.content;
      updatedContent = updatedContent.replace(/\.listen\((\d+)/g, `.listen(${port}`);
      await fs.writeFile(path.join(projectDir, entry), updatedContent);
    }

    // Install dependencies if package.json exists
    const hasPackageJson = files.some(f => f.path === 'package.json');
    if (hasPackageJson) {
      await new Promise<void>((resolve) => {
        const install = spawn('npm', ['install'], {
          cwd: projectDir,
          shell: true
        });
        install.on('close', () => resolve());
      });
    }

    return new Promise((resolve) => {
      const nodeProcess = spawn('node', [entry], {
        cwd: projectDir,
        shell: true,
        env: { ...process.env, PORT: port.toString() }
      });

      portManager.registerProcess(port, nodeProcess);

      let output = '';
      nodeProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      nodeProcess.stderr?.on('data', (data) => {
        output += data.toString();
      });

      setTimeout(() => {
        resolve({
          success: true,
          port,
          url: `http://0.0.0.0:${port}`,
          output
        });
      }, 2000);
    });
  }

  private async executePython(
    projectId: string,
    files: ProjectFile[],
    stack: ProjectStack,
    entryPoint?: string
  ): Promise<ExecutionResult> {
    const projectDir = await projectManager.createProject(projectId, files);
    const port = portManager.allocatePort(projectId, 'python');

    // Find entry point
    const entry = entryPoint || 
      files.find(f => f.path === 'app.py' || f.path === 'main.py')?.path ||
      'app.py';

    // Update port in code
    const entryFile = files.find(f => f.path === entry);
    if (entryFile) {
      let updatedContent = entryFile.content;
      updatedContent = updatedContent.replace(/\.run\([^)]*port\s*=\s*\d+/g, `.run(port=${port}`);
      updatedContent = updatedContent.replace(/port\s*=\s*\d+/g, `port=${port}`);
      await fs.writeFile(path.join(projectDir, entry), updatedContent);
    }

    return new Promise((resolve) => {
      let command: string[];
      if (stack === 'python-fastapi') {
        const module = entry.replace('.py', '').replace('/', '.');
        command = ['uvicorn', `${module}:app`, '--host', '0.0.0.0', '--port', port.toString()];
      } else {
        command = ['python', entry];
      }

      const pythonProcess = spawn(command[0], command.slice(1), {
        cwd: projectDir,
        shell: true,
        env: { ...process.env, PORT: port.toString() }
      });

      portManager.registerProcess(port, pythonProcess);

      let output = '';
      pythonProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr?.on('data', (data) => {
        output += data.toString();
      });

      setTimeout(() => {
        resolve({
          success: true,
          port,
          url: `http://0.0.0.0:${port}`,
          output
        });
      }, 2000);
    });
  }

  stopExecution(projectId: string): void {
    portManager.releaseProjectPorts(projectId);
    projectManager.deleteProject(projectId);
  }
}

export const executionEngine = new ExecutionEngine();
