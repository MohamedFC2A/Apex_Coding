import React, { useEffect, useRef } from 'react';
import { GlassCard } from './GlassCard';
import { usePreviewStore } from '@/stores/previewStore';
import { Monitor, Loader2, ExternalLink } from 'lucide-react';

export const PreviewPanel: React.FC = () => {
  const { isExecuting, previewUrl, previewContent, addLog } = usePreviewStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (previewContent && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (doc) {
        // Inject console capture script
        const consoleScript = `
          <script>
            (function() {
              const originalConsole = {
                log: console.log,
                error: console.error,
                warn: console.warn
              };
              
              console.log = function(...args) {
                window.parent.postMessage({
                  type: 'console',
                  method: 'log',
                  data: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
                }, '*');
                originalConsole.log.apply(console, args);
              };
              
              console.error = function(...args) {
                window.parent.postMessage({
                  type: 'console',
                  method: 'error',
                  data: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
                }, '*');
                originalConsole.error.apply(console, args);
              };
              
              console.warn = function(...args) {
                window.parent.postMessage({
                  type: 'console',
                  method: 'warn',
                  data: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
                }, '*');
                originalConsole.warn.apply(console, args);
              };
              
              window.addEventListener('error', function(e) {
                window.parent.postMessage({
                  type: 'console',
                  method: 'error',
                  data: [e.message + ' at ' + e.filename + ':' + e.lineno]
                }, '*');
              });
            })();
          </script>
        `;
        
        const modifiedContent = previewContent.replace('</head>', consoleScript + '</head>');
        doc.open();
        doc.write(modifiedContent);
        doc.close();
      }
    }
  }, [previewContent]);

  // Listen for console messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'console') {
        const { method, data } = event.data;
        addLog({
          timestamp: Date.now(),
          type: method === 'error' ? 'error' : method === 'warn' ? 'warning' : 'info',
          message: data.join(' '),
          source: 'preview'
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addLog]);

  return (
    <GlassCard className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-white/10 glass-panel flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-white/70" />
          <h3 className="text-sm font-semibold">Live Preview</h3>
        </div>
        
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-white/70 hover:text-white/90 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open in new tab
          </a>
        )}
      </div>
      
      <div className="flex-1 relative bg-white">
        {isExecuting ? (
          <div className="absolute inset-0 flex items-center justify-center bg-nexus-darker/90">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-white/70 mx-auto mb-4" />
              <p className="text-white">Executing code...</p>
            </div>
          </div>
        ) : previewContent ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            className="w-full h-full border-0"
            title="preview"
          />
        ) : previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            title="preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-nexus-darker/90">
            <div className="text-center text-gray-400">
              <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Click Run to see your code in action</p>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
};
