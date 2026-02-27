import type { GenerationProfile } from '@/types/constraints';

export const hasExplicitFrameworkRequest = (prompt: string) => {
  const text = String(prompt || '').toLowerCase();
  return /\breact\b|\bnext(?:\.js)?\b|\bvite\b|\btypescript app\b|\bvue\b|\bangular\b|\bsvelte\b/.test(text);
};

export const hasFrameworkProjectShape = (paths: string[]) => {
  const normalized = (paths || []).map((item) => String(item || '').replace(/\\/g, '/').toLowerCase());
  return normalized.some((path) =>
    path.includes('/src/app/') ||
    path.endsWith('next.config.mjs') ||
    path.endsWith('next.config.js') ||
    path.endsWith('vite.config.ts') ||
    path.endsWith('vite.config.js') ||
    path.endsWith('package.json')
  );
};

export const resolveGenerationProfile = (args: {
  requested?: GenerationProfile;
  prompt: string;
  filePaths: string[];
}): Exclude<GenerationProfile, 'auto'> => {
  if (args.requested === 'static' || args.requested === 'framework') return args.requested;
  if (hasExplicitFrameworkRequest(args.prompt) || hasFrameworkProjectShape(args.filePaths)) return 'framework';
  return 'static';
};

