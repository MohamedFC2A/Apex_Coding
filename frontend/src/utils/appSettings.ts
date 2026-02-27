export const APP_SETTINGS_STORAGE_KEY = 'apex-app-settings-v1';

export type AppSettings = {
  autoSaveChats: boolean;
  restoreLastSession: boolean;
  autoOpenPreview: boolean;
  chatAutoFollow: boolean;
  preferLivePreviewRoute: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoSaveChats: true,
  restoreLastSession: true,
  autoOpenPreview: true,
  chatAutoFollow: true,
  preferLivePreviewRoute: true
};

const toBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
};

export const normalizeAppSettings = (input: unknown): AppSettings => {
  const source = (input && typeof input === 'object' ? (input as Record<string, unknown>) : {}) || {};
  return {
    autoSaveChats: toBoolean(source.autoSaveChats, DEFAULT_APP_SETTINGS.autoSaveChats),
    restoreLastSession: toBoolean(source.restoreLastSession, DEFAULT_APP_SETTINGS.restoreLastSession),
    autoOpenPreview: toBoolean(source.autoOpenPreview, DEFAULT_APP_SETTINGS.autoOpenPreview),
    chatAutoFollow: toBoolean(source.chatAutoFollow, DEFAULT_APP_SETTINGS.chatAutoFollow),
    preferLivePreviewRoute: toBoolean(source.preferLivePreviewRoute, DEFAULT_APP_SETTINGS.preferLivePreviewRoute)
  };
};

export const readAppSettings = (): AppSettings => {
  if (typeof window === 'undefined') return { ...DEFAULT_APP_SETTINGS };
  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    return normalizeAppSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
};

export const writeAppSettings = (settings: AppSettings) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)));
  } catch {
    // ignore storage failures
  }
};

export const patchAppSettings = (patch: Partial<AppSettings>): AppSettings => {
  const next = normalizeAppSettings({ ...readAppSettings(), ...(patch || {}) });
  writeAppSettings(next);
  return next;
};

export const isChatAutoSaveEnabled = () => readAppSettings().autoSaveChats;
