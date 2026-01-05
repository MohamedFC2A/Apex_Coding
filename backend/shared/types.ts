export interface ProjectFile {
  name: string;
  content: string;
  path?: string;
  language?: string;
}

export interface FileSystemEntry {
  file?: { contents: string };
  directory?: FileSystem;
}

export interface FileSystem {
  [name: string]: FileSystemEntry;
}

export interface ProjectMetadata {
  language: string;
  framework: string;
}

export interface ProjectConfig {
  project_files: ProjectFile[];
  metadata: ProjectMetadata;
  instructions: string;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  port?: number;
  url?: string;
}

export type ProjectStack =
  | 'HTML/CSS/JS'
  | 'React'
  | 'Node.js' | 'node-express'
  | 'Python' | 'python-flask' | 'python-fastapi'
  | 'Vue'
  | 'Svelte'
  | 'React Vite' | 'react-vite'
  | 'C++' | 'cpp'
  | 'Other';
