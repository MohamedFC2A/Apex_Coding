import { describe, it, expect } from 'vitest';
import { getStackBlitzFiles } from './stackBlitzUtils';
import { ProjectFile } from '@/types';

describe('getStackBlitzFiles', () => {
  it('converts project files to flat object', () => {
    const files: ProjectFile[] = [
      { name: 'App.tsx', path: 'src/App.tsx', content: 'console.log("App");' },
      { name: 'main.tsx', path: 'src/main.tsx', content: 'console.log("main");' }
    ];

    const result = getStackBlitzFiles(files);

    expect(result['src/App.tsx']).toBe('console.log("App");');
    expect(result['src/main.tsx']).toBe('console.log("main");');
  });

  it('ensures package.json exists', () => {
    const files: ProjectFile[] = [];
    const result = getStackBlitzFiles(files);

    expect(result['package.json']).toBeDefined();
    const pkg = JSON.parse(result['package.json']);
    expect(pkg.name).toBe('apex-coding-project');
    expect(pkg.devDependencies['typescript']).toBeDefined();
  });

  it('ensures react types are present in existing package.json', () => {
    const files: ProjectFile[] = [
      {
        name: 'package.json',
        path: 'package.json',
        content: JSON.stringify({
          dependencies: { react: '18.0.0' },
          devDependencies: {}
        })
      }
    ];

    const result = getStackBlitzFiles(files);
    const pkg = JSON.parse(result['package.json']);
    
    expect(pkg.devDependencies['@types/react']).toBeDefined();
    expect(pkg.devDependencies['typescript']).toBeDefined();
  });

  it('ensures index.html exists', () => {
    const files: ProjectFile[] = [];
    const result = getStackBlitzFiles(files);
    expect(result['index.html']).toBeDefined();
    expect(result['index.html']).toContain('<div id="root"></div>');
  });

  it('ensures vite.config.ts exists', () => {
    const files: ProjectFile[] = [];
    const result = getStackBlitzFiles(files);
    expect(result['vite.config.ts']).toBeDefined();
  });

  it('does not overwrite existing vite.config.js', () => {
    const files: ProjectFile[] = [
      { name: 'vite.config.js', path: 'vite.config.js', content: '// custom config' }
    ];
    const result = getStackBlitzFiles(files);
    expect(result['vite.config.js']).toBe('// custom config');
    expect(result['vite.config.ts']).toBeUndefined();
  });
});
