export const LIVE_PREVIEW_STORAGE_PREFIX = 'apex-live-preview:';
export const LIVE_PREVIEW_CHANNEL = 'apex-live-preview';

export type LivePreviewSnapshot = {
  projectId: string;
  html: string;
  updatedAt: number;
  meta: Record<string, unknown>;
};

const normalizeProjectId = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const unwrapPathLike = (candidate: string) => {
    const clean = String(candidate || '').trim().replace(/^\/+|\/+$/g, '');
    if (!clean) return '';
    const parts = clean.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  };

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const parsed = new URL(raw);
      return decodeURIComponent(unwrapPathLike(parsed.pathname));
    } catch {
      return raw;
    }
  }

  const withoutQuery = raw.split(/[?#]/, 1)[0] || raw;
  const candidate = unwrapPathLike(withoutQuery);
  if (!candidate) return '';

  try {
    return decodeURIComponent(candidate).trim();
  } catch {
    return candidate;
  }
};

const getStorageKey = (projectId: string) => `${LIVE_PREVIEW_STORAGE_PREFIX}${normalizeProjectId(projectId)}`;

let livePreviewChannel: BroadcastChannel | null = null;

const getChannel = () => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!livePreviewChannel) {
    livePreviewChannel = new BroadcastChannel(LIVE_PREVIEW_CHANNEL);
  }
  return livePreviewChannel;
};

export const buildLivePreviewPath = (projectId: string) => {
  const cleanId = normalizeProjectId(projectId);
  if (!cleanId) return '/live-preview';
  return `/live-preview/${encodeURIComponent(cleanId)}`;
};

export const publishLivePreviewSnapshot = (
  projectId: string,
  html: string,
  meta: Record<string, unknown> = {}
): LivePreviewSnapshot | null => {
  if (typeof window === 'undefined') return null;

  const cleanId = normalizeProjectId(projectId);
  if (!cleanId) return null;

  const snapshot: LivePreviewSnapshot = {
    projectId: cleanId,
    html: String(html || ''),
    updatedAt: Date.now(),
    meta: meta || {}
  };

  try {
    window.localStorage.setItem(getStorageKey(cleanId), JSON.stringify(snapshot));
  } catch {
    // ignore local storage failures
  }

  try {
    getChannel()?.postMessage(snapshot);
  } catch {
    // ignore broadcast failures
  }

  return snapshot;
};

export const readLivePreviewSnapshot = (projectId: string): LivePreviewSnapshot | null => {
  if (typeof window === 'undefined') return null;
  const cleanId = normalizeProjectId(projectId);
  if (!cleanId) return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(cleanId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (normalizeProjectId(parsed?.projectId) !== cleanId) return null;
    if (typeof parsed?.html !== 'string') return null;
    return {
      projectId: cleanId,
      html: parsed.html,
      updatedAt: Number(parsed?.updatedAt || Date.now()),
      meta: typeof parsed?.meta === 'object' && parsed.meta ? parsed.meta : {}
    };
  } catch {
    return null;
  }
};

export const subscribeLivePreviewSnapshot = (
  projectId: string,
  onSnapshot: (snapshot: LivePreviewSnapshot) => void
) => {
  if (typeof window === 'undefined') return () => undefined;
  const cleanId = normalizeProjectId(projectId);
  if (!cleanId) return () => undefined;

  const storageKey = getStorageKey(cleanId);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue);
      if (normalizeProjectId(parsed?.projectId) !== cleanId) return;
      if (typeof parsed?.html !== 'string') return;
      onSnapshot({
        projectId: cleanId,
        html: parsed.html,
        updatedAt: Number(parsed?.updatedAt || Date.now()),
        meta: typeof parsed?.meta === 'object' && parsed.meta ? parsed.meta : {}
      });
    } catch {
      // ignore malformed storage payloads
    }
  };

  const channel = getChannel();
  const handleChannel = (event: MessageEvent<LivePreviewSnapshot>) => {
    const data = event?.data;
    if (!data || normalizeProjectId(data.projectId) !== cleanId || typeof data.html !== 'string') return;
    onSnapshot({
      projectId: cleanId,
      html: data.html,
      updatedAt: Number(data.updatedAt || Date.now()),
      meta: typeof data.meta === 'object' && data.meta ? data.meta : {}
    });
  };

  window.addEventListener('storage', handleStorage);
  channel?.addEventListener('message', handleChannel);

  return () => {
    window.removeEventListener('storage', handleStorage);
    channel?.removeEventListener('message', handleChannel);
  };
};
