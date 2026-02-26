import type { ProjectFile } from '@/types';
import { applyWorkspaceDelta, BACKUPS_STORE, FILE_STORE, openWorkspaceDb } from '@/utils/workspaceDb';

export type WorkspaceBackupRecord = {
  id: string;
  updatedAt: number;
  reason: string;
  paths: string[];
  files: Array<{
    path: string;
    name: string;
    content: string;
    language?: string;
  }>;
};

const MAX_BACKUP_RECORDS = 120;

const SENSITIVE_PATTERNS = [
  /(^|\/)package\.json$/i,
  /(^|\/)package-lock\.json$/i,
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)yarn\.lock$/i,
  /(^|\/)tsconfig(\..+)?\.json$/i,
  /(^|\/)next\.config\.(mjs|js|ts)$/i,
  /(^|\/)vite\.config\.(mjs|js|ts)$/i
];

const normalizePath = (value: string) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

export const isSensitiveWorkspacePath = (path: string) => {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
};

const pruneBackups = async (store: IDBObjectStore) => {
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
  if (ids.length <= MAX_BACKUP_RECORDS) return;
  for (const id of ids.slice(MAX_BACKUP_RECORDS)) {
    store.delete(id);
  }
};

export const createWorkspaceBackup = async (args: { reason: string; paths: string[] }) => {
  const normalizedPaths = Array.from(new Set((args.paths || []).map((path) => normalizePath(path)).filter(Boolean)));
  if (normalizedPaths.length === 0) return null;

  const db = await openWorkspaceDb();
  const tx = db.transaction([FILE_STORE, BACKUPS_STORE], 'readwrite');
  const fileStore = tx.objectStore(FILE_STORE);
  const backupStore = tx.objectStore(BACKUPS_STORE);

  const files: WorkspaceBackupRecord['files'] = [];
  for (const path of normalizedPaths) {
    const record = await new Promise<any>((resolve, reject) => {
      const req = fileStore.get(path);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!record) continue;
    files.push({
      path,
      name: record.name || path.split('/').pop() || path,
      content: String(record.content || ''),
      language: record.language
    });
  }

  if (files.length === 0) {
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return null;
  }

  const updatedAt = Date.now();
  const backup: WorkspaceBackupRecord = {
    id: `backup-${updatedAt}-${Math.random().toString(36).slice(2, 8)}`,
    updatedAt,
    reason: String(args.reason || 'pre-destructive-operation').slice(0, 160),
    paths: normalizedPaths,
    files
  };

  backupStore.put(backup);
  await pruneBackups(backupStore);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return backup;
};

export const loadWorkspaceBackups = async (limit = 40): Promise<WorkspaceBackupRecord[]> => {
  const db = await openWorkspaceDb();
  const tx = db.transaction([BACKUPS_STORE], 'readonly');
  const store = tx.objectStore(BACKUPS_STORE);
  const out: WorkspaceBackupRecord[] = [];
  return await new Promise<WorkspaceBackupRecord[]>((resolve, reject) => {
    const req = store.index('by_updatedAt').openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result as IDBCursorWithValue | null;
      if (!cursor || out.length >= limit) {
        resolve(out);
        return;
      }
      out.push(cursor.value as WorkspaceBackupRecord);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
};

export const restoreWorkspaceBackup = async (backupId: string) => {
  const id = String(backupId || '').trim();
  if (!id) return false;
  const db = await openWorkspaceDb();
  const tx = db.transaction([BACKUPS_STORE], 'readonly');
  const store = tx.objectStore(BACKUPS_STORE);
  const backup = await new Promise<WorkspaceBackupRecord | null>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as WorkspaceBackupRecord) || null);
    req.onerror = () => reject(req.error);
  });
  if (!backup || !Array.isArray(backup.files) || backup.files.length === 0) return false;

  const upsertFiles: ProjectFile[] = backup.files.map((file) => ({
    name: file.name,
    path: file.path,
    content: file.content,
    language: file.language
  }));
  await applyWorkspaceDelta({ upsertFiles });
  return true;
};
