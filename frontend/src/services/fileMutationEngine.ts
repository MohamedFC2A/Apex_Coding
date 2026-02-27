import type { StreamFileEvent } from '@/services/aiService';
import { sanitizeOperationPath } from '@/utils/fileOpGuards';

type ResolvePath = (rawPath: string) => string;

interface FileMutationEngineOptions {
  resolvePath: ResolvePath;
  basenameRegistry: Map<string, string>;
  duplicateSensitiveBasenames?: Set<string>;
}

const normalize = (value: string) => sanitizeOperationPath(value);

/**
 * Maps forbidden filenames to their canonical equivalents.
 * When AI tries to create a forbidden name, it auto-redirects to the canonical one.
 */
const FORBIDDEN_TO_CANONICAL: Record<string, string> = {
  'styles.css': 'style.css',
  'main.css': 'style.css',
  'global.css': 'style.css',
  'globals.css': 'style.css',
  'app.css': 'style.css',
  'index.css': 'style.css',
  'main.js': 'script.js',
  'app.js': 'script.js',
  'index.js': 'script.js',
};

export const createFileMutationEngine = (options: FileMutationEngineOptions) => {
  const resolvePath = options.resolvePath;
  const basenameRegistry = options.basenameRegistry;
  const duplicateSensitiveBasenames =
    options.duplicateSensitiveBasenames ||
    new Set([
      'index.html',
      'style.css',
      'styles.css',
      'main.css',
      'global.css',
      'globals.css',
      'app.css',
      'index.css',
      'script.js',
      'main.js',
      'app.js',
      'index.js',
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

  /**
   * If the basename is a forbidden name and a canonical equivalent exists in the project,
   * redirect to the canonical path. Otherwise, rename the basename to canonical.
   */
  const applyForbiddenNameRedirect = (resolvedPath: string): string => {
    const basename = getBasename(resolvedPath).toLowerCase();
    const canonicalBasename = FORBIDDEN_TO_CANONICAL[basename];
    if (!canonicalBasename) return resolvedPath;

    // Check if the canonical file already exists in the registry
    const canonicalExisting = basenameRegistry.get(canonicalBasename);
    if (canonicalExisting) return canonicalExisting;

    // Rename: replace the forbidden basename with the canonical one
    const dir = resolvedPath.includes('/')
      ? resolvedPath.slice(0, resolvedPath.lastIndexOf('/') + 1)
      : '';
    return `${dir}${canonicalBasename}`;
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
        const mode = event.mode === 'edit' ? 'edit' : 'create';

        // For create mode, apply forbidden-name redirect before duplicate check
        if (mode === 'create') {
          resolved = applyForbiddenNameRedirect(resolved);
        }

        const basename = getBasename(resolved).toLowerCase();
        const existingPath = basenameRegistry.get(basename);

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
