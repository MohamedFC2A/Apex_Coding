import { TOOL_FEATURES_BY_ID } from '@/config/toolFeatures';
import type { GenerationConstraints } from '@/types/constraints';
import type { ProjectFile } from '@/types';

type ConstraintValidationResult = {
  missingFeatures: string[];
  qualityViolations: string[];
  routingViolations: string[];
  namingViolations: string[];
  retrievalCoverageScore: number;
  readyForFinalize: boolean;
};

const flattenProjectFiles = (files: ProjectFile[]) =>
  files
    .map((file) => `${file.path || file.name}\n${file.content || ''}`)
    .join('\n');

const normalizePath = (value: string) => String(value || '').replace(/\\/g, '/').trim().toLowerCase();

const findFile = (files: ProjectFile[], matcher: (path: string) => boolean) =>
  files.find((file) => matcher(normalizePath(file.path || file.name || '')));

const validateFrontendStructure = (files: ProjectFile[]): string[] => {
  const violations: string[] = [];
  const htmlFiles = files.filter((file) => /\.html?$/i.test(String(file.path || file.name || '')));
  const cssFiles = files.filter((file) => /\.css$/i.test(String(file.path || file.name || '')));
  const jsFiles = files.filter((file) => /\.js$/i.test(String(file.path || file.name || '')));

  if (htmlFiles.length === 0) violations.push('STRUCTURE_MISSING_HTML_ENTRY');
  if (cssFiles.length === 0) violations.push('STRUCTURE_MISSING_CSS');
  if (jsFiles.length === 0) violations.push('STRUCTURE_MISSING_JS');

  const hasIndexHtml = Boolean(findFile(files, (p) => p.endsWith('/index.html') || p === 'index.html'));
  const hasStyleCss = Boolean(findFile(files, (p) => p.endsWith('/style.css') || p === 'style.css'));
  const hasScriptJs = Boolean(findFile(files, (p) => p.endsWith('/script.js') || p === 'script.js'));

  if (htmlFiles.length === 1 && !hasIndexHtml) violations.push('STRUCTURE_SINGLE_PAGE_MISSING_INDEX_HTML');
  if (cssFiles.length === 1 && !hasStyleCss) violations.push('STRUCTURE_SHARED_STYLE_CSS_MISSING');
  if (jsFiles.length === 1 && !hasScriptJs) violations.push('STRUCTURE_SHARED_SCRIPT_JS_MISSING');
  return violations;
};

const validateHtmlQuality = (files: ProjectFile[]): string[] => {
  const violations: string[] = [];
  const htmlFile = findFile(files, (p) => p.endsWith('.html'));
  if (!htmlFile) {
    violations.push('HTML_MISSING_ENTRY');
    return violations;
  }

  const html = String(htmlFile.content || '');
  const requiredLandmarks = ['<header', '<main', '<footer'];
  const hasLandmarks = requiredLandmarks.every((token) => html.toLowerCase().includes(token));
  if (!hasLandmarks) violations.push('HTML_MISSING_SEMANTIC_LANDMARKS');

  const hasA11yHints = /aria-|role=|<label\b/i.test(html);
  if (!hasA11yHints) violations.push('A11Y_MISSING_ARIA_OR_LABELS');

  return violations;
};

const validateCssQuality = (files: ProjectFile[]): string[] => {
  const violations: string[] = [];
  const cssFile = findFile(files, (p) => p.endsWith('.css'));
  if (!cssFile) {
    violations.push('CSS_MISSING_FILE');
    return violations;
  }

  const css = String(cssFile.content || '');
  const hasMediaQueries = /@media\s*\(/i.test(css);
  if (!hasMediaQueries) violations.push('CSS_MISSING_RESPONSIVE_MEDIA_QUERIES');

  const hasRelativeUnits = /\b\d+(\.\d+)?(rem|em|vw|vh|%)\b/i.test(css);
  if (!hasRelativeUnits) violations.push('CSS_MISSING_FLUID_UNITS');

  return violations;
};

const validateJsQuality = (files: ProjectFile[]): string[] => {
  const violations: string[] = [];
  const jsFile = findFile(files, (p) => p.endsWith('.js'));
  if (!jsFile) {
    violations.push('JS_MISSING_FILE');
    return violations;
  }

  const js = String(jsFile.content || '');
  if (!js.trim()) {
    violations.push('JS_EMPTY_FILE');
    return violations;
  }

  const hasDomReady = /DOMContentLoaded|document\.readyState/i.test(js);
  if (!hasDomReady) violations.push('JS_MISSING_DOM_READY_BOOTSTRAP');

  const hasGuardedDomAccess =
    /if\s*\([^)]*(?:querySelector|getElementById|getElementsByClassName)[^)]*\)/i.test(js) ||
    /\?\./.test(js);
  if (!hasGuardedDomAccess) violations.push('JS_MISSING_GUARDED_DOM_BINDING');

  const hasGluedCommentPattern = /\/\/[^\n]*(?:const|let|var|function|class)\s+/i.test(js);
  if (hasGluedCommentPattern) violations.push('JS_GLUED_COMMENT_CODE_PATTERN');

  return violations;
};

const validateRouteIntegrity = (files: ProjectFile[]): string[] => {
  const violations: string[] = [];
  const htmlFiles = files.filter((f) => /\.html?$/i.test(String(f.path || f.name || '')));
  if (htmlFiles.length <= 1) return violations;

  const hasSiteMapContract = Boolean(findFile(files, (p) => p.endsWith('/site-map.json') || p === 'site-map.json'));
  if (!hasSiteMapContract) violations.push('ROUTE_MISSING_SITE_MAP_CONTRACT');

  const allPaths = new Set(
    htmlFiles.map((f) => normalizePath(f.path || f.name || '')).filter(Boolean)
  );
  const linkRegex = /href=["']([^"']+)["']/gi;

  for (const file of htmlFiles) {
    const fromPath = normalizePath(file.path || file.name || '');
    const content = String(file.content || '');
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(content)) !== null) {
      const ref = String(match[1] || '').trim();
      if (!ref || ref.startsWith('#') || /^[a-z]+:\/\//i.test(ref)) continue;
      const normalized = normalizePath(ref.replace(/^\.\//, ''));
      if (!normalized.endsWith('.html')) continue;
      const sameDir = fromPath.includes('/')
        ? normalizePath(`${fromPath.slice(0, fromPath.lastIndexOf('/') + 1)}${normalized}`)
        : normalized;
      if (!allPaths.has(normalized) && !allPaths.has(sameDir)) {
        violations.push(`ROUTE_BROKEN_LINK:${fromPath}->${normalized}`);
      }
    }
  }

  return Array.from(new Set(violations));
};

const validateNamingConventions = (files: ProjectFile[]): string[] => {
  const violations: string[] = [];
  const kebabCaseRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const htmlFiles = files.filter((file) => /\.html?$/i.test(String(file.path || file.name || '')));

  for (const file of files) {
    const path = normalizePath(file.path || file.name || '');
    if (!path) continue;
    const parts = path.split('/');
    const filename = parts[parts.length - 1] || '';
    const base = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename;

    if (filename.endsWith('.html') && !kebabCaseRe.test(base) && base !== 'index') {
      violations.push(`NAMING_HTML_NOT_KEBAB:${path}`);
    }

    if (/[A-Z]/.test(path) && /\.(html|css|js)$/i.test(filename)) {
      violations.push(`NAMING_STATIC_PATH_HAS_UPPERCASE:${path}`);
    }
  }

  if (htmlFiles.length > 1) {
    for (const file of htmlFiles) {
      const path = normalizePath(file.path || file.name || '');
      if (!path || path === 'index.html') continue;
      if (!path.startsWith('pages/')) {
        violations.push(`NAMING_MULTI_PAGE_OUTSIDE_PAGES_DIR:${path}`);
      }
    }
  }

  return violations;
};

const computeRetrievalCoverageScore = (files: ProjectFile[]): number => {
  if (!files.length) return 0;
  const pathSet = new Set(files.map((f) => normalizePath(f.path || f.name || '')).filter(Boolean));
  let refs = 0;
  let resolved = 0;

  const attrRegex = /(href|src)=["']([^"']+)["']/gi;
  for (const file of files) {
    const content = String(file.content || '');
    const fromPath = normalizePath(file.path || file.name || '');
    const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : '';
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(content)) !== null) {
      const ref = String(match[2] || '').trim();
      if (!ref || ref.startsWith('#') || /^[a-z]+:\/\//i.test(ref)) continue;
      refs += 1;
      const normalized = normalizePath(ref.replace(/^\.\//, ''));
      const sameDirPath = normalizePath(`${fromDir}${normalized}`);
      if (pathSet.has(normalized) || pathSet.has(sameDirPath)) resolved += 1;
    }
  }

  if (refs === 0) return 100;
  return Math.max(0, Math.min(100, Math.round((resolved / refs) * 100)));
};

export const validateConstraints = (
  files: ProjectFile[],
  constraints: GenerationConstraints
): ConstraintValidationResult => {
  const corpus = flattenProjectFiles(files);

  const missingFeatures = constraints.selectedFeatures.filter((featureId) => {
    const feature = TOOL_FEATURES_BY_ID[featureId];
    if (!feature || feature.validators.length === 0) return false;
    return !feature.validators.some((rule) => rule.test(corpus));
  });

  const qualityViolations: string[] = [];
  const routingViolations: string[] = [];
  const namingViolations: string[] = [];
  const isFrontendOnly = constraints.projectMode === 'FRONTEND_ONLY';
  const qualityGateMode = constraints.qualityGateMode || 'strict';
  const retrievalCoverageScore = computeRetrievalCoverageScore(files);

  if (isFrontendOnly && qualityGateMode === 'strict') {
    qualityViolations.push(...validateFrontendStructure(files));
    qualityViolations.push(...validateHtmlQuality(files));
    qualityViolations.push(...validateCssQuality(files));
    qualityViolations.push(...validateJsQuality(files));
    routingViolations.push(...validateRouteIntegrity(files));
    namingViolations.push(...validateNamingConventions(files));
  }

  return {
    missingFeatures,
    qualityViolations,
    routingViolations,
    namingViolations,
    retrievalCoverageScore,
    readyForFinalize:
      missingFeatures.length === 0 &&
      qualityViolations.length === 0 &&
      routingViolations.length === 0 &&
      namingViolations.length === 0
  };
};
