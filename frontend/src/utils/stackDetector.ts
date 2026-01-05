import { ProjectFile, ProjectStack } from '@/types';

export function detectStack(files: ProjectFile[]): ProjectStack {
  // Check for React + Vite
  const hasPackageJson = files.find(f => f.path?.includes('package.json'));
  if (hasPackageJson) {
    const content = hasPackageJson.content?.toLowerCase() || '';
    if (content.includes('react') && (content.includes('vite') || files.some(f => f.path?.includes('vite.config')))) {
      return 'react-vite';
    }
    if (content.includes('express') || files.some(f => f.content?.includes('express'))) {
      return 'node-express';
    }
  }

  // Check for Python
  const hasPythonFiles = files.some(f => f.path?.endsWith('.py'));
  if (hasPythonFiles) {
    const hasFlask = files.some(f => f.content?.includes('Flask') || f.content?.includes('from flask'));
    const hasFastAPI = files.some(f => f.content?.includes('FastAPI') || f.content?.includes('from fastapi'));
    
    if (hasFastAPI) return 'python-fastapi';
    if (hasFlask) return 'python-flask';
  }

  // Check for C/C++
  const hasCppFiles = files.some(f => f.path?.endsWith('.cpp') || f.path?.endsWith('.c'));
  if (hasCppFiles) return 'cpp';

  // Default to HTML/CSS/JS
  return 'HTML/CSS/JS';
}

export function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'cpp': 'cpp',
    'c': 'c',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'sh': 'shell',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'sql': 'sql'
  };

  return languageMap[ext || ''] || 'plaintext';
}
