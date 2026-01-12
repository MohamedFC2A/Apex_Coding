import type { FileStructure, ProjectFile } from '@/types';
import { loadWorkspace } from '@/utils/workspaceDb';

type StoredChatRole = 'system' | 'user' | 'assistant';

export type StoredChatMessage = {
  role: StoredChatRole;
  content: string;
};

export type StoredPlanStep = {
  id: string;
  title: string;
  completed: boolean;
  category?: 'config' | 'frontend' | 'backend' | 'integration' | 'testing' | 'deployment';
  files?: string[];
  description?: string;
};

export type StoredHistorySession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  projectName: string;
  stack: string;
  description: string;
  activeFile: string | null;
  fileStructure: FileStructure[];
  projectFiles: ProjectFile[];
  chatHistory: StoredChatMessage[];
  plan: string;
  planSteps: StoredPlanStep[];
  contextSize: number;
};

const DB_NAME = 'apex-coding-workspace';
const DB_VERSION = 2;
const SESSIONS_STORE = 'sessions';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'path' });
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const store = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
      } else {
        try {
          const store = req.transaction?.objectStore(SESSIONS_STORE);
          if (store && !Array.from(store.indexNames).includes('by_updatedAt')) {
            store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
          }
        } catch {
          // ignore
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const withTx = async <T>(storeNames: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T>) => {
  const db = await openDb();
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

export const saveSessionToDisk = async (session: StoredHistorySession) => {
  return withTx([SESSIONS_STORE], 'readwrite', async (tx) => {
    tx.objectStore(SESSIONS_STORE).put(session);
    return;
  });
};

export const loadSessionsFromDisk = async (limit = 40): Promise<StoredHistorySession[]> => {
  return withTx([SESSIONS_STORE], 'readonly', async (tx) => {
    const store = tx.objectStore(SESSIONS_STORE);
    const index = store.index('by_updatedAt');
    const out: StoredHistorySession[] = [];

    return new Promise<StoredHistorySession[]>((resolve, reject) => {
      const req = index.openCursor(null, 'prev');
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return resolve(out);
        out.push(cursor.value as StoredHistorySession);
        if (out.length >= limit) return resolve(out);
        cursor.continue();
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

export const archiveCurrentWorkspaceAsSession = async (session: Omit<StoredHistorySession, 'projectFiles' | 'fileStructure' | 'activeFile' | 'projectName' | 'stack' | 'description'>) => {
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
    stack: String(meta?.stack || ''),
    description: String(meta?.description || ''),
    activeFile: (meta?.activeFile ?? null) as string | null,
    fileStructure: Array.isArray(meta?.fileStructure) ? meta.fileStructure : [],
    projectFiles
  };

  await saveSessionToDisk(record);
  return record;
};
