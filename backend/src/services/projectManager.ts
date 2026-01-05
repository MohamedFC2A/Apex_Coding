import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProjectFile } from '../../../shared/types.js';
import { sanitizePath } from '../utils/sandbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ProjectManager {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(__dirname, '../../temp-projects');
  }

  async initializeBaseDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create base directory:', error);
    }
  }

  async createProject(projectId: string, files: ProjectFile[]): Promise<string> {
    await this.initializeBaseDir();
    const projectDir = path.join(this.baseDir, sanitizePath(projectId));
    
    await fs.mkdir(projectDir, { recursive: true });

    for (const file of files) {
      if (!file.path) continue;
      const filePath = path.join(projectDir, sanitizePath(file.path));
      const fileDir = path.dirname(filePath);
      
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content || '', 'utf-8');
    }

    return projectDir;
  }

  async deleteProject(projectId: string): Promise<void> {
    const projectDir = path.join(this.baseDir, sanitizePath(projectId));
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to delete project ${projectId}:`, error);
    }
  }

  async readProjectFile(projectId: string, filePath: string): Promise<string> {
    const fullPath = path.join(this.baseDir, sanitizePath(projectId), sanitizePath(filePath));
    return await fs.readFile(fullPath, 'utf-8');
  }

  getProjectPath(projectId: string): string {
    return path.join(this.baseDir, sanitizePath(projectId));
  }
}

export const projectManager = new ProjectManager();
