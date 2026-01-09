export const getApiBaseUrl = () => {
  const env = import.meta.env.VITE_BACKEND_URL;
  if (env && String(env).trim().length > 0) return String(env).trim();
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}/api`;
  return '/api';
};

export const apiUrl = (path: string) => {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

