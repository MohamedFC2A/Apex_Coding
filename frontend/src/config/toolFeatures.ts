import type { ToolFeature } from '@/types/constraints';

export const TOOL_FEATURES: ToolFeature[] = [
  {
    id: 'support-svg-icons',
    labelKey: 'app.tools.feature.support-svg-icons.label',
    descriptionKey: 'app.tools.feature.support-svg-icons.desc',
    category: 'ui',
    promptRule: 'Use SVG icons or inline SVG assets consistently in the UI.',
    validators: [/<svg\b/i, /\.svg\b/i]
  },
  {
    id: 'ui-glassmorphism',
    labelKey: 'app.tools.feature.ui-glassmorphism.label',
    descriptionKey: 'app.tools.feature.ui-glassmorphism.desc',
    category: 'ui',
    promptRule: 'Apply glassmorphism style with blur, layered transparency, and clear contrast.',
    validators: [/backdrop-filter/i, /glass/i, /blur\(/i]
  },
  {
    id: 'dark-mode-toggle',
    labelKey: 'app.tools.feature.dark-mode-toggle.label',
    descriptionKey: 'app.tools.feature.dark-mode-toggle.desc',
    category: 'ux',
    promptRule: 'Provide a user-visible dark/light mode toggle with persisted preference.',
    validators: [/dark/i, /theme/i, /localstorage/i]
  },
  {
    id: 'responsive-mobile-first',
    labelKey: 'app.tools.feature.responsive-mobile-first.label',
    descriptionKey: 'app.tools.feature.responsive-mobile-first.desc',
    category: 'ux',
    promptRule: 'Build mobile-first responsive layouts with sensible breakpoints.',
    validators: [/@media/i, /max-width/i, /min-width/i]
  },
  {
    id: 'animation-system',
    labelKey: 'app.tools.feature.animation-system.label',
    descriptionKey: 'app.tools.feature.animation-system.desc',
    category: 'ux',
    promptRule: 'Include meaningful animation transitions with reduced-motion fallback.',
    validators: [/animation/i, /transition/i, /prefers-reduced-motion/i]
  },
  {
    id: 'form-validation',
    labelKey: 'app.tools.feature.form-validation.label',
    descriptionKey: 'app.tools.feature.form-validation.desc',
    category: 'quality',
    promptRule: 'Implement robust client-side form validation and clear error states.',
    validators: [/validation/i, /required/i, /error/i]
  },
  {
    id: 'seo-meta-og',
    labelKey: 'app.tools.feature.seo-meta-og.label',
    descriptionKey: 'app.tools.feature.seo-meta-og.desc',
    category: 'quality',
    promptRule: 'Include complete SEO metadata (title/description/open graph).',
    validators: [/<meta\b/i, /og:/i, /description/i]
  },
  {
    id: 'a11y-landmarks',
    labelKey: 'app.tools.feature.a11y-landmarks.label',
    descriptionKey: 'app.tools.feature.a11y-landmarks.desc',
    category: 'quality',
    promptRule: 'Use semantic landmarks and accessibility-friendly labels/roles.',
    validators: [/<main\b/i, /aria-/i, /role=/i]
  },
  {
    id: 'rtl-support',
    labelKey: 'app.tools.feature.rtl-support.label',
    descriptionKey: 'app.tools.feature.rtl-support.desc',
    category: 'ux',
    promptRule: 'Support RTL content direction and mirrored layout behavior where needed.',
    validators: [/\bdir\s*=\s*["']rtl["']/i, /rtl/i]
  },
  {
    id: 'api-integration-ready',
    labelKey: 'app.tools.feature.api-integration-ready.label',
    descriptionKey: 'app.tools.feature.api-integration-ready.desc',
    category: 'integration',
    promptRule: 'Structure frontend data flows for API integration with loading/error states.',
    validators: [/fetch\(/i, /axios/i, /api/i]
  },
  {
    id: 'state-management-ready',
    labelKey: 'app.tools.feature.state-management-ready.label',
    descriptionKey: 'app.tools.feature.state-management-ready.desc',
    category: 'integration',
    promptRule: 'Use organized state management patterns for UI and async data.',
    validators: [/zustand/i, /useState/i, /store/i]
  },
  {
    id: 'performance-optimized-assets',
    labelKey: 'app.tools.feature.performance-optimized-assets.label',
    descriptionKey: 'app.tools.feature.performance-optimized-assets.desc',
    category: 'quality',
    promptRule: 'Optimize assets and rendering for performance (lazy loading, efficient media).',
    validators: [/lazy/i, /loading=/i, /optimiz/i]
  }
];

export const TOOL_FEATURES_BY_ID = TOOL_FEATURES.reduce<Record<string, ToolFeature>>((acc, feature) => {
  acc[feature.id] = feature;
  return acc;
}, {});

