export type NormalizedPlanCategory =
  | 'config'
  | 'frontend'
  | 'backend'
  | 'integration'
  | 'testing'
  | 'deployment'
  | 'tasks';

const DIRECT_CATEGORIES = new Set<NormalizedPlanCategory>([
  'config',
  'frontend',
  'backend',
  'integration',
  'testing',
  'deployment',
  'tasks'
]);

const CATEGORY_ALIASES: Record<string, NormalizedPlanCategory> = {
  setup: 'config',
  layout: 'frontend',
  components: 'frontend',
  interactivity: 'frontend',
  styling: 'frontend',
  polish: 'testing'
};

const clean = (value: string) => String(value || '').trim().toLowerCase();

const inferFromContent = (title: string, files: string[]) => {
  const haystack = `${title} ${files.join(' ')}`.toLowerCase();
  if (/(config|setup|package|deps|dependency|tsconfig|tailwind|env)/.test(haystack)) return 'config';
  if (/(backend|api|server|database|db|auth|route|middleware)/.test(haystack)) return 'backend';
  if (/(integrat|connect|sync|hook|bridge)/.test(haystack)) return 'integration';
  if (/(test|spec|qa|assert|coverage|validate)/.test(haystack)) return 'testing';
  if (/(deploy|release|build|vercel|netlify|cloudflare|render)/.test(haystack)) return 'deployment';
  if (/(ui|frontend|component|page|layout|style|css|html|javascript|interaction)/.test(haystack)) return 'frontend';
  return 'tasks';
};

export const isKnownPlanCategory = (category: string): category is NormalizedPlanCategory => {
  return DIRECT_CATEGORIES.has(clean(category) as NormalizedPlanCategory);
};

export const normalizePlanCategory = (
  rawCategory?: string | null,
  title?: string | null,
  files?: string[] | null
): NormalizedPlanCategory => {
  const category = clean(rawCategory || '');
  if (isKnownPlanCategory(category)) return category;

  if (category && CATEGORY_ALIASES[category]) return CATEGORY_ALIASES[category];

  if (category) return 'tasks';

  return inferFromContent(String(title || ''), Array.isArray(files) ? files.map((f) => String(f || '')) : []);
};
