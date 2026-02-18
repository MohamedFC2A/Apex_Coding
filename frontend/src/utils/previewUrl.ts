import { buildLivePreviewPath } from '@/utils/livePreviewLink';

const ABSOLUTE_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const BARE_PROJECT_ID_RE = /^project-[a-z0-9-]+$/i;
const HOST_WITH_TLD_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/.*)?$/i;

const normalizeToken = (value: string) => {
  return String(value || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
};

export const normalizePreviewUrl = (value: string | null | undefined): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const token = normalizeToken(raw.split(/[?#]/, 1)[0] || raw);

  if (BARE_PROJECT_ID_RE.test(token)) {
    return buildLivePreviewPath(token);
  }

  if (raw.startsWith('/')) {
    return raw;
  }

  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  if (ABSOLUTE_SCHEME_RE.test(raw)) {
    return raw;
  }

  if (HOST_WITH_TLD_RE.test(raw) || token.includes('.')) {
    return `https://${raw}`;
  }

  // Last-resort guard: avoid relative URLs that trigger same-origin 404s.
  return `https://${token}`;
};

