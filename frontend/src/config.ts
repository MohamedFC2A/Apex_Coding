const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

const runtimeEnv =
  (import.meta as any)?.env ||
  (globalThis as any)?.process?.env ||
  {};

export const API_BASE_URL = normalizeBaseUrl(runtimeEnv.VITE_BACKEND_URL || 'http://localhost:3001');
