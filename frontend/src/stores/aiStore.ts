import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { FileSystem, GenerationStatus, ProjectFile } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { aiService } from '@/services/aiService';

type ModelMode = 'fast' | 'thinking';
export type FileStreamStatus = 'ready' | 'queued' | 'writing';
export type InteractionMode = 'create' | 'edit';

type FileSystemState = FileSystem | [];

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface PlanStep {
  id: string;
  title: string;
  completed: boolean;
}

export interface HistorySession {
  id: string;
  createdAt: number;
  title: string;
  files: FileSystem;
  chatHistory: ChatMessage[];
  plan: string;
  planSteps: PlanStep[];
}

interface AISections {
  interpretation?: string;
  trace?: string;
  structure?: string;
  code?: string;
  preview?: string;
  download?: string;
}

interface AIStoreState {
  prompt: string;
  plan: string;
  planSteps: PlanStep[];
  architectMode: boolean;
  lastPlannedPrompt: string;
  chatHistory: ChatMessage[];
  decisionTrace: string;
  streamText: string;
  lastTokenAt: number;
  modelMode: ModelMode;
  interactionMode: InteractionMode;
  writingFilePath: string | null;
  fileStatuses: Record<string, FileStreamStatus>;
  sections: AISections;
  isGenerating: boolean;
  isPlanning: boolean;
  thinkingContent: string;
  systemConsoleContent: string;
  generationStatus: GenerationStatus;
  error: string | null;
  isPreviewOpen: boolean;
  files: FileSystemState;
  history: HistorySession[];
}

interface AIStoreActions {
  setPrompt: (prompt: string) => void;
  setPlan: (plan: string) => void;
  setPlanSteps: (steps: PlanStep[]) => void;
  setPlanStepCompleted: (id: string, completed: boolean) => void;
  clearPlanSteps: () => void;
  setArchitectMode: (enabled: boolean) => void;
  setLastPlannedPrompt: (prompt: string) => void;
  setChatHistory: (history: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  generatePlan: (prompt?: string) => Promise<void>;
  setDecisionTrace: (trace: string) => void;
  appendStreamText: (text: string) => void;
  setStreamText: (text: string) => void;
  updateLastToken: () => void;
  setWritingFilePath: (path: string | null) => void;
  setFileStatus: (path: string, status: FileStreamStatus) => void;
  clearFileStatuses: () => void;
  setSections: (sections: AISections) => void;
  setModelMode: (mode: ModelMode) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setIsPlanning: (isPlanning: boolean) => void;
  appendThinkingContent: (chunk: string) => void;
  clearThinkingContent: () => void;
  appendSystemConsoleContent: (chunk: string) => void;
  clearSystemConsoleContent: () => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  setError: (error: string | null) => void;
  setIsPreviewOpen: (open: boolean) => void;
  setFiles: (files: FileSystemState) => void;
  resetFiles: () => void;
  resolveFilePath: (path: string) => string;
  upsertFileNode: (path: string, content?: string) => void;
  appendToFileNode: (path: string, chunk: string) => void;
  setFilesFromProjectFiles: (files: ProjectFile[]) => void;
  saveCurrentSession: () => void;
  restoreSession: (sessionId: string) => void;
  startNewChat: () => void;
  reset: () => void;
}

export type AIState = AIStoreState & AIStoreActions;

const ROOT_FILES = new Set(['readme.md']);

const FRONTEND_EXTENSIONS = new Set([
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'jsx',
  'tsx',
  'vue',
  'svelte'
]);

const BACKEND_EXTENSIONS = new Set([
  'js',
  'ts',
  'py',
  'go',
  'rb',
  'java',
  'cs',
  'php',
  'rs',
  'cpp',
  'c',
  'sql',
  'env'
]);

const FRONTEND_HINTS = ['frontend', 'client', 'components', 'pages', 'public', 'styles', 'assets', 'hooks', 'ui'];
const BACKEND_HINTS = ['backend', 'server', 'api', 'routes', 'controllers', 'models', 'db', 'database', 'middleware'];

const FRONTEND_FILES = new Set([
  'index.html',
  'main.tsx',
  'main.jsx',
  'app.tsx',
  'app.jsx',
  'vite.config.ts',
  'vite.config.js',
  'tailwind.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.ts'
]);

const BACKEND_FILES = new Set([
  'server.js',
  'server.ts',
  'server.py',
  'app.js',
  'app.ts',
  'app.py',
  'main.py',
  'requirements.txt',
  '.env',
  '.env.example'
]);

const createInitialFiles = (): FileSystemState => [];

const normalizeFileSystem = (files: FileSystemState): FileSystem => (Array.isArray(files) ? {} : files);

const cloneFileSystem = (tree: FileSystem): FileSystem => {
  const cloned: FileSystem = {};
  for (const [name, entry] of Object.entries(tree)) {
    if (entry.file) {
      cloned[name] = { file: { contents: entry.file.contents } };
    }
    if (entry.directory) {
      cloned[name] = { ...cloned[name], directory: cloneFileSystem(entry.directory) };
    }
  }
  return cloned;
};

const cleanPath = (rawPath: string) =>
  rawPath
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '')
    .trim();

const isRootFile = (fileName: string) => ROOT_FILES.has(fileName.toLowerCase());

const inferRootFromPath = (path: string) => {
  const lower = path.toLowerCase();
  const segments = lower.split('/');
  const fileName = segments[segments.length - 1] || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';

  const hasFrontendHint =
    segments.some((segment) => FRONTEND_HINTS.includes(segment)) ||
    FRONTEND_HINTS.some((hint) => fileName.includes(hint));

  const hasBackendHint =
    segments.some((segment) => BACKEND_HINTS.includes(segment)) ||
    BACKEND_HINTS.some((hint) => fileName.includes(hint));

  if (FRONTEND_FILES.has(fileName) || (ext && FRONTEND_EXTENSIONS.has(ext)) || hasFrontendHint) {
    return 'frontend';
  }

  if (BACKEND_FILES.has(fileName) || (ext && BACKEND_EXTENSIONS.has(ext)) || hasBackendHint) {
    return 'backend';
  }

  return 'frontend';
};

const normalizePath = (rawPath: string) => {
  if (!rawPath) return '';
  const cleaned = cleanPath(rawPath);
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (lower.startsWith('frontend/') || lower.startsWith('backend/')) return cleaned;

  const segments = cleaned.split('/');
  const fileName = segments[segments.length - 1] || '';

  if (segments.length === 1 && isRootFile(fileName)) return cleaned;

  const root = inferRootFromPath(cleaned);
  return `${root}/${cleaned}`;
};

const upsertFileSystemEntry = (tree: FileSystem, rawPath: string, content?: string) => {
  const resolvedPath = normalizePath(rawPath);
  if (!resolvedPath) return tree;

  const segments = resolvedPath.split('/');

  const insert = (node: FileSystem, index: number): FileSystem => {
    const name = segments[index];
    const isLeaf = index === segments.length - 1;

    if (isLeaf) {
      const existing = node[name]?.file?.contents ?? '';
      return {
        ...node,
        [name]: {
          file: { contents: content ?? existing }
        }
      };
    }

    const existingDir = node[name]?.directory ?? {};
    return {
      ...node,
      [name]: {
        directory: insert(existingDir, index + 1)
      }
    };
  };

  return insert(tree, 0);
};

const appendToFileSystemEntry = (tree: FileSystem, rawPath: string, chunk: string) => {
  const resolvedPath = normalizePath(rawPath);
  if (!resolvedPath) return tree;

  const segments = resolvedPath.split('/');

  const insert = (node: FileSystem, index: number): FileSystem => {
    const name = segments[index];
    const isLeaf = index === segments.length - 1;

    if (isLeaf) {
      const existing = node[name]?.file?.contents ?? '';
      return {
        ...node,
        [name]: {
          file: { contents: existing + chunk }
        }
      };
    }

    const existingDir = node[name]?.directory ?? {};
    return {
      ...node,
      [name]: {
        directory: insert(existingDir, index + 1)
      }
    };
  };

  return insert(tree, 0);
};

const buildTreeFromProjectFiles = (files: ProjectFile[]) => {
  let tree: FileSystem = {};

  for (const file of files) {
    const rawPath = file.path || file.name;
    if (!rawPath) continue;
    tree = upsertFileSystemEntry(tree, rawPath, file.content || '');
  }

  return tree;
};

const buildInitialState = (): AIStoreState => ({
  prompt: '',
  plan: '',
  planSteps: [],
  architectMode: true,
  lastPlannedPrompt: '',
  chatHistory: [],
  decisionTrace: '',
  streamText: '',
  lastTokenAt: 0,
  modelMode: 'fast',
  interactionMode: 'create',
  writingFilePath: null,
  fileStatuses: {},
  sections: {},
  isGenerating: false,
  isPlanning: false,
  thinkingContent: '',
  systemConsoleContent: '',
  generationStatus: {
    isGenerating: false,
    currentStep: 'idle' as const,
    progress: 0
  },
  error: null,
  isPreviewOpen: false,
  files: createInitialFiles(),
  history: []
});

const initialState: AIStoreState = buildInitialState();

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPrompt: (prompt) => set({ prompt }),

      setPlan: (plan) => set({ plan }),

      setPlanSteps: (steps) => set({ planSteps: steps }),

      setPlanStepCompleted: (id, completed) =>
        set((state) => ({
          planSteps: state.planSteps.map((step) =>
            step.id === id ? { ...step, completed } : step
          )
        })),

      clearPlanSteps: () => set({ planSteps: [] }),

      setArchitectMode: (enabled) => set({ architectMode: enabled }),

      setLastPlannedPrompt: (prompt) => set({ lastPlannedPrompt: prompt }),

      setChatHistory: (history) => set({ chatHistory: history }),

      addChatMessage: (message) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, message]
        })),

      clearChatHistory: () => set({ chatHistory: [] }),

      setInteractionMode: (mode) => set({ interactionMode: mode }),

      generatePlan: async (promptOverride?: string) => {
        const prompt = (promptOverride ?? get().prompt ?? '').trim();
        if (!prompt) return;

        set({ isPlanning: true, error: null });
        try {
          const thinkingMode = get().modelMode === 'thinking';
          const data = await aiService.generatePlan(prompt, thinkingMode);
          const rawSteps: any[] = Array.isArray(data?.steps) ? data.steps : [];

          const planSteps: PlanStep[] = rawSteps
            .map((s, i) => ({
              id: String(s?.id ?? i + 1),
              title: String(s?.title ?? s?.text ?? s?.step ?? '').trim(),
              completed: false
            }))
            .filter((s) => s.title.length > 0);

          set({ planSteps, lastPlannedPrompt: prompt });
        } catch (err: any) {
          set({ error: err?.message || 'Failed to generate plan' });
        } finally {
          set({ isPlanning: false });
        }
      },

      setDecisionTrace: (trace) => set({ decisionTrace: trace }),

      appendStreamText: (text) =>
        set((state) => ({
          streamText: state.streamText + text,
          lastTokenAt: Date.now()
        })),

      setStreamText: (text) => set({ streamText: text }),

      updateLastToken: () => set({ lastTokenAt: Date.now() }),

      setWritingFilePath: (path) => set({ writingFilePath: path }),

      setFileStatus: (path, status) =>
        set((state) => ({
          fileStatuses: { ...state.fileStatuses, [path]: status }
        })),

      clearFileStatuses: () => set({ fileStatuses: {}, writingFilePath: null }),

      setSections: (sections) => set({ sections }),

      setModelMode: (mode) => set({ modelMode: mode }),

      setIsGenerating: (isGenerating) => set({ isGenerating }),

      setIsPlanning: (isPlanning) => set({ isPlanning }),

      appendThinkingContent: (chunk) =>
        set((state) => ({
          thinkingContent: state.thinkingContent + chunk
        })),

      clearThinkingContent: () => set({ thinkingContent: '' }),

      appendSystemConsoleContent: (chunk) =>
        set((state) => ({
          systemConsoleContent: state.systemConsoleContent + chunk
        })),

      clearSystemConsoleContent: () => set({ systemConsoleContent: '' }),

      setGenerationStatus: (status) => set({ generationStatus: status }),

      setError: (error) => set({ error }),

      setIsPreviewOpen: (open) => set({ isPreviewOpen: open }),

      setFiles: (files) => set({ files }),

      resetFiles: () => set({ files: createInitialFiles() }),

      resolveFilePath: (path) => normalizePath(path),

      upsertFileNode: (path, content) =>
        set((state) => ({
          files: upsertFileSystemEntry(normalizeFileSystem(state.files), path, content)
        })),

      appendToFileNode: (path, chunk) =>
        set((state) => ({
          files: appendToFileSystemEntry(normalizeFileSystem(state.files), path, chunk)
        })),

      setFilesFromProjectFiles: (projectFiles) =>
        set({ files: buildTreeFromProjectFiles(projectFiles) }),

      saveCurrentSession: () => {
        const state = get();
        const projectFiles = useProjectStore.getState().files;
        const snapshotFiles = projectFiles.length > 0
          ? buildTreeFromProjectFiles(projectFiles)
          : normalizeFileSystem(state.files);

        const titleSource = state.lastPlannedPrompt || state.prompt || 'Untitled Session';
        const snapshot: HistorySession = {
          id: `session-${Date.now()}`,
          createdAt: Date.now(),
          title: titleSource.slice(0, 60),
          files: cloneFileSystem(snapshotFiles),
          chatHistory: state.chatHistory.map((msg) => ({ ...msg })),
          plan: state.plan,
          planSteps: state.planSteps.map((step) => ({ ...step }))
        };

        set({ history: [snapshot, ...state.history] });
      },

      restoreSession: (sessionId) => {
        const session = get().history.find((item) => item.id === sessionId);
        if (!session) return;

        set({
          files: cloneFileSystem(session.files),
          chatHistory: session.chatHistory.map((msg) => ({ ...msg })),
          plan: session.plan,
          planSteps: session.planSteps.map((step) => ({ ...step })),
          prompt: '',
          lastPlannedPrompt: '',
          decisionTrace: '',
          streamText: '',
          thinkingContent: '',
          systemConsoleContent: '',
          fileStatuses: {},
          writingFilePath: null,
          sections: {},
          isGenerating: false,
          isPlanning: false,
          generationStatus: {
            isGenerating: false,
            currentStep: 'idle' as const,
            progress: 0
          },
          error: null,
          isPreviewOpen: false
        });
      },

      startNewChat: () => {
        get().saveCurrentSession();

        set({
          files: createInitialFiles(),
          chatHistory: [],
          plan: '',
          planSteps: [],
          lastPlannedPrompt: '',
          prompt: '',
          decisionTrace: '',
          streamText: '',
          thinkingContent: '',
          systemConsoleContent: '',
          fileStatuses: {},
          writingFilePath: null,
          sections: {},
          isGenerating: false,
          isPlanning: false,
          generationStatus: {
            isGenerating: false,
            currentStep: 'idle' as const,
            progress: 0
          },
          error: null,
          isPreviewOpen: false,
          interactionMode: 'create'
        });

        useProjectStore.getState().reset();
        window.location.reload();
      },

      reset: () => set(buildInitialState())
    }),
    {
      name: 'nexus-ai-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
