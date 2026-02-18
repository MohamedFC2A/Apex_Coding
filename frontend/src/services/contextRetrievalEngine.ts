import type { ProjectFile } from '@/types';
import { selectContextRetrievalTrace } from '@/services/contextGraph';
import type { ContextRetrievalTrace, WorkspaceAnalysisReport, WorkspaceManifestEntry } from '@/types/context';

export interface ContextBundleFile {
  path: string;
  content: string;
  snippet: string;
  hash: string;
  size: number;
  score: number;
}

export interface ContextBundleActiveFile {
  path: string;
  content: string;
  hash: string;
}

export interface ContextBundle {
  manifest: WorkspaceManifestEntry[];
  files: ContextBundleFile[];
  activeFile: ContextBundleActiveFile | null;
  retrievalTrace: ContextRetrievalTrace;
}

interface BuildContextBundleOptions {
  files: ProjectFile[];
  activeFile?: string | null;
  recentPreviewErrors?: string[];
  prompt?: string;
  mode?: 'balanced_graph' | 'light' | 'max' | 'strict_full';
  maxFiles?: number;
  maxChars?: number;
  workspaceAnalysis?: WorkspaceAnalysisReport | null;
}

const normalizePath = (value: string) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

const normalizeText = (value: string) => String(value || '').toLowerCase();

const hashString = (value: string) => {
  let hash = 5381;
  const input = String(value || '');
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return `h${(hash >>> 0).toString(16)}`;
};

const getExtension = (path: string) => {
  const normalized = normalizePath(path);
  const name = normalized.split('/').pop() || normalized;
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
};

const classifyManifestType = (path: string): WorkspaceManifestEntry['type'] => {
  const normalized = normalizePath(path).toLowerCase();
  const name = normalized.split('/').pop() || normalized;
  const ext = getExtension(path);
  if (
    name === 'package.json' ||
    name === 'package-lock.json' ||
    name === 'yarn.lock' ||
    name === 'pnpm-lock.yaml' ||
    name.includes('config') ||
    name === 'tsconfig.json' ||
    name === '.env' ||
    name === '.env.local' ||
    name === '.env.example'
  ) {
    return 'config';
  }
  if (['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'avif', 'woff', 'woff2', 'ttf'].includes(ext)) return 'asset';
  if (['md', 'txt', 'adoc'].includes(ext)) return 'doc';
  if (['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'sass', 'html', 'htm', 'json'].includes(ext)) return 'code';
  return 'other';
};

const buildManifest = (files: ProjectFile[]): WorkspaceManifestEntry[] =>
  files
    .map((file) => {
      const path = normalizePath(file.path || file.name || '');
      const content = String(file.content || '');
      if (!path) return null;
      return {
        path,
        hash: hashString(`${path}:${content}`),
        size: content.length,
        type: classifyManifestType(path),
        extension: getExtension(path)
      } satisfies WorkspaceManifestEntry;
    })
    .filter((item): item is WorkspaceManifestEntry => Boolean(item));

const tokenize = (value: string) => {
  const tokens = normalizeText(value)
    .split(/[^a-z0-9_]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  return Array.from(new Set(tokens)).slice(0, 48);
};

const buildSnippet = (content: string, tokens: string[]) => {
  const source = String(content || '');
  if (!source) return '';
  const lower = source.toLowerCase();
  const hit = tokens.find((token) => token.length >= 3 && lower.includes(token));
  if (!hit) return source.slice(0, 1600);
  const idx = lower.indexOf(hit);
  const start = Math.max(0, idx - 300);
  const end = Math.min(source.length, idx + 1200);
  return source.slice(start, end);
};

const computeLexicalScore = (path: string, content: string, tokens: string[]) => {
  if (tokens.length === 0) return 0;
  const corpusPath = normalizeText(path);
  const corpusContent = normalizeText(content.slice(0, 6000));
  let score = 0;
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (corpusPath.includes(token)) score += 18;
    if (corpusContent.includes(token)) score += 7;
  }
  return Math.min(140, score);
};

const computePreviewErrorScore = (path: string, recentPreviewErrors: string[]) => {
  if (recentPreviewErrors.length === 0) return 0;
  const base = normalizePath(path).split('/').pop() || '';
  if (!base) return 0;
  return recentPreviewErrors.some((line) => normalizeText(line).includes(normalizeText(base))) ? 24 : 0;
};

export const buildContextBundle = (options: BuildContextBundleOptions): ContextBundle => {
  const files = Array.isArray(options.files) ? options.files : [];
  const maxFiles = Math.max(1, Number(options.maxFiles || 24));
  const maxChars = Math.max(20_000, Number(options.maxChars || 120_000));
  const activePath = normalizePath(options.activeFile || '');
  const recentPreviewErrors = (options.recentPreviewErrors || []).map((item) => String(item || ''));
  const tokens = tokenize(options.prompt || '');
  const manifest = options.workspaceAnalysis?.manifest || buildManifest(files);

  if (options.mode === 'strict_full' && options.workspaceAnalysis) {
    const analysis = options.workspaceAnalysis;
    const fileByPath = new Map(
      files.map((file) => [normalizePath(file.path || file.name || ''), String(file.content || '')] as const)
    );
    const strictMaxFiles = Math.max(1, Number(options.maxFiles || 40));
    const strictPaths = Array.from(
      new Set([
        ...analysis.requiredReadSet.map((item) => normalizePath(item)),
        ...analysis.expandedReadSet.map((item) => normalizePath(item))
      ])
    ).filter(Boolean);

    const selectedFiles: ContextBundleFile[] = [];
    const dropped: Array<{ path: string; score: number; reasons: string[] }> = [];
    let usedChars = 0;
    for (const path of strictPaths) {
      const content = fileByPath.get(path);
      if (typeof content !== 'string') continue;
      const isRequired = analysis.requiredReadSet.some((item) => normalizePath(item) === path);
      const nextSize = content.length;
      const exceedChars = usedChars + nextSize > maxChars;
      const exceedCount = selectedFiles.length >= strictMaxFiles;
      if (!isRequired && (exceedChars || exceedCount)) {
        dropped.push({ path, score: 0, reasons: ['context-budget'] });
        continue;
      }
      const lexicalScore = computeLexicalScore(path, content, tokens);
      const previewScore = computePreviewErrorScore(path, recentPreviewErrors);
      const score = (isRequired ? 200 : 120) + lexicalScore + previewScore;
      selectedFiles.push({
        path,
        content,
        snippet: content.slice(0, 1600),
        size: content.length,
        hash: hashString(`${path}:${content}`),
        score
      });
      usedChars += nextSize;
    }

    const selectedSet = new Set(selectedFiles.map((item) => item.path));
    for (const file of files) {
      const path = normalizePath(file.path || file.name || '');
      if (!path || selectedSet.has(path)) continue;
      dropped.push({ path, score: 0, reasons: ['not-in-expanded-read-set'] });
    }

    const activeContent = fileByPath.get(activePath);
    const activeFile =
      activePath && typeof activeContent === 'string'
        ? {
            path: activePath,
            content: activeContent,
            hash: hashString(`${activePath}:${activeContent}`)
          }
        : null;

    return {
      manifest,
      files: selectedFiles.map((item) => ({ ...item, score: Math.round(item.score * 100) / 100 })),
      activeFile,
      retrievalTrace: {
        strategy: 'strict_full',
        budgetMax: strictMaxFiles,
        budgetUsed: selectedFiles.length,
        generatedAt: Date.now(),
        selected: selectedFiles.map((item) => ({
          path: item.path,
          score: Math.round(item.score * 100) / 100,
          reasons: ['strict-full-context']
        })),
        dropped
      }
    };
  }

  const trace = selectContextRetrievalTrace({
    files,
    activeFile: activePath,
    recentPreviewErrors,
    mode: options.mode || 'balanced_graph',
    maxItems: Math.max(maxFiles * 2, 24)
  });
  const graphScoreByPath = new Map(trace.selected.map((item) => [normalizePath(item.path), Number(item.score || 0)]));

  const ranked = files
    .map((file, index) => {
      const path = normalizePath(file.path || file.name || '');
      const content = String(file.content || '');
      if (!path) return null;
      const graphScore = graphScoreByPath.get(path) || 0;
      const lexicalScore = computeLexicalScore(path, content, tokens);
      const previewScore = computePreviewErrorScore(path, recentPreviewErrors);
      const recencyScore = Math.max(0, 20 - Math.floor(index / 2));
      const score = graphScore + lexicalScore + previewScore + recencyScore;
      const snippet = buildSnippet(content, tokens);
      return {
        path,
        content,
        snippet,
        size: content.length,
        hash: hashString(`${path}:${content}`),
        score
      };
    })
    .filter((item): item is ContextBundleFile => Boolean(item))
    .sort((a, b) => b.score - a.score);

  const selectedFiles = ranked.slice(0, maxFiles);
  const selectedPathSet = new Set(selectedFiles.map((item) => item.path));
  const selectedTrace = ranked
    .slice(0, maxFiles)
    .map((item) => ({ path: item.path, score: item.score, reasons: ['context-bundle'] }));
  const droppedTrace = ranked
    .slice(maxFiles)
    .map((item) => ({ path: item.path, score: item.score, reasons: ['context-bundle'] }));

  const activeFileSource = files.find((file) => normalizePath(file.path || file.name || '') === activePath);
  const activeFile =
    activeFileSource && activePath
      ? {
          path: activePath,
          content: String(activeFileSource.content || ''),
          hash: hashString(`${activePath}:${String(activeFileSource.content || '')}`)
        }
      : null;

  return {
    manifest,
    files: selectedFiles.map((item) => ({
      ...item,
      score: Math.round(item.score * 100) / 100
    })),
    activeFile,
    retrievalTrace: {
      strategy: trace.strategy,
      budgetMax: maxFiles,
      budgetUsed: selectedPathSet.size,
      generatedAt: Date.now(),
      selected: selectedTrace,
      dropped: droppedTrace
    }
  };
};
