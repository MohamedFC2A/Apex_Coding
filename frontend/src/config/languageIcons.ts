export interface LanguageIconMeta {
  language: string;
  label: string;
  iconPath: string;
  accent: string;
}

const ICONS: Record<string, LanguageIconMeta> = {
  javascript: {
    language: 'javascript',
    label: 'JavaScript',
    iconPath: '/language-icons/javascript.svg',
    accent: '#f7df1e'
  },
  typescript: {
    language: 'typescript',
    label: 'TypeScript',
    iconPath: '/language-icons/typescript.svg',
    accent: '#3178c6'
  },
  react: {
    language: 'react',
    label: 'React',
    iconPath: '/language-icons/react.svg',
    accent: '#61dafb'
  },
  html: {
    language: 'html',
    label: 'HTML',
    iconPath: '/language-icons/html.svg',
    accent: '#e34f26'
  },
  css: {
    language: 'css',
    label: 'CSS',
    iconPath: '/language-icons/css.svg',
    accent: '#1572b6'
  },
  node: {
    language: 'node',
    label: 'Node',
    iconPath: '/language-icons/nodejs.svg',
    accent: '#83cd29'
  },
  nodejs: {
    language: 'nodejs',
    label: 'Node',
    iconPath: '/language-icons/nodejs.svg',
    accent: '#83cd29'
  },
  python: {
    language: 'python',
    label: 'Python',
    iconPath: '/language-icons/python.svg',
    accent: '#3776ab'
  },
  json: {
    language: 'json',
    label: 'JSON',
    iconPath: '/language-icons/json.svg',
    accent: '#f7df1e'
  },
  markdown: {
    language: 'markdown',
    label: 'Markdown',
    iconPath: '/language-icons/markdown.svg',
    accent: '#8b949e'
  },
  yaml: {
    language: 'yaml',
    label: 'YAML',
    iconPath: '/language-icons/yaml.svg',
    accent: '#cb171e'
  },
  shell: {
    language: 'shell',
    label: 'Shell',
    iconPath: '/language-icons/shell.svg',
    accent: '#89e051'
  },
  go: {
    language: 'go',
    label: 'Go',
    iconPath: '/language-icons/go.svg',
    accent: '#00add8'
  },
  rust: {
    language: 'rust',
    label: 'Rust',
    iconPath: '/language-icons/rust.svg',
    accent: '#dea584'
  },
  java: {
    language: 'java',
    label: 'Java',
    iconPath: '/language-icons/java.svg',
    accent: '#f89820'
  },
  php: {
    language: 'php',
    label: 'PHP',
    iconPath: '/language-icons/php.svg',
    accent: '#777bb4'
  },
  cpp: {
    language: 'cpp',
    label: 'C++',
    iconPath: '/language-icons/cpp.svg',
    accent: '#00599c'
  },
  sql: {
    language: 'sql',
    label: 'SQL',
    iconPath: '/language-icons/sql.svg',
    accent: '#4479a1'
  },
  svg: {
    language: 'svg',
    label: 'SVG',
    iconPath: '/language-icons/svg.svg',
    accent: '#ff7f00'
  },
  plaintext: {
    language: 'plaintext',
    label: 'Text',
    iconPath: '/language-icons/text.svg',
    accent: '#94a3b8'
  }
};

const normalizeLanguage = (language: string) => {
  const value = String(language || '').toLowerCase();
  if (value === 'jsx' || value === 'tsx') return 'react';
  if (value === 'js') return 'javascript';
  if (value === 'ts') return 'typescript';
  if (value === 'md') return 'markdown';
  if (value === 'yml') return 'yaml';
  return value;
};

export const getLanguageIconMeta = (language?: string) => {
  const normalized = normalizeLanguage(language || 'plaintext');
  return ICONS[normalized] || ICONS.plaintext;
};
