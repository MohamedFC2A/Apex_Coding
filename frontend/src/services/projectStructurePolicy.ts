export const SVG_CANONICAL_DIR = 'frontend/src/assets/icons';

const normalize = (value: string) => String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();

export const isSvgPath = (path: string) => /\.svg$/i.test(String(path || ''));

export const enforceSvgCanonicalPath = (rawPath: string) => {
  const path = normalize(rawPath);
  if (!path) return path;
  if (!isSvgPath(path)) return path;
  if (path.toLowerCase().startsWith(`${SVG_CANONICAL_DIR.toLowerCase()}/`)) return path;
  const fileName = path.split('/').pop() || 'icon.svg';
  return `${SVG_CANONICAL_DIR}/${fileName}`;
};

export const buildSvgPolicyPromptLine = () =>
  `- Place every .svg asset under ${SVG_CANONICAL_DIR} and keep imports aligned with that path.`;
