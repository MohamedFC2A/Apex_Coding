import type { FileStructure, ProjectFile } from '@/types';
import type { DestructiveSafetyMode, GenerationProfile, TouchBudgetMode } from '@/types/constraints';

export type WorkspaceMetaRecord = {
  key: 'current';
  version: 3;
  updatedAt: number;
  projectId: string;
  projectName: string;
  projectType: 'FRONTEND_ONLY' | null;
  selectedFeatures: string[];
  customFeatureTags: string[];
  constraintsEnforcement: 'hard';
  stack: string;
  description: string;
  activeFile: string | null;
  fileStructure: FileStructure[];
  generationProfile: GenerationProfile;
  destructiveSafetyMode: DestructiveSafetyMode;
  touchBudgetMode: TouchBudgetMode;
};

export type WorkspaceFileRecord = {
  path: string;
  name: string;
  content: string;
  language?: string;
  updatedAt: number;
};

export type WorkspaceJournalRecord = {
  id: string;
  updatedAt: number;
  type: 'delta';
  upserts: number;
  deletes: number;
  moves: number;
  hasMetaUpdate: boolean;
};

export type WorkspaceCheckpointRecord = {
  id: string;
  updatedAt: number;
  label: string;
  meta: WorkspaceMetaRecord | null;
  files: WorkspaceFileRecord[];
};

export const DB_NAME = 'apex-coding-workspace';
export const DB_VERSION = 3;
export const META_STORE = 'meta';
export const FILE_STORE = 'files';
export const SESSIONS_STORE = 'sessions';
export const JOURNAL_STORE = 'journals';
export const CHECKPOINT_STORE = 'checkpoints';
export const BACKUPS_STORE = 'backups';

const MAX_JOURNAL_RECORDS = 500;
const MAX_CHECKPOINT_RECORDS = 30;

let dbPromise: Promise<IDBDatabase> | null = null;

const coerceProjectType = (_value: unknown): 'FRONTEND_ONLY' => 'FRONTEND_ONLY';

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

const asPromise = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const ensureIndex = (store: IDBObjectStore, name: string, keyPath: string) => {
  if (!Array.from(store.indexNames).includes(name)) {
    store.createIndex(name, keyPath, { unique: false });
  }
};

const normalizeMeta = (meta: WorkspaceMetaRecord | null | undefined): WorkspaceMetaRecord | null => {
  if (!meta) return null;
  return {
    ...meta,
    version: 3,
    projectType: coerceProjectType(meta.projectType),
    generationProfile: coerceGenerationProfile((meta as any).generationProfile),
    destructiveSafetyMode: coerceDestructiveSafetyMode((meta as any).destructiveSafetyMode),
    touchBudgetMode: coerceTouchBudgetMode((meta as any).touchBudgetMode)
  };
};

export const openWorkspaceDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: 'path' });

      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessions = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        ensureIndex(sessions, 'by_updatedAt', 'updatedAt');
      } else {
        const sessions = req.transaction?.objectStore(SESSIONS_STORE);
        if (sessions) ensureIndex(sessions, 'by_updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains(JOURNAL_STORE)) {
        const journals = db.createObjectStore(JOURNAL_STORE, { keyPath: 'id' });
        ensureIndex(journals, 'by_updatedAt', 'updatedAt');
      } else {
        const journals = req.transaction?.objectStore(JOURNAL_STORE);
        if (journals) ensureIndex(journals, 'by_updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
        const checkpoints = db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'id' });
        ensureIndex(checkpoints, 'by_updatedAt', 'updatedAt');
      } else {
        const checkpoints = req.transaction?.objectStore(CHECKPOINT_STORE);
        if (checkpoints) ensureIndex(checkpoints, 'by_updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains(BACKUPS_STORE)) {
        const backups = db.createObjectStore(BACKUPS_STORE, { keyPath: 'id' });
        ensureIndex(backups, 'by_updatedAt', 'updatedAt');
      } else {
        const backups = req.transaction?.objectStore(BACKUPS_STORE);
        if (backups) ensureIndex(backups, 'by_updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
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

const pruneByUpdatedAt = async (store: IDBObjectStore, maxRecords: number) => {
  const ids: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const index = store.index('by_updatedAt');
    const req = index.openCursor(null, 'prev');
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
  if (ids.length <= maxRecords) return;
  for (const id of ids.slice(maxRecords)) {
    store.delete(id);
  }
};

const addJournalRecord = (tx: IDBTransaction, record: WorkspaceJournalRecord) => {
  tx.objectStore(JOURNAL_STORE).put(record);
};

export const loadWorkspace = async (): Promise<{ meta: WorkspaceMetaRecord | null; files: WorkspaceFileRecord[] }> => {
  return withTx([META_STORE, FILE_STORE], 'readonly', async (tx) => {
    const metaStore = tx.objectStore(META_STORE);
    const fileStore = tx.objectStore(FILE_STORE);

    const meta = await asPromise(metaStore.get('current') as IDBRequest<WorkspaceMetaRecord | undefined>);
    const files = await asPromise(fileStore.getAll() as IDBRequest<WorkspaceFileRecord[]>);
    return {
      meta: normalizeMeta(meta || null),
      files: Array.isArray(files) ? files : []
    };
  });
};

export const applyWorkspaceDelta = async (delta: {
  meta?: Omit<WorkspaceMetaRecord, 'key' | 'version' | 'updatedAt'>;
  upsertFiles?: ProjectFile[];
  deletePaths?: string[];
  movePaths?: Array<{ from: string; to: string }>;
}) => {
  const updatedAt = Date.now();
  return withTx([META_STORE, FILE_STORE, JOURNAL_STORE], 'readwrite', async (tx) => {
    const metaStore = tx.objectStore(META_STORE);
    const fileStore = tx.objectStore(FILE_STORE);
    const journalStore = tx.objectStore(JOURNAL_STORE);
    const upserts = Array.isArray(delta.upsertFiles) ? delta.upsertFiles : [];
    const deletes = Array.isArray(delta.deletePaths) ? delta.deletePaths : [];
    const moves = Array.isArray(delta.movePaths) ? delta.movePaths : [];

    if (delta.meta) {
      const record: WorkspaceMetaRecord = {
        key: 'current',
        version: 3,
        updatedAt,
        projectId: delta.meta.projectId ?? '',
        projectName: delta.meta.projectName ?? '',
        projectType: 'FRONTEND_ONLY',
        selectedFeatures: Array.isArray(delta.meta.selectedFeatures) ? delta.meta.selectedFeatures : [],
        customFeatureTags: Array.isArray(delta.meta.customFeatureTags) ? delta.meta.customFeatureTags : [],
        constraintsEnforcement: delta.meta.constraintsEnforcement ?? 'hard',
        stack: delta.meta.stack ?? '',
        description: delta.meta.description ?? '',
        activeFile: delta.meta.activeFile ?? null,
        fileStructure: Array.isArray(delta.meta.fileStructure) ? delta.meta.fileStructure : [],
        generationProfile: coerceGenerationProfile((delta.meta as any).generationProfile),
        destructiveSafetyMode: coerceDestructiveSafetyMode((delta.meta as any).destructiveSafetyMode),
        touchBudgetMode: coerceTouchBudgetMode((delta.meta as any).touchBudgetMode)
      };
      metaStore.put(record);
    }

    if (upserts.length > 0) {
      for (const f of upserts) {
        const path = String(f.path || f.name || '').trim();
        if (!path) continue;
        const record: WorkspaceFileRecord = {
          path,
          name: f.name || path.split('/').pop() || path,
          content: f.content || '',
          language: f.language,
          updatedAt
        };
        fileStore.put(record);
      }
    }

    if (deletes.length > 0) {
      for (const path of deletes) {
        const cleanPath = String(path || '').trim();
        if (!cleanPath) continue;
        fileStore.delete(cleanPath);
      }
    }

    if (moves.length > 0) {
      for (const op of moves) {
        const from = String(op?.from || '').trim();
        const to = String(op?.to || '').trim();
        if (!from || !to || from === to) continue;

        const existing = await asPromise(fileStore.get(from) as IDBRequest<WorkspaceFileRecord | undefined>);
        if (existing) {
          const movedRecord: WorkspaceFileRecord = {
            ...existing,
            path: to,
            name: to.split('/').pop() || to,
            updatedAt
          };
          fileStore.put(movedRecord);
        }
        fileStore.delete(from);
      }
    }

    addJournalRecord(tx, {
      id: `journal-${updatedAt}-${Math.random().toString(36).slice(2, 8)}`,
      updatedAt,
      type: 'delta',
      upserts: upserts.length,
      deletes: deletes.length,
      moves: moves.length,
      hasMetaUpdate: Boolean(delta.meta)
    });
    await pruneByUpdatedAt(journalStore, MAX_JOURNAL_RECORDS);
    return;
  });
};

export const createWorkspaceCheckpoint = async (label = 'autosave') => {
  const snapshot = await loadWorkspace();
  const updatedAt = Date.now();
  return withTx([CHECKPOINT_STORE], 'readwrite', async (tx) => {
    const checkpointStore = tx.objectStore(CHECKPOINT_STORE);
    const record: WorkspaceCheckpointRecord = {
      id: `checkpoint-${updatedAt}-${Math.random().toString(36).slice(2, 8)}`,
      updatedAt,
      label: String(label || 'autosave').slice(0, 80),
      meta: snapshot.meta,
      files: snapshot.files
    };
    checkpointStore.put(record);
    await pruneByUpdatedAt(checkpointStore, MAX_CHECKPOINT_RECORDS);
    return record;
  });
};

export const loadWorkspaceCheckpoints = async (limit = 30): Promise<WorkspaceCheckpointRecord[]> => {
  return withTx([CHECKPOINT_STORE], 'readonly', async (tx) => {
    const store = tx.objectStore(CHECKPOINT_STORE);
    const out: WorkspaceCheckpointRecord[] = [];
    return await new Promise<WorkspaceCheckpointRecord[]>((resolve, reject) => {
      const req = store.index('by_updatedAt').openCursor(null, 'prev');
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor || out.length >= limit) {
          resolve(out);
          return;
        }
        out.push(cursor.value as WorkspaceCheckpointRecord);
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  });
};

export const clearWorkspace = async () => {
  return withTx([META_STORE, FILE_STORE, JOURNAL_STORE, CHECKPOINT_STORE, BACKUPS_STORE], 'readwrite', async (tx) => {
    tx.objectStore(META_STORE).clear();
    tx.objectStore(FILE_STORE).clear();
    tx.objectStore(JOURNAL_STORE).clear();
    tx.objectStore(CHECKPOINT_STORE).clear();
    tx.objectStore(BACKUPS_STORE).clear();
    return;
  });
};
