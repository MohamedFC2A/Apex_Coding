import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Code, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { repairTruncatedContent, validatePreviewContent } from '@/utils/codeRepair';
import { buildLivePreviewPath, publishLivePreviewSnapshot } from '@/utils/livePreviewLink';
import { readAppSettings } from '@/utils/appSettings';

interface SimplePreviewProps {
  className?: string;
}

type ProjectFileLike = {
  path?: string;
  name?: string;
  content?: string;
};

type PreviewMeta = {
  mode: 'html' | 'fallback';
  entryFile: string | null;
  fileCount: number;
  folderCount: number;
  resolvedRefs: number;
  autoMappedRefs: number;
  sanitizedSvgPaths: number;
  sanitizedSvgViewBoxes: number;
  sanitizedScripts: number;
  unresolvedRefs: string[];
  note: string;
};

const DEFAULT_META: PreviewMeta = {
  mode: 'fallback',
  entryFile: null,
  fileCount: 0,
  folderCount: 0,
  resolvedRefs: 0,
  autoMappedRefs: 0,
  sanitizedSvgPaths: 0,
  sanitizedSvgViewBoxes: 0,
  sanitizedScripts: 0,
  unresolvedRefs: [],
  note: 'Waiting for files'
};

const isExternalAssetUrl = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed)) return true;
  return (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('#')
  );
};

const normalizePath = (value: string) => {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
    .replace(/^\//, '')
    .trim();
};

const dirname = (value: string) => {
  const clean = normalizePath(value);
  const idx = clean.lastIndexOf('/');
  if (idx === -1) return '';
  return clean.slice(0, idx);
};

const joinPath = (baseDir: string, relativePath: string) => {
  const base = normalizePath(baseDir);
  const rel = normalizePath(relativePath);
  if (!rel) return base;
  const stack = [...(base ? base.split('/') : []), ...rel.split('/')];
  const normalized: string[] = [];
  for (const part of stack) {
    if (!part || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.join('/');
};

const extensionOf = (value: string) => {
  const clean = normalizePath(value);
  const idx = clean.lastIndexOf('.');
  if (idx === -1) return '';
  return clean.slice(idx + 1).toLowerCase();
};

const mimeTypeFromPath = (value: string) => {
  const ext = extensionOf(value);
  if (ext === 'html' || ext === 'htm') return 'text/html';
  if (ext === 'css') return 'text/css';
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'text/javascript';
  if (ext === 'json') return 'application/json';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'ico') return 'image/x-icon';
  if (ext === 'woff') return 'font/woff';
  if (ext === 'woff2') return 'font/woff2';
  if (ext === 'ttf') return 'font/ttf';
  return 'text/plain';
};

const encodeBase64Utf8 = (value: string) => {
  const bytes = new TextEncoder().encode(String(value || ''));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const toDataUrl = (content: string, mimeType: string) => {
  return `data:${mimeType};base64,${encodeBase64Utf8(content)}`;
};

const sanitizeSvgPathData = (value: string) => {
  const raw = String(value || '');
  const cutAtEncoded = raw.search(/(?:\\u003c|&lt;|<|…)/i);
  const base = cutAtEncoded >= 0 ? raw.slice(0, cutAtEncoded) : raw;
  const cleaned = base
    .replace(/[\u2018\u2019\u201C\u201D]/g, '')
    .replace(/[^MmLlHhVvCcSsQqTtAaZz0-9eE,.\-\s]/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const tokens = cleaned.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g);
  if (!tokens || tokens.length === 0) return null;
  const normalized = tokens.join(' ').replace(/\s+/g, ' ').trim();
  if (!/[MmLlHhVvCcSsQqTtAaZz]/.test(normalized)) return null;
  return normalized;
};

const isValidSvgPathData = (value: string) => {
  const pathData = String(value || '').trim();
  if (!pathData || typeof document === 'undefined') return false;
  try {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.getTotalLength();
    return true;
  } catch {
    return false;
  }
};

const trimPathDataToValid = (value: string) => {
  const tokens = String(value || '').split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 2; i -= 1) {
    const candidate = tokens.slice(0, i).join(' ');
    if (!/[MmLlHhVvCcSsQqTtAaZz]/.test(candidate)) continue;
    if (isValidSvgPathData(candidate)) return candidate;
  }
  return null;
};

const formatSvgNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.abs(value) < 1e-7 ? 0 : value;
  return Number.isInteger(rounded) ? String(rounded) : String(Number(rounded.toFixed(6)));
};

const isValidSvgViewBox = (value: string) => {
  const nums = String(value || '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (nums.length !== 4) return false;
  if (nums.some((n) => !Number.isFinite(n))) return false;
  return nums[2] > 0 && nums[3] > 0;
};

const sanitizeSvgViewBox = (value: string) => {
  const raw = String(value || '');
  const cutAtEncoded = raw.search(/(?:\\u003c|&lt;|<|…)/i);
  const base = cutAtEncoded >= 0 ? raw.slice(0, cutAtEncoded) : raw;
  const normalized = base.replace(/,/g, ' ').trim();
  const numbers = normalized.match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) || [];

  if (numbers.length >= 4) {
    const parsed = numbers.slice(0, 4).map((token) => Number(token));
    if (parsed.every((n) => Number.isFinite(n)) && parsed[2] > 0 && parsed[3] > 0) {
      return parsed.map(formatSvgNumber).join(' ');
    }
  }

  const compact = normalized.replace(/[^\d.-]/g, '');
  if (/^00\d{4,8}$/.test(compact)) {
    const rest = compact.slice(2);
    if (rest.length % 2 === 0) {
      const mid = rest.length / 2;
      const width = Number(rest.slice(0, mid));
      const height = Number(rest.slice(mid));
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return `0 0 ${formatSvgNumber(width)} ${formatSvgNumber(height)}`;
      }
    }
  }

  return '0 0 24 24';
};

const sanitizeSvgNodes = (root: ParentNode) => {
  let sanitizedPathCount = 0;
  let sanitizedViewBoxCount = 0;

  const viewBoxTargets = new Set<Element>();
  if (root instanceof Element && root.tagName.toLowerCase() === 'svg') {
    viewBoxTargets.add(root);
  }
  root.querySelectorAll?.('svg').forEach((svgNode) => viewBoxTargets.add(svgNode));

  viewBoxTargets.forEach((svgNode) => {
    const raw = svgNode.getAttribute('viewBox');
    if (!raw) return;
    if (isValidSvgViewBox(raw)) return;
    const next = sanitizeSvgViewBox(raw);
    if (next) {
      svgNode.setAttribute('viewBox', next);
      sanitizedViewBoxCount += 1;
      return;
    }
    svgNode.removeAttribute('viewBox');
    sanitizedViewBoxCount += 1;
  });

  root.querySelectorAll?.('path[d]').forEach((pathNode) => {
    const raw = pathNode.getAttribute('d') || '';
    if (!raw) return;
    if (isValidSvgPathData(raw)) return;

    const sanitized = sanitizeSvgPathData(raw);
    if (sanitized && isValidSvgPathData(sanitized)) {
      pathNode.setAttribute('d', sanitized);
      sanitizedPathCount += 1;
      return;
    }

    if (sanitized) {
      const trimmed = trimPathDataToValid(sanitized);
      if (trimmed) {
        pathNode.setAttribute('d', trimmed);
        sanitizedPathCount += 1;
        return;
      }
    }

    pathNode.removeAttribute('d');
    sanitizedPathCount += 1;
  });

  return { sanitizedPathCount, sanitizedViewBoxCount };
};

const isValidClassicScript = (source: string) => {
  try {
    // eslint-disable-next-line no-new-func
    new Function(source);
    return true;
  } catch {
    return false;
  }
};

const normalizeExternalResource = (url: string, kind: 'script' | 'style') => {
  const value = String(url || '').trim();
  if (!value) return null;
  // cdnjs does not provide lucide css/js for the versions commonly hallucinated by models.
  if (/cdnjs\.cloudflare\.com\/ajax\/libs\/lucide\//i.test(value)) {
    if (kind === 'script') return 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
    return null;
  }
  return value;
};

const quickHash = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
};

const rewriteCssUrls = (
  content: string,
  fromPath: string,
  resolveToUrl: (from: string, ref: string) => string | null
) => {
  return String(content || '').replace(/url\(([^)]+)\)/gi, (full, rawValue: string) => {
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
    if (!value || isExternalAssetUrl(value)) return full;
    const blobUrl = resolveToUrl(fromPath, value);
    if (!blobUrl) return full;
    return `url("${blobUrl}")`;
  });
};

const rewriteJavaScriptImports = (
  content: string,
  fromPath: string,
  resolveToUrl: (from: string, ref: string) => string | null
) => {
  let output = String(content || '');

  output = output.replace(
    /((?:import|export)\s+(?:[\s\S]*?)\s+from\s*)(['"])([^'"]+)\2/g,
    (full, prefix: string, quote: string, ref: string) => {
      if (isExternalAssetUrl(ref)) return full;
      const next = resolveToUrl(fromPath, ref);
      if (!next) return full;
      return `${prefix}${quote}${next}${quote}`;
    }
  );

  output = output.replace(/(import\(\s*)(['"])([^'"]+)\2(\s*\))/g, (full, start, quote, ref, end) => {
    if (isExternalAssetUrl(ref)) return full;
    const next = resolveToUrl(fromPath, ref);
    if (!next) return full;
    return `${start}${quote}${next}${quote}${end}`;
  });

  output = output.replace(/(new\s+Worker\(\s*)(['"])([^'"]+)\2(\s*[,)\}])/g, (full, start, quote, ref, end) => {
    if (isExternalAssetUrl(ref)) return full;
    const next = resolveToUrl(fromPath, ref);
    if (!next) return full;
    return `${start}${quote}${next}${quote}${end}`;
  });

  return output;
};

const buildFallbackHtml = (files: ProjectFileLike[], fileCount: number, folderCount: number) => {
  const list = files
    .map((file) => normalizePath(file.path || file.name || 'untitled'))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => `<li>${path}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Simple Preview</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(900px 600px at 15% 20%, rgba(14, 165, 233, 0.16), transparent 60%),
        radial-gradient(900px 700px at 85% 80%, rgba(99, 102, 241, 0.14), transparent 60%),
        #040712;
      color: #f8fafc;
    }
    .card {
      width: min(860px, calc(100vw - 32px));
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(8, 14, 28, 0.72);
      box-shadow: 0 22px 60px rgba(2, 6, 23, 0.62);
      padding: 28px;
      backdrop-filter: blur(22px);
    }
    h1 { margin: 0 0 8px; font-size: clamp(1.3rem, 2vw + 1rem, 2.2rem); }
    p { margin: 0; color: rgba(226,232,240,0.75); line-height: 1.5; }
    .stats { display: flex; gap: 10px; margin: 18px 0 20px; flex-wrap: wrap; }
    .pill {
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.13);
      background: rgba(255,255,255,0.05);
      font-size: 12px;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      max-height: min(48vh, 360px);
      overflow: auto;
      display: grid;
      gap: 8px;
    }
    li {
      padding: 9px 11px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(15, 23, 42, 0.58);
      font-size: 13px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <section class="card">
    <h1>Simple Preview is Ready</h1>
    <p>No HTML entry file was found yet. Add <code>index.html</code> (or any HTML file) and preview will render your app with folder-aware assets.</p>
    <div class="stats">
      <span class="pill">Files: ${fileCount}</span>
      <span class="pill">Folders: ${folderCount}</span>
      <span class="pill">Mode: Fallback</span>
    </div>
    <ul>${list || '<li>No files yet</li>'}</ul>
  </section>
</body>
</html>`;
};

export const SimplePreview: React.FC<SimplePreviewProps> = ({ className }) => {
  const files = useProjectStore((state) => state.files) as ProjectFileLike[];
  const projectId = useProjectStore((state) => state.projectId);
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const lastFilesHashRef = useRef<string>('');

  const [previewContent, setPreviewContent] = useState('');
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta>(DEFAULT_META);
  const [runtimeState, setRuntimeState] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const ensureProjectId = useCallback(() => {
    const currentId = String(useProjectStore.getState().projectId || projectId || '').trim();
    if (currentId) return currentId;
    const createdId = `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setProjectId(createdId);
    return createdId;
  }, [projectId, setProjectId]);

  const publishSnapshot = useCallback(
    (html: string, meta: PreviewMeta) => {
      const stableProjectId = ensureProjectId();
      publishLivePreviewSnapshot(stableProjectId, html, meta as unknown as Record<string, unknown>);
    },
    [ensureProjectId]
  );

  const { htmlFiles, folderCount } = useMemo(() => {
    const html = files.filter((file) => /\.(html|htm)$/i.test(String(file.path || file.name || '')));
    const folders = new Set<string>();
    files.forEach((file) => {
      const path = normalizePath(file.path || file.name || '');
      const dir = dirname(path);
      if (dir) folders.add(dir);
    });
    return { htmlFiles: html, folderCount: folders.size };
  }, [files]);

  const filesHash = useMemo(() => {
    return files
      .map((file) => {
        const path = normalizePath(file.path || file.name || 'untitled');
        const content = String(file.content || '');
        return `${path}:${content.length}:${quickHash(content)}`;
      })
      .join('|');
  }, [files]);

  const generatePreview = useCallback(() => {
    try {
      setError(null);
      setRuntimeState('rendering');

      if (files.length === 0) {
        setPreviewContent('');
        setPreviewMeta({
          ...DEFAULT_META,
          note: 'No files in workspace'
        });
        return;
      }

      const normalizedFiles = files
        .map((file) => ({
          ...file,
          normalizedPath: normalizePath(file.path || file.name || '')
        }))
        .filter((file) => file.normalizedPath);

      const pathToFile = new Map<string, (ProjectFileLike & { normalizedPath: string })>();
      normalizedFiles.forEach((file) => pathToFile.set(file.normalizedPath, file));
      const allPaths = Array.from(pathToFile.keys());
      const fileNameIndex = new Map<string, string[]>();
      allPaths.forEach((path) => {
        const base = path.split('/').pop() || path;
        const list = fileNameIndex.get(base) || [];
        list.push(path);
        fileNameIndex.set(base, list);
      });
      const autoMapped = new Set<string>();
      let projectRootDir = '';

      const resolveProjectPath = (fromPath: string, reference: string) => {
        if (!reference) return null;
        if (isExternalAssetUrl(reference)) return null;
        const cleanRef = normalizePath(reference);
        if (!cleanRef) return null;

        const candidates: string[] = [];
        const pushCandidate = (candidate: string) => {
          const clean = normalizePath(candidate);
          if (!clean) return;
          if (!candidates.includes(clean)) candidates.push(clean);
        };

        const addSrcFallbacks = (candidate: string) => {
          const clean = normalizePath(candidate);
          if (!clean) return;
          const srcPrefix = 'src/';
          if (!clean.startsWith(srcPrefix)) return;
          const withoutSrc = clean.slice(srcPrefix.length);
          pushCandidate(`frontend/src/${withoutSrc}`);
          pushCandidate(`frontend/src/assets/${withoutSrc}`);
          pushCandidate(`frontend/assets/${withoutSrc}`);
        };

        if (reference.startsWith('/')) {
          pushCandidate(joinPath(projectRootDir, cleanRef));
          pushCandidate(cleanRef);
          pushCandidate(`frontend/${cleanRef}`);
          pushCandidate(`frontend/src/${cleanRef}`);
          pushCandidate(`frontend/public/${cleanRef}`);
          pushCandidate(`public/${cleanRef}`);
          addSrcFallbacks(cleanRef);
        } else {
          const baseDir = dirname(fromPath);
          const joined = joinPath(baseDir, cleanRef);
          pushCandidate(joined);
          pushCandidate(`frontend/${joined}`);
          pushCandidate(`frontend/src/${joined}`);
          pushCandidate(`frontend/public/${cleanRef}`);
          pushCandidate(`public/${cleanRef}`);
          addSrcFallbacks(cleanRef);
          addSrcFallbacks(joined);
        }

        for (const candidate of candidates) {
          if (pathToFile.has(candidate)) return candidate;
        }

        const suffixMatches = allPaths.filter((path) => path === cleanRef || path.endsWith(`/${cleanRef}`));
        const fromRoot = normalizePath(fromPath).startsWith('backend/')
          ? 'backend/'
          : projectRootDir
            ? `${normalizePath(projectRootDir)}/`
            : '';
        const referenceName = cleanRef.split('/').pop() || '';
        const referenceExt = extensionOf(cleanRef);
        const preferredByName = referenceName ? fileNameIndex.get(referenceName) || [] : [];
        const pool = suffixMatches.length > 0 ? suffixMatches : preferredByName;
        if (pool.length === 0) return null;

        const scored = pool
          .map((path) => {
            const ext = extensionOf(path);
            const score =
              (path.startsWith(fromRoot) ? 22 : 0) +
              (path.endsWith(`/${cleanRef}`) ? 14 : 0) +
              (referenceExt && ext === referenceExt ? 10 : 0) +
              (path.includes('/assets/icons/') ? 16 : 0) +
              (path.includes('/assets/') ? 10 : 0) +
              (path.includes('/src/') ? 4 : 0) -
              path.length * 0.001;
            return { path, score };
          })
          .sort((a, b) => b.score - a.score);

        const winner = scored[0]?.path || null;
        if (winner) autoMapped.add(`${fromPath} -> ${reference} => ${winner}`);
        return winner;
      };

      const selectEntryFile = () => {
        const htmlPaths = allPaths.filter((path) => {
          const ext = extensionOf(path);
          return ext === 'html' || ext === 'htm';
        });
        if (htmlPaths.length === 0) return null;

        const indexCandidates = htmlPaths.filter((path) => path === 'index.html' || path.endsWith('/index.html'));
        const candidates = indexCandidates.length > 0 ? indexCandidates : htmlPaths;

        const scoreHtmlEntry = (path: string) => {
          const file = pathToFile.get(path);
          const html = String(file?.content || '');
          const lower = html.toLowerCase();
          const base = (path.split('/').pop() || path).toLowerCase();
          const dir = dirname(path);

          let score = 0;
          if (base === 'index.html') score += 40;
          if (path === 'index.html') score += 35;
          if (dir && /^(components|partials)\b/i.test(dir)) score -= 30;
          if (path.includes('/components/')) score -= 20;

          if (/\b<!doctype\b/i.test(html)) score += 18;
          if (lower.includes('<html')) score += 10;
          if (lower.includes('<head')) score += 6;
          if (lower.includes('<body')) score += 10;
          if (lower.includes('<main')) score += 6;

          const size = html.trim().length;
          score += Math.min(25, Math.log10(size + 1) * 10);

          const stylePath = dir ? `${dir}/style.css` : 'style.css';
          const scriptPath = dir ? `${dir}/script.js` : 'script.js';
          if (pathToFile.has(stylePath)) score += 12;
          if (pathToFile.has(scriptPath)) score += 12;

          // Prefer shallower candidates when all else is equal.
          score -= Math.max(0, path.split('/').length - 1) * 2;
          return score;
        };

        return [...candidates]
          .map((path) => ({ path, score: scoreHtmlEntry(path) }))
          .sort((a, b) => b.score - a.score)[0]?.path || null;
      };

      const unresolved = new Set<string>();
      const resolved = new Set<string>();
      const resourceUrlByPath = new Map<string, string>();
      const buildingResource = new Set<string>();
      let sanitizedSvgPathCount = 0;
      let sanitizedSvgViewBoxCount = 0;
      let sanitizedScriptCount = 0;

      const resolveToResourceUrl = (fromPath: string, reference: string): string | null => {
        const resolvedPath = resolveProjectPath(fromPath, reference);
        if (!resolvedPath) {
          unresolved.add(`${fromPath} -> ${reference}`);
          return null;
        }
        const url = createResourceUrlForPath(resolvedPath);
        if (!url) {
          unresolved.add(`${fromPath} -> ${reference}`);
          return null;
        }
        resolved.add(`${fromPath} -> ${reference}`);
        return url;
      };

      const createResourceUrlForPath = (path: string): string | null => {
        if (resourceUrlByPath.has(path)) return resourceUrlByPath.get(path) || null;
        if (buildingResource.has(path)) return resourceUrlByPath.get(path) || null;

        const file = pathToFile.get(path);
        if (!file) return null;

        buildingResource.add(path);
        const ext = extensionOf(path);
        let content = String(file.content || '');

        if (ext === 'css') {
          content = rewriteCssUrls(content, path, resolveToResourceUrl);
        } else if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
          content = rewriteJavaScriptImports(content, path, resolveToResourceUrl);
          const isLikelyEsm = /\bimport\s+|\bexport\s+/.test(content);
          if (!isLikelyEsm && !isValidClassicScript(content)) {
            sanitizedScriptCount += 1;
            content = '/* Simple Preview skipped malformed JS file. */';
          }
        } else if (ext === 'svg' && typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
          try {
            const svgParser = new DOMParser();
            const svgDoc = svgParser.parseFromString(content, 'image/svg+xml');
            const hasParserError = svgDoc.getElementsByTagName('parsererror').length > 0;
            if (!hasParserError && svgDoc.documentElement) {
              const counts = sanitizeSvgNodes(svgDoc.documentElement);
              sanitizedSvgPathCount += counts.sanitizedPathCount;
              sanitizedSvgViewBoxCount += counts.sanitizedViewBoxCount;
              content = new XMLSerializer().serializeToString(svgDoc);
            }
          } catch {
            // ignore malformed standalone svg parsing failures
          }
        }

        const url = toDataUrl(content, mimeTypeFromPath(path));
        resourceUrlByPath.set(path, url);
        buildingResource.delete(path);
        return url;
      };

      const entryHtmlPath = selectEntryFile();

      if (!entryHtmlPath) {
        const fallback = buildFallbackHtml(files, files.length, folderCount);
        const fallbackMeta: PreviewMeta = {
          mode: 'fallback',
          entryFile: null,
          fileCount: files.length,
          folderCount,
          resolvedRefs: 0,
          autoMappedRefs: 0,
          sanitizedSvgPaths: 0,
          sanitizedSvgViewBoxes: 0,
          sanitizedScripts: 0,
          unresolvedRefs: [],
          note: 'No HTML entry file detected'
        };
        setPreviewContent(fallback);
        setPreviewMeta(fallbackMeta);
        publishSnapshot(fallback, fallbackMeta);
        return;
      }

      projectRootDir = dirname(entryHtmlPath);

      const entryHtml = String(pathToFile.get(entryHtmlPath)?.content || '');
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(entryHtml, 'text/html');

      if (!documentNode.querySelector('meta[charset]')) {
        const charsetMeta = documentNode.createElement('meta');
        charsetMeta.setAttribute('charset', 'UTF-8');
        documentNode.head.prepend(charsetMeta);
      }
      if (!documentNode.querySelector('meta[name="viewport"]')) {
        const viewportMeta = documentNode.createElement('meta');
        viewportMeta.setAttribute('name', 'viewport');
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
        documentNode.head.appendChild(viewportMeta);
      }

      const rewriteElementAttr = (selector: string, attr: string, removeOnFail = true) => {
        documentNode.querySelectorAll(selector).forEach((element) => {
          const value = element.getAttribute(attr);
          if (!value || isExternalAssetUrl(value)) return;
          const url = resolveToResourceUrl(entryHtmlPath, value);
          if (url) {
            element.setAttribute(attr, url);
          } else if (removeOnFail) {
            element.remove();
            unresolved.add(`${entryHtmlPath} -> removed unresolved ${selector}: ${value}`);
          } else {
            element.removeAttribute(attr);
            unresolved.add(`${entryHtmlPath} -> blanked unresolved ${attr} on ${selector}: ${value}`);
          }
        });
      };

      rewriteElementAttr('img[src]', 'src', false);
      rewriteElementAttr('video[poster]', 'poster', false);
      rewriteElementAttr('source[src]', 'src', true);
      rewriteElementAttr('audio[src]', 'src', true);
      rewriteElementAttr('object[data]', 'data', true);

      documentNode.querySelectorAll('a[href]').forEach((anchor) => {
        const href = String(anchor.getAttribute('href') || '').trim();
        if (!href || isExternalAssetUrl(href)) return;

        const [pathAndQueryRaw, hashRaw] = href.split('#', 2);
        const [pathOnlyRaw, queryRaw] = String(pathAndQueryRaw || '').split('?', 2);
        const hashSuffix = hashRaw ? `#${hashRaw}` : '';
        const querySuffix = queryRaw ? `?${queryRaw}` : '';

        let targetPath = String(pathOnlyRaw || '').trim();
        if (!targetPath || targetPath === '.') {
          targetPath = entryHtmlPath;
        } else if (targetPath === '/') {
          targetPath = 'index.html';
        }

        const targetUrl = resolveToResourceUrl(entryHtmlPath, targetPath);
        if (targetUrl) {
          anchor.setAttribute('href', `${targetUrl}${querySuffix}${hashSuffix}`);
        } else {
          unresolved.add(`${entryHtmlPath} -> unresolved anchor: ${href}`);
          anchor.setAttribute('href', '#');
        }
      });

      documentNode.querySelectorAll('script[src]').forEach((scriptNode) => {
        const value = scriptNode.getAttribute('src');
        if (!value) return;
        if (isExternalAssetUrl(value)) {
          const normalized = normalizeExternalResource(value, 'script');
          if (!normalized) {
            scriptNode.remove();
            unresolved.add(`${entryHtmlPath} -> removed unsupported external script: ${value}`);
            return;
          }
          scriptNode.setAttribute('src', normalized);
          scriptNode.removeAttribute('integrity');
          if (normalized !== value) {
            resolved.add(`${entryHtmlPath} -> ${value}`);
          }
          return;
        }
        const url = resolveToResourceUrl(entryHtmlPath, value);
        if (url) {
          scriptNode.setAttribute('src', url);
        } else {
          scriptNode.remove();
          unresolved.add(`${entryHtmlPath} -> removed unresolved script: ${value}`);
        }
      });

      documentNode.querySelectorAll('link[href]').forEach((linkNode) => {
        const rel = String(linkNode.getAttribute('rel') || '').toLowerCase();
        const handledRels = ['stylesheet', 'icon', 'shortcut icon', 'manifest', 'apple-touch-icon', 'apple-touch-icon-precomposed', 'preload', 'modulepreload'];
        if (rel && !handledRels.includes(rel)) return;
        const value = linkNode.getAttribute('href');
        if (!value) return;
        if (isExternalAssetUrl(value)) {
          const normalized = normalizeExternalResource(value, 'style');
          if (!normalized) {
            linkNode.remove();
            unresolved.add(`${entryHtmlPath} -> removed unsupported external resource: ${value}`);
            return;
          }
          linkNode.setAttribute('href', normalized);
          linkNode.removeAttribute('integrity');
          if (normalized !== value) {
            resolved.add(`${entryHtmlPath} -> ${value}`);
          }
          return;
        }
        const url = resolveToResourceUrl(entryHtmlPath, value);
        if (url) {
          linkNode.setAttribute('href', url);
        } else {
          // Remove unresolved link elements to prevent 404 errors
          // For manifests, replace with empty JSON data-url; for others, remove entirely
          if (rel === 'manifest') {
            linkNode.setAttribute('href', 'data:application/json,{}');
          } else {
            linkNode.remove();
          }
          unresolved.add(`${entryHtmlPath} -> removed unresolved ${rel || 'link'}: ${value}`);
        }
      });

      documentNode.querySelectorAll('source[srcset]').forEach((source) => {
        const srcset = source.getAttribute('srcset');
        if (!srcset) return;
        const rewritten = srcset
          .split(',')
          .map((entry) => {
            const parts = entry.trim().split(/\s+/);
            if (parts.length === 0) return '';
            const local = parts[0];
            if (isExternalAssetUrl(local)) return entry;
            const url = resolveToResourceUrl(entryHtmlPath, local);
            if (!url) return ''; // drop unresolved srcset entries
            return [url, ...parts.slice(1)].join(' ');
          })
          .filter(Boolean)
          .join(', ');
        if (rewritten) {
          source.setAttribute('srcset', rewritten);
        } else {
          source.remove();
        }
      });

      documentNode.querySelectorAll('style').forEach((styleNode) => {
        styleNode.textContent = rewriteCssUrls(styleNode.textContent || '', entryHtmlPath, resolveToResourceUrl);
      });

      // Prevent any remaining relative URLs from resolving against the parent page
      if (!documentNode.querySelector('base')) {
        const baseTag = documentNode.createElement('base');
        baseTag.setAttribute('href', 'about:blank');
        documentNode.head.prepend(baseTag);
      }

      // Strip meta tags with local content URLs (og:image, twitter:image, etc.)
      documentNode.querySelectorAll('meta[content]').forEach((metaNode) => {
        const property = metaNode.getAttribute('property') || metaNode.getAttribute('name') || '';
        if (!/(image|url|icon)/i.test(property)) return;
        const content = metaNode.getAttribute('content') || '';
        if (!content || isExternalAssetUrl(content) || content.startsWith('data:')) return;
        // It's a local URL reference in meta — try to resolve, remove if not found
        const url = resolveToResourceUrl(entryHtmlPath, content);
        if (url) {
          metaNode.setAttribute('content', url);
        } else {
          metaNode.remove();
          unresolved.add(`${entryHtmlPath} -> removed unresolved meta ${property}: ${content}`);
        }
      });

      documentNode.querySelectorAll('script:not([src])').forEach((scriptNode) => {
        const isModule = scriptNode.getAttribute('type') === 'module';
        const rawSource = scriptNode.textContent || '';
        const nextSource = isModule
          ? rewriteJavaScriptImports(rawSource, entryHtmlPath, resolveToResourceUrl)
          : rawSource;

        if (!isModule && !isValidClassicScript(nextSource)) {
          sanitizedScriptCount += 1;
          scriptNode.textContent = '/* Simple Preview skipped malformed inline script. */';
          scriptNode.setAttribute('data-apex-sanitized', 'script');
          return;
        }

        scriptNode.textContent = nextSource;
      });

      const inlineSvgCounts = sanitizeSvgNodes(documentNode);
      sanitizedSvgPathCount += inlineSvgCounts.sanitizedPathCount;
      sanitizedSvgViewBoxCount += inlineSvgCounts.sanitizedViewBoxCount;

      let htmlOutput = `<!doctype html>\n${documentNode.documentElement.outerHTML}`;
      const validation = validatePreviewContent(htmlOutput);
      if (!validation.valid) {
        htmlOutput = repairTruncatedContent(htmlOutput, entryHtmlPath || 'preview.html');
      }

      const noteParts: string[] = [];
      if (unresolved.size === 0) {
        noteParts.push(autoMapped.size > 0 ? `All linked resources resolved (${autoMapped.size} auto-mapped)` : 'All linked resources resolved');
      } else {
        noteParts.push('Some referenced resources could not be resolved');
      }
      if (sanitizedSvgPathCount > 0) {
        noteParts.push(`sanitized ${sanitizedSvgPathCount} SVG path values`);
      }
      if (sanitizedSvgViewBoxCount > 0) {
        noteParts.push(`sanitized ${sanitizedSvgViewBoxCount} SVG viewBox values`);
      }
      if (sanitizedScriptCount > 0) {
        noteParts.push(`skipped ${sanitizedScriptCount} malformed scripts`);
      }

      const nextMeta: PreviewMeta = {
        mode: 'html',
        entryFile: entryHtmlPath,
        fileCount: files.length,
        folderCount,
        resolvedRefs: resolved.size,
        autoMappedRefs: autoMapped.size,
        sanitizedSvgPaths: sanitizedSvgPathCount,
        sanitizedSvgViewBoxes: sanitizedSvgViewBoxCount,
        sanitizedScripts: sanitizedScriptCount,
        unresolvedRefs: Array.from(unresolved).slice(0, 8),
        note: noteParts.join(' • ')
      };
      setPreviewContent(htmlOutput);
      setPreviewMeta(nextMeta);
      publishSnapshot(htmlOutput, nextMeta);
    } catch (err) {
      setError(`Failed to generate preview: ${(err as Error).message}`);
      setRuntimeState('error');
    }
  }, [files, folderCount, htmlFiles, publishSnapshot]);

  useEffect(() => {
    if (filesHash === lastFilesHashRef.current) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      lastFilesHashRef.current = filesHash;
      generatePreview();
    }, 240);
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [filesHash, generatePreview]);

  const handleOpenNewTab = useCallback(() => {
    if (!previewContent) return;
    const stableProjectId = ensureProjectId();
    publishLivePreviewSnapshot(stableProjectId, previewContent, previewMeta as unknown as Record<string, unknown>);
    const encodedId = encodeURIComponent(stableProjectId);
    const canonicalLivePath = `/live-preview/${encodedId}`;
    const scopedLivePath = `/app/live-preview/${encodedId}`;
    const settings = readAppSettings();
    const targetPath = settings.preferLivePreviewRoute
      ? (String(window.location.pathname || '').startsWith('/app') ? scopedLivePath : canonicalLivePath)
      : buildLivePreviewPath(stableProjectId);
    const targetUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${targetPath}`
        : targetPath;
    const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.assign(targetUrl);
    }
  }, [previewContent, previewMeta, ensureProjectId]);

  const viewState: 'empty' | 'error' | 'ready' = files.length === 0 ? 'empty' : error ? 'error' : 'ready';

  return (
    <div className={`relative w-full h-full overflow-hidden ${className || ''}`}>
      {viewState === 'empty' ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_15%_20%,rgba(59,130,246,0.15),transparent_60%),radial-gradient(900px_600px_at_85%_80%,rgba(14,165,233,0.12),transparent_60%)]" />
          <div className="relative z-10 flex h-full items-center justify-center px-6">
            <div className="glass-panel max-w-md rounded-3xl p-6 text-center shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <FileText className="h-7 w-7 text-white/70" />
              </div>
              <p className="text-lg font-semibold text-white">No files yet</p>
              <p className="mt-2 text-sm text-white/60">Generate HTML, CSS, or JS and preview will render automatically.</p>
            </div>
          </div>
        </>
      ) : null}

      {viewState === 'error' ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_15%_20%,rgba(239,68,68,0.18),transparent_60%),radial-gradient(900px_600px_at_85%_80%,rgba(248,113,113,0.12),transparent_60%)]" />
          <div className="relative z-10 flex h-full items-center justify-center px-6">
            <div className="glass-panel max-w-md rounded-3xl p-6 text-center shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <AlertTriangle className="h-7 w-7 text-red-300" />
              </div>
              <h3 className="text-lg font-semibold text-white">Preview error</h3>
              <p className="mt-2 text-sm text-red-200/80">{error}</p>
              <button
                onClick={generatePreview}
                className="mx-auto mt-5 inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Preview
              </button>
            </div>
          </div>
        </>
      ) : null}

      {viewState === 'ready' ? (
        <>
          <div className="relative z-10 flex h-full flex-col">
            <div className="border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                    <Code className="h-4 w-4 text-white/80" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Simple Preview</div>
                    <div className="text-xs text-white/60">
                      {previewMeta.mode === 'html' ? `Entry: ${previewMeta.entryFile}` : 'Fallback mode'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {previewMeta.autoMappedRefs > 0 ? (
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-cyan-100">
                      Auto-mapped {previewMeta.autoMappedRefs}
                    </span>
                  ) : null}
                  {previewMeta.sanitizedSvgPaths > 0 ? (
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-amber-100">
                      SVG sanitized {previewMeta.sanitizedSvgPaths}
                    </span>
                  ) : null}
                  {previewMeta.sanitizedSvgViewBoxes > 0 ? (
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-amber-100">
                      viewBox sanitized {previewMeta.sanitizedSvgViewBoxes}
                    </span>
                  ) : null}
                  {previewMeta.sanitizedScripts > 0 ? (
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-amber-100">
                      Scripts skipped {previewMeta.sanitizedScripts}
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em] ${
                      runtimeState === 'ready'
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                        : runtimeState === 'error'
                          ? 'border-red-400/30 bg-red-400/10 text-red-200'
                          : 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                    }`}
                  >
                    {runtimeState === 'ready' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {runtimeState === 'ready' ? 'Healthy' : runtimeState === 'error' ? 'Error' : 'Rendering'}
                  </span>
                  <button
                    onClick={handleOpenNewTab}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                    title="Open Live Preview in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Open Live Preview</span>
                  </button>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-white/60">
                {previewMeta.note} • Resolved links: {previewMeta.resolvedRefs}
              </div>
            </div>

            {previewMeta.unresolvedRefs.length === 0 ? (
              <div className="border-b border-emerald-200/20 bg-emerald-300/12 px-4 py-2 text-[11px] text-emerald-100/95">
                <div className="font-semibold">Preview status: Everything looks connected and ready.</div>
              </div>
            ) : null}

            {previewMeta.unresolvedRefs.length > 0 ? (
              <div className="border-b border-amber-200/15 bg-amber-300/10 px-4 py-2 text-[11px] text-amber-100/90">
                <div className="font-semibold">Unresolved references</div>
                <div className="mt-1 opacity-90">{previewMeta.unresolvedRefs.join(' • ')}</div>
              </div>
            ) : null}

            <iframe
              ref={iframeRef}
              className="w-full flex-1 min-h-0 border-0"
              title="Simple Preview"
              sandbox="allow-scripts allow-modals allow-popups allow-forms allow-presentation"
              srcDoc={previewContent}
              onLoad={() => setRuntimeState('ready')}
              onError={() => {
                setRuntimeState('error');
                setError('Preview iframe failed to load');
              }}
            />
          </div>

          <button
            onClick={generatePreview}
            className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl transition hover:bg-white/20"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </>
      ) : null}
    </div>
  );
};
