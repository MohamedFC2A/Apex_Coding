import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { Loader2, RefreshCw, AlertTriangle, Settings, ExternalLink, Info } from 'lucide-react';

import { useAIStore } from '@/stores/aiStore';
import { usePreviewStore } from '@/stores/previewStore';
import { useProjectStore } from '@/stores/projectStore';
import { diffPreviewFileMaps, toPreviewFileMap, type FileMap } from '@/utils/previewFilesUtils';

interface PreviewRunnerPreviewProps {
  className?: string;
  enabled?: boolean;
}

export type PreviewRunnerPreviewHandle = {
  resetSession: () => void;
  retryConnection: () => void;
};

export const PreviewRunnerPreview = forwardRef<PreviewRunnerPreviewHandle, PreviewRunnerPreviewProps>(
  ({ className, enabled = true }, ref) => {
  const files = useProjectStore((s) => s.files);
  const setRuntimeStatus = usePreviewStore((s) => s.setRuntimeStatus);
  const setPreviewUrl = usePreviewStore((s) => s.setPreviewUrl);
  const runtimeStatus = usePreviewStore((s) => s.runtimeStatus);
  const runtimeMessage = usePreviewStore((s) => s.runtimeMessage);
  const appendSystemConsoleContent = useAIStore((s) => s.appendSystemConsoleContent);
  const appendThinkingContent = useAIStore((s) => s.appendThinkingContent);
  const isGenerating = useAIStore((s) => s.isGenerating);
  const isPlanning = useAIStore((s) => s.isPlanning);

  const [isLoading, setIsLoading] = useState(true);
  const [isLongLoading, setIsLongLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const creatingSessionRef = useRef(false);
  const prevMapRef = useRef<FileMap>({});
  const patchTimerRef = useRef<number | null>(null);
  const idleHandleRef = useRef<number | null>(null);

  const logStatus = useCallback((line: string) => {
    appendSystemConsoleContent(`${new Date().toLocaleTimeString([], { hour12: false })} [PREVIEW] ${line}\n`);
  }, [appendSystemConsoleContent]);

  const checkPreviewConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/preview/config');
      if (!res.ok) throw new Error(`Config check failed: ${res.status}`);
      const data = await res.json();
      
      if (!data.configured) {
        setConfigError('CodeSandbox API key is not configured');
        setRuntimeStatus('error', 'Preview configuration required');
        return false;
      }
      
      if (data.missing && data.missing.length > 0) {
        setConfigError(`Missing configuration: ${data.missing.join(', ')}`);
        setRuntimeStatus('error', 'Preview configuration incomplete');
        return false;
      }
      
      setConfigError(null);
      return true;
    } catch (err: any) {
      const message = String(err?.message || err || 'Failed to check preview configuration');
      setConfigError(message);
      setRuntimeStatus('error', 'Preview configuration error');
      return false;
    }
  }, [setRuntimeStatus]);

  const createSession = useCallback(async (initialFiles = files) => {
    if (creatingSessionRef.current) return;
    creatingSessionRef.current = true;
    
    if (!Array.isArray(initialFiles) || initialFiles.length === 0) {
      setRuntimeStatus('idle');
      setPreviewUrl(null);
      setIframeUrl(null);
      setSessionId(null);
      sessionIdRef.current = null;
      setIsLoading(false);
      setIsLongLoading(false);
      creatingSessionRef.current = false;
      return;
    }

    // Check configuration first
    setRuntimeStatus('configuring');
    logStatus('Checking preview configuration…');
    
    const configOk = await checkPreviewConfig();
    if (!configOk) {
      setIsLoading(false);
      setIsLongLoading(false);
      creatingSessionRef.current = false;
      return;
    }

    setIsLoading(true);
    setIsLongLoading(false);
    setRuntimeStatus('booting');
    logStatus('Starting preview session…');

    const timeoutMs = 300000; // Increased to 5 minutes to match backend cold start
    const longLoadingTimer = setTimeout(() => {
      if (creatingSessionRef.current) setIsLongLoading(true);
    }, 15000); // Show long loading message after 15 seconds

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('/api/preview/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: initialFiles }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = text || `Failed to start preview (${res.status})`;
        
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) message = String(parsed.error);
          if (Array.isArray(parsed?.missing) && parsed.missing.length > 0) {
            message = `${message} (missing: ${parsed.missing.join(', ')})`;
          }
          if (parsed?.details) message = `${message} - ${String(parsed.details)}`;
          if (parsed?.hint) message = `${message}\n${String(parsed.hint)}`;
          if (parsed?.requestId) message = `${message}\n(requestId: ${String(parsed.requestId)})`;
        } catch {}

        // Handle specific error codes
        if (res.status === 502 || res.status === 503) {
          message = 'Preview server is temporarily unavailable. Please try again in a moment.';
        } else if (res.status === 429) {
          message = 'Too many preview requests. Please wait a moment before trying again.';
        } else if (res.status === 401 || res.status === 400) {
          message = `Configuration error: ${message}. Please check your CodeSandbox API key.`;
        }

        throw new Error(message);
      }

      const data: any = await res.json();
      const id = typeof data?.id === 'string' ? data.id : null;
      const url = typeof data?.url === 'string' ? data.url : null;
      
      if (!id || !url) throw new Error('Invalid preview runner response');

      // Success!
      setSessionId(id);
      sessionIdRef.current = id;
      setIframeUrl(url);
      setPreviewUrl(url);
      setRuntimeStatus('starting');
      prevMapRef.current = toPreviewFileMap(initialFiles);
      logStatus(`Session ready: ${id}`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      let msg = String(err?.message || err || 'Preview failed');
      
      if (err.name === 'AbortError') {
        msg = 'Preview timeout. CodeSandbox is taking longer than expected (over 5 minutes). Please try again.';
      }
      
      setRuntimeStatus('error', msg);
      logStatus(`ERROR: ${msg}`);
      setIframeUrl(null);
      setSessionId(null);
      sessionIdRef.current = null;
    } finally {
      clearTimeout(longLoadingTimer);
      setIsLoading(false);
      setIsLongLoading(false);
      creatingSessionRef.current = false;
    }
  }, [files, setRuntimeStatus, setPreviewUrl, logStatus, checkPreviewConfig]);

  const resetSessionInternal = useCallback(async () => {
    const currentId = sessionIdRef.current;
    if (currentId) {
      try {
        await fetch(`/api/preview/sessions/${encodeURIComponent(currentId)}`, { method: 'DELETE' });
      } catch {}
    }
    await createSession(files);
  }, [createSession, files]);

  const retryConnection = useCallback(() => {
    createSession(files);
  }, [createSession, files]);

  // Initialize preview when enabled
  useEffect(() => {
    if (!enabled) {
      setRuntimeStatus('idle');
      setPreviewUrl(null);
      setIframeUrl(null);
      setSessionId(null);
      sessionIdRef.current = null;
      setIsLoading(false);
      return;
    }

    // Check configuration first before creating session
    const initPreview = async () => {
      setRuntimeStatus('configuring');
      const configOk = await checkPreviewConfig();
      if (configOk) {
        createSession(files);
      }
    };

    initPreview();
    
    return () => {
      const currentId = sessionIdRef.current;
      if (currentId) {
        fetch(`/api/preview/sessions/${encodeURIComponent(currentId)}`, { method: 'DELETE' }).catch(() => {});
      }
    };
  }, [enabled, createSession, files, setRuntimeStatus, setPreviewUrl, checkPreviewConfig]);

  // Update preview when files change
  useEffect(() => {
    if (!enabled) return;
    if (sessionIdRef.current) return;
    if (!Array.isArray(files) || files.length === 0) return;
    if (isGenerating || isPlanning) return;
    
    const delay = setTimeout(() => {
      createSession(files);
    }, 500); // Debounce file changes
    
    return () => clearTimeout(delay);
  }, [enabled, files.length, isGenerating, isPlanning, createSession]);

  // Sync file changes to preview
  useEffect(() => {
    if (!sessionId) return;
    if (!enabled) return;
    if (isGenerating || isPlanning) return;

    if (patchTimerRef.current) window.clearTimeout(patchTimerRef.current);
    if (idleHandleRef.current) {
      const h = idleHandleRef.current;
      idleHandleRef.current = null;
      (window as any).cancelIdleCallback?.(h);
    }

    patchTimerRef.current = window.setTimeout(async () => {
      const run = async () => {
        const nextMap = toPreviewFileMap(files);
        const { create, destroy } = diffPreviewFileMaps(prevMapRef.current, nextMap);
        if (Object.keys(create).length === 0 && destroy.length === 0) return;

        setRuntimeStatus('starting');
        logStatus(`Syncing ${Object.keys(create).length} change(s), removing ${destroy.length} file(s)…`);

        try {
          const res = await fetch(`/api/preview/sessions/${encodeURIComponent(sessionId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ create, destroy, files })
          });
          
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(text || `Sync failed (${res.status})`);
          }

          const text = await res.text().catch(() => '');
          try {
            const parsed = JSON.parse(text);
            const nextId = typeof parsed?.id === 'string' ? parsed.id : null;
            const nextUrl = typeof parsed?.url === 'string' ? parsed.url : null;
            if (nextId && nextId !== sessionIdRef.current) {
              setSessionId(nextId);
              sessionIdRef.current = nextId;
            }
            if (nextUrl) {
              setIframeUrl(nextUrl);
              setPreviewUrl(nextUrl);
            }
          } catch {}

          prevMapRef.current = nextMap;
          logStatus('Sync complete');
        } catch (err: any) {
          const msg = String(err?.message || err || 'Sync failed');
          setRuntimeStatus('error', msg);
          logStatus(`ERROR: ${msg}`);
        }
      };

      const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: any) => number);
      if (typeof ric === 'function') {
        idleHandleRef.current = ric(() => {
          idleHandleRef.current = null;
          void run();
        }, { timeout: 1000 });
        return;
      }

      void run();
    }, 800); // Faster sync (was 1200ms)

    return () => {
      if (patchTimerRef.current) window.clearTimeout(patchTimerRef.current);
      if (idleHandleRef.current) {
        const h = idleHandleRef.current;
        idleHandleRef.current = null;
        (window as any).cancelIdleCallback?.(h);
      }
    };
  }, [
    files,
    sessionId,
    enabled,
    isGenerating,
    isPlanning,
    setRuntimeStatus,
    appendSystemConsoleContent,
    logStatus,
    setPreviewUrl
  ]);

  useImperativeHandle(ref, () => ({
    resetSession: resetSessionInternal,
    retryConnection,
    checkConfig: checkPreviewConfig
  }));

  const renderLoadingState = () => {
    if (runtimeStatus === 'configuring') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 backdrop-blur-sm z-10 p-4">
          <div className="flex items-center mb-4">
            <Settings className="w-8 h-8 animate-pulse text-blue-400" />
            <span className="ml-3 text-white font-medium">Checking Preview Configuration…</span>
          </div>
          <p className="text-white/60 text-sm max-w-md text-center">
            Verifying CodeSandbox API configuration...
          </p>
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 backdrop-blur-sm z-10 p-4">
        <div className="flex items-center mb-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="ml-3 text-white font-medium">
            {runtimeStatus === 'booting' ? 'Booting Preview Environment…' : 
             runtimeStatus === 'starting' ? 'Starting Preview Server…' : 
             'Initializing Preview…'}
          </span>
        </div>
        {isLongLoading && (
          <div className="text-center max-w-md">
            <p className="text-yellow-400 text-sm animate-pulse mb-2">
              CodeSandbox is preparing your environment...
            </p>
            <p className="text-white/60 text-xs">
              First-time setup can take 3-5 minutes. Subsequent loads will be faster.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderErrorState = () => {
    const isConfigError = configError || 
      (runtimeMessage && (runtimeMessage.includes('configuration') || 
                         runtimeMessage.includes('CSB_API_KEY') || 
                         runtimeMessage.includes('CodeSandbox')));
    
    return (
      <div className="w-full h-full flex items-center justify-center text-white/60 bg-black/30 text-center px-6">
        <div className="max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-400 opacity-50" />
          <p className="text-sm font-medium mb-1">Preview Not Available</p>
          <p className="text-xs opacity-70 mb-4">
            {isConfigError ? 'Preview configuration issue detected' : 'Generate some code to see the live preview'}
          </p>
          
          {(runtimeMessage || configError) && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="text-red-300 text-xs max-w-md text-center bg-red-900/20 p-3 rounded border border-red-800/30">
                <div className="flex items-start mb-2">
                  <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="font-medium">Error Details:</span>
                </div>
                <div className="text-left font-mono text-xs whitespace-pre-wrap">
                  {configError || runtimeMessage}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={retryConnection}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Preview
                </button>
                
                {isConfigError && (
                  <button
                    onClick={() => setShowDiagnostics(true)}
                    className="flex items-center justify-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Check Configuration
                  </button>
                )}
                
                {isConfigError && (
                  <a
                    href="https://codesandbox.io/dashboard/settings/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Get API Key
                  </a>
                )}
              </div>
              
              {isConfigError && (
                <div className="mt-3 text-xs text-white/50 max-w-md">
                  <p className="mb-1">To fix this issue:</p>
                  <ol className="text-left list-decimal pl-4 space-y-1">
                    <li>Get a free API key from CodeSandbox</li>
                    <li>Add <code className="bg-black/30 px-1 rounded">CSB_API_KEY=csb_v1_...</code> to your .env file</li>
                    <li>Restart the server</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      {isLoading && renderLoadingState()}

      {iframeUrl ? (
        <iframe
          src={iframeUrl}
          className="w-full h-full border-0"
          onLoad={() => {
            setRuntimeStatus('ready');
            logStatus('Preview ready.');
          }}
          onError={() => {
            setRuntimeStatus('error', 'Preview failed to render');
            logStatus('ERROR: Preview failed to render.');
          }}
          allow="clipboard-read; clipboard-write; accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        />
      ) : (
        !isLoading && renderErrorState()
      )}
    </div>
  );
});

PreviewRunnerPreview.displayName = 'PreviewRunnerPreview';
