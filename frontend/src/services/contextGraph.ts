import type { ContextRetrievalItem, ContextRetrievalTrace, DependencyEdge, FileNode } from '@/types/context';

type ContextGraphInputFile = {
  path?: string;
  name?: string;
  content?: string;
};

const normalizePath = (value: string) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .trim();

const getExtension = (path: string) => {
  const clean = normalizePath(path);
  const idx = clean.lastIndexOf('.');
  return idx === -1 ? '' : clean.slice(idx + 1).toLowerCase();
};

const toFileNodes = (files: ContextGraphInputFile[]): FileNode[] =>
  files
    .map((file) => {
      const path = normalizePath(file.path || file.name || '');
      const content = String(file.content || '');
      if (!path) return null;
      const ext = getExtension(path);
      const tags: string[] = [];
      if (/(html|htm)/.test(ext)) tags.push('page');
      if (/(js|ts|tsx|jsx)/.test(ext)) tags.push('script');
      if (/(css|scss|sass)/.test(ext)) tags.push('style');
      if (/(json|md)/.test(ext)) tags.push('meta');
      return {
        path,
        type: 'file' as const,
        extension: ext,
        size: content.length,
        tags,
        lastTouchedAt: Date.now()
      };
    })
    .filter((node): node is FileNode => Boolean(node));

const extractRefs = (content: string) => {
  const refs: string[] = [];
  const re = /(href|src|from)\s*[:=]?\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const raw = String(match[2] || '').trim();
    if (!raw || raw.startsWith('#') || /^[a-z]+:\/\//i.test(raw)) continue;
    refs.push(raw);
  }
  return refs;
};

export const buildDependencyEdges = (files: ContextGraphInputFile[]): DependencyEdge[] => {
  const knownPaths = new Set(files.map((f) => normalizePath(f.path || f.name || '')).filter(Boolean));
  const edges: DependencyEdge[] = [];

  for (const file of files) {
    const from = normalizePath(file.path || file.name || '');
    const content = String(file.content || '');
    if (!from) continue;

    const refs = extractRefs(content);
    for (const ref of refs) {
      const normalizedRef = normalizePath(ref);
      if (!normalizedRef) continue;
      const to =
        knownPaths.has(normalizedRef)
          ? normalizedRef
          : Array.from(knownPaths).find((path) => path.endsWith(`/${normalizedRef}`) || path === normalizedRef);
      if (!to) continue;
      edges.push({
        from,
        to,
        type: /href/i.test(ref) ? 'route' : /src/i.test(ref) ? 'asset' : 'import',
        weight: 1
      });
    }
  }

  return edges;
};

type ContextSelectionOptions = {
  files: ContextGraphInputFile[];
  activeFile?: string | null;
  recentPreviewErrors?: string[];
  mode?: 'balanced_graph' | 'light' | 'max' | 'strict_full';
  maxItems?: number;
};

const scorePath = (
  path: string,
  activeFile: string,
  recentPreviewErrors: string[],
  degree: number,
  dependencyDistance: number
) => {
  let score = 0;
  const normalized = normalizePath(path);
  const active = normalizePath(activeFile);
  if (normalized === active) score += 120;
  if (active && normalized.includes(active.split('/').slice(0, -1).join('/'))) score += 18;
  if (recentPreviewErrors.some((line) => line.includes(normalized.split('/').pop() || ''))) score += 35;
  if (Number.isFinite(dependencyDistance)) {
    score += Math.max(0, 28 - Math.min(28, dependencyDistance * 7));
  }
  score += Math.min(24, degree * 4);
  if (/\.(html|css|js|ts|tsx|jsx)$/i.test(normalized)) score += 6;
  return score;
};

export const selectContextRetrievalTrace = (options: ContextSelectionOptions): ContextRetrievalTrace => {
  const mode = options.mode || 'balanced_graph';
  const maxItems = options.maxItems || (mode === 'light' ? 24 : mode === 'max' ? 90 : mode === 'strict_full' ? 120 : 56);
  const files = options.files || [];
  const activeFile = options.activeFile || '';
  const recentPreviewErrors = (options.recentPreviewErrors || []).map((item) => String(item || ''));
  const fileNodes = toFileNodes(files);
  const edges = buildDependencyEdges(files);

  const degreeByPath = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    degreeByPath.set(edge.from, (degreeByPath.get(edge.from) || 0) + 1);
    degreeByPath.set(edge.to, (degreeByPath.get(edge.to) || 0) + 1);
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    adjacency.get(edge.from)!.add(edge.to);
    adjacency.get(edge.to)!.add(edge.from);
  }

  const errorSeedPaths = new Set<string>();
  for (const node of fileNodes) {
    const base = node.path.split('/').pop() || '';
    if (!base) continue;
    if (recentPreviewErrors.some((line) => line.includes(base))) {
      errorSeedPaths.add(node.path);
    }
  }

  const seedPaths = new Set<string>();
  const normalizedActive = normalizePath(activeFile);
  if (normalizedActive) seedPaths.add(normalizedActive);
  for (const seed of errorSeedPaths) seedPaths.add(seed);

  const distanceByPath = new Map<string, number>();
  if (seedPaths.size > 0) {
    const queue: Array<{ path: string; distance: number }> = [];
    for (const seed of seedPaths) {
      distanceByPath.set(seed, 0);
      queue.push({ path: seed, distance: 0 });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current.path);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (distanceByPath.has(neighbor)) continue;
        const nextDistance = current.distance + 1;
        distanceByPath.set(neighbor, nextDistance);
        queue.push({ path: neighbor, distance: nextDistance });
      }
    }
  }

  const scored = fileNodes
    .map((node) => {
      const degree = degreeByPath.get(node.path) || 0;
      const dependencyDistance = distanceByPath.has(node.path) ? Number(distanceByPath.get(node.path)) : Number.POSITIVE_INFINITY;
      const score = scorePath(node.path, activeFile, recentPreviewErrors, degree, dependencyDistance);
      const reasons: string[] = [];
      if (normalizePath(node.path) === normalizePath(activeFile || '')) reasons.push('active-file');
      if (degree > 0) reasons.push(`dependency-degree:${degree}`);
      if (recentPreviewErrors.some((line) => line.includes(node.path.split('/').pop() || ''))) reasons.push('error-proximity');
      if (Number.isFinite(dependencyDistance)) reasons.push(`dependency-distance:${dependencyDistance}`);
      if (reasons.length === 0) reasons.push('global-context');
      return { path: node.path, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const selected: ContextRetrievalItem[] = scored.slice(0, maxItems).map((item) => ({
    path: item.path,
    score: item.score,
    reasons: item.reasons
  }));
  const dropped: ContextRetrievalItem[] = scored.slice(maxItems).map((item) => ({
    path: item.path,
    score: item.score,
    reasons: item.reasons
  }));

  return {
    selected,
    dropped,
    budgetUsed: selected.length,
    budgetMax: maxItems,
    generatedAt: Date.now(),
    strategy: mode
  };
};
