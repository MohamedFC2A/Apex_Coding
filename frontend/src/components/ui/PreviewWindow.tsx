'use client';

import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { AlertTriangle, Loader2, RotateCw, Terminal, XCircle } from 'lucide-react';
import { usePreviewStore } from '../../stores/previewStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { WebContainerService } from '../../services/webcontainer';
import { ensureProjectConfig } from '../../utils/projectRepair';
import { ErrorBoundary } from './ErrorBoundary';

const Window = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 10, 10, 0.95);
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
`;

const Titlebar = styled.div`
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
`;

const UrlBar = styled.div`
  flex: 1;
  margin: 0 16px;
  height: 24px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  font-family: monospace;
`;

const Content = styled.div`
  position: relative;
  flex: 1;
  background: white;
`;

const Iframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: 0;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 10, 0.9);
  color: white;
  z-index: 10;
`;

const TerminalView = styled.div`
  width: 90%;
  max-width: 600px;
  max-height: 300px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
  font-family: monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  white-space: pre-wrap;
`;

interface PreviewWindowProps {
  className?: string;
  enabled?: boolean;
}

export const PreviewWindow: React.FC<PreviewWindowProps> = ({ className, enabled = true }) => {
  const { files, upsertFile } = useProjectStore();
  const {
    previewUrl,
    runtimeStatus,
    setRuntimeStatus,
    setPreviewUrl
  } = usePreviewStore();
  const { addChatMessage } = useAIStore();

  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const mountedFilesRef = useRef<string>('');
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // 1. Boot & Mount
  useEffect(() => {
    if (!enabled || files.length === 0) return;

    // Check configuration and repair if needed BEFORE hashing/mounting
    const { files: cleanFiles, repaired } = ensureProjectConfig(files);

    // If repaired, update store and return (effect will re-run with new files)
    if (repaired) {
      cleanFiles.forEach(f => {
        if (!files.some(existing => existing.path === f.path)) {
          upsertFile(f as any);
        }
      });
      return;
    }

    const currentFilesHash = JSON.stringify(cleanFiles.map(f => (f.path || f.name || '') + (f.content?.length || 0)));
    if (mountedFilesRef.current === currentFilesHash) return;

    const init = async () => {
      setRuntimeStatus('booting');
      setTerminalOutput('');

      try {
        // Prepare files map
        const fileMap: Record<string, string> = {};
        cleanFiles.forEach(f => {
          if (f.path) fileMap[f.path] = f.content || '';
        });

        await WebContainerService.mount(fileMap);
        mountedFilesRef.current = currentFilesHash;

        // Install dependencies
        setRuntimeStatus('installing');
        const installExit = await WebContainerService.installDependencies((data) => {
          setTerminalOutput(prev => prev + data);
          usePreviewStore.getState().addLog({ timestamp: Date.now(), message: data, source: 'system', type: 'info' });
        });

        if (installExit !== 0) {
          throw new Error(`npm install failed with exit code ${installExit}`);
        }

        // Start Dev Server
        setRuntimeStatus('starting');
        await WebContainerService.startDevServer((data) => {
          setTerminalOutput(prev => prev + data);
          usePreviewStore.getState().addLog({ timestamp: Date.now(), message: data, source: 'system', type: 'info' });
        });

      } catch (err: any) {
        console.error('Preview Error:', err);
        setRuntimeStatus('error', err.message);
        // The App.tsx component observes runtimeStatus and triggers auto-fix
      }
    };

    init();
  }, [files, enabled, retryCount, upsertFile, setRuntimeStatus]);

  const handleRefresh = () => {
    const frame = document.getElementById('preview-frame') as HTMLIFrameElement;
    if (frame) frame.src = frame.src;
  };

  const handleRetry = () => {
    mountedFilesRef.current = ''; // Force remount
    setRetryCount(c => c + 1);
  };

  return (
    <Window className={className}>
      <Titlebar>
        <div className="flex gap-2">
           <div className="w-3 h-3 rounded-full bg-red-500/80" />
           <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
           <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <UrlBar>{previewUrl || 'Loading...'}</UrlBar>
        <button onClick={handleRefresh} className="p-1 hover:bg-white/10 rounded">
          <RotateCw size={14} className="text-white/60" />
        </button>
      </Titlebar>

      <Content>
        {previewUrl && runtimeStatus === 'ready' && (
          <Iframe
            id="preview-frame"
            src={previewUrl}
            title="Preview"
            allow="clipboard-read; clipboard-write"
          />
        )}

        {runtimeStatus !== 'ready' && (
          <Overlay>
            {runtimeStatus === 'error' ? (
              <>
                <XCircle size={40} className="text-red-500 mb-4" />
                <h3 className="text-lg font-bold mb-2">Preview Failed</h3>
                <p className="text-white/60 mb-6 text-center max-w-md">
                   The container failed to start. The AI has been notified to fix the issue.
                </p>
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition"
                >
                  Retry Manually
                </button>
              </>
            ) : (
              <>
                <Loader2 size={40} className="text-cyan-400 animate-spin mb-4" />
                <h3 className="text-lg font-bold mb-2">
                  {runtimeStatus === 'booting' && 'Booting WebContainer...'}
                  {runtimeStatus === 'installing' && 'Installing Dependencies...'}
                  {runtimeStatus === 'starting' && 'Starting Dev Server...'}
                </h3>
              </>
            )}

            {(terminalOutput || runtimeStatus === 'error') && (
               <TerminalView ref={terminalRef}>
                 <div className="flex items-center justify-between gap-2 mb-2 border-b border-white/10 pb-2 sticky top-0 bg-black/80 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <Terminal size={12} className="text-cyan-400" />
                      <span className="font-bold text-cyan-100">Terminal Output</span>
                    </div>
                    <button onClick={() => setTerminalOutput('')} className="text-[10px] uppercase opacity-50 hover:opacity-100">Clear</button>
                 </div>
                 {terminalOutput || 'Initializing environment...'}
               </TerminalView>
            )}
          </Overlay>
        )}
      </Content>
    </Window>
  );
};
