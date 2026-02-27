import type { FileStructure, ProjectFile } from '@/types';
import { DB_NAME, DB_VERSION, SESSIONS_STORE, loadWorkspace, openWorkspaceDb } from '@/utils/workspaceDb';
import type {
  ActiveModelProfile,
  CompressionSnapshot,
  ContextBudgetState,
  MemorySnapshot
} from '@/types/context';
import type { DestructiveSafetyMode, GenerationProfile, TouchBudgetMode } from '@/types/constraints';

type StoredChatRole = 'system' | 'user' | 'assistant';

export type StoredChatMessage = {
  role: StoredChatRole;
  content: string;
};

export type StoredPlanStep = {
  id: string;
  title: string;
  completed: boolean;
  category?: 'config' | 'frontend' | 'backend' | 'integration' | 'testing' | 'deployment' | 'tasks';
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  files?: string[];
  description?: string;
  estimatedSize?: 'small' | 'medium' | 'large';
  depends_on?: string[];
};

export type StoredHistorySession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  projectName: string;
  projectType: 'FRONTEND_ONLY' | null;
  selectedFeatures: string[];
  customFeatureTags: string[];
  constraintsEnforcement: 'hard';
  stack: string;
  description: string;
  activeFile: string | null;
  fileStructure: FileStructure[];
  projectFiles: ProjectFile[];
  chatHistory: StoredChatMessage[];
  plan: string;
  planSteps: StoredPlanStep[];
  contextSize: number;
  contextBudget: ContextBudgetState;
  compressionSnapshot: CompressionSnapshot;
  memorySnapshot?: MemorySnapshot;
  activeModelProfile: ActiveModelProfile;
  generationProfile?: GenerationProfile;
  destructiveSafetyMode?: DestructiveSafetyMode;
  touchBudgetMode?: TouchBudgetMode;
  multiAgentEnabled?: boolean;
  executionPhase?: 'idle' | 'planning' | 'executing' | 'interrupted' | 'completed';
  writingFilePath?: string | null;
  fileStatuses?: Record<string, 'ready' | 'queued' | 'writing' | 'partial' | 'compromised'>;
  completedFiles?: string[];
  lastSuccessfulFile?: string | null;
  lastSuccessfulLine?: number;
};

const MAX_HISTORY_SESSIONS = 120;

const coerceProjectType = (_value: unknown): 'FRONTEND_ONLY' => 'FRONTEND_ONLY';

const coerceExecutionPhase = (value: unknown): StoredHistorySession['executionPhase'] => {
  const phase = String(value || '').trim();
  if (phase === 'planning' || phase === 'executing' || phase === 'interrupted' || phase === 'completed') {
    return phase;
  }
  return 'idle';
};

const coerceGenerationProfile = (value: unknown): GenerationProfile => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'static' || normalized === 'framework') return normalized;
  return 'auto';
};

const coerceDestructiveSafetyMode = (value: unknown): DestructiveSafetyMode => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'manual_confirm' || normalized === 'no_delete_move') return normalized;
  return 'backup_then_apply';
};

const coerceTouchBudgetMode = (value: unknown): TouchBudgetMode => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'minimal') return 'minimal';
  return 'adaptive';
};

const withTx = async <T>(storeNames: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T>) => {
  const db = await openWorkspaceDb();
  const tx = db.transaction(storeNames, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const result = await fn(tx);
  await done;
  return result;
};

const normalizeSession = (raw: StoredHistorySession): StoredHistorySession => ({
  ...raw,
  projectType: coerceProjectType(raw?.projectType),
  executionPhase: coerceExecutionPhase(raw?.executionPhase),
  generationProfile: coerceGenerationProfile((raw as any)?.generationProfile),
  destructiveSafetyMode: coerceDestructiveSafetyMode((raw as any)?.destructiveSafetyMode),
  touchBudgetMode: coerceTouchBudgetMode((raw as any)?.touchBudgetMode)
});

const pruneSessions = async (store: IDBObjectStore) => {
  const ids: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const req = store.index('by_updatedAt').openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result as IDBCursorWithValue | null;
      if (!cursor) {
        resolve();
        return;
      }
      ids.push(String(cursor.primaryKey || ''));
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  if (ids.length <= MAX_HISTORY_SESSIONS) return;
  for (const id of ids.slice(MAX_HISTORY_SESSIONS)) {
    store.delete(id);
  }
};

export const saveSessionToDisk = async (session: StoredHistorySession) => {
  return withTx([SESSIONS_STORE], 'readwrite', async (tx) => {
    const store = tx.objectStore(SESSIONS_STORE);
    store.put({
      ...session,
      generationProfile: coerceGenerationProfile((session as any).generationProfile),
      destructiveSafetyMode: coerceDestructiveSafetyMode((session as any).destructiveSafetyMode),
      touchBudgetMode: coerceTouchBudgetMode((session as any).touchBudgetMode)
    });
    await pruneSessions(store);
    return;
  });
};

export const loadSessionsFromDisk = async (limit = 40): Promise<StoredHistorySession[]> => {
  return withTx([SESSIONS_STORE], 'readonly', async (tx) => {
    const store = tx.objectStore(SESSIONS_STORE);
    const canUseUpdatedAtIndex = Array.from(store.indexNames).includes('by_updatedAt');

    if (canUseUpdatedAtIndex) {
      try {
        const index = store.index('by_updatedAt');
        const out: StoredHistorySession[] = [];
        return await new Promise<StoredHistorySession[]>((resolve, reject) => {
          const req = index.openCursor(null, 'prev');
          req.onsuccess = () => {
            const cursor = req.result as IDBCursorWithValue | null;
            if (!cursor) return resolve(out);
            const raw = cursor.value as StoredHistorySession;
            out.push(normalizeSession(raw));
            if (out.length >= limit) return resolve(out);
            cursor.continue();
          };
          req.onerror = () => reject(req.error);
        });
      } catch {
        // fallback below
      }
    }

    return new Promise<StoredHistorySession[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (Array.isArray(req.result) ? req.result : []) as StoredHistorySession[];
        const normalized = records.map((record) => normalizeSession(record));
        normalized.sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
        resolve(normalized.slice(0, limit));
      };
      req.onerror = () => reject(req.error);
    });
  });
};

export const deleteSessionFromDisk = async (sessionId: string) => {
  const id = String(sessionId || '').trim();
  if (!id) return;
  return withTx([SESSIONS_STORE], 'readwrite', async (tx) => {
    tx.objectStore(SESSIONS_STORE).delete(id);
    return;
  });
};

export const clearAllSessionsFromDisk = async () => {
  return withTx([SESSIONS_STORE], 'readwrite', async (tx) => {
    tx.objectStore(SESSIONS_STORE).clear();
    return;
  });
};

export const archiveCurrentWorkspaceAsSession = async (
  session: Omit<
    StoredHistorySession,
    | 'projectFiles'
    | 'fileStructure'
    | 'activeFile'
    | 'projectName'
    | 'projectType'
    | 'selectedFeatures'
    | 'customFeatureTags'
    | 'constraintsEnforcement'
    | 'contextBudget'
    | 'compressionSnapshot'
    | 'activeModelProfile'
    | 'stack'
    | 'description'
  >
) => {
  const workspace = await loadWorkspace().catch(() => ({ meta: null as any, files: [] as any[] }));
  const projectFiles: ProjectFile[] = Array.isArray(workspace.files)
    ? workspace.files.map((f: any) => ({
        name: String(f?.name || f?.path || ''),
        path: String(f?.path || f?.name || ''),
        content: String(f?.content || ''),
        language: f?.language
      }))
    : [];

  const meta = workspace.meta || null;
  const record: StoredHistorySession = {
    ...session,
    projectName: String(meta?.projectName || ''),
    projectType: coerceProjectType(meta?.projectType),
    selectedFeatures: Array.isArray(meta?.selectedFeatures) ? meta.selectedFeatures : [],
    customFeatureTags: Array.isArray(meta?.customFeatureTags) ? meta.customFeatureTags : [],
    constraintsEnforcement: (meta?.constraintsEnforcement || 'hard') as 'hard',
    stack: String(meta?.stack || ''),
    description: String(meta?.description || ''),
    activeFile: (meta?.activeFile ?? null) as string | null,
    fileStructure: Array.isArray(meta?.fileStructure) ? meta.fileStructure : [],
    projectFiles,
    contextBudget: {
      maxChars: 160_000,
      maxEstimatedTokens: 32_000,
      usedChars: Number(session.contextSize || 0),
      usedEstimatedTokens: Math.ceil(Number(session.contextSize || 0) / 4),
      utilizationPct: 0,
      status: 'ok'
    },
    compressionSnapshot: {
      level: 0,
      compressedMessagesCount: 0,
      summaryBlocks: [],
      lastCompressedAt: 0
    },
    activeModelProfile: {
      plannerModel: 'planner:auto',
      executorModel: 'executor:auto',
      specialistModels: {}
    },
    generationProfile: coerceGenerationProfile((meta as any)?.generationProfile),
    destructiveSafetyMode: coerceDestructiveSafetyMode((meta as any)?.destructiveSafetyMode),
    touchBudgetMode: coerceTouchBudgetMode((meta as any)?.touchBudgetMode),
    executionPhase: coerceExecutionPhase(session.executionPhase)
  };

  await saveSessionToDisk(record);
  return record;
};

export { DB_NAME, DB_VERSION };
