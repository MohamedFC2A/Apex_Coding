import { getViteEnv } from '@/utils/env';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const getHostFromUrl = (value: string): string | null => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const getApiBaseUrl = () => {
  const env =
    getViteEnv('VITE_BACKEND_URL') ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BACKEND_URL : undefined);

  const envValue = env && String(env).trim().length > 0 ? String(env).trim() : '';

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const runtimeHost = String(window.location.hostname || '').toLowerCase();
    const isLocalRuntime = LOCAL_HOSTS.has(runtimeHost);

    if (isLocalRuntime) {
      if (!envValue) return 'http://localhost:3001';
      if (envValue === '/api') return envValue;

      const envHost = getHostFromUrl(envValue);
      if (envHost && !LOCAL_HOSTS.has(envHost)) {
        // Prevent local dev from accidentally calling remote/stale backend URLs.
        return 'http://localhost:3001';
      }
    }
  }

  if (envValue) return envValue;

  if (typeof window !== 'undefined' && window.location?.origin) {
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
