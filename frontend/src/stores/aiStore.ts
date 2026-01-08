import { createWithEqualityFn } from 'zustand/traditional';
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
  category?: 'config' | 'frontend' | 'backend' | 'integration' | 'testing' | 'deployment';
  files?: string[];
  description?: string;
}

export interface HistorySession {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  projectName: string;
  files: FileSystem;
  chatHistory: ChatMessage[];
  plan: string;
  planSteps: PlanStep[];
  contextSize: number;
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
  currentSessionId: string | null;
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
  upsertDirectoryNode: (path: string) => void;
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

const createInitialFiles = (): FileSystemState => {
  return {};
};

// Context compression constants
const MAX_MESSAGE_LENGTH = 4000;
const COMPRESSION_THRESHOLD = 100000;

// Calculate total context size in characters
const calculateContextSize = (chatHistory: ChatMessage[], files: FileSystem): number => {
  let size = 0;
  
  // Chat history size
  for (const msg of chatHistory) {
    size += msg.content.length + msg.role.length + 10;
  }
  
  // Files size
  const countFileSize = (tree: FileSystem): number => {
    let total = 0;
    for (const [name, entry] of Object.entries(tree)) {
      total += name.length;
      if (entry.file?.contents) {
        total += entry.file.contents.length;
      }
      if (entry.directory) {
        total += countFileSize(entry.directory);
      }
    }
    return total;
  };
  
  size += countFileSize(files);
  return size;
};

// Compress chat history when context is too large
const compressChatHistory = (history: ChatMessage[]): ChatMessage[] => {
  if (history.length === 0) return [];
  
  const totalSize = history.reduce((acc, msg) => acc + msg.content.length, 0);
  
  // If under threshold, return as-is
  if (totalSize < COMPRESSION_THRESHOLD) {
    return history.map(msg => ({ ...msg }));
  }
  
  // Compress older messages, keep recent ones intact
  const keepRecentCount = Math.min(6, history.length);
  const recentMessages = history.slice(-keepRecentCount);
  const olderMessages = history.slice(0, -keepRecentCount);
  
  const compressed: ChatMessage[] = [];
  
  // Summarize older messages
  if (olderMessages.length > 0) {
    const summary = olderMessages.map(msg => {
      const truncated = msg.content.length > MAX_MESSAGE_LENGTH 
        ? msg.content.slice(0, MAX_MESSAGE_LENGTH) + '... [truncated]'
        : msg.content;
      return `[${msg.role}]: ${truncated.slice(0, 200)}...`;
    }).join('\n');
    
    compressed.push({
      role: 'system',
      content: `[COMPRESSED HISTORY - ${olderMessages.length} messages]\n${summary.slice(0, 2000)}`
    });
  }
  
  // Add recent messages as-is
  for (const msg of recentMessages) {
    compressed.push({
      role: msg.role,
      content: msg.content.length > MAX_MESSAGE_LENGTH
        ? msg.content.slice(0, MAX_MESSAGE_LENGTH) + '... [truncated]'
        : msg.content
    });
  }
  
  return compressed;
};

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

const normalizeDirPath = (rawPath: string) => {
  if (!rawPath) return '';
  const cleaned = cleanPath(rawPath).replace(/\/+$/, '');
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (lower.startsWith('frontend/') || lower.startsWith('backend/')) return cleaned;

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

const upsertDirectoryEntry = (tree: FileSystem, rawPath: string) => {
  const resolvedPath = normalizeDirPath(rawPath);
  if (!resolvedPath) return tree;

  const segments = resolvedPath.split('/');

  const insert = (node: FileSystem, index: number): FileSystem => {
    const name = segments[index];
    const isLeaf = index === segments.length - 1;

    if (isLeaf) {
      const existingDir = node[name]?.directory ?? {};
      return {
        ...node,
        [name]: {
          directory: existingDir
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

  if (!files || files.length === 0) {
    return tree;
  }

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
  history: [],
  currentSessionId: null
});

const initialState: AIStoreState = buildInitialState();

export const useAIStore = createWithEqualityFn<AIState>()(
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
        set((state) => {
          const updatedHistory = [...state.chatHistory, message];
          // Auto-save when chat message is added
          setTimeout(() => get().saveCurrentSession(), 100);
          return { chatHistory: updatedHistory };
        }),

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
              completed: false,
              category: (s?.category || 'frontend') as PlanStep['category'],
              files: Array.isArray(s?.files) ? s.files : [],
              description: String(s?.description ?? '')
            }))
            .filter((s) => s.title.length > 0);

          set({ planSteps, lastPlannedPrompt: prompt, plan: data?.title || 'Architecture Plan' });
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

      upsertDirectoryNode: (path) =>
        set((state) => ({
          files: upsertDirectoryEntry(normalizeFileSystem(state.files), path)
        })),

      appendToFileNode: (path, chunk) =>
        set((state) => ({
          files: appendToFileSystemEntry(normalizeFileSystem(state.files), path, chunk)
        })),

      setFilesFromProjectFiles: (projectFiles) =>
        set({ files: buildTreeFromProjectFiles(projectFiles) }),

      saveCurrentSession: () => {
        const state = get();
        const projectStore = useProjectStore.getState();
        const projectFiles = projectStore.files;
        const projectName = projectStore.projectName || '';

        const snapshotFiles = projectFiles.length > 0
          ? buildTreeFromProjectFiles(projectFiles)
          : normalizeFileSystem(state.files);

        const hasAnyFiles = Object.keys(snapshotFiles).length > 0;
        const hasAnyContext =
          hasAnyFiles ||
          state.chatHistory.length > 0 ||
          state.planSteps.length > 0 ||
          state.plan.trim().length > 0 ||
          state.lastPlannedPrompt.trim().length > 0;

        if (!hasAnyContext) return;

        // Generate stable session ID based on projectName
        const sanitizedName = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 50) || 'untitled';
        
        // Use existing session ID or find by projectName, or create new stable ID
        let sessionId = state.currentSessionId;
        if (!sessionId && projectName) {
          // Check if session with this projectName already exists
          const existingSession = state.history.find(s => s.projectName === projectName);
          if (existingSession) {
            sessionId = existingSession.id;
          }
        }
        if (!sessionId) {
          sessionId = `project-${sanitizedName}-${Date.now()}`;
        }

        const titleSource = projectName || state.lastPlannedPrompt || state.prompt || 'Untitled Session';
        
        // Calculate context size for compression indicator
        const contextSize = calculateContextSize(state.chatHistory, snapshotFiles);
        
        const existingSession = state.history.find(s => s.id === sessionId);
        const createdAt = existingSession?.createdAt || Date.now();

        const snapshot: HistorySession = {
          id: sessionId,
          createdAt,
          updatedAt: Date.now(),
          title: titleSource.slice(0, 60),
          projectName,
          files: cloneFileSystem(snapshotFiles),
          chatHistory: compressChatHistory(state.chatHistory),
          plan: state.plan,
          planSteps: state.planSteps.map((step) => ({ ...step })),
          contextSize
        };

        // Update existing session or add new one - always update same session
        const existingIndex = state.history.findIndex(s => s.id === sessionId);
        if (existingIndex >= 0) {
          set((prevState) => ({
            history: prevState.history.map((s) =>
              s.id === sessionId ? snapshot : s
            ),
            currentSessionId: sessionId
          }));
        } else {
          set({ history: [snapshot, ...state.history], currentSessionId: sessionId });
        }
      },

      restoreSession: (sessionId) => {
        const session = get().history.find((item) => item.id === sessionId);
        if (!session) return;

        // Restore project name in projectStore
        if (session.projectName) {
          useProjectStore.getState().setProjectName(session.projectName);
        }

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
          isPreviewOpen: false,
          currentSessionId: sessionId
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
          interactionMode: 'create',
          currentSessionId: null
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
