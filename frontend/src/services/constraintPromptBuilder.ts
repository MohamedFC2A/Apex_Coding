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
  const modeStructure =
    projectMode === 'FULL_STACK'
      ? '- Keep clear separation: frontend/* for UI, backend/* for APIs/services, shared/* only if required.'
      : '- Keep everything frontend-only and never create backend/, server/, api/, database/ folders.';

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
    '- File naming: ONE index.html, ONE style.css (or styles.css), ONE script.js (or app.js).',
    '- Never create two files serving the same purpose (e.g., main.css AND style.css).',
    '- Plan responsive behavior explicitly: mobile-first base → tablet breakpoint → desktop breakpoint.',
    '- Include interactivity requirements per step: which elements get event listeners, what behavior occurs.',
    '- Include accessibility in layout step: semantic HTML5 tags, ARIA labels for interactive elements.',
    '- Plan steps must flow: scaffold → structure → components → behavior → polish.',
    '- Each step must be atomic and independently verifiable in the live preview.'
  ].join('\n');

export const buildAntiDuplicationPolicyBlock = (): string =>
  [
    '[ANTI-DUPLICATION POLICY]',
    '- Before creating any file, check if a file with the same path or basename already exists.',
    '- If a file at the same path exists, use EDIT_NODE protocol to modify it — never START_FILE.',
    '- Never split CSS into multiple files unless explicitly using CSS modules or framework convention.',
    '- Never create a new file if an existing file already serves the same purpose.',
    '- ONE CSS file, ONE JS file, ONE HTML entry point for simple static sites.',
    '- If editing an existing project, preserve the existing file structure — do not reorganize.'
  ].join('\n');

export const buildGenerationConstraintsBlock = (constraints: GenerationConstraints): string => {
  const modeLine =
    constraints.projectMode === 'FULL_STACK'
      ? 'Project Mode: FULL_STACK (frontend + backend allowed).'
      : 'Project Mode: FRONTEND_ONLY (backend/server files are forbidden).';

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
  const isFrontendOnly = constraints.projectMode === 'FRONTEND_ONLY';
  const frontendPolicyBlock = isFrontendOnly ? buildFrontendDeliveryPolicyBlock() : null;
  const frontendPlanningBlock = isFrontendOnly ? buildFrontendPlanningPolicyBlock() : null;
  const antiDuplicationBlock = buildAntiDuplicationPolicyBlock();

  return [
    '[GENERATION CONSTRAINTS]',
    modeLine,
    `Enforcement: ${constraints.enforcement.toUpperCase()}`,
    'Selected Features:',
    featureLines,
    '',
    '[HARD ENFORCEMENT RULES]',
    '- Respect project mode strictly.',
    '- Respect all selected feature constraints strictly.',
    '- If an output misses constraints, revise it immediately in the same response.',
    ...extraRules,
    '',
    organizationBlock,
    '',
    antiDuplicationBlock,
    ...(frontendPolicyBlock ? ['', frontendPolicyBlock] : []),
    ...(frontendPlanningBlock ? ['', frontendPlanningBlock] : [])
  ].join('\n');
};

export const mergePromptWithConstraints = (prompt: string, constraints: GenerationConstraints): string => {
  const base = String(prompt || '').trim();
  if (/\[GENERATION CONSTRAINTS\]/i.test(base)) return base;
  const block = buildGenerationConstraintsBlock(constraints);
  return `${base}\n\n${block}`.trim();
};

export const buildConstraintsRepairPrompt = (
  missingFeatures: string[],
  constraints: GenerationConstraints
): string => {
  const missingList = missingFeatures.map((id) => `- ${id}`).join('\n');
  return [
    'AUTO-FIX: apply missing constraints in the current project.',
    '',
    '[MISSING CONSTRAINTS]',
    missingList || '- none',
    '',
    buildGenerationConstraintsBlock(constraints),
    '',
    'Output only valid file markers and full code changes to satisfy missing constraints.'
  ].join('\n');
};
