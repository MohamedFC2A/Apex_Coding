import { describe, expect, it } from 'vitest';
import { diffPreviewFileMaps, toPreviewFileMap } from './previewFilesUtils';
import type { ProjectFile } from '@/types';

describe('previewFilesUtils', () => {
  it('creates a path->content map', () => {
    const files: ProjectFile[] = [
      { name: 'a.ts', path: 'src/a.ts', content: 'export const a = 1;' },
      { name: 'b.ts', path: '/src/b.ts', content: 'export const b = 2;' }
    ];

    const map = toPreviewFileMap(files);
    expect(map['src/a.ts']).toBe('export const a = 1;');
    expect(map['src/b.ts']).toBe('export const b = 2;');
  });

  it('diffs create/destroy correctly', () => {
    const prev = { 'a.txt': '1', 'b.txt': '2' };
    const next = { 'a.txt': '1', 'b.txt': '3', 'c.txt': '4' };
    const diff = diffPreviewFileMaps(prev, next);
    expect(diff.create).toEqual({ 'b.txt': '3', 'c.txt': '4' });
    expect(diff.destroy).toEqual([]);
  });

  it('diffs deletions correctly', () => {
    const prev = { 'a.txt': '1', 'b.txt': '2' };
    const next = { 'b.txt': '2' };
    const diff = diffPreviewFileMaps(prev, next);
    expect(diff.create).toEqual({});
    expect(diff.destroy).toEqual(['a.txt']);
  });
});

