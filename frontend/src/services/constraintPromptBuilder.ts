import { TOOL_FEATURES_BY_ID } from '@/config/toolFeatures';
import type { GenerationConstraints } from '@/types/constraints';
import { buildSvgPolicyPromptLine } from '@/services/projectStructurePolicy';

const formatFeatureLine = (featureId: string) => {
  const feature = TOOL_FEATURES_BY_ID[featureId];
  if (!feature) return `- ${featureId}`;
  return `- ${featureId}: ${feature.promptRule}`;
};

type ProjectMode = GenerationConstraints['projectMode'];

export const buildAIOrganizationPolicyBlock = (projectMode: ProjectMode): string => {
  void projectMode;
  const modeStructure =
    '- Keep everything frontend-only and never create backend/, server/, api/, database/ folders.';

  return [
    '[AI ORGANIZATION POLICY]',
    '- Output complete files only, never placeholders or TODO stubs as final content.',
    '- Prefer editing existing files over creating duplicate files with the same purpose.',
    '- Keep file naming consistent: components in PascalCase, hooks as useX, utilities in camelCase file names.',
    '- Keep one responsibility per file and split large features into smaller modules when needed.',
    '- Keep import paths valid and consistent after every change.',
    '- Place assets in meaningful folders (assets/icons, assets/images, styles, components, services, utils).',
    '- Order implementation logically: foundation/setup -> core structure -> feature logic -> polish/fixes.',
    modeStructure,
    '- Ensure final structure remains easy to scan for humans and stable for future edits.'
  ].join('\n');
};

export const buildFrontendDeliveryPolicyBlock = (): string =>
  [
    '[FRONTEND DELIVERY POLICY]',
    '- Deliver a complete, production-ready frontend experience (not a skeleton).',
    '- Include meaningful real content and clear UI hierarchy, not placeholder sections.',
    '- Ensure responsive behavior for desktop and mobile with stable spacing and typography.',
    '- Keep HTML/JS/CSS valid and connected (no broken selectors, missing handlers, or dangling imports).',
    '- Ensure JavaScript is syntax-safe and runs without runtime errors in simple preview.',
    '- If SVG is used, keep it valid and clean (no malformed path/viewBox attributes).',
    '- Before final output, run a self-check: build integrity, preview integrity, UX completeness.'
  ].join('\n');

export const buildFrontendPlanningPolicyBlock = (): string =>
  [
    '[FRONTEND PLANNING POLICY]',
    '- Decompose every UI into named sections: Header/Nav, Hero, Content Sections, Footer at minimum.',
    '- Each plan step must target specific named UI sections or behaviors, not vague tasks.',
    '- File naming: ONE index.html, ONE style.css, ONE script.js.',
    '- Never create two files serving the same purpose (e.g., main.css AND style.css).',
    '- Plan responsive behavior explicitly: mobile-first base → tablet breakpoint → desktop breakpoint.',
    '- Include interactivity requirements per step: which elements get event listeners, what behavior occurs.',
    '- Include accessibility in layout step: semantic HTML5 tags, ARIA labels for interactive elements.',
    '- Plan steps must flow: scaffold → structure → components → behavior → polish.',
    '- Each step must be atomic and independently verifiable in the live preview.'
  ].join('\n');

export const buildFrameworkDeliveryPolicyBlock = (): string =>
  [
    '[FRAMEWORK DELIVERY POLICY]',
    '- Deliver complete frontend modules with clean imports and predictable boundaries.',
    '- Use reusable components and keep component responsibility focused.',
    '- Keep framework conventions intact (routing/layout/entry files).',
    '- Ensure runtime-safe event handlers and deterministic state wiring.',
    '- Avoid placeholder pages/components in final output.'
  ].join('\n');

export const buildFrameworkPlanningPolicyBlock = (): string =>
  [
    '[FRAMEWORK PLANNING POLICY]',
    '- Decompose into route/page modules + reusable components + shared utilities.',
    '- Each step must declare target files and expected behavior outcome.',
    '- Prefer editing existing modules over creating duplicate-purpose files.',
    '- Keep styling strategy consistent (global styles vs module styles).',
    '- Keep architecture frontend-only: no backend/server/db code.'
  ].join('\n');

export const buildFrontendProfessionalBaselineBlock = (): string =>
  [
    '[FRONTEND PROFESSIONAL BASELINE]',
    '- Project Mode Frontend v1.2: decide full file map first, then implement files in deterministic order.',
    '- Default output for static frontend is adaptive multi-page vanilla HTML/CSS/JS.',
    '- For simple requests: index.html + style.css + script.js. For broader scope: linked pages with shared style/script.',
    '- Keep naming stable and predictable: route-oriented kebab-case pages + shared style.css/script.js.',
    '- Mandatory section map: Header/Nav, Hero, Features/Content, CTA/Form, Footer.',
    '- JavaScript architecture: IIFE or module-safe bootstrapping + DOM ready initialization + guarded selectors.',
    '- Event binding must be runtime-safe (check element existence before addEventListener).',
    '- Avoid alert() as the default UX pattern; prefer inline status or accessible messages unless explicitly requested.',
    '- File control protocol must support safe create/edit/delete/move with explicit reason for destructive operations.',
    '- Never glue comments with executable code on the same line in a way that can break syntax.',
    '- Deliver complete, runnable behavior in first pass; no TODO placeholders.'
  ].join('\n');

export const buildPageArchitecturePolicyBlock = (
  mode: GenerationConstraints['siteArchitectureMode'] = 'adaptive_multi_page'
): string => {
  const modeLine =
    mode === 'single_page'
      ? '- Prefer single-page architecture unless user explicitly requests multiple pages.'
      : mode === 'force_multi_page'
        ? '- Use multi-page architecture by default for all non-trivial websites.'
        : '- Use adaptive multi-page architecture: single-page for simple requests, multi-page for rich/complex websites.';

  return [
    '[PAGE ARCHITECTURE POLICY]',
    modeLine,
    '- Switch to multi-page automatically when request implies: multiple services/products, legal pages, blog/docs/faq, or dashboard-like flows.',
    '- Use stable folder conventions for static sites: pages/, components/, styles/, scripts/, assets/, data/.',
    '- Use kebab-case for static page files and route-oriented paths.',
    '- Include a route map contract (site-map.json or equivalent structured route mapping) when multi-page output is generated.',
    '- Ensure navigation/footer/internal links are generated from the same route map and remain consistent after edits.'
  ].join('\n');
};

export const buildAntiDuplicationPolicyBlock = (): string =>
  [
    '[ANTI-DUPLICATION POLICY]',
    '- Before creating any file, check if a file with the same path or basename already exists.',
    '- If a file at the same path exists, use EDIT_NODE protocol to modify it — never START_FILE.',
    '- Never split CSS into multiple files unless explicitly using CSS modules or framework convention.',
    '- Never create a new file if an existing file already serves the same purpose.',
    '- ONE shared CSS file and ONE shared JS file for simple static sites (multi-page may add additional HTML pages).',
    '- Always use style.css for primary styling (never styles.css/main.css/app.css/global.css/globals.css/index.css for the same static project).',
    '- Always use script.js for primary behavior (never app.js/main.js/index.js for the same static project).',
    '- If editing an existing project, preserve the existing file structure — do not reorganize.',
    '- FORBIDDEN DUPLICATE NAMES (will be auto-renamed): styles.css, main.css, global.css, globals.css, app.css, index.css, main.js, app.js, index.js.'
  ].join('\n');

export const buildLanguagePurityPolicyBlock = (): string =>
  [
    '[LANGUAGE PURITY POLICY]',
    '- .css files must contain ONLY CSS code: selectors, properties, values, media queries, @import, @keyframes.',
    '- .js files must contain ONLY JavaScript code: variables, functions, classes, DOM manipulation, event listeners.',
    '- .html files must contain HTML markup and should link external CSS/JS files instead of inline code blocks.',
    '- In static frontend mode, inline <style> and inline <script> blocks are forbidden unless explicitly requested by the user.',
    '- NEVER write CSS selectors/properties (e.g., color:, display:, .class { }) directly in a .js file.',
    '- NEVER write JavaScript syntax (const, let, function, addEventListener) directly in a .css file.',
    '- NEVER write raw HTML tags (<div>, <header>, <section>) directly in a .css or .js file.',
    '- If you need dynamic styles in JS, use element.style.property or element.classList — not raw CSS.',
    '- Violation of this policy will trigger automatic content-type detection and rejection.'
  ].join('\n');

export const buildGenerationConstraintsBlock = (constraints: GenerationConstraints): string => {
  const requestedProfile = constraints.generationProfile || 'auto';
  const modeLine = 'Project Mode: FRONTEND_ONLY (backend/server files are forbidden).';
  const profileLine = `Generation Profile: ${requestedProfile.toUpperCase()}`;
  const destructiveSafetyLine = `Destructive Safety: ${(constraints.destructiveSafetyMode || 'backup_then_apply').toUpperCase()}`;
  const touchBudgetLine = `Touch Budget Mode: ${(constraints.touchBudgetMode || 'adaptive').toUpperCase()}`;

  const selectedFeatureRules = constraints.selectedFeatures.map(formatFeatureLine);
  const customFeatureRules = constraints.customFeatureTags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .map((tag) => `- custom: ${tag}`);

  const featureLines =
    selectedFeatureRules.length + customFeatureRules.length > 0
      ? [...selectedFeatureRules, ...customFeatureRules].join('\n')
      : '- none';

  const wantsSvgPolicy =
    constraints.selectedFeatures.includes('support-svg-icons') ||
    constraints.customFeatureTags.some((tag) => /\bsvg\b/i.test(String(tag || '')));

  const extraRules = wantsSvgPolicy ? [buildSvgPolicyPromptLine()] : [];
  const organizationBlock = buildAIOrganizationPolicyBlock(constraints.projectMode);
  const isFrontendOnly = true;
  const staticProfile = requestedProfile === 'static';
  const frameworkProfile = requestedProfile === 'framework';
  const frontendPolicyBlock = isFrontendOnly && !frameworkProfile ? buildFrontendDeliveryPolicyBlock() : null;
  const frontendPlanningBlock = isFrontendOnly && !frameworkProfile ? buildFrontendPlanningPolicyBlock() : null;
  const frontendProfessionalBaselineBlock = isFrontendOnly && !frameworkProfile ? buildFrontendProfessionalBaselineBlock() : null;
  const frameworkPolicyBlock = isFrontendOnly && frameworkProfile ? buildFrameworkDeliveryPolicyBlock() : null;
  const frameworkPlanningBlock = isFrontendOnly && frameworkProfile ? buildFrameworkPlanningPolicyBlock() : null;
  const pageArchitectureBlock = isFrontendOnly
    ? buildPageArchitecturePolicyBlock(constraints.siteArchitectureMode || 'adaptive_multi_page')
    : null;
  const antiDuplicationBlock = buildAntiDuplicationPolicyBlock();
  const languagePurityBlock = buildLanguagePurityPolicyBlock();

  return [
    '[GENERATION CONSTRAINTS]',
    modeLine,
    profileLine,
    destructiveSafetyLine,
    touchBudgetLine,
    `Enforcement: ${constraints.enforcement.toUpperCase()}`,
    'Selected Features:',
    featureLines,
    '',
    '[HARD ENFORCEMENT RULES]',
    '- Respect project mode strictly.',
    '- Respect all selected feature constraints strictly.',
    '- If an output misses constraints, revise it immediately in the same response.',
    staticProfile ? '- Static profile: do NOT emit framework scaffolding.' : '',
    frameworkProfile ? '- Framework profile: prefer framework conventions and modular structure.' : '',
    ...extraRules,
    '',
    organizationBlock,
    '',
    antiDuplicationBlock,
    '',
    languagePurityBlock,
    ...(pageArchitectureBlock ? ['', pageArchitectureBlock] : []),
    ...(frontendProfessionalBaselineBlock ? ['', frontendProfessionalBaselineBlock] : []),
    ...(frontendPolicyBlock ? ['', frontendPolicyBlock] : []),
    ...(frontendPlanningBlock ? ['', frontendPlanningBlock] : []),
    ...(frameworkPolicyBlock ? ['', frameworkPolicyBlock] : []),
    ...(frameworkPlanningBlock ? ['', frameworkPlanningBlock] : [])
  ].join('\n');
};

export const mergePromptWithConstraints = (prompt: string, constraints: GenerationConstraints): string => {
  const base = String(prompt || '').trim();
  if (/\[GENERATION CONSTRAINTS\]/i.test(base)) return base;
  const block = buildGenerationConstraintsBlock(constraints);
  return `${base}\n\n${block}`.trim();
};

export const buildConstraintsRepairPrompt = (
  issues: string[],
  constraints: GenerationConstraints,
  options?: {
    focus?: string;
    attempt?: number;
    maxAttempts?: number;
    recentlyHealedFiles?: string[];
  }
): string => {
  const issueList = issues.map((id) => `- ${id}`).join('\n');
  const focus = String(options?.focus || '').trim();
  const attempt = Number(options?.attempt || 0);
  const maxAttempts = Number(options?.maxAttempts || 0);
  const recentHeals =
    Array.isArray(options?.recentlyHealedFiles) && options?.recentlyHealedFiles.length > 0
      ? options.recentlyHealedFiles.map((file) => `- ${file}`).join('\n')
      : '- none';

  return [
    'SMART AUTO-FIX: patch ONLY critical blockers in the current project.',
    '',
    '[AUTO-FIX CONTEXT]',
    `Focus Area: ${focus || 'general'}`,
    `Attempt: ${attempt > 0 ? attempt : 1}${maxAttempts > 0 ? `/${maxAttempts}` : ''}`,
    'Deterministic pre-heals:',
    recentHeals,
    '',
    '[CRITICAL ISSUES]',
    issueList || '- none',
    '',
    buildGenerationConstraintsBlock(constraints),
    '',
    'Rules:',
    '- Modify only files needed to resolve the listed critical issues.',
    '- Do not rewrite stable files or perform cosmetic refactors.',
    '- If issue is HIDDEN_CSS_BRACE_MISMATCH:* then make that CSS file brace-balanced and syntactically complete.',
    '- If issue is HIDDEN_JS_SYNTAX_ERROR:* then return syntactically valid JavaScript with guarded DOM access.',
    '- If issue is HIDDEN_FILE_TYPE_MISMATCH_JS_CONTAINS_CSS:* move styling rules into the canonical CSS file and keep the JS file executable JavaScript only.',
    '- If issue is HIDDEN_FILE_TYPE_MISMATCH_CSS_CONTAINS_JS:* move logic into the canonical JS file and keep the CSS file styles-only.',
    '- If issue is HIDDEN_FILE_TYPE_MISMATCH_*_CONTAINS_HTML* then put markup in HTML files only and keep JS/CSS files pure.',
    '- Output only valid file markers and full code changes.'
  ].join('\n');
};
