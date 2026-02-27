import { clearAllSessionsFromDisk } from '@/utils/sessionDb';
import { DB_NAME, clearWorkspace } from '@/utils/workspaceDb';

export type ResetLocalDataOptions = {
  includeCookies?: boolean;
  includeSessionStorage?: boolean;
  includeBrowserCaches?: boolean;
};

const deleteIndexedDbDatabase = async (dbName: string, timeoutMs = 1800): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);
    try {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => {
        window.clearTimeout(timer);
        finish(true);
      };
      req.onerror = () => {
        window.clearTimeout(timer);
        finish(false);
      };
      req.onblocked = () => {
        window.clearTimeout(timer);
        finish(false);
      };
    } catch {
      window.clearTimeout(timer);
      finish(false);
    }
  });
};

const clearCookiesBestEffort = () => {
  if (typeof document === 'undefined') return;
  const cookiePairs = String(document.cookie || '')
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (cookiePairs.length === 0) return;

  const host = String(window.location.hostname || '').trim();
  const hostParts = host.split('.').filter(Boolean);
  const domains = new Set<string>(['', host]);
  for (let i = 0; i < hostParts.length - 1; i += 1) {
    domains.add(`.${hostParts.slice(i).join('.')}`);
    domains.add(hostParts.slice(i).join('.'));
  }

  const pathParts = String(window.location.pathname || '/')
    .split('/')
    .filter(Boolean);
  const paths = new Set<string>(['/']);
  let rollingPath = '';
  for (const part of pathParts) {
    rollingPath += `/${part}`;
    paths.add(rollingPath);
  }

  for (const pair of cookiePairs) {
    const name = pair.split('=')[0]?.trim();
    if (!name) continue;
    for (const path of paths) {
      document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path};`;
      for (const domain of domains) {
        if (!domain) continue;
        document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain};`;
      }
    }
  }
};

const clearStorageKeys = (storage: Storage, options: { prefixes: string[]; exact: string[] }) => {
  const toDelete: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (options.exact.includes(key)) {
      toDelete.push(key);
      continue;
    }
    if (options.prefixes.some((prefix) => key.startsWith(prefix))) {
      toDelete.push(key);
    }
  }
  for (const key of toDelete) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }
};

export const resetAllLocalData = async (options: ResetLocalDataOptions = {}) => {
  if (typeof window === 'undefined') return;

  const includeCookies = options.includeCookies !== false;
  const includeSessionStorage = options.includeSessionStorage !== false;
  const includeBrowserCaches = options.includeBrowserCaches !== false;

  try {
    await clearAllSessionsFromDisk();
  } catch {
    // ignore
  }

  try {
    await clearWorkspace();
  } catch {
    // ignore
  }

  try {
    clearStorageKeys(window.localStorage, {
      prefixes: ['apex-', 'apex:', 'apex_'],
      exact: ['editor-settings', 'monaco-editor-state']
    });
  } catch {
    // ignore
  }

  if (includeSessionStorage) {
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
  }

  if (includeBrowserCaches && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    } catch {
      // ignore
    }
  }

  if (includeCookies) {
    clearCookiesBestEffort();
  }

  try {
    await deleteIndexedDbDatabase(DB_NAME);
  } catch {
    // ignore
  }
};
