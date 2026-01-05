import { ProjectFile } from '@/types';

const findFile = (files: ProjectFile[], names: string[]) => {
  const normalized = files.map((f) => ({
    path: (f.path || f.name || '').trim(),
    content: f.content || ''
  }));
  const lowerMap = new Map(normalized.map((f) => [f.path.toLowerCase(), f]));

  for (const name of names) {
    const hit = lowerMap.get(name.toLowerCase());
    if (hit) return hit;
  }

  // Fallback: match by basename
  for (const name of names) {
    const base = name.split('/').pop()?.toLowerCase();
    if (!base) continue;
    const hit = normalized.find((f) => f.path.split('/').pop()?.toLowerCase() === base);
    if (hit) return hit;
  }

  return null;
};

const injectIntoHead = (html: string, injection: string) => {
  if (html.includes('</head>')) return html.replace('</head>', `${injection}\n</head>`);
  if (html.includes('<html')) return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>\n${injection}\n</head>`);
  return `<!doctype html><html><head>${injection}</head><body>${html}</body></html>`;
};

const injectBeforeBodyEnd = (html: string, injection: string) => {
  if (html.includes('</body>')) return html.replace('</body>', `${injection}\n</body>`);
  return `${html}\n${injection}`;
};

/**
 * Bundles a simple HTML/CSS/JS project into a single HTML document for iframe preview:
 * - Uses `index.html` as base.
 * - Inlines `style.css` into <head>.
 * - Inlines `script.js` before </body>.
 */
export const compileProject = (files: ProjectFile[]): string | null => {
  const htmlFile =
    findFile(files, ['index.html', 'main.html', 'app.html']) ||
    files
      .map((f) => ({ path: f.path || f.name || '', content: f.content || '' }))
      .find((f) => f.path.toLowerCase().endsWith('.html')) ||
    null;

  if (!htmlFile) return null;

  const cssFile = findFile(files, ['style.css', 'styles.css', 'index.css', 'app.css']);
  const jsFile = findFile(files, ['script.js', 'main.js', 'index.js', 'app.js']);

  let html = htmlFile.content || '';

  if (cssFile && cssFile.content.trim().length > 0) {
    html = injectIntoHead(html, `<style>\n${cssFile.content}\n</style>`);
  }

  if (jsFile && jsFile.content.trim().length > 0) {
    html = injectBeforeBodyEnd(html, `<script>\n${jsFile.content}\n</script>`);
  }

  return html;
};

