import type { StreamFileEvent } from '@/services/aiService';
import { sanitizeOperationPath } from '@/utils/fileOpGuards';

type ResolvePath = (rawPath: string) => string;

interface FileMutationEngineOptions {
  resolvePath: ResolvePath;
  basenameRegistry: Map<string, string>;
  duplicateSensitiveBasenames?: Set<string>;
}

const normalize = (value: string) => sanitizeOperationPath(value);

export const createFileMutationEngine = (options: FileMutationEngineOptions) => {
  const resolvePath = options.resolvePath;
  const basenameRegistry = options.basenameRegistry;
  const duplicateSensitiveBasenames =
    options.duplicateSensitiveBasenames ||
    new Set([
      'index.html',
      'style.css',
      'styles.css',
      'script.js',
      'main.js',
      'app.js',
      'package.json'
    ]);

  const rawToResolved = new Map<string, string>();
  let activeOperationPath: string | null = null;

  const getBasename = (path: string) => normalize(path).split('/').pop() || '';

  const resolveOperationPath = (rawPath: string) => {
    const normalizedRaw = normalize(rawPath);
    if (!normalizedRaw) return '';
    return rawToResolved.get(normalizedRaw) || resolvePath(normalizedRaw) || normalizedRaw;
  };

  const mapPath = (rawPath: string, resolvedPath: string) => {
    const normalizedRaw = normalize(rawPath);
    if (!normalizedRaw || !resolvedPath) return;
    rawToResolved.set(normalizedRaw, resolvedPath);
  };

  return {
    applyFileOperation(event: StreamFileEvent): StreamFileEvent | null {
      if (event.type === 'delete') {
        const raw = normalize(event.path || '');
        const resolved = resolveOperationPath(raw);
        if (!resolved) return null;
        rawToResolved.delete(raw);
        if (activeOperationPath === resolved) activeOperationPath = null;
        return { ...event, path: resolved };
      }

      if (event.type === 'move') {
        const fromRaw = normalize(event.path || '');
        const toRaw = normalize(event.toPath || '');
        const fromPath = resolveOperationPath(fromRaw);
        const toPath = resolveOperationPath(toRaw);
        if (!fromPath || !toPath) return null;
        rawToResolved.delete(fromRaw);
        rawToResolved.delete(toRaw);
        mapPath(fromRaw, toPath);
        mapPath(toRaw, toPath);
        if (activeOperationPath === fromPath) activeOperationPath = toPath;
        return { ...event, path: fromPath, toPath };
      }

      if (event.type === 'start') {
        const raw = normalize(event.path || '');
        let resolved = resolvePath(raw) || raw;
        const basename = getBasename(resolved).toLowerCase();
        const existingPath = basenameRegistry.get(basename);
        const mode = event.mode === 'edit' ? 'edit' : 'create';

        if (mode === 'create' && existingPath && existingPath !== resolved && duplicateSensitiveBasenames.has(basename)) {
          resolved = existingPath;
        } else if (resolved) {
          basenameRegistry.set(basename, resolved);
        }

        mapPath(raw, resolved);
        activeOperationPath = resolved || null;
        return { ...event, path: resolved };
      }

      if (event.type === 'chunk' || event.type === 'end') {
        const raw = normalize(event.path || '');
        const resolved = resolveOperationPath(raw) || activeOperationPath || resolvePath(raw) || raw;
        if (!resolved) return null;
        mapPath(raw, resolved);
        if (event.type === 'end') {
          rawToResolved.delete(raw);
          if (activeOperationPath === resolved) activeOperationPath = null;
        }
        return { ...event, path: resolved };
      }

      return event;
    }
  };
};
