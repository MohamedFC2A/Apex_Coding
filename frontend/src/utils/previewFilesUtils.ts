import { ProjectFile } from '@/types';

export type FileMap = Record<string, string>;

export const toPreviewFileMap = (files: ProjectFile[]): FileMap => {
  const map: FileMap = {};

  for (const file of files) {
    const rawPath = String(file.path || file.name || '').trim();
    if (!rawPath) continue;

    const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) continue;

    map[normalized] = String(file.content || '');
  }

  return map;
};

export const diffPreviewFileMaps = (prev: FileMap, next: FileMap) => {
  const create: FileMap = {};
  const destroy: string[] = [];

  for (const [path, content] of Object.entries(next)) {
    if (!(path in prev) || prev[path] !== content) create[path] = content;
  }

  for (const path of Object.keys(prev)) {
    if (!(path in next)) destroy.push(path);
  }

  return { create, destroy };
};

