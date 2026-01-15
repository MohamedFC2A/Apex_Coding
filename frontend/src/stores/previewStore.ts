import { createWithEqualityFn } from 'zustand/traditional';
import { ExecutionResult, LogEntry } from '@/types';

export type RuntimeStatus = 'idle' | 'configuring' | 'booting' | 'mounting' | 'installing' | 'starting' | 'ready' | 'error';

interface PreviewState {
  isExecuting: boolean;
  executionResult: ExecutionResult | null;
  logs: LogEntry[];
  previewUrl: string | null;
  previewContent: string | null;
  runtimeStatus: RuntimeStatus;
  runtimeMessage: string | null;
  
  setIsExecuting: (isExecuting: boolean) => void;
  setExecutionResult: (result: ExecutionResult) => void;
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  setPreviewUrl: (url: string | null) => void;
  setPreviewContent: (content: string | null) => void;
  setRuntimeStatus: (status: RuntimeStatus, message?: string | null) => void;
  reset: () => void;
}

const initialState = {
  isExecuting: false,
  executionResult: null,
  logs: [],
  previewUrl: null,
  previewContent: null,
  runtimeStatus: 'idle' as RuntimeStatus,
  runtimeMessage: null
};

export const usePreviewStore = createWithEqualityFn<PreviewState>((set) => ({
  ...initialState,
  
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  
  setExecutionResult: (result) => set({ executionResult: result }),
  
  addLog: (log) => set((state) => ({
    logs: [...state.logs, log]
  })),
  
  clearLogs: () => set({ logs: [] }),
  
  setPreviewUrl: (url) => set({ previewUrl: url }),
  
  setPreviewContent: (content) => set({ previewContent: content }),

  setRuntimeStatus: (runtimeStatus, runtimeMessage = null) => set({ runtimeStatus, runtimeMessage }),
  
  reset: () => set(initialState)
}));
