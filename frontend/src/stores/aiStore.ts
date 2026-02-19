import { createWithEqualityFn } from 'zustand/traditional';
import { createJSONStorage, persist } from 'zustand/middleware';
import { FileStructure, FileSystem, GenerationStatus, ProjectFile } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { aiService } from '@/services/aiService';
import { repairTruncatedContent } from '@/utils/codeRepair';
import { normalizePlanCategory } from '@/utils/planCategory';
import { loadSessionsFromDisk, saveSessionToDisk, type StoredHistorySession } from '@/utils/sessionDb';
import type {
  ActiveModelProfile,
  CompressionSnapshot,
  ContextBudgetState,
  WorkspaceAnalysisReport
} from '@/types/context';

type ModelMode = 'fast' | 'thinking' | 'super';
export type FileStreamStatus = 'ready' | 'queued' | 'writing' | 'partial' | 'compromised';
export type InteractionMode = 'create' | 'edit';
export type ProjectType = 'FRONTEND_ONLY';
export type BrainEventSource = 'system' | 'stream' | 'file' | 'preview' | 'user';
export type BrainEventLevel = 'info' | 'warn' | 'error' | 'success';
export type AIFileEvent =
  | {
      type: 'start' | 'chunk' | 'end';
      path: string;
      mode?: 'create' | 'edit';
      chunk?: string;
      partial?: boolean;
      line?: number;
      append?: boolean;
    }
  | {
      type: 'delete';
      path: string;
      reason?: string;
      safetyCheckPassed?: boolean;
    }
  | {
      type: 'move';
      path: string;
      toPath: string;
      reason?: string;
      safetyCheckPassed?: boolean;
    };

type FileSystemState = FileSystem | [];

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
  round?: number;
  createdAt?: number;
  signature?: string;
  kind?: 'completion-summary' | 'general';
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  category: 'config' | 'frontend' | 'backend' | 'integration' | 'testing' | 'deployment' | 'tasks';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  files: string[];
  estimatedSize: 'small' | 'medium' | 'large';
  depends_on?: string[];
}

export interface HistorySession {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  projectName: string;
  projectType: ProjectType | null;
  selectedFeatures: string[];
  customFeatureTags: string[];
  constraintsEnforcement: 'hard';
  files: FileSystem;
  fileStructure?: FileStructure[];
  projectFiles?: ProjectFile[];
  stack?: string;
  description?: string;
  activeFile?: string | null;
  chatHistory: ChatMessage[];
  plan: string;
  planSteps: PlanStep[];
  contextSize: number;
  contextBudget: ContextBudgetState;
  compressionSnapshot: CompressionSnapshot;
  activeModelProfile: ActiveModelProfile;
  multiAgentEnabled?: boolean;
  executionPhase?: ExecutionPhase;
  writingFilePath?: string | null;
  fileStatuses?: Record<string, FileStreamStatus>;
  completedFiles?: string[];
  lastSuccessfulFile?: string | null;
  lastSuccessfulLine?: number;
}

interface AISections {
  interpretation?: string;
  trace?: string;
  structure?: string;
  code?: string;
  preview?: string;
  download?: string;
}

export type ExecutionPhase = 'idle' | 'planning' | 'executing' | 'interrupted' | 'completed';

export interface BrainEvent {
  id: string;
  ts: number;
  source: BrainEventSource;
  level: BrainEventLevel;
  message: string;
  path?: string;
  phase?: ExecutionPhase | 'recovering' | 'heartbeat' | 'writing';
}

interface AIStoreState {
  prompt: string;
  plan: string;
  planSteps: PlanStep[];
  projectType: ProjectType | null;
  selectedFeatures: string[];
  customFeatureTags: string[];
  constraintsEnforcement: 'hard';
  architectMode: boolean;
  multiAgentEnabled: boolean;
  lastPlannedPrompt: string;
  chatHistory: ChatMessage[];
  decisionTrace: string;
  streamText: string;
  lastTokenAt: number;
  lastActiveTimestamp: number;
  executionPhase: ExecutionPhase;
  executionBudget: number;
  
  // Execution Cursor (Persistence)
  lastSuccessfulFile: string | null;
  lastSuccessfulLine: number;
  completedFiles: string[];
  
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
  contextBudget: ContextBudgetState;
  compressionSnapshot: CompressionSnapshot;
  brainEvents: BrainEvent[];
  analysisReport: WorkspaceAnalysisReport | null;
  policyViolations: string[];
  blockedReason: string | null;
}

interface AIStoreActions {
  setPrompt: (prompt: string) => void;
  setPlan: (plan: string) => void;
  setPlanSteps: (steps: PlanStep[]) => void;
  setPlanStepCompleted: (id: string, completed: boolean) => void;
  clearPlanSteps: () => void;
  setProjectType: (type: ProjectType | null) => void;
  setSelectedFeatures: (features: string[]) => void;
  setCustomFeatureTags: (tags: string[]) => void;
  setConstraintsEnforcement: (mode: 'hard') => void;
  setArchitectMode: (enabled: boolean) => void;
  setMultiAgentEnabled: (enabled: boolean) => void;
  setLastPlannedPrompt: (prompt: string) => void;
  setChatHistory: (history: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  generatePlan: (prompt?: string, abortSignal?: AbortSignal) => Promise<void>;
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
  handleFileEvent: (event: AIFileEvent) => void;
  setFilesFromProjectFiles: (files: ProjectFile[]) => void;
  saveCurrentSession: () => void;
  hydrateHistoryFromDisk: () => Promise<void>;
  restoreSession: (sessionId: string) => void;
  startNewChat: () => void;
  reset: () => void;
  verifyIntegrity: () => { isSecure: boolean; brokenFiles: string[] };
  setExecutionPhase: (phase: ExecutionPhase) => void;
  setExecutionCursor: (file: string | null, line: number) => void;
  addCompletedFile: (path: string) => void;
  touchSession: () => void;
  recoverSession: () => void;
  addBrainEvent: (event: Omit<BrainEvent, 'id' | 'ts'> & { id?: string; ts?: number }) => void;
  clearBrainEvents: () => void;
  setAnalysisReport: (report: WorkspaceAnalysisReport | null) => void;
  setPolicyViolations: (issues: string[]) => void;
  addPolicyViolation: (issue: string) => void;
  clearPolicyViolations: () => void;
  setBlockedReason: (reason: string | null) => void;
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

// Context engine constants
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONTEXT_CHARS = 160_000;
const MAX_CONTEXT_ESTIMATED_TOKENS = 32_000;
const CONTEXT_WARNING_PCT = 70;
const CONTEXT_CRITICAL_PCT = 90;
const COMPRESSION_THRESHOLD_CHARS = 100_000;
const KEEP_RECENT_MESSAGES = 8;
const SUMMARY_CHUNK_SIZE = 5;
const MAX_HISTORY_SESSIONS = 40;
const AI_EMERGENCY_SESSION_KEY = 'apex-ai-emergency-session';
export const AI_NEW_CHAT_GUARD_KEY = 'apex-ai-new-chat-guard';

// Keep long-running sessions responsive: cap large UI strings.
const MAX_THINKING_CHARS = 120_000;
const MAX_CONSOLE_CHARS = 160_000;
const MAX_BRAIN_EVENTS = 480;

const DEFAULT_CONTEXT_BUDGET: ContextBudgetState = {
  maxChars: MAX_CONTEXT_CHARS,
  maxEstimatedTokens: MAX_CONTEXT_ESTIMATED_TOKENS,
  usedChars: 0,
  usedEstimatedTokens: 0,
  utilizationPct: 0,
  status: 'ok'
};

const DEFAULT_COMPRESSION_SNAPSHOT: CompressionSnapshot = {
  level: 0,
  compressedMessagesCount: 0,
  summaryBlocks: [],
  lastCompressedAt: 0
};

const coerceProjectType = (_value: unknown): ProjectType => 'FRONTEND_ONLY';

const coerceExecutionPhase = (value: unknown): ExecutionPhase => {
  const phase = String(value || '').trim();
  if (phase === 'planning' || phase === 'executing' || phase === 'interrupted' || phase === 'completed') {
    return phase;
  }
  return 'idle';
};

const readEmergencySession = (): Partial<HistorySession> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AI_EMERGENCY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const id = String(parsed?.id || '').trim();
    if (!id) return null;
    return {
      id,
      createdAt: Number(parsed?.createdAt || Date.now()),
      updatedAt: Number(parsed?.updatedAt || Date.now()),
      title: String(parsed?.title || 'Recovered Session'),
      projectName: String(parsed?.projectName || ''),
      projectType: coerceProjectType(parsed?.projectType),
      selectedFeatures: Array.isArray(parsed?.selectedFeatures) ? parsed.selectedFeatures : [],
      customFeatureTags: Array.isArray(parsed?.customFeatureTags) ? parsed.customFeatureTags : [],
      constraintsEnforcement: 'hard',
      stack: String(parsed?.stack || ''),
      description: String(parsed?.description || ''),
      activeFile: parsed?.activeFile ? String(parsed.activeFile) : null,
      chatHistory: Array.isArray(parsed?.chatHistory)
        ? parsed.chatHistory.map((m: any) => ({
            role: m?.role === 'assistant' || m?.role === 'system' ? m.role : 'user',
            content: String(m?.content || '')
          }))
        : [],
      plan: String(parsed?.plan || ''),
      planSteps: Array.isArray(parsed?.planSteps) ? parsed.planSteps : [],
      contextBudget: parsed?.contextBudget || DEFAULT_CONTEXT_BUDGET,
      compressionSnapshot: parsed?.compressionSnapshot || DEFAULT_COMPRESSION_SNAPSHOT,
      activeModelProfile: parsed?.activeModelProfile || getActiveModelProfile(),
      executionPhase: coerceExecutionPhase(parsed?.executionPhase),
      multiAgentEnabled: Boolean(parsed?.multiAgentEnabled),
      writingFilePath: parsed?.writingFilePath ? String(parsed.writingFilePath) : null,
      fileStatuses:
        parsed?.fileStatuses && typeof parsed.fileStatuses === 'object'
          ? (parsed.fileStatuses as Record<string, FileStreamStatus>)
          : {},
      completedFiles: Array.isArray(parsed?.completedFiles) ? parsed.completedFiles.map((v: any) => String(v || '')) : [],
      lastSuccessfulFile: parsed?.lastSuccessfulFile ? String(parsed.lastSuccessfulFile) : null,
      lastSuccessfulLine: Number(parsed?.lastSuccessfulLine || 0)
    };
  } catch {
    return null;
  }
};

const normalizeModelMode = (mode: ModelMode): ModelMode => {
  if (mode === 'super') return 'thinking';
  return mode;
};

const getActiveModelProfile = (): ActiveModelProfile => ({
  plannerModel: 'planner:auto',
  executorModel: 'executor:auto',
  specialistModels: {}
});

// Calculate total context size in characters.
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

const estimateTokens = (chars: number) => Math.ceil(chars / 4);

const calculateContextBudget = (chatHistory: ChatMessage[], files: FileSystem): ContextBudgetState => {
  const usedChars = calculateContextSize(chatHistory, files);
  const systemOverhead = chatHistory.reduce((acc, msg) => acc + (msg.role === 'system' ? 220 : 0), 0);
  const usedEstimatedTokens = estimateTokens(usedChars) + systemOverhead;
  const charRatio = usedChars / MAX_CONTEXT_CHARS;
  const tokenRatio = usedEstimatedTokens / MAX_CONTEXT_ESTIMATED_TOKENS;
  const utilizationPct = Math.max(charRatio, tokenRatio) * 100;

  const status: ContextBudgetState['status'] =
    utilizationPct >= CONTEXT_CRITICAL_PCT ? 'critical' : utilizationPct >= CONTEXT_WARNING_PCT ? 'warning' : 'ok';

  return {
    maxChars: MAX_CONTEXT_CHARS,
    maxEstimatedTokens: MAX_CONTEXT_ESTIMATED_TOKENS,
    usedChars,
    usedEstimatedTokens,
    utilizationPct: Number(utilizationPct.toFixed(2)),
    status
  };
};

const FILE_PATH_RE = /(?:^|[\s("'`])((?:frontend|backend)\/[^\s"'`]+|src\/[^\s"'`]+|[a-zA-Z0-9_-]+\.(?:tsx?|jsx?|css|scss|sass|html|md|svg|json))/g;

const extractKeyFiles = (text: string): string[] => {
  const files = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = FILE_PATH_RE.exec(text)) !== null) {
    const value = String(match[1] || '').trim();
    if (!value) continue;
    files.add(value);
    if (files.size >= 8) break;
  }
  return Array.from(files);
};

const extractKeyDecisions = (messages: ChatMessage[]): string[] => {
  const decisions: string[] = [];
  for (const msg of messages) {
    const lines = String(msg.content || '').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^(important|decision|rule|constraint|must|should|todo|fix|api|mode)/i.test(trimmed)) {
        decisions.push(trimmed.slice(0, 160));
      }
      if (decisions.length >= 6) return decisions;
    }
  }
  return decisions;
};

const createSummaryBlock = (
  messages: ChatMessage[],
  start: number,
  end: number,
  level: number
): CompressionSnapshot['summaryBlocks'][number] => {
  const joined = messages
    .map((msg) => {
      const clipped =
        msg.content.length > MAX_MESSAGE_LENGTH
          ? `${msg.content.slice(0, MAX_MESSAGE_LENGTH)}... [truncated]`
          : msg.content;
      return `[${msg.role}] ${clipped.slice(0, 260)}`;
    })
    .join('\n');

  return {
    id: `l${level}-${start}-${end}-${Date.now()}`,
    range: `${start}-${end}`,
    summary: joined.slice(0, 900),
    keyFiles: extractKeyFiles(joined),
    keyDecisions: extractKeyDecisions(messages)
  };
};

const compressChatHistoryHierarchical = (
  history: ChatMessage[],
  previousSnapshot?: CompressionSnapshot
): { chatHistory: ChatMessage[]; snapshot: CompressionSnapshot } => {
  if (history.length === 0) {
    return { chatHistory: [], snapshot: previousSnapshot || DEFAULT_COMPRESSION_SNAPSHOT };
  }

  const totalSize = history.reduce((acc, msg) => acc + msg.content.length, 0);
  if (totalSize < COMPRESSION_THRESHOLD_CHARS) {
    return {
      chatHistory: history.map((msg) => ({ ...msg })),
      snapshot: previousSnapshot || DEFAULT_COMPRESSION_SNAPSHOT
    };
  }

  const keepRecentCount = Math.min(KEEP_RECENT_MESSAGES, history.length);
  const recentMessages = history.slice(-keepRecentCount).map((msg) => ({ ...msg }));
  const olderMessages = history.slice(0, -keepRecentCount);

  const level = Math.min((previousSnapshot?.level || 0) + 1, 3);
  const summaryBlocks: CompressionSnapshot['summaryBlocks'] = [];

  for (let i = 0; i < olderMessages.length; i += SUMMARY_CHUNK_SIZE) {
    const chunk = olderMessages.slice(i, i + SUMMARY_CHUNK_SIZE);
    summaryBlocks.push(createSummaryBlock(chunk, i, i + chunk.length - 1, level));
  }

  const summaryMessage: ChatMessage = {
    role: 'system',
    content: [
      `[CONTEXT SUMMARY L${level}] compressed ${olderMessages.length} older messages.`,
      'Blocks:',
      ...summaryBlocks.map((block) => {
        const files = block.keyFiles.length > 0 ? `files=${block.keyFiles.join(', ')}` : 'files=none';
        const decisions = block.keyDecisions.length > 0 ? `decisions=${block.keyDecisions.join(' | ')}` : 'decisions=none';
        return `- (${block.range}) ${block.summary.slice(0, 220)} | ${files} | ${decisions}`;
      })
    ].join('\n')
  };

  return {
    chatHistory: [summaryMessage, ...recentMessages],
    snapshot: {
      level,
      compressedMessagesCount: olderMessages.length,
      summaryBlocks,
      lastCompressedAt: Date.now()
    }
  };
};

const normalizeFileSystem = (files: FileSystemState): FileSystem => (Array.isArray(files) ? {} : files);

// Helper to check if file exists
const checkFileExists = (tree: FileSystem, path: string): boolean => {
  const parts = path.split('/');
  let node: any = tree;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!node[part]) return false;
    if (i === parts.length - 1) return !!node[part].file;
    if (node[part].directory) node = node[part].directory;
    else return false;
  }
  return false;
};

// Helper to find file by basename (anti-duplication)
const findFileByBasename = (tree: FileSystem, filename: string, currentPath: string = ''): string | null => {
  for (const [name, entry] of Object.entries(tree || {})) {
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    if (entry.file && name === filename) return fullPath;
    if (entry.directory) {
      const found = findFileByBasename(entry.directory, filename, fullPath);
      if (found) return found;
    }
  }
  return null;
};

const flattenFileSystem = (tree: FileSystem, currentPath: string = ''): ProjectFile[] => {
  const out: ProjectFile[] = [];

  for (const [name, entry] of Object.entries(tree || {})) {
    const nextPath = currentPath ? `${currentPath}/${name}` : name;

    if (entry.file) {
      out.push({
        name,
        path: nextPath,
        content: entry.file.contents || ''
      });
    }

    if (entry.directory) {
      out.push(...flattenFileSystem(entry.directory, nextPath));
    }
  }

  return out;
};

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

  const isAmbiguousScriptExt = ext === 'js' || ext === 'ts';
  if (isAmbiguousScriptExt && !hasBackendHint && !BACKEND_FILES.has(fileName)) {
    return 'frontend';
  }

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
  if (lower.endsWith('.svg')) {
    if (lower.startsWith('frontend/src/assets/icons/')) return cleaned;
    const fileName = cleaned.split('/').pop() || 'icon.svg';
    return `frontend/src/assets/icons/${fileName}`;
  }

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

const removeFileSystemEntry = (tree: FileSystem, rawPath: string): FileSystem => {
  const resolvedPath = normalizePath(rawPath);
  if (!resolvedPath) return tree;

  const segments = resolvedPath.split('/');

  const removeAt = (node: FileSystem, index: number): FileSystem => {
    const name = segments[index];
    if (!name || !node[name]) return node;

    if (index === segments.length - 1) {
      const next = { ...node };
      delete next[name];
      return next;
    }

    const dir = node[name]?.directory;
    if (!dir) return node;

    const updatedDir = removeAt(dir, index + 1);
    const next = { ...node };

    if (Object.keys(updatedDir).length === 0 && !node[name]?.file) {
      delete next[name];
      return next;
    }

    next[name] = {
      ...(node[name]?.file ? { file: node[name].file } : {}),
      directory: updatedDir
    };
    return next;
  };

  return removeAt(tree, 0);
};

const findFileContentByPath = (tree: FileSystem, rawPath: string): string => {
  const resolvedPath = normalizePath(rawPath);
  if (!resolvedPath) return '';
  const segments = resolvedPath.split('/');
  let node: any = tree;
  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    const entry = node?.[name];
    if (!entry) return '';
    if (i === segments.length - 1) return entry?.file?.contents || '';
    if (!entry.directory) return '';
    node = entry.directory;
  }
  return '';
};

const moveFileSystemEntry = (tree: FileSystem, fromPath: string, toPath: string): FileSystem => {
  const content = findFileContentByPath(tree, fromPath);
  if (!content && !checkFileExists(tree, fromPath)) return tree;
  const withoutSource = removeFileSystemEntry(tree, fromPath);
  return upsertFileSystemEntry(withoutSource, toPath, content);
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
  projectType: 'FRONTEND_ONLY',
  selectedFeatures: [],
  customFeatureTags: [],
  constraintsEnforcement: 'hard',
  architectMode: true,
  multiAgentEnabled: false,
  lastPlannedPrompt: '',
  chatHistory: [],
  decisionTrace: '',
  streamText: '',
  lastTokenAt: 0,
  lastActiveTimestamp: Date.now(),
  executionPhase: 'idle',
  executionBudget: 5,
  lastSuccessfulFile: null,
  lastSuccessfulLine: 0,
  completedFiles: [],
  modelMode: 'thinking',
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
  currentSessionId: null,
  contextBudget: DEFAULT_CONTEXT_BUDGET,
  compressionSnapshot: DEFAULT_COMPRESSION_SNAPSHOT,
  brainEvents: [],
  analysisReport: null,
  policyViolations: [],
  blockedReason: null
});

const initialState: AIStoreState = buildInitialState();

export const useAIStore = createWithEqualityFn<AIState>()(
  persist(
    (set, get) => {
      let sessionSaveTimer: number | null = null;

      const scheduleSessionSave = (delay = 900) => {
        if (typeof window === 'undefined') return;
        if (sessionSaveTimer) window.clearTimeout(sessionSaveTimer);
        sessionSaveTimer = window.setTimeout(() => {
          sessionSaveTimer = null;
          get().saveCurrentSession();
        }, delay);
      };

      return {
        ...initialState,

        setPrompt: (prompt) => set({ prompt }),

        setPlan: (plan) => {
          set({ plan });
          scheduleSessionSave();
        },

        setPlanSteps: (steps) => {
          set({ planSteps: steps });
          scheduleSessionSave();
        },

        setPlanStepCompleted: (id, completed) => {
          set((state) => ({
            planSteps: state.planSteps.map((step) =>
              step.id === id ? { ...step, completed } : step
            )
          }));
          scheduleSessionSave();
        },

        clearPlanSteps: () => {
          set({ planSteps: [] });
          scheduleSessionSave();
        },

        setProjectType: (type) => {
          set({ projectType: type });
          scheduleSessionSave();
        },

        setSelectedFeatures: (features) => {
          set({ selectedFeatures: features });
          scheduleSessionSave();
        },

        setCustomFeatureTags: (tags) => {
          set({ customFeatureTags: tags });
          scheduleSessionSave();
        },

        setConstraintsEnforcement: (mode) => {
          set({ constraintsEnforcement: mode });
          scheduleSessionSave();
        },

        setArchitectMode: (enabled) => {
          set({ architectMode: enabled });
          scheduleSessionSave();
        },

        setMultiAgentEnabled: (enabled) => {
          set({ multiAgentEnabled: Boolean(enabled) });
          scheduleSessionSave();
        },

        setLastPlannedPrompt: (prompt) => {
          set({ lastPlannedPrompt: prompt });
          scheduleSessionSave();
        },

        setChatHistory: (history) => {
          set((state) => ({
            chatHistory: history,
            contextBudget: calculateContextBudget(history, normalizeFileSystem(state.files))
          }));
          scheduleSessionSave();
        },

        addChatMessage: (message) => {
          set((state) => {
            // dedup: skip if last message has same signature
            if (message.signature && state.chatHistory.length > 0) {
              const last = state.chatHistory[state.chatHistory.length - 1];
              if (last.signature === message.signature) return {};
            }
            const updatedHistory = [...state.chatHistory, message];
            // emergency localStorage snapshot (last 50 messages)
            try {
              window.localStorage.setItem('apex-chat-snapshot', JSON.stringify(updatedHistory.slice(-50)));
            } catch { /* ignore storage issues */ }
            return {
              chatHistory: updatedHistory,
              contextBudget: calculateContextBudget(updatedHistory, normalizeFileSystem(state.files))
            };
          });
          scheduleSessionSave();
        },

        clearChatHistory: () => {
          set({ chatHistory: [] });
          scheduleSessionSave();
        },

        setInteractionMode: (mode) => set({ interactionMode: mode }),

      generatePlan: async (promptOverride?: string, abortSignal?: AbortSignal) => {
        const prompt = (promptOverride ?? get().prompt ?? '').trim();
        if (!prompt) return;

        set({ isPlanning: true, error: null });
        try {
          const thinkingMode = get().modelMode === 'thinking';
          const projectType = get().projectType;
          const constraints = {
            projectMode: 'FRONTEND_ONLY' as const,
            selectedFeatures: get().selectedFeatures,
            customFeatureTags: get().customFeatureTags,
            enforcement: 'hard' as const,
            qualityGateMode: 'strict' as const,
            siteArchitectureMode: 'adaptive_multi_page' as const,
            fileControlMode: 'safe_full' as const,
            contextIntelligenceMode: 'strict_full' as const,
            analysisMode: 'strict_full' as const,
            touchBudgetMode: 'minimal' as const,
            postProcessMode: 'safety_only' as const,
            minContextConfidence: 80
          };
          const data = await aiService.generatePlan(
            prompt,
            thinkingMode,
            abortSignal,
            projectType,
            constraints,
            get().architectMode,
            get().multiAgentEnabled
          );
          const rawSteps: any[] = Array.isArray(data?.steps) ? data.steps : [];

          const planSteps: PlanStep[] = rawSteps
            .map((s, i) => ({
              id: String(s?.id ?? i + 1),
              title: String(s?.title ?? s?.text ?? s?.step ?? '').trim(),
              description: String(s?.description ?? ''),
              completed: false,
              status: 'pending' as const,
              category: normalizePlanCategory(s?.category, s?.title ?? s?.text ?? s?.step ?? '', Array.isArray(s?.files) ? s.files : []),
              files: Array.isArray(s?.files) ? s.files : [],
              estimatedSize: (s?.estimatedSize || 'medium') as PlanStep['estimatedSize'],
              depends_on: Array.isArray(s?.depends_on) ? s.depends_on : []
            }))
            .filter((s) => s.title.length > 0);

          if (planSteps.length === 0) {
            throw new Error('PLAN_EMPTY: Planner returned no executable steps.');
          }

          set({ planSteps, lastPlannedPrompt: prompt, plan: data?.title || 'Architecture Plan' });
          scheduleSessionSave();
          
          const project = useProjectStore.getState();
          if (typeof data?.stack === 'string' && data.stack.trim().length > 0) {
            project.setStack(data.stack);
          }
          if (typeof data?.description === 'string' && data.description.trim().length > 0) {
            project.setDescription(data.description);
          }
          const autoNameSource =
            typeof data?.title === 'string' && data.title.trim().length > 0
              ? data.title
              : prompt;
          const autoName = autoNameSource
            .slice(0, 50)
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '');
          if (autoName) {
            project.setProjectName(data.title || autoName);
          } else if (data.title) {
            project.setProjectName(data.title);
          }
          if (Array.isArray(data?.fileTree) && data.fileTree.length > 0) {
            project.setFileStructure(
              data.fileTree.map((p: string) => ({ path: p, type: 'file' as const }))
            );
          }
        } catch (err: any) {
          if (err?.abortedByUser || err?.message === 'ABORTED_BY_USER' || err?.name === 'AbortError') {
            set({ error: null });
            throw err;
          }

          const message = err?.message || 'Failed to generate plan';
          set({ error: message, plan: '', planSteps: [], lastPlannedPrompt: '' });
          throw (err instanceof Error ? err : new Error(message));
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

      addBrainEvent: (event) =>
        set((state) => {
          const next: BrainEvent = {
            id: String(event.id || `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
            ts: Number(event.ts || Date.now()),
            source: event.source,
            level: event.level,
            message: event.message,
            path: event.path,
            phase: event.phase
          };
          const merged = [...state.brainEvents, next];
          return {
            brainEvents: merged.length > MAX_BRAIN_EVENTS ? merged.slice(merged.length - MAX_BRAIN_EVENTS) : merged
          };
        }),

      clearBrainEvents: () => set({ brainEvents: [] }),

      setAnalysisReport: (report) => set({ analysisReport: report }),

      setPolicyViolations: (issues) => set({ policyViolations: Array.from(new Set((issues || []).map((item) => String(item || '').trim()).filter(Boolean))) }),

      addPolicyViolation: (issue) =>
        set((state) => {
          const normalized = String(issue || '').trim();
          if (!normalized) return state;
          if (state.policyViolations.includes(normalized)) return state;
          return { policyViolations: [...state.policyViolations, normalized] };
        }),

      clearPolicyViolations: () => set({ policyViolations: [] }),

      setBlockedReason: (reason) => set({ blockedReason: reason ? String(reason) : null }),

  verifyIntegrity: () => {
    const { fileStatuses } = get();
    const broken = Object.entries(fileStatuses).filter(
      ([_, status]) => status === 'partial' || status === 'compromised'
    );
    return {
      isSecure: broken.length === 0,
      brokenFiles: broken.map(([path]) => path)
    };
  },

  setSections: (sections) => set({ sections }),

      setModelMode: (mode) => set({ modelMode: normalizeModelMode(mode) }),

      setIsGenerating: (isGenerating) => set({ isGenerating }),

      setIsPlanning: (isPlanning) => set({ isPlanning }),

      appendThinkingContent: (chunk) =>
        set((state) => ({
          thinkingContent: (() => {
            const next = state.thinkingContent + chunk;
            if (next.length <= MAX_THINKING_CHARS) return next;
            return next.slice(next.length - MAX_THINKING_CHARS);
          })()
        })),

      clearThinkingContent: () => set({ thinkingContent: '' }),

      appendSystemConsoleContent: (chunk) =>
        set((state) => ({
          systemConsoleContent: (() => {
            const next = state.systemConsoleContent + chunk;
            if (next.length <= MAX_CONSOLE_CHARS) return next;
            return next.slice(next.length - MAX_CONSOLE_CHARS);
          })()
        })),

      clearSystemConsoleContent: () => set({ systemConsoleContent: '' }),

      setGenerationStatus: (status) => set({ generationStatus: status }),

      setError: (error) => set({ error }),

      setIsPreviewOpen: (open) => set({ isPreviewOpen: open }),

      setFiles: (files) => {
        set((state) => {
          const normalized = normalizeFileSystem(files);
          return {
            files,
            contextBudget: calculateContextBudget(state.chatHistory, normalized)
          };
        });
        scheduleSessionSave();
      },

      resetFiles: () => {
        set((state) => ({
          files: createInitialFiles(),
          contextBudget: calculateContextBudget(state.chatHistory, {})
        }));
        scheduleSessionSave();
      },

      resolveFilePath: (path) => normalizePath(path),

      upsertFileNode: (path, content) => {
        set((state) => ({
          files: upsertFileSystemEntry(normalizeFileSystem(state.files), path, content)
        }));
        scheduleSessionSave(700);
      },

      upsertDirectoryNode: (path) => {
        set((state) => ({
          files: upsertDirectoryEntry(normalizeFileSystem(state.files), path)
        }));
        scheduleSessionSave(700);
      },

      appendToFileNode: (path, chunk) => {
        set((state) => ({
          files: appendToFileSystemEntry(normalizeFileSystem(state.files), path, chunk)
        }));
        scheduleSessionSave(1200);
      },

      handleFileEvent: (event) => {
        const type = event.type;
        let path = event.path;
        const state = get();

        if (type === 'delete') {
          set((current) => ({
            files: removeFileSystemEntry(normalizeFileSystem(current.files), path),
            writingFilePath: current.writingFilePath === path ? null : current.writingFilePath
          }));
          get().setFileStatus(path, 'ready');
          scheduleSessionSave(350);
          return;
        }

        if (type === 'move') {
          const toPath = event.toPath;
          if (!toPath) return;
          set((current) => ({
            files: moveFileSystemEntry(normalizeFileSystem(current.files), path, toPath),
            writingFilePath: current.writingFilePath === path ? toPath : current.writingFilePath
          }));
          get().setFileStatus(path, 'ready');
          get().setFileStatus(toPath, 'ready');
          scheduleSessionSave(350);
          return;
        }

        const chunk = event.type === 'chunk' ? event.chunk : undefined;
        const partial = event.type === 'end' ? event.partial : undefined;
        const mode = event.type === 'start' ? event.mode : undefined;
        
        if (type === 'start') {
           // Anti-duplication Logic
           const files = normalizeFileSystem(state.files);
           const basename = path.split('/').pop() || '';
           const exactExists = checkFileExists(files, path);
           
           if (!exactExists && mode === 'create') {
              const existing = findFileByBasename(files, basename);
              if (existing) {
                 console.log(`[Anti-Duplication] Redirecting ${path} to ${existing}`);
                 path = existing;
              }
           }

          set({ writingFilePath: path });
          get().setFileStatus(path, 'writing');
          // Always clear the file before streaming new content.
          // The AI always outputs the FULL updated file contents (never a diff),
          // so both 'create' and 'edit' modes must start from an empty slate.
          // The only exception is append=true which is used for resume streaming.
          if (!event.append) {
             get().upsertFileNode(path, '');
          }
        } else if (type === 'chunk' && chunk) {
          const targetPath = state.writingFilePath || path;
          get().appendToFileNode(targetPath, chunk);
        } else if (type === 'end') {
          const targetPath = state.writingFilePath || path;
          set({ writingFilePath: null });
          
          if (partial) {
             // Handle partial file - REPAIR IT
             get().setFileStatus(targetPath, 'partial');
             
             // Get current content
             const files = normalizeFileSystem(get().files);
             // Helper to find file content
             const findContent = (tree: FileSystem, p: string): string => {
                const parts = p.split('/');
                let node: any = tree;
                for (const part of parts) {
                   if (node[part]?.directory) node = node[part].directory;
                   else if (node[part]?.file) return node[part].file.contents;
                   else return '';
                }
                return '';
             };
            
             const currentContent = findContent(files, targetPath);
             const repaired = repairTruncatedContent(currentContent, targetPath, {
                isKnownPartial: true,
                allowAggressiveFixes: false
             });
             
             if (repaired !== currentContent) {
                get().upsertFileNode(targetPath, repaired);
                // Mark as compromised but repaired
                get().setFileStatus(targetPath, 'compromised'); 
             }
          } else {
             get().setFileStatus(targetPath, 'ready');
             get().addCompletedFile(targetPath);
             get().setExecutionCursor(targetPath, event.line || 0);
          }
          scheduleSessionSave(350);
        }
      },

      setFilesFromProjectFiles: (projectFiles) => {
        set((state) => {
          const tree = buildTreeFromProjectFiles(projectFiles);
          return {
            files: tree,
            contextBudget: calculateContextBudget(state.chatHistory, tree)
          };
        });
        scheduleSessionSave(900);
      },

      saveCurrentSession: () => {
        const state = get();
        const projectStore = useProjectStore.getState();
        const projectFiles = projectStore.files;
        const projectName = projectStore.projectName || '';
        const stack = projectStore.stack || '';
        const description = projectStore.description || '';
        const activeFile = projectStore.activeFile || null;
        const fileStructure = projectStore.fileStructure || [];

        const projectBytes = projectFiles.reduce((acc, f) => acc + (f.content ? f.content.length : 0), 0);
        const shouldSnapshotFileContents = projectFiles.length > 0 && projectBytes <= 700_000 && projectFiles.length <= 120;

        const snapshotFiles = shouldSnapshotFileContents
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

        // Generate a stable ID for this conversation instance only.
        // Do not merge by project name so multiple chats with same name remain distinct.
        const sanitizedName = projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 50) || 'untitled';
        
        // Keep writing to the current session when available; otherwise create a new one.
        let sessionId = state.currentSessionId;
        if (!sessionId) {
          const canCreateSession =
            state.chatHistory.length > 0 ||
            state.planSteps.length > 0 ||
            state.plan.trim().length > 0 ||
            state.lastPlannedPrompt.trim().length > 0 ||
            projectName.trim().length > 0;
          if (!canCreateSession) return;
          sessionId = `project-${sanitizedName}-${Date.now()}`;
        }

        const titleSource = projectName || state.lastPlannedPrompt || state.prompt || 'Untitled Session';
        
        const contextBudget = calculateContextBudget(state.chatHistory, snapshotFiles);
        const contextSize = contextBudget.usedChars;
        const compressed = compressChatHistoryHierarchical(state.chatHistory, state.compressionSnapshot);
        const activeModelProfile = getActiveModelProfile();
        const fullChatHistory = state.chatHistory.map((message) => ({ ...message }));
        
        const existingSession = state.history.find(s => s.id === sessionId);
        const createdAt = existingSession?.createdAt || Date.now();

        const snapshot: HistorySession = {
          id: sessionId,
          createdAt,
          updatedAt: Date.now(),
          title: titleSource.slice(0, 60),
          projectName,
          projectType: state.projectType,
          selectedFeatures: [...state.selectedFeatures],
          customFeatureTags: [...state.customFeatureTags],
          constraintsEnforcement: state.constraintsEnforcement,
          files: cloneFileSystem(snapshotFiles),
          fileStructure: fileStructure.map((entry) => ({ ...entry })),
          projectFiles: shouldSnapshotFileContents ? projectFiles.map((f) => ({ ...f })) : undefined,
          stack,
          description,
          activeFile,
          chatHistory: fullChatHistory,
          plan: state.plan,
          planSteps: state.planSteps.map((step) => ({ ...step })),
          contextSize,
          contextBudget,
          compressionSnapshot: compressed.snapshot,
          activeModelProfile,
          multiAgentEnabled: state.multiAgentEnabled,
          executionPhase: state.executionPhase,
          writingFilePath: state.writingFilePath,
          fileStatuses: { ...state.fileStatuses },
          completedFiles: [...state.completedFiles],
          lastSuccessfulFile: state.lastSuccessfulFile,
          lastSuccessfulLine: state.lastSuccessfulLine
        };

        // Always move latest snapshot to the top so history ordering stays consistent.
        const remaining = state.history.filter((s) => s.id !== sessionId);
        const nextHistory = [snapshot, ...remaining];
        set({ history: nextHistory.slice(0, MAX_HISTORY_SESSIONS), currentSessionId: sessionId });

        // Persist the session to IndexedDB (non-blocking).
        try {
          const storedProjectFiles = projectFiles.length > 0
            ? projectFiles
            : flattenFileSystem(snapshotFiles);
          const normalizedFileStructure = fileStructure.length > 0
            ? fileStructure
            : storedProjectFiles.map((f) => ({ path: f.path || f.name, type: 'file' as const }));

          const stored: StoredHistorySession = {
            id: snapshot.id,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            title: snapshot.title,
            projectName,
            projectType: snapshot.projectType,
            selectedFeatures: snapshot.selectedFeatures,
            customFeatureTags: snapshot.customFeatureTags,
            constraintsEnforcement: snapshot.constraintsEnforcement,
            stack,
            description,
            activeFile,
            fileStructure: normalizedFileStructure,
            projectFiles: storedProjectFiles.map((f) => ({
              name: f.name,
              path: f.path,
              content: f.content,
              language: f.language
            })),
            chatHistory: snapshot.chatHistory.map((m) => ({ role: m.role, content: m.content })),
            plan: snapshot.plan,
            planSteps: snapshot.planSteps.map((s) => ({
              id: s.id,
              title: s.title,
              completed: s.completed,
              category: s.category as any,
              status: s.status,
              files: s.files,
              description: s.description,
              estimatedSize: s.estimatedSize,
              depends_on: s.depends_on
            })),
            contextSize: snapshot.contextSize,
            contextBudget: snapshot.contextBudget,
            compressionSnapshot: snapshot.compressionSnapshot,
            activeModelProfile: snapshot.activeModelProfile,
            executionPhase: snapshot.executionPhase,
            writingFilePath: snapshot.writingFilePath,
            fileStatuses: snapshot.fileStatuses || {},
            completedFiles: Array.isArray(snapshot.completedFiles) ? snapshot.completedFiles : [],
            lastSuccessfulFile: snapshot.lastSuccessfulFile || null,
            lastSuccessfulLine: Number(snapshot.lastSuccessfulLine || 0)
          };
          void saveSessionToDisk(stored).catch(() => undefined);

          if (typeof window !== 'undefined') {
            const emergencyPayload = {
              id: snapshot.id,
              createdAt: snapshot.createdAt,
              updatedAt: snapshot.updatedAt,
              title: snapshot.title,
              projectName: snapshot.projectName,
              projectType: snapshot.projectType,
              selectedFeatures: snapshot.selectedFeatures,
              customFeatureTags: snapshot.customFeatureTags,
              constraintsEnforcement: snapshot.constraintsEnforcement,
              stack: snapshot.stack,
              description: snapshot.description,
              activeFile: snapshot.activeFile,
              chatHistory: snapshot.chatHistory,
              plan: snapshot.plan,
              planSteps: snapshot.planSteps,
              contextBudget: snapshot.contextBudget,
              compressionSnapshot: snapshot.compressionSnapshot,
              activeModelProfile: snapshot.activeModelProfile,
              multiAgentEnabled: state.multiAgentEnabled,
              executionPhase: snapshot.executionPhase,
              writingFilePath: snapshot.writingFilePath,
              fileStatuses: snapshot.fileStatuses || {},
              completedFiles: snapshot.completedFiles || [],
              lastSuccessfulFile: snapshot.lastSuccessfulFile || null,
              lastSuccessfulLine: Number(snapshot.lastSuccessfulLine || 0)
            };
            window.localStorage.setItem(AI_EMERGENCY_SESSION_KEY, JSON.stringify(emergencyPayload));
          }
        } catch {
          // ignore persistence errors
        }

        set({
          contextBudget,
          compressionSnapshot: compressed.snapshot
        });
      },

      hydrateHistoryFromDisk: async () => {
        if (typeof window === 'undefined') return;
        try {
          const stored = await loadSessionsFromDisk(MAX_HISTORY_SESSIONS).catch(() => []);
          if (!Array.isArray(stored) || stored.length === 0) {
            const emergency = readEmergencySession();
            if (!emergency?.id) return;
            const projectStore = useProjectStore.getState();
            const emergencyProjectFiles = Array.isArray(projectStore.files) ? projectStore.files : [];
            const recovered: HistorySession = {
              id: emergency.id,
              createdAt: Number(emergency.createdAt || Date.now()),
              updatedAt: Number(emergency.updatedAt || Date.now()),
              title: String(emergency.title || 'Recovered Session'),
              projectName: String(emergency.projectName || ''),
              projectType: coerceProjectType(emergency.projectType),
              selectedFeatures: Array.isArray(emergency.selectedFeatures) ? emergency.selectedFeatures : [],
              customFeatureTags: Array.isArray(emergency.customFeatureTags) ? emergency.customFeatureTags : [],
              constraintsEnforcement: 'hard',
              files: buildTreeFromProjectFiles(emergencyProjectFiles),
              fileStructure: projectStore.fileStructure || [],
              projectFiles: emergencyProjectFiles,
              stack: String(emergency.stack || ''),
              description: String(emergency.description || ''),
              activeFile: emergency.activeFile || null,
              chatHistory: Array.isArray(emergency.chatHistory) ? emergency.chatHistory.map((msg) => ({ ...msg })) : [],
              plan: String(emergency.plan || ''),
              planSteps: Array.isArray(emergency.planSteps) ? emergency.planSteps.map((step: any) => ({ ...step })) : [],
              contextSize: Number(emergency.contextBudget?.usedChars || 0),
              contextBudget: emergency.contextBudget || DEFAULT_CONTEXT_BUDGET,
              compressionSnapshot: emergency.compressionSnapshot || DEFAULT_COMPRESSION_SNAPSHOT,
              activeModelProfile: emergency.activeModelProfile || getActiveModelProfile(),
              multiAgentEnabled: Boolean((emergency as any)?.multiAgentEnabled),
              executionPhase: coerceExecutionPhase(emergency.executionPhase),
              writingFilePath: emergency.writingFilePath || null,
              fileStatuses:
                emergency.fileStatuses && typeof emergency.fileStatuses === 'object'
                  ? (emergency.fileStatuses as Record<string, FileStreamStatus>)
                  : {},
              completedFiles: Array.isArray(emergency.completedFiles) ? emergency.completedFiles : [],
              lastSuccessfulFile: emergency.lastSuccessfulFile || null,
              lastSuccessfulLine: Number(emergency.lastSuccessfulLine || 0)
            };
            set((prev) => ({
              history: [recovered, ...prev.history].slice(0, MAX_HISTORY_SESSIONS),
              currentSessionId: prev.currentSessionId || null
            }));
            return;
          }

          const sessions: HistorySession[] = stored.map((s) => ({
            id: s.id,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            title: s.title,
            projectName: s.projectName,
            projectType: coerceProjectType(s.projectType),
            selectedFeatures: Array.isArray(s.selectedFeatures) ? s.selectedFeatures : [],
            customFeatureTags: Array.isArray(s.customFeatureTags) ? s.customFeatureTags : [],
            constraintsEnforcement: s.constraintsEnforcement || 'hard',
            stack: s.stack,
            description: s.description,
            activeFile: s.activeFile,
            fileStructure: Array.isArray(s.fileStructure) ? s.fileStructure : [],
            projectFiles: Array.isArray(s.projectFiles) ? s.projectFiles : [],
            files: buildTreeFromProjectFiles(Array.isArray(s.projectFiles) ? s.projectFiles : []),
            chatHistory: Array.isArray(s.chatHistory) ? s.chatHistory.map((m) => ({ role: m.role as any, content: m.content })) : [],
            plan: s.plan || '',
            planSteps: Array.isArray(s.planSteps)
              ? s.planSteps.map((p) => ({
                  id: p.id,
                  title: p.title,
                  description: p.description || '',
                  completed: Boolean(p.completed),
                  category: normalizePlanCategory(p.category, p.title, Array.isArray(p.files) ? p.files : []),
                  status: (p.status || 'pending') as PlanStep['status'],
                  files: Array.isArray(p.files) ? p.files : [],
                  estimatedSize: (p.estimatedSize || 'medium') as PlanStep['estimatedSize'],
                  depends_on: Array.isArray(p.depends_on) ? p.depends_on : []
                }))
              : [],
            contextSize: Number(s.contextSize || 0),
            contextBudget: s.contextBudget || DEFAULT_CONTEXT_BUDGET,
            compressionSnapshot: s.compressionSnapshot || DEFAULT_COMPRESSION_SNAPSHOT,
            activeModelProfile: s.activeModelProfile || getActiveModelProfile(),
            multiAgentEnabled: Boolean((s as any)?.multiAgentEnabled),
            executionPhase: coerceExecutionPhase(s.executionPhase),
            writingFilePath: s.writingFilePath || null,
            fileStatuses:
              s.fileStatuses && typeof s.fileStatuses === 'object'
                ? (s.fileStatuses as Record<string, FileStreamStatus>)
                : {},
            completedFiles: Array.isArray(s.completedFiles) ? s.completedFiles : [],
            lastSuccessfulFile: s.lastSuccessfulFile || null,
            lastSuccessfulLine: Number(s.lastSuccessfulLine || 0)
          }));

          set((prev) => ({
            history: sessions.slice(0, MAX_HISTORY_SESSIONS),
            currentSessionId: prev.currentSessionId || null
          }));
        } catch {
          // ignore
        }
      },

      restoreSession: (sessionId) => {
        const session = get().history.find((item) => item.id === sessionId);
        if (!session) return;

        const projectStore = useProjectStore.getState();
        const projectFiles =
          Array.isArray(session.projectFiles) && session.projectFiles.length > 0
            ? session.projectFiles
            : flattenFileSystem(session.files);

        if (session.projectName) projectStore.setProjectName(session.projectName);
        if (session.projectType) projectStore.setProjectType(session.projectType);
        projectStore.setSelectedFeatures(Array.isArray(session.selectedFeatures) ? session.selectedFeatures : []);
        projectStore.setCustomFeatureTags(Array.isArray(session.customFeatureTags) ? session.customFeatureTags : []);
        projectStore.setConstraintsEnforcement(session.constraintsEnforcement || 'hard');
        if (typeof session.stack === 'string') projectStore.setStack(session.stack);
        if (typeof session.description === 'string') projectStore.setDescription(session.description);
        projectStore.setFiles(projectFiles);
        projectStore.setFileStructure(
          Array.isArray(session.fileStructure) && session.fileStructure.length > 0
            ? session.fileStructure
            : projectFiles.map((file) => ({
                path: file.path || file.name,
                type: 'file' as const
              }))
        );

        const nextActive = session.activeFile || projectFiles[0]?.path || projectFiles[0]?.name || null;
        if (nextActive) projectStore.setActiveFile(nextActive);

        set({
          projectType: coerceProjectType(session.projectType),
          selectedFeatures: Array.isArray(session.selectedFeatures) ? session.selectedFeatures : [],
          customFeatureTags: Array.isArray(session.customFeatureTags) ? session.customFeatureTags : [],
          constraintsEnforcement: session.constraintsEnforcement || 'hard',
          multiAgentEnabled: Boolean(session.multiAgentEnabled),
          files: cloneFileSystem(session.files),
          chatHistory: (() => {
            const hist = session.chatHistory.map((msg) => ({ ...msg }));
            if (hist.length > 0) return hist;
            // Fallback: restore from emergency localStorage snapshot
            try {
              const snap = window.localStorage.getItem('apex-chat-snapshot');
              if (snap) {
                const parsed = JSON.parse(snap);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
              }
            } catch { /* ignore */ }
            return hist;
          })(),
          plan: session.plan,
          planSteps: session.planSteps.map((step) => ({ ...step })),
          prompt: '',
          lastPlannedPrompt: '',
          decisionTrace: '',
          streamText: '',
          thinkingContent: '',
          systemConsoleContent: '',
          fileStatuses:
            session.fileStatuses && typeof session.fileStatuses === 'object'
              ? { ...session.fileStatuses }
              : {},
          writingFilePath: session.writingFilePath || null,
          sections: {},
          isGenerating: false,
          isPlanning: false,
          executionPhase: coerceExecutionPhase(session.executionPhase),
          completedFiles: Array.isArray(session.completedFiles) ? session.completedFiles : [],
          lastSuccessfulFile: session.lastSuccessfulFile || null,
          lastSuccessfulLine: Number(session.lastSuccessfulLine || 0),
          generationStatus: {
            isGenerating: false,
            currentStep: 'idle' as const,
            progress: 0
          },
          error: null,
          isPreviewOpen: false,
          currentSessionId: sessionId,
          contextBudget: session.contextBudget || DEFAULT_CONTEXT_BUDGET,
          compressionSnapshot: session.compressionSnapshot || DEFAULT_COMPRESSION_SNAPSHOT,
          brainEvents: [],
          analysisReport: null,
          policyViolations: [],
          blockedReason: null
        });
      },

      startNewChat: () => {
         get().saveCurrentSession();
         if (typeof window !== 'undefined') {
           try {
             window.localStorage.setItem(AI_NEW_CHAT_GUARD_KEY, String(Date.now()));
           } catch {
             // ignore
           }
         }

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
          executionPhase: 'idle',
          completedFiles: [],
          lastSuccessfulFile: null,
          lastSuccessfulLine: 0,
          generationStatus: {
            isGenerating: false,
            currentStep: 'idle' as const,
            progress: 0
          },
          error: null,
          isPreviewOpen: false,
          interactionMode: 'create',
          currentSessionId: null,
          contextBudget: DEFAULT_CONTEXT_BUDGET,
          compressionSnapshot: DEFAULT_COMPRESSION_SNAPSHOT,
          brainEvents: [],
          analysisReport: null,
          policyViolations: [],
          blockedReason: null
         });

         // Clear persisted workspace before reload so "New Chat" doesn't restore old files.
         void useProjectStore.getState().clearDisk();
         try {
           void (window as any).__APEX_WORKSPACE_PERSIST__?.flush?.();
           window.localStorage.removeItem(AI_EMERGENCY_SESSION_KEY);
         } catch {
           // ignore
         }

         useProjectStore.getState().reset();
       },

      reset: () => set(buildInitialState()),

      setExecutionPhase: (phase) => {
        set({ executionPhase: phase });
        scheduleSessionSave(600);
      },
      
      setExecutionCursor: (file, line) => {
        set({ lastSuccessfulFile: file, lastSuccessfulLine: line });
        scheduleSessionSave(500);
      },
      
      addCompletedFile: (path) => {
        set((state) => ({ 
          completedFiles: state.completedFiles.includes(path) ? state.completedFiles : [...state.completedFiles, path] 
        }));
        scheduleSessionSave(500);
      },
      
      touchSession: () => set({ lastActiveTimestamp: Date.now() }),
      
      recoverSession: () => {
        const state = get();
        const now = Date.now();
        // If generating but silent for > 30s, or just rehydrated in a stuck state
        if (state.isGenerating || state.executionPhase === 'executing' || state.executionPhase === 'planning') {
           const silence = now - state.lastTokenAt;
           if (silence > 10000) { // 10s grace
              set({ 
                 isGenerating: false, 
                 executionPhase: 'interrupted',
                 error: 'Session restored from interruption. Please check partial files.'
              });
           }
        }
      }
    };
  },
    {
      name: 'apex-ai-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        prompt: state.prompt,
        plan: state.plan,
        planSteps: state.planSteps,
        lastPlannedPrompt: state.lastPlannedPrompt,
        projectType: state.projectType,
        selectedFeatures: state.selectedFeatures,
        customFeatureTags: state.customFeatureTags,
        constraintsEnforcement: state.constraintsEnforcement,
        architectMode: state.architectMode,
        multiAgentEnabled: state.multiAgentEnabled,
        modelMode: normalizeModelMode(state.modelMode),
        interactionMode: state.interactionMode,
        executionBudget: state.executionBudget,
        executionPhase: state.executionPhase,
        lastTokenAt: state.lastTokenAt,
        lastSuccessfulFile: state.lastSuccessfulFile,
        lastSuccessfulLine: state.lastSuccessfulLine,
        completedFiles: state.completedFiles,
        fileStatuses: state.fileStatuses,
        writingFilePath: state.writingFilePath,
        isPreviewOpen: state.isPreviewOpen,
        currentSessionId: state.currentSessionId,
        contextBudget: state.contextBudget,
        compressionSnapshot: state.compressionSnapshot
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.modelMode === 'super') {
          state.setModelMode('thinking');
        }
        if (state) {
          state.setProjectType(coerceProjectType(state.projectType));
          state.setExecutionPhase(coerceExecutionPhase(state.executionPhase));
          if (typeof state.multiAgentEnabled !== 'boolean') {
            state.setMultiAgentEnabled(false);
          }
        }
        state?.recoverSession();
      }
    }
  )
);

if (typeof window !== 'undefined') {
  const w = window as any;
  if (!w.__APEX_HISTORY_AUTOSAVE_BOUND__) {
    const flushSession = () => {
      try {
        useAIStore.getState().saveCurrentSession();
      } catch {
        // ignore
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSession();
    });
    window.addEventListener('pagehide', flushSession);
    window.addEventListener('beforeunload', flushSession);
    w.__APEX_HISTORY_AUTOSAVE_BOUND__ = true;
  }
}

export const selectContextBudget = (sessionId?: string | null): ContextBudgetState => {
  const state = useAIStore.getState();
  if (!sessionId) return state.contextBudget || DEFAULT_CONTEXT_BUDGET;
  const session = state.history.find((item) => item.id === sessionId);
  return session?.contextBudget || DEFAULT_CONTEXT_BUDGET;
};
