'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, Terminal, CheckCircle2, XCircle, Play, RefreshCw } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { 
  runProject, 
  teardownWebContainer, 
  RuntimeStatus,
  ProjectFile 
} from '@/utils/webcontainer';

interface WebContainerPreviewProps {
  className?: string;
}

const statusConfig: Record<RuntimeStatus, { icon: React.ReactNode; label: string; color: string }> = {
  idle: { 
    icon: <Play className="h-4 w-4" />, 
    label: 'Ready to start',
    color: 'text-white/50'
  },
  booting: { 
    icon: <Loader2 className="h-4 w-4 animate-spin" />, 
    label: 'Booting WebContainer...',
    color: 'text-blue-400'
  },
  mounting: { 
    icon: <Loader2 className="h-4 w-4 animate-spin" />, 
    label: 'Mounting files...',
    color: 'text-cyan-400'
  },
  installing: { 
    icon: <Loader2 className="h-4 w-4 animate-spin" />, 
    label: 'Installing dependencies...',
    color: 'text-purple-400'
  },
  starting: { 
    icon: <Loader2 className="h-4 w-4 animate-spin" />, 
    label: 'Starting dev server...',
    color: 'text-amber-400'
  },
  ready: { 
    icon: <CheckCircle2 className="h-4 w-4" />, 
    label: 'Server running',
    color: 'text-emerald-400'
  },
  error: { 
    icon: <XCircle className="h-4 w-4" />, 
    label: 'Error occurred',
    color: 'text-red-400'
  }
};

const sanitizeTerminalOutput = (value: string) => {
  return value
    .replace(/\u001b\][^\u0007]*\u0007/g, '')
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\r/g, '')
    .replace(/\u0000/g, '');
};

export const WebContainerPreview: React.FC<WebContainerPreviewProps> = ({ className }) => {
  const files = useProjectStore((s) => s.files);
  const [status, setStatus] = useState<RuntimeStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);
  const lastFilesHashRef = useRef<string>('');

  // Create hash of files for comparison
  const filesHash = files.map(f => `${f.path}:${f.content?.length}`).join('|');

  const startPreview = useCallback(async () => {
    if (files.length === 0) return;
    
    setError(null);
    setOutput([]);
    setPreviewUrl(null);
    
    await runProject(files as ProjectFile[], {
      onStatusChange: (newStatus, message) => {
        setStatus(newStatus);
        if (message) setStatusMessage(message);
      },
      onServerReady: (url) => {
        setPreviewUrl(url);
      },
      onError: (err) => {
        setError(err.message);
        setStatus('error');
      },
      onOutput: (data) => {
        const clean = sanitizeTerminalOutput(String(data || ''));
        if (!clean.trim()) return;
        setOutput(prev => [...prev.slice(-140), clean]); // Keep recent lines
      }
    });
  }, [files]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  // Auto-start on file changes (debounced)
  useEffect(() => {
    if (filesHash === lastFilesHashRef.current) return;
    if (files.length === 0) return;
    
    lastFilesHashRef.current = filesHash;
    
    // Debounce restart
    const timer = setTimeout(() => {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        startPreview();
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [filesHash, files.length, startPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardownWebContainer();
    };
  }, []);

  const currentStatus = statusConfig[status];

  // Empty state
  if (files.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center bg-black/50 ${className}`}>
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Terminal className="h-8 w-8 text-white/40" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Project Files</h3>
          <p className="text-sm text-white/50 max-w-xs">
            Generate code to see a live preview powered by WebContainer
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-black/30 ${className}`}>
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 ${currentStatus.color}`}>
            {currentStatus.icon}
            <span className="text-xs font-semibold uppercase tracking-wider">
              {currentStatus.label}
            </span>
          </span>
          {statusMessage && status !== 'ready' && status !== 'idle' && (
            <span className="text-xs text-white/40">{statusMessage}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`p-2 rounded-lg border transition-all ${
              showTerminal 
                ? 'bg-white/10 border-white/20' 
                : 'bg-transparent border-transparent hover:bg-white/5'
            }`}
            title="Toggle terminal"
          >
            <Terminal className="h-4 w-4 text-white/60" />
          </button>
          <button
            onClick={startPreview}
            disabled={status === 'booting' || status === 'installing' || status === 'starting'}
            className="p-2 rounded-lg border border-transparent hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Restart preview"
          >
            <RefreshCw className={`h-4 w-4 text-white/60 ${status === 'starting' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading State */}
        {status !== 'ready' && status !== 'error' && status !== 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-white/10 border-t-blue-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse" />
              </div>
            </div>
            <p className="mt-6 text-sm font-medium text-white/80">{currentStatus.label}</p>
            {statusMessage && (
              <p className="mt-2 text-xs text-white/50">{statusMessage}</p>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 p-8">
            <XCircle className="h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Preview Error</h3>
            <p className="text-sm text-red-300/80 text-center max-w-md mb-4">{error}</p>
            <button
              onClick={startPreview}
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/15 transition-all flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* Preview iframe */}
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0 bg-white"
            title="WebContainer Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          status === 'idle' && (
            <div className="h-full flex flex-col items-center justify-center">
              <button
                onClick={startPreview}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Play className="h-5 w-5" />
                Start Preview
              </button>
              <p className="mt-4 text-xs text-white/40">
                Powered by WebContainer
              </p>
            </div>
          )
        )}
      </div>

      {/* Terminal Output */}
      {showTerminal && (
        <div className="h-40 border-t border-white/10 bg-black/60">
          <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Terminal</span>
            <button
              onClick={() => setOutput([])}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Clear
            </button>
          </div>
          <div
            ref={terminalRef}
            className="h-[calc(100%-32px)] overflow-auto p-3 font-mono text-xs text-white/70 leading-relaxed"
          >
            {output.length === 0 ? (
              <span className="text-white/30">Waiting for output...</span>
            ) : (
              output.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">{line}</div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WebContainerPreview;
