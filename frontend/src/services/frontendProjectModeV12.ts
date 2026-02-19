import type { ProjectFile } from '@/types';

export const FRONTEND_PROJECT_MODE_VERSION = '1.2';

type PlanStepLike = {
  files?: string[];
};

export interface FrontendProjectModeScaffold {
  version: string;
  directories: string[];
  requiredFiles: string[];
  queuedFiles: string[];
}

const BASE_DIRECTORIES = ['pages', 'components', 'styles', 'scripts', 'assets', 'assets/images', 'assets/icons', 'data'];

const BASE_REQUIRED_FILES = ['index.html', 'style.css', 'script.js'];

const BLOCKED_SEGMENTS = new Set(['node_modules', 'dist', 'build', '.git', '.next']);

const normalizePath = (value: string) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim();

const hasFileExtension = (path: string) => /\/?[^/]+\.[a-z0-9]+$/i.test(path);

const isBlockedPath = (path: string) => {
  const parts = normalizePath(path).split('/').filter(Boolean);
  return parts.some((part) => BLOCKED_SEGMENTS.has(part.toLowerCase()));
};

const isForbiddenBackendPath = (path: string) => /^(backend|server|api|database|db)\//i.test(normalizePath(path));

const collectParentDirectories = (path: string) => {
  const normalized = normalizePath(path);
  if (!normalized) return [] as string[];
  const parts = normalized.split('/').filter(Boolean);
  const out: string[] = [];
  let cursor = '';
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor ? `${cursor}/${parts[i]}` : parts[i];
    out.push(cursor);
  }
  return out;
};

export const toFrontendCanonicalPath = (rawPath: string): string | null => {
  const normalizedRaw = normalizePath(rawPath);
  const normalized = normalizedRaw.toLowerCase().startsWith('frontend/')
    ? normalizedRaw.slice('frontend/'.length)
    : normalizedRaw;
  if (!normalized) return null;
  if (isBlockedPath(normalized)) return null;
  if (isForbiddenBackendPath(normalized)) return null;

  if (!hasFileExtension(normalized)) return null;
  return normalized;
};

export const extractPlannedFrontendFiles = (planSteps: PlanStepLike[] = []) => {
  const out = new Set<string>();
  for (const step of planSteps) {
    if (!Array.isArray(step?.files)) continue;
    for (const rawPath of step.files) {
      const canonical = toFrontendCanonicalPath(rawPath);
      if (!canonical) continue;
      out.add(canonical);
      if (out.size >= 180) return Array.from(out);
    }
  }
  return Array.from(out);
};

export const buildFrontendProjectModeScaffold = (options: {
  planSteps?: PlanStepLike[];
  existingFiles?: ProjectFile[];
}): FrontendProjectModeScaffold => {
  const existingPaths = new Set(
    (options.existingFiles || [])
      .map((file) => toFrontendCanonicalPath(file.path || file.name || ''))
      .filter((value): value is string => Boolean(value))
  );

  const plannedFiles = extractPlannedFrontendFiles(options.planSteps || []);
  const shouldBootstrapRequired = existingPaths.size === 0;
  const requiredFiles = shouldBootstrapRequired ? BASE_REQUIRED_FILES.filter((path) => !existingPaths.has(path)) : [];
  const queuedFiles = Array.from(new Set([...requiredFiles, ...plannedFiles]));

  const directories = new Set<string>(BASE_DIRECTORIES);
  for (const filePath of [...queuedFiles, ...Array.from(existingPaths)]) {
    for (const directory of collectParentDirectories(filePath)) {
      directories.add(directory);
    }
  }

  return {
    version: FRONTEND_PROJECT_MODE_VERSION,
    directories: Array.from(directories).sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    }),
    requiredFiles,
    queuedFiles
  };
};
