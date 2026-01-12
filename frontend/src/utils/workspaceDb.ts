import type { FileStructure, ProjectFile } from '@/types';

type WorkspaceMetaRecord = {
  key: 'current';
  version: 1;
  updatedAt: number;
  projectId: string;
  projectName: string;
  stack: string;
  description: string;
  activeFile: string | null;
  fileStructure: FileStructure[];
};

type WorkspaceFileRecord = {
  path: string;
  name: string;
  content: string;
  language?: string;
  updatedAt: number;
};

const DB_NAME = 'apex-coding-workspace';
const DB_VERSION = 1;
const META_STORE = 'meta';
const FILE_STORE = 'files';

let dbPromise: Promise<IDBDatabase> | null = null;

const asPromise = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: 'path' });
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

export const loadWorkspace = async (): Promise<{ meta: WorkspaceMetaRecord | null; files: WorkspaceFileRecord[] }> => {
  return withTx([META_STORE, FILE_STORE], 'readonly', async (tx) => {
    const metaStore = tx.objectStore(META_STORE);
    const fileStore = tx.objectStore(FILE_STORE);

    const meta = await asPromise(metaStore.get('current') as IDBRequest<WorkspaceMetaRecord | undefined>);
    const files = await asPromise(fileStore.getAll() as IDBRequest<WorkspaceFileRecord[]>);
    return { meta: meta ?? null, files: Array.isArray(files) ? files : [] };
  });
};

export const applyWorkspaceDelta = async (delta: {
  meta?: Omit<WorkspaceMetaRecord, 'key' | 'version' | 'updatedAt'>;
  upsertFiles?: ProjectFile[];
  deletePaths?: string[];
}) => {
  const updatedAt = Date.now();
  return withTx([META_STORE, FILE_STORE], 'readwrite', async (tx) => {
    const metaStore = tx.objectStore(META_STORE);
    const fileStore = tx.objectStore(FILE_STORE);

    if (delta.meta) {
      const record: WorkspaceMetaRecord = {
        key: 'current',
        version: 1,
        updatedAt,
        projectId: delta.meta.projectId ?? '',
        projectName: delta.meta.projectName ?? '',
        stack: delta.meta.stack ?? '',
        description: delta.meta.description ?? '',
        activeFile: delta.meta.activeFile ?? null,
        fileStructure: Array.isArray(delta.meta.fileStructure) ? delta.meta.fileStructure : []
      };
      metaStore.put(record);
    }

    if (Array.isArray(delta.upsertFiles) && delta.upsertFiles.length > 0) {
      for (const f of delta.upsertFiles) {
        const path = f.path || f.name;
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

    if (Array.isArray(delta.deletePaths) && delta.deletePaths.length > 0) {
      for (const path of delta.deletePaths) {
        if (!path) continue;
        fileStore.delete(path);
      }
    }

    return;
  });
};

export const clearWorkspace = async () => {
  return withTx([META_STORE, FILE_STORE], 'readwrite', async (tx) => {
    tx.objectStore(META_STORE).clear();
    tx.objectStore(FILE_STORE).clear();
    return;
  });
};

