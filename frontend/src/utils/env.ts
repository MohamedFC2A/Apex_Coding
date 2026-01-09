export const getViteEnv = (key: string, envOverride?: Record<string, unknown>): string | undefined => {
  const env = envOverride ?? (import.meta as any)?.env ?? {};
  const value = env?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getWebContainerClientId = (envOverride?: Record<string, unknown>): string | undefined =>
  getViteEnv('VITE_WC_CLIENT_ID', envOverride);
