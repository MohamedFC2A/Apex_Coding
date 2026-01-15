import React, { useEffect, useRef, useState } from 'react';
import { Code, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';

interface SimplePreviewProps {
  className?: string;
}

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
        // Generate a simple HTML page if no HTML file exists
        const mainHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - Apex Coding</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            width: 100%;
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 40px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(90deg, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .header p {
            color: #94a3b8;
            font-size: 1.1rem;
        }
        .files-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .file-card {
            background: rgba(15, 23, 42, 0.8);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: transform 0.2s, border-color 0.2s;
        }
        .file-card:hover {
            transform: translateY(-2px);
            border-color: rgba(96, 165, 250, 0.3);
        }
        .file-card h3 {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.1rem;
            margin-bottom: 10px;
            color: #e2e8f0;
        }
        .file-card .icon {
            width: 24px;
            height: 24px;
        }
        .file-card p {
            color: #94a3b8;
            font-size: 0.9rem;
        }
        .code-preview {
            background: #0f172a;
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            overflow-x: auto;
        }
        .code-preview h3 {
            color: #e2e8f0;
            margin-bottom: 15px;
            font-size: 1.1rem;
        }
        pre {
            color: #cbd5e1;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            line-height: 1.5;
            white-space: pre-wrap;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            color: #64748b;
            font-size: 0.9rem;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        @media (max-width: 640px) {
            .container { padding: 20px; }
            .header h1 { font-size: 2rem; }
            .files-info { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Simple Preview</h1>
            <p>Live preview of your generated code</p>
        </div>
        
        <div class="files-info">
            <div class="file-card">
                <h3><span class="icon">📄</span> HTML Files</h3>
                <p>${htmlFiles.length} file${htmlFiles.length !== 1 ? 's' : ''} found</p>
            </div>
            <div class="file-card">
                <h3><span class="icon">🎨</span> CSS Files</h3>
                <p>${cssFiles.length} file${cssFiles.length !== 1 ? 's' : ''} found</p>
            </div>
            <div class="file-card">
                <h3><span class="icon">⚡</span> JS Files</h3>
                <p>${jsFiles.length} file${jsFiles.length !== 1 ? 's' : ''} found</p>
            </div>
        </div>
        
        <div class="code-preview">
            <h3>Project Structure</h3>
            <pre>${files.map(f => `📁 ${f.path || f.name}`).join('\n')}</pre>
        </div>
        
        <div class="footer">
            <p>Built with Apex Coding • Simple Preview Mode</p>
            <p>Add an index.html file for full preview functionality</p>
        </div>
    </div>
    
    <script>
        // Simple interactivity
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Simple Preview loaded');
            
            // Add click animation to file cards
            const cards = document.querySelectorAll('.file-card');
            cards.forEach(card => {
                card.addEventListener('click', () => {
                    card.style.transform = 'scale(0.98)';
                    setTimeout(() => {
                        card.style.transform = '';
                    }, 150);
                });
            });
            
            // Update timestamp
            const timeElement = document.createElement('p');
            timeElement.textContent = 'Loaded: ' + new Date().toLocaleTimeString();
            timeElement.style.marginTop = '10px';
            timeElement.style.fontSize = '0.8rem';
            timeElement.style.color = '#475569';
            document.querySelector('.footer').appendChild(timeElement);
        });
    </script>
</body>
</html>`;
        setPreviewContent(mainHtml);
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
      setError(`Failed to generate preview: ${err.message}`);
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
        <div className="mt-2 text-xs text-gray-400">
          This is a simple preview. For full functionality, configure CodeSandbox API key.
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