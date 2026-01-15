import React, { useEffect, useRef, useState } from 'react';
import { Code, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';

interface SimplePreviewProps {
  className?: string;
}

const escapeHtml = (value?: string) => {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const isExternalAssetUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed)) return true;
  return (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  );
};

const extractAttribute = (tag: string, attr: string) => {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  return match?.[2] ?? '';
};

const shouldStripRelativeAsset = (value: string) => {
  if (!value) return false;
  return !isExternalAssetUrl(value);
};

const stripRelativeAssets = (html: string) => {
  let output = html;
  output = output.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = extractAttribute(tag, 'rel').toLowerCase();
    if (!rel || !rel.includes('stylesheet')) return tag;
    const href = extractAttribute(tag, 'href');
    return shouldStripRelativeAsset(href) ? '' : tag;
  });
  output = output.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => {
    const src = extractAttribute(tag, 'src');
    if (!src) return tag;
    return shouldStripRelativeAsset(src) ? '' : tag;
  });
  return output;
};

export const SimplePreview: React.FC<SimplePreviewProps> = ({ className }) => {
  const files = useProjectStore((s) => s.files);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [hasHtmlFile, setHasHtmlFile] = useState(false);
  const [hasJsFile, setHasJsFile] = useState(false);
  const [hasCssFile, setHasCssFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePreview = () => {
    try {
      setError(null);
      
      // Find HTML, JS, and CSS files
      const htmlFiles = files.filter(f => 
        f.path?.endsWith('.html') || f.name?.endsWith('.html') ||
        f.path?.endsWith('.htm') || f.name?.endsWith('.htm')
      );
      
      const jsFiles = files.filter(f => 
        f.path?.endsWith('.js') || f.name?.endsWith('.js') ||
        f.path?.endsWith('.jsx') || f.name?.endsWith('.jsx') ||
        f.path?.endsWith('.ts') || f.name?.endsWith('.ts') ||
        f.path?.endsWith('.tsx') || f.name?.endsWith('.tsx')
      );
      
      const cssFiles = files.filter(f => 
        f.path?.endsWith('.css') || f.name?.endsWith('.css') ||
        f.path?.endsWith('.scss') || f.name?.endsWith('.scss') ||
        f.path?.endsWith('.sass') || f.name?.endsWith('.sass')
      );

      setHasHtmlFile(htmlFiles.length > 0);
      setHasJsFile(jsFiles.length > 0);
      setHasCssFile(cssFiles.length > 0);

      if (htmlFiles.length === 0) {
        const fileListMarkup = files.length > 0
          ? files
              .map((f) => `<li>${escapeHtml(f.path || f.name || 'untitled')}</li>`)
              .join('')
          : '<li class="empty">No files yet</li>';

        const defaultHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Preview</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: "Space Grotesk", "Sora", "Manrope", "Inter", system-ui, sans-serif;
      background-color: #02040b;
      color: #f8fafc;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(1200px 800px at 10% 15%, rgba(56, 189, 248, 0.12), transparent 55%),
        radial-gradient(900px 700px at 85% 20%, rgba(139, 92, 246, 0.14), transparent 60%),
        radial-gradient(800px 600px at 75% 90%, rgba(14, 165, 233, 0.12), transparent 60%),
        linear-gradient(160deg, #02040b 0%, #050b1b 45%, #0b1120 100%);
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.45'/%3E%3C/svg%3E");
      opacity: 0.12;
      mix-blend-mode: soft-light;
      pointer-events: none;
    }
    .stage {
      position: relative;
      width: min(900px, 92vw);
      padding: 48px 24px;
    }
    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(40px);
      opacity: 0.6;
      animation: float 14s ease-in-out infinite;
    }
    .orb.one {
      width: 280px;
      height: 280px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.45), transparent 70%);
      top: -120px;
      left: -90px;
    }
    .orb.two {
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.45), transparent 70%);
      bottom: -140px;
      right: -110px;
      animation-delay: -4s;
    }
    .panel {
      position: relative;
      padding: 36px;
      border-radius: 28px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow:
        0 30px 80px rgba(2, 6, 23, 0.65),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      overflow: hidden;
    }
    .panel::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.04), rgba(14, 165, 233, 0.18));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      opacity: 0.7;
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }
    .eyebrow {
      font-size: 0.7rem;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      color: rgba(248, 250, 252, 0.55);
    }
    .status-pill {
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(15, 23, 42, 0.5);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(248, 250, 252, 0.85);
      box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.08);
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(1.6rem, 2vw + 1rem, 2.4rem);
      letter-spacing: -0.02em;
      color: #f8fafc;
      text-shadow: 0 12px 30px rgba(15, 23, 42, 0.65);
    }
    .hint {
      margin: 0 0 24px;
      color: rgba(226, 232, 240, 0.68);
      font-size: 0.98rem;
      line-height: 1.55;
      max-width: 520px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .stat {
      padding: 14px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 10px 24px rgba(2, 6, 23, 0.4);
    }
    .stat strong {
      display: block;
      font-size: 1.5rem;
      color: #f8fafc;
      margin-bottom: 6px;
    }
    .stat span {
      font-size: 0.7rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: rgba(226, 232, 240, 0.7);
    }
    .files h2 {
      margin: 0;
      font-size: 0.85rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: rgba(148, 163, 184, 0.75);
    }
    .files {
      margin-top: 14px;
      font-size: 0.92rem;
      color: rgba(226, 232, 240, 0.82);
    }
    .files ul {
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
      max-height: 200px;
      overflow-y: auto;
      display: grid;
      gap: 8px;
    }
    .files li {
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      word-break: break-all;
    }
    .files li.empty {
      color: rgba(148, 163, 184, 0.85);
      text-align: center;
    }
    .footer {
      margin-top: 20px;
      font-size: 0.8rem;
      color: rgba(148, 163, 184, 0.7);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .footer span {
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
    }
    @keyframes float {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-16px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .orb {
        animation: none;
      }
    }
    @media (max-width: 560px) {
      .panel {
        padding: 24px;
      }
      .footer {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="stage">
    <div class="orb one"></div>
    <div class="orb two"></div>
    <section class="panel">
      <div class="panel-header">
        <div class="eyebrow">Simple Preview</div>
        <div class="status-pill">Local</div>
      </div>
      <h1>Live Preview Ready</h1>
      <p class="hint">Your project renders directly in the browser. Add an index.html for full layout previews.</p>
      <div class="stats">
        <div class="stat">
          <strong>${htmlFiles.length}</strong>
          <span>HTML</span>
        </div>
        <div class="stat">
          <strong>${cssFiles.length}</strong>
          <span>CSS</span>
        </div>
        <div class="stat">
          <strong>${jsFiles.length}</strong>
          <span>JavaScript</span>
        </div>
      </div>
      <div class="files">
        <h2>Project files</h2>
        <ul>
          ${fileListMarkup}
        </ul>
      </div>
      <div class="footer">
        <span>Frosted glass preview layer</span>
        <span>Render mode: browser-only</span>
      </div>
    </section>
  </div>
</body>
</html>`;
        setPreviewContent(defaultHtml);
      } else {
        // Use the first HTML file found
        const htmlContent = htmlFiles[0].content;
        
        // Inject CSS and JS if they exist
        let enhancedHtml = htmlContent;
        
        // Inject CSS
        if (cssFiles.length > 0) {
          const cssContent = cssFiles.map(f => f.content).join('\n');
          const styleTag = `<style>\n${cssContent}\n</style>`;
          
          if (enhancedHtml.includes('</head>')) {
            enhancedHtml = enhancedHtml.replace('</head>', `${styleTag}\n</head>`);
          } else if (enhancedHtml.includes('<head>')) {
            enhancedHtml = enhancedHtml.replace('<head>', `<head>\n${styleTag}`);
          } else {
            enhancedHtml = enhancedHtml.replace('</title>', `</title>\n${styleTag}`);
          }
        }
        
        // Inject JS
        if (jsFiles.length > 0) {
          const jsContent = jsFiles.map(f => f.content).join('\n');
          const scriptTag = `<script>\n${jsContent}\n</script>`;
          
          if (enhancedHtml.includes('</body>')) {
            enhancedHtml = enhancedHtml.replace('</body>', `${scriptTag}\n</body>`);
          } else if (enhancedHtml.includes('<body>')) {
            enhancedHtml = enhancedHtml.replace('<body>', `<body>\n${scriptTag}`);
          } else {
            enhancedHtml += `\n${scriptTag}`;
          }
        }
        
        enhancedHtml = stripRelativeAssets(enhancedHtml);
        setPreviewContent(enhancedHtml);
      }
    } catch (err) {
      setError(`Failed to generate preview: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    if (files.length > 0) {
      generatePreview();
    }
  }, [files]);

  useEffect(() => {
    if (iframeRef.current && previewContent) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(previewContent);
        iframeDoc.close();
      }
    }
  }, [previewContent]);

  if (files.length === 0) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className || ''}`}>
        <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_15%_20%,rgba(59,130,246,0.15),transparent_60%),radial-gradient(900px_600px_at_85%_80%,rgba(14,165,233,0.12),transparent_60%)]" />
        <div className="absolute -top-32 right-[-120px] h-[360px] w-[360px] rounded-full bg-cyan-400/15 blur-[120px]" />
        <div className="absolute -bottom-40 left-[-140px] h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[140px]" />
        <div className="relative z-10 flex h-full items-center justify-center px-6">
          <div className="glass-panel max-w-md rounded-3xl p-6 text-center shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <FileText className="h-7 w-7 text-white/70" />
            </div>
            <p className="text-lg font-semibold text-white">No files yet</p>
            <p className="mt-2 text-sm text-white/60">
              Generate HTML, CSS, or JS to see a live preview instantly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className || ''}`}>
        <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_15%_20%,rgba(239,68,68,0.18),transparent_60%),radial-gradient(900px_600px_at_85%_80%,rgba(248,113,113,0.12),transparent_60%)]" />
        <div className="relative z-10 flex h-full items-center justify-center px-6">
          <div className="glass-panel max-w-md rounded-3xl p-6 text-center shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <AlertTriangle className="h-7 w-7 text-red-300" />
            </div>
            <h3 className="text-lg font-semibold text-white">Preview error</h3>
            <p className="mt-2 text-sm text-red-200/80">{error}</p>
            <button
              onClick={generatePreview}
              className="mx-auto mt-5 inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Preview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      {/* Preview Header */}
      <div className="absolute left-0 right-0 top-0 z-10 border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10">
              <Code className="h-4 w-4 text-white/80" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Simple Preview</div>
              <div className="text-xs text-white/60">Browser-only render</div>
            </div>
            <div className="ml-2 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${hasHtmlFile ? 'bg-emerald-400' : 'bg-white/30'}`} />
                HTML
              </span>
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${hasCssFile ? 'bg-sky-400' : 'bg-white/30'}`} />
                CSS
              </span>
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${hasJsFile ? 'bg-violet-400' : 'bg-white/30'}`} />
                JS
              </span>
            </div>
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/50">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 pt-16"
        title="Simple Preview"
        sandbox="allow-scripts allow-same-origin"
      />

      {/* Refresh Button */}
      <button
        onClick={generatePreview}
        className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 shadow-[0_20px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl transition hover:bg-white/20"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </button>
    </div>
  );
};
