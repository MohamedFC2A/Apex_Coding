import { getViteEnv } from '@/utils/env';

export const getApiBaseUrl = () => {
  const env =
    getViteEnv('VITE_BACKEND_URL') ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BACKEND_URL : undefined);
  if (env && String(env).trim().length > 0) return String(env).trim();
  
  // If we are on Vercel or same domain, we can just use relative paths which Vercel rewrites handle.
  // However, to be safe and explicit:
  if (typeof window !== 'undefined' && window.location?.origin) {
    // If we are running locally on port 5173, we want to hit the proxy at /api
    // If we are on production, we want /api as well.
    // BUT if the rewrite expects /ai/plan to go to /api/index.js, we can just use /api prefix convention.
    return '/api'; 
  }
  return '/api';
};

export const apiUrl = (path: string) => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If path already contains /api/ prefix (e.g. passed in by mistake), don't double it if base is /api
  const base = getApiBaseUrl().replace(/\/+$/, '');
  
  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${base.replace(/\/api$/, '')}${normalizedPath}`;
  }

  return `${base}${normalizedPath}`;
};
