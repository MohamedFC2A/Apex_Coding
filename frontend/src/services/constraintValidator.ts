import { TOOL_FEATURES_BY_ID } from '@/config/toolFeatures';
import type { GenerationConstraints } from '@/types/constraints';
import type { ProjectFile } from '@/types';

type ConstraintValidationResult = {
  missingFeatures: string[];
  qualityViolations: string[];
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
  const hasIndexHtml = Boolean(findFile(files, (p) => p.endsWith('/index.html') || p === 'index.html'));
  const hasStyleCss = Boolean(findFile(files, (p) => p.endsWith('/style.css') || p === 'style.css'));
  const hasScriptJs = Boolean(findFile(files, (p) => p.endsWith('/script.js') || p === 'script.js'));

  if (!hasIndexHtml) violations.push('STRUCTURE_MISSING_INDEX_HTML');
  if (!hasStyleCss) violations.push('STRUCTURE_MISSING_STYLE_CSS');
  if (!hasScriptJs) violations.push('STRUCTURE_MISSING_SCRIPT_JS');
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
  const isFrontendOnly = constraints.projectMode === 'FRONTEND_ONLY';
  const qualityGateMode = constraints.qualityGateMode || 'strict';

  if (isFrontendOnly && qualityGateMode === 'strict') {
    qualityViolations.push(...validateFrontendStructure(files));
    qualityViolations.push(...validateHtmlQuality(files));
    qualityViolations.push(...validateCssQuality(files));
    qualityViolations.push(...validateJsQuality(files));
  }

  return {
    missingFeatures,
    qualityViolations,
    readyForFinalize: missingFeatures.length === 0 && qualityViolations.length === 0
  };
};

