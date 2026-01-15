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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background-color: #020617;
      color: #e2e8f0;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #020617;
    }
    .preview-card {
      width: min(640px, 90vw);
      padding: 32px;
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.25);
      box-shadow: 0 20px 60px rgba(2, 6, 23, 0.8);
    }
    .preview-card h1 {
      margin-bottom: 8px;
      font-size: 1.6rem;
      color: #f8fafc;
    }
    .hint {
      margin-bottom: 16px;
      color: #94a3b8;
      font-size: 0.95rem;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat {
      padding: 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(148, 163, 184, 0.2);
      text-align: center;
    }
    .stat strong {
      display: block;
      font-size: 1.3rem;
      color: #f8fafc;
    }
    .stat span {
      font-size: 0.75rem;
      letter-spacing: 0.2em;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .files h2 {
      margin: 0;
      font-size: 1rem;
      color: #94a3b8;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .files {
      margin-top: 8px;
      font-size: 0.9rem;
    }
    .files ul {
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
      max-height: 200px;
      overflow-y: auto;
    }
    .files li {
      padding: 6px 8px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.1);
      margin-bottom: 6px;
      word-break: break-all;
    }
    .files li.empty {
      color: #94a3b8;
      text-align: center;
    }
    @media (max-width: 480px) {
      .preview-card {
        padding: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="preview-card">
    <h1>Live Preview Ready</h1>
    <p class="hint">Rendered in-browser with the files you generated so far.</p>
    <div class="stats">
      <div class="stat">
        <span>HTML</span>
        <strong>${htmlFiles.length}</strong>
      </div>
      <div class="stat">
        <span>CSS</span>
        <strong>${cssFiles.length}</strong>
      </div>
      <div class="stat">
        <span>JavaScript</span>
        <strong>${jsFiles.length}</strong>
      </div>
    </div>
    <div class="files">
      <h2>Project files</h2>
      <ul>
        ${fileListMarkup}
      </ul>
    </div>
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
      <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white/60 ${className || ''}`}>
        <FileText className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium mb-2">No Files to Preview</p>
        <p className="text-sm max-w-md text-center">
          Generate some code first to see the live preview
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-900 ${className || ''}`}>
        <div className="max-w-md text-center p-6">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Preview Error</h3>
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <button
            onClick={generatePreview}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors mx-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Preview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      {/* Preview Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Code className="w-5 h-5 text-blue-400 mr-2" />
            <span className="text-sm font-medium text-white">Simple Preview</span>
            <div className="ml-4 flex items-center gap-3">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-1.5 ${hasHtmlFile ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-300">HTML</span>
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-1.5 ${hasCssFile ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-300">CSS</span>
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-1.5 ${hasJsFile ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-300">JS</span>
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-400">
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
        className="absolute bottom-4 right-4 z-10 flex items-center px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors shadow-lg"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Refresh Preview
      </button>
    </div>
  );
};
