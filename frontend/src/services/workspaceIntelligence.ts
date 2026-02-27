import type { ProjectFile } from '@/types';
import type { InteractionMode } from '@/stores/aiStore';
import { buildDependencyEdges } from '@/services/contextGraph';
import type { GenerationProfile, TouchBudgetMode } from '@/types/constraints';
import type {
  WorkspaceAllowedCreateRule,
  WorkspaceAnalysisReport,
  WorkspaceCoverageMetrics,
  WorkspaceManifestEntry
} from '@/types/context';
import { resolveGenerationProfile } from '@/utils/generationProfile';

interface AnalyzeWorkspaceIntelligenceOptions {
  files: ProjectFile[];
  prompt?: string;
  generationProfile?: GenerationProfile;
  activeFile?: string | null;
  recentPreviewErrors?: string[];
  interactionMode?: InteractionMode;
  minContextConfidence?: number;
  maxContextChars?: number;
}

export interface StrictWritePolicy {
  mode: 'minimal';
  interactionMode: InteractionMode;
  touchBudgetMode: TouchBudgetMode;
  allowedEditPaths: string[];
  allowedCreateRules: WorkspaceAllowedCreateRule[];
  maxTouchedFiles: number;
  minContextConfidence: number;
  analysisConfidence: number;
  manifestPaths: string[];
}

const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', 'build', '.next', '.git', 'coverage']);

const CRITICAL_CONFIG_BASENAMES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tsconfig.base.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  '.env',
  '.env.local',
  '.env.example'
]);

const EXT_CODE = new Set(['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'sass', 'html', 'htm', 'json']);
const EXT_ASSET = new Set(['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'avif', 'woff', 'woff2', 'ttf']);
const EXT_DOC = new Set(['md', 'txt', 'adoc']);

const normalizePath = (value: string) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .trim();

const basename = (path: string) => {
  const normalized = normalizePath(path);
  if (!normalized) return '';
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
};

const extension = (path: string) => {
  const name = basename(path);
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
};

const isFirstPartyPath = (path: string) => {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  const segments = normalized.split('/').filter(Boolean);
  return !segments.some((segment) => EXCLUDED_SEGMENTS.has(segment.toLowerCase()));
};

const classifyManifestType = (path: string): WorkspaceManifestEntry['type'] => {
  const name = basename(path).toLowerCase();
  const ext = extension(path);
  if (CRITICAL_CONFIG_BASENAMES.has(name) || name.includes('config') || name.includes('lock')) return 'config';
  if (EXT_ASSET.has(ext)) return 'asset';
  if (EXT_DOC.has(ext)) return 'doc';
  if (EXT_CODE.has(ext)) return 'code';
  return 'other';
};

const hashString = (value: string) => {
  let hash = 5381;
  const input = String(value || '');
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return `h${(hash >>> 0).toString(16)}`;
};

const extractPromptPathCandidates = (prompt: string): string[] => {
  const out = new Set<string>();
  const re =
    /(?:^|[\s("'`])((?:frontend|src|pages|components|styles|scripts|assets|data|public)\/[^\s"'`]+|[a-zA-Z0-9_-]+\.(?:tsx?|jsx?|css|scss|sass|html?|md|svg|json))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(String(prompt || ''))) !== null) {
    const value = normalizePath(match[1] || '');
    if (value) out.add(value);
    if (out.size >= 32) break;
  }
  return Array.from(out);
};

const resolveMentionToPath = (mention: string, availablePaths: string[]): string | null => {
  const normalizedMention = normalizePath(mention).toLowerCase();
  if (!normalizedMention) return null;
  const exact = availablePaths.find((path) => path.toLowerCase() === normalizedMention);
  if (exact) return exact;
  const suffix = availablePaths.filter((path) => path.toLowerCase().endsWith(`/${normalizedMention}`));
  if (suffix.length === 1) return suffix[0];
  const base = basename(normalizedMention);
  const byBase = availablePaths.filter((path) => basename(path).toLowerCase() === base.toLowerCase());
  if (byBase.length === 1) return byBase[0];
  return null;
};

const buildDependencyAdjacency = (files: ProjectFile[]) => {
  const adjacency = new Map<string, Set<string>>();
  const edges = buildDependencyEdges(
    files.map((file) => ({
      path: file.path || file.name,
      content: file.content || ''
    }))
  );

  for (const edge of edges) {
    const from = normalizePath(edge.from);
    const to = normalizePath(edge.to);
    if (!from || !to) continue;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)!.add(to);
    adjacency.get(to)!.add(from);
  }
  return adjacency;
};

const bfsExpand = (seeds: string[], adjacency: Map<string, Set<string>>, depthLimit: number) => {
  const visited = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [];

  for (const seed of seeds) {
    const normalized = normalizePath(seed);
    if (!normalized || visited.has(normalized)) continue;
    visited.add(normalized);
    queue.push({ path: normalized, depth: 0 });
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= depthLimit) continue;
    const neighbors = adjacency.get(current.path);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ path: neighbor, depth: current.depth + 1 });
    }
  }

  return Array.from(visited);
};

const buildAllowedCreateRules = (
  interactionMode: InteractionMode,
  generationProfile: Exclude<GenerationProfile, 'auto'>,
  explicitCreatePaths: string[] = []
): WorkspaceAllowedCreateRule[] => {
  if (interactionMode === 'edit') {
    return Array.from(
      new Set(explicitCreatePaths.map((path) => normalizePath(path)).filter((path) => isFirstPartyPath(path)))
    )
      .slice(0, 16)
      .map((path) => ({
        pattern: path,
        reason: 'explicitly requested create path in edit-mode plan/prompt'
      }));
  }
  if (generationProfile === 'framework') {
    return [
      { pattern: 'src/**', reason: 'framework source output' },
      { pattern: 'public/**', reason: 'framework public assets' },
      { pattern: 'package.json', reason: 'framework package manifest' },
      { pattern: 'package-lock.json', reason: 'framework lockfile' },
      { pattern: 'pnpm-lock.yaml', reason: 'framework lockfile' },
      { pattern: 'yarn.lock', reason: 'framework lockfile' },
      { pattern: 'tsconfig.json', reason: 'framework tsconfig' },
      { pattern: 'next.config.*', reason: 'next config' },
      { pattern: 'vite.config.*', reason: 'vite config' },
      { pattern: 'postcss.config.*', reason: 'postcss config' },
      { pattern: 'tailwind.config.*', reason: 'tailwind config' },
      { pattern: '.env*', reason: 'env files' },
      { pattern: '*.md', reason: 'documentation output' }
    ];
  }

  // Static frontend: keep output predictable and preview-runner friendly.
  return [
    { pattern: 'index.html', reason: 'static HTML entry output' },
    { pattern: 'style.css', reason: 'static primary stylesheet output' },
    { pattern: 'script.js', reason: 'static primary script output' },
    { pattern: 'site-map.json', reason: 'static multipage route contract' },
    { pattern: 'pages/*.html', reason: 'static multipage output' },
    { pattern: 'pages/**/*.html', reason: 'static multipage output' },
    { pattern: 'components/*.html', reason: 'static component fragments' },
    { pattern: 'components/**/*.html', reason: 'static component fragments' },
    { pattern: 'styles/*.css', reason: 'static additional styles' },
    { pattern: 'styles/**/*.css', reason: 'static additional styles' },
    { pattern: 'scripts/*.js', reason: 'static additional scripts' },
    { pattern: 'scripts/**/*.js', reason: 'static additional scripts' },
    { pattern: 'data/*.json', reason: 'static data output' },
    { pattern: 'data/**/*.json', reason: 'static data output' },
    { pattern: 'assets/*.svg', reason: 'static svg assets' },
    { pattern: 'assets/**/*.svg', reason: 'static svg assets' },
    { pattern: 'assets/*.png', reason: 'static png assets' },
    { pattern: 'assets/**/*.png', reason: 'static png assets' },
    { pattern: 'assets/*.jpg', reason: 'static jpg assets' },
    { pattern: 'assets/**/*.jpg', reason: 'static jpg assets' },
    { pattern: 'assets/*.jpeg', reason: 'static jpeg assets' },
    { pattern: 'assets/**/*.jpeg', reason: 'static jpeg assets' },
    { pattern: 'assets/*.webp', reason: 'static webp assets' },
    { pattern: 'assets/**/*.webp', reason: 'static webp assets' },
    { pattern: 'assets/*.gif', reason: 'static gif assets' },
    { pattern: 'assets/**/*.gif', reason: 'static gif assets' },
    { pattern: 'assets/*.ico', reason: 'static icon assets' },
    { pattern: 'assets/**/*.ico', reason: 'static icon assets' },
    { pattern: 'assets/*.woff', reason: 'static font assets' },
    { pattern: 'assets/**/*.woff', reason: 'static font assets' },
    { pattern: 'assets/*.woff2', reason: 'static font assets' },
    { pattern: 'assets/**/*.woff2', reason: 'static font assets' },
    { pattern: 'assets/*.ttf', reason: 'static font assets' },
    { pattern: 'assets/**/*.ttf', reason: 'static font assets' },
    { pattern: 'assets/*.otf', reason: 'static font assets' },
    { pattern: 'assets/**/*.otf', reason: 'static font assets' },
    { pattern: 'favicon.ico', reason: 'static favicon output' },
    { pattern: 'robots.txt', reason: 'static robots output' },
    { pattern: 'README.md', reason: 'documentation output' }
  ];
};

const round = (value: number) => Math.max(0, Math.min(100, Math.round(value * 100) / 100));

const computeCoverageMetrics = (args: {
  requiredReadSet: string[];
  expandedReadSet: string[];
  previewSignalPaths: string[];
  activePath: string;
  dependencyAdjacency: Map<string, Set<string>>;
  estimatedContextChars: number;
  maxContextChars: number;
}): WorkspaceCoverageMetrics => {
  const requiredSet = new Set(args.requiredReadSet.map((path) => normalizePath(path)));
  const expandedSet = new Set(args.expandedReadSet.map((path) => normalizePath(path)));
  const previewSet = new Set(args.previewSignalPaths.map((path) => normalizePath(path)));

  const requiredCovered =
    requiredSet.size === 0
      ? 100
      : (Array.from(requiredSet).filter((path) => expandedSet.has(path)).length / requiredSet.size) * 100;

  const directDeps = new Set<string>();
  for (const path of requiredSet) {
    const neighbors = args.dependencyAdjacency.get(path);
    if (!neighbors) continue;
    for (const neighbor of neighbors) directDeps.add(neighbor);
  }
  const dependencyCoverage =
    directDeps.size === 0
      ? 100
      : (Array.from(directDeps).filter((path) => expandedSet.has(path)).length / directDeps.size) * 100;

  const previewSignalCoverage =
    previewSet.size === 0
      ? 100
      : (Array.from(previewSet).filter((path) => expandedSet.has(path)).length / previewSet.size) * 100;

  const activeRecencyCoverage = args.activePath
    ? expandedSet.has(args.activePath)
      ? 100
      : 30
    : requiredSet.size > 0
      ? 85
      : 100;

  const remainingChars = Math.max(0, args.maxContextChars - args.estimatedContextChars);
  const tokenHeadroomCoverage = args.maxContextChars <= 0 ? 100 : (remainingChars / args.maxContextChars) * 100;

  const overallConfidence =
    requiredCovered * 0.4 +
    dependencyCoverage * 0.25 +
    previewSignalCoverage * 0.15 +
    activeRecencyCoverage * 0.1 +
    tokenHeadroomCoverage * 0.1;

  return {
    requiredSetCoverage: round(requiredCovered),
    dependencyCoverage: round(dependencyCoverage),
    previewSignalCoverage: round(previewSignalCoverage),
    activeRecencyCoverage: round(activeRecencyCoverage),
    tokenHeadroomCoverage: round(tokenHeadroomCoverage),
    overallConfidence: round(overallConfidence)
  };
};

export const analyzeWorkspaceIntelligence = (
  options: AnalyzeWorkspaceIntelligenceOptions
): WorkspaceAnalysisReport => {
  const files = Array.isArray(options.files) ? options.files : [];
  const firstPartyFiles = files
    .map((file) => ({
      path: normalizePath(file.path || file.name || ''),
      content: String(file.content || '')
    }))
    .filter((file) => file.path.length > 0 && isFirstPartyPath(file.path));

  const fileByPath = new Map(firstPartyFiles.map((file) => [file.path, file]));
  const allPaths = firstPartyFiles.map((file) => file.path);
  const activePath = normalizePath(options.activeFile || '');
  const promptCandidates = extractPromptPathCandidates(options.prompt || '');
  const interactionMode = options.interactionMode || 'create';
  const resolvedProfile = resolveGenerationProfile({
    requested: options.generationProfile,
    prompt: options.prompt || '',
    filePaths: allPaths
  });
  const previewSignals = (options.recentPreviewErrors || []).map((line) => String(line || '').toLowerCase());

  const manifest: WorkspaceManifestEntry[] = firstPartyFiles.map((file) => ({
    path: file.path,
    hash: hashString(`${file.path}:${file.content}`),
    size: file.content.length,
    type: classifyManifestType(file.path),
    extension: extension(file.path)
  }));

  const requiredReadSet = new Set<string>();
  const explicitEditCandidates = new Set<string>();
  const explicitCreateCandidates = new Set<string>();
  if (activePath && fileByPath.has(activePath)) requiredReadSet.add(activePath);
  if (activePath && fileByPath.has(activePath)) explicitEditCandidates.add(activePath);

  for (const candidate of promptCandidates) {
    const resolved = resolveMentionToPath(candidate, allPaths);
    if (resolved) {
      requiredReadSet.add(resolved);
      explicitEditCandidates.add(resolved);
      continue;
    }
    if (interactionMode === 'edit' && isFirstPartyPath(candidate)) {
      explicitCreateCandidates.add(candidate);
    }
  }

  const previewSignalPaths = allPaths.filter((path) => {
    const base = basename(path).toLowerCase();
    if (!base) return false;
    return previewSignals.some((line) => line.includes(base));
  });
  for (const path of previewSignalPaths) {
    requiredReadSet.add(path);
    explicitEditCandidates.add(path);
  }

  for (const path of allPaths) {
    if (CRITICAL_CONFIG_BASENAMES.has(basename(path).toLowerCase())) {
      requiredReadSet.add(path);
    }
  }

  if (requiredReadSet.size === 0 && allPaths.length > 0) {
    requiredReadSet.add(allPaths[0]);
  }

  const dependencyAdjacency = buildDependencyAdjacency(
    firstPartyFiles.map((file) => ({
      name: basename(file.path),
      path: file.path,
      content: file.content
    }))
  );

  const expandedSet = new Set<string>([
    ...Array.from(requiredReadSet),
    ...bfsExpand(Array.from(requiredReadSet), dependencyAdjacency, 2)
  ]);

  for (const path of allPaths) {
    if (CRITICAL_CONFIG_BASENAMES.has(basename(path).toLowerCase())) {
      expandedSet.add(path);
    }
  }

  const expandedReadSet = Array.from(expandedSet).filter((path) => fileByPath.has(path));
  const requiredReadSetList = Array.from(requiredReadSet);
  const minimalEditSet = new Set<string>(
    Array.from(explicitEditCandidates)
      .map((path) => normalizePath(path))
      .filter((path) => fileByPath.has(path))
  );

  if (interactionMode === 'edit') {
    const normalizedActive = normalizePath(activePath);
    if (normalizedActive && fileByPath.has(normalizedActive)) {
      minimalEditSet.add(normalizedActive);
    }

    for (const path of requiredReadSetList.slice(0, 8)) {
      const normalized = normalizePath(path);
      if (normalized && fileByPath.has(normalized)) {
        minimalEditSet.add(normalized);
      }
    }

    const baselineNames = new Set(['index.html', 'style.css', 'script.js']);
    for (const path of allPaths) {
      const name = basename(path).toLowerCase();
      if (baselineNames.has(name)) {
        minimalEditSet.add(path);
      }
    }
  }

  if (minimalEditSet.size === 0 && requiredReadSetList.length > 0) {
    for (const path of requiredReadSetList.slice(0, 3)) {
      const normalized = normalizePath(path);
      if (normalized && fileByPath.has(normalized)) {
        minimalEditSet.add(normalized);
      }
    }
  }
  const allowedEditPaths =
    interactionMode === 'edit'
      ? Array.from(minimalEditSet)
      : Array.from(new Set(expandedReadSet.map((path) => normalizePath(path))));
  const allowedCreateRules = buildAllowedCreateRules(interactionMode, resolvedProfile, Array.from(explicitCreateCandidates));
  const maxContextChars = Math.max(20_000, Number(options.maxContextChars || 120_000));
  const estimatedContextChars = expandedReadSet.reduce((acc, path) => acc + String(fileByPath.get(path)?.content || '').length, 0);

  const coverageMetrics = computeCoverageMetrics({
    requiredReadSet: Array.from(requiredReadSet),
    expandedReadSet,
    previewSignalPaths,
    activePath,
    dependencyAdjacency,
    estimatedContextChars,
    maxContextChars
  });

  const confidence = round(coverageMetrics.overallConfidence);
  const minContextConfidence = Math.max(0, Number(options.minContextConfidence ?? 80));
  const riskFlags: string[] = [];
  if (confidence < minContextConfidence) riskFlags.push('LOW_CONFIDENCE');
  if (coverageMetrics.requiredSetCoverage < 100) riskFlags.push('MISSING_REQUIRED_READS');
  if (coverageMetrics.dependencyCoverage < 60) riskFlags.push('LOW_DEPENDENCY_COVERAGE');
  if (coverageMetrics.previewSignalCoverage < 80) riskFlags.push('LOW_PREVIEW_SIGNAL_COVERAGE');
  if (estimatedContextChars > maxContextChars) riskFlags.push('CONTEXT_BUDGET_PRESSURE');

  return {
    manifest,
    requiredReadSet: requiredReadSetList,
    expandedReadSet,
    allowedEditPaths,
    allowedCreateRules,
    confidence,
    coverageMetrics,
    riskFlags
  };
};

export const buildStrictWritePolicy = (args: {
  report: WorkspaceAnalysisReport;
  minContextConfidence?: number;
  interactionMode?: InteractionMode;
  touchBudgetMode?: TouchBudgetMode;
}): StrictWritePolicy => {
  const minConfidence = Math.max(0, Number(args.minContextConfidence ?? 80));
  const interactionMode = args.interactionMode || 'create';
  const touchBudgetMode = args.touchBudgetMode || 'adaptive';
  const allowedEditPaths = Array.from(
    new Set(args.report.allowedEditPaths.map((path) => normalizePath(path)).filter(Boolean))
  );
  const editBudget = Math.max(1, allowedEditPaths.length);
  const createBudget = Math.max(0, args.report.allowedCreateRules.length);
  const riskWeight = Math.max(1, args.report.riskFlags.length);
  const expandedWeight = Math.max(1, Math.ceil(args.report.expandedReadSet.length / 6));
  const adaptiveBase =
    interactionMode === 'edit'
      ? Math.max(1, Math.min(36, editBudget + Math.ceil(createBudget / 2) + expandedWeight + riskWeight))
      : Math.max(6, Math.min(48, allowedEditPaths.length + createBudget + expandedWeight + 6));
  const minimalBase = interactionMode === 'edit' ? Math.max(1, Math.min(12, editBudget + createBudget)) : Math.max(6, Math.min(24, allowedEditPaths.length + 4));
  const maxTouchedFiles = touchBudgetMode === 'minimal' ? minimalBase : adaptiveBase;

  return {
    mode: 'minimal',
    interactionMode,
    touchBudgetMode,
    allowedEditPaths,
    allowedCreateRules: args.report.allowedCreateRules,
    maxTouchedFiles,
    minContextConfidence: minConfidence,
    analysisConfidence: args.report.confidence,
    manifestPaths: args.report.manifest.map((entry) => entry.path)
  };
};

export const getWorkspaceBlockReason = (report: WorkspaceAnalysisReport, minContextConfidence = 80) => {
  if (report.confidence >= minContextConfidence) return null;
  const metrics = report.coverageMetrics;
  return [
    `Workspace analysis confidence ${report.confidence.toFixed(1)} is below threshold ${minContextConfidence}.`,
    `required=${metrics.requiredSetCoverage.toFixed(1)}%`,
    `dependencies=${metrics.dependencyCoverage.toFixed(1)}%`,
    `preview-signals=${metrics.previewSignalCoverage.toFixed(1)}%`,
    `token-headroom=${metrics.tokenHeadroomCoverage.toFixed(1)}%`,
    'next-step=add explicit target file paths in prompt/plan and retry',
    report.riskFlags.length > 0 ? `flags=${report.riskFlags.join(', ')}` : ''
  ]
    .filter(Boolean)
    .join(' | ');
};
