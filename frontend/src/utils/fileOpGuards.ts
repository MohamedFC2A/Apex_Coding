const CONTROL_MARKER_LINE_RE =
  /^\s*\[\[(?:PATCH_FILE|START_FILE|EDIT_FILE|EDIT_NODE|DELETE_FILE|MOVE_FILE|END_FILE|PARTIAL_FILE_CLOSED|ACTIVE_FILE|END_ACTIVE_FILE|CTX_FILE|END_CTX_FILE)\b[^\]]*\]\]\s*$/gim;

const CONTROL_MARKER_PREFIXES = [
  '[[PATCH_FILE:',
  '[[START_FILE:',
  '[[EDIT_FILE:',
  '[[EDIT_NODE:',
  '[[DELETE_FILE:',
  '[[MOVE_FILE:',
  '[[END_FILE]]'
];

export const sanitizeOperationPath = (rawPath: string) => {
  let value = String(rawPath || '').trim();
  if (!value) return '';

  value = value.replace(/^['"`]+|['"`]+$/g, '');
  value = value
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim();

  if (!value) return '';
  if (/^[a-z]+:/i.test(value)) return '';
  if (value.startsWith('~')) return '';

  const segments = value.split('/').filter(Boolean);
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (normalized.length === 0) return '';
      normalized.pop();
      continue;
    }
    if (/[\u0000-\u001f<>:"|?*]/.test(segment)) return '';
    normalized.push(segment);
  }

  return normalized.join('/');
};

export const stripTrailingFileMarkerFragment = (content: string) => {
  const text = String(content || '');
  if (!text) return '';

  let cutAt = -1;
  for (const prefix of CONTROL_MARKER_PREFIXES) {
    const idx = text.lastIndexOf(prefix);
    if (idx === -1) continue;
    const closeIdx = text.indexOf(']]', idx);
    if (closeIdx === -1 || closeIdx + 2 >= text.length) {
      cutAt = Math.max(cutAt, idx);
    }
  }

  const danglingMatch = text.match(/\[\[[A-Z_:\- |./>]*$/);
  if (danglingMatch && typeof danglingMatch.index === 'number') {
    cutAt = Math.max(cutAt, danglingMatch.index);
  }

  return cutAt >= 0 ? text.slice(0, cutAt) : text;
};

export const stripFileOperationMarkers = (content: string) => {
  const text = String(content || '');
  if (!text) return '';
  const withoutLines = text.replace(CONTROL_MARKER_LINE_RE, '');
  return stripTrailingFileMarkerFragment(withoutLines);
};
