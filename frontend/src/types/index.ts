export * from '../../../shared/types';

export interface Tab {
  id: string;
  path: string;
  language: string;
  content: string;
}

export interface GenerationStatus {
  isGenerating: boolean;
  currentStep: 'idle' | 'planning' | 'structuring' | 'coding' | 'complete';
  progress: number;
}

export interface FileStructure {
  path: string;
  type: 'file' | 'directory';
  children?: FileStructure[];
}

export interface LogEntry {
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  source?: string;
}
