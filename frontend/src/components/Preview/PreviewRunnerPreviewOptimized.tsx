import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { Loader2, RefreshCw, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

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

export const PreviewRunnerPreviewOptimized = forwardRef<PreviewRunnerPreviewHandle, PreviewRunnerPreviewProps>(
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
  const [retryCount, setRetryCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const sessionIdRef = useRef<string | null>(null);
  const creatingSessionRef = useRef(false);
  const prevMapRef = useRef<FileMap>({});
  const patchTimerRef = useRef<number | null>(null);
  const idleHandleRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);

  const logStatus = useCallback((line: string) => {
    appendSystemConsoleContent(`${new Date().toLocaleTimeString([], { hour12: false })} [PREVIEW] ${line}\n`);
  }, [appendSystemConsoleContent]);

  const createSession = useCallback(async (initialFiles = files, isRetry = false) => {
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

    setIsLoading(true);
    setIsLongLoading(false);
    setRuntimeStatus('booting');
    setConnectionStatus('connecting');
    logStatus(isRetry ? `Retrying preview session... (attempt ${retryCount + 1})` : 'Starting preview session…');

    // Progressive timeout based on retry count
    const baseTimeout = 180000; // 3 minutes base (CodeSandbox needs time)
    const retryPenalty = retryCount * 30000; // Add 30s per retry
    const timeoutMs = Math.min(baseTimeout + retryPenalty, 300000); // Max 5 minutes

    // Show "taking longer than expected" after 15s for first try, 30s for retries
    const longLoadingDelay = isRetry ? 30000 : 15000;
    const longLoadingTimer = setTimeout(() => {
      if (creatingSessionRef.current) setIsLongLoading(true);
    }, longLoadingDelay);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Add retry attempt to request headers for debugging
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'X-Preview-Retry': String(retryCount)
      };

      const res = await fetch('/api/preview/sessions', {
        method: 'POST',
        headers,
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
      setConnectionStatus('connected');
      prevMapRef.current = toPreviewFileMap(initialFiles);
      setRetryCount(0); // Reset retry count on success
      
      const retryInfo = data?.retryCount ? ` (after ${data.retryCount} retries)` : '';
      logStatus(`Session ready: ${id}${retryInfo}`);
      
      // Notify AI about successful preview
      if (!isRetry) {
        appendThinkingContent(`[THOUGHT] Live preview initialized successfully. Session ID: ${id}\n`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      let msg = String(err?.message || err || 'Preview failed');
      
      if (err.name === 'AbortError') {
        const timeoutMinutes = Math.round(timeoutMs / 60000);
        msg = `Preview timeout after ${timeoutMinutes} minute${timeoutMinutes > 1 ? 's' : ''}. CodeSandbox is provisioning your environment. This is normal for first-time setup. Please try again.`;
      }
      
      setRuntimeStatus('error', msg);
      setConnectionStatus('error');
      appendThinkingContent(`[THOUGHT] Preview runner error: ${msg}\n`);
      logStatus(`ERROR: ${msg}`);
      setIframeUrl(null);
      setSessionId(null);
      sessionIdRef.current = null;
      
      // Auto-retry logic
      if (retryCount < 3 && err.name !== 'AbortError') {
        const retryDelay = Math.min(5000 * (retryCount + 1), 15000); // 5s, 10s, 15s
        logStatus(`Auto-retrying in ${retryDelay / 1000}s...`);
        retryTimeoutRef.current = window.setTimeout(() => {
          setRetryCount(prev => prev + 1);
          createSession(initialFiles, true);
        }, retryDelay);
      }
    } finally {
      clearTimeout(longLoadingTimer);
      setIsLoading(false);
      setIsLongLoading(false);
      creatingSessionRef.current = false;
    }
  }, [files, retryCount, setRuntimeStatus, setPreviewUrl, logStatus, appendThinkingContent]);

  const resetSessionInternal = useCallback(async () => {
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    const currentId = sessionIdRef.current;
    if (currentId) {
      try {
        await fetch(`/api/preview/sessions/${encodeURIComponent(currentId)}`, { method: 'DELETE' });
      } catch {}
    }
    setRetryCount(0);
    await createSession(files);
  }, [createSession, files]);

  const retryConnection = useCallback(() => {
    setRetryCount(0);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    createSession(files, true);
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
      setConnectionStatus('disconnected');
      return;
    }

    createSession(files);
    return () => {
      const currentId = sessionIdRef.current;
      if (currentId) {
        fetch(`/api/preview/sessions/${encodeURIComponent(currentId)}`, { method: 'DELETE' }).catch(() => {});
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [enabled, createSession, files, setRuntimeStatus, setPreviewUrl]);

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
          appendThinkingContent(`[THOUGHT] Preview sync error: ${msg}\n`);
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
    appendThinkingContent,
    appendSystemConsoleContent,
    logStatus,
    setPreviewUrl
  ]);

  useImperativeHandle(ref, () => ({
    resetSession: resetSessionInternal,
    retryConnection
  }));

  // Connection status indicator
  const StatusIndicator = () => {
    switch (connectionStatus) {
      case 'connecting':
        return <Wifi className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 backdrop-blur-sm z-10 p-4">
          <div className="flex items-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="ml-3 text-white font-medium">Initializing Preview…</span>
            <StatusIndicator />
          </div>
          {isLongLoading && (
            <div className="text-center max-w-md">
              <p className="text-yellow-400 text-sm animate-pulse mb-2">
                {retryCount > 0 ? `Retrying... (attempt ${retryCount})` : 'CodeSandbox is preparing your environment...'}
              </p>
              <p className="text-white/60 text-xs">
                {retryCount > 0 
                  ? 'The server is experiencing high load. Please wait...'
                  : 'First-time setup can take 2-3 minutes. Subsequent loads will be faster.'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {iframeUrl ? (
        <iframe
          src={iframeUrl}
          className="w-full h-full border-0"
          onLoad={() => {
            setRuntimeStatus('ready');
            setConnectionStatus('connected');
            logStatus('Preview ready.');
          }}
          onError={() => {
            setRuntimeStatus('error', 'preview iframe error');
            setConnectionStatus('error');
            logStatus('ERROR: Preview failed to render.');
            appendThinkingContent('[THOUGHT] Detected preview iframe error. Attempting to recover…\n');
            // Don't auto-reset on iframe error, let user decide
          }}
          allow="clipboard-read; clipboard-write; accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        />
      ) : (
        !isLoading && (
          <div className="w-full h-full flex items-center justify-center text-white/60 bg-black/30 text-center px-6">
            <div className="max-w-sm">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-400 opacity-50" />
              <p className="text-sm font-medium mb-1">Preview Not Available</p>
              <p className="text-xs opacity-70 mb-4">
                Generate some code to see the live preview
              </p>
              {runtimeStatus === 'error' && runtimeMessage && (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <div className="text-red-300 text-xs max-w-md">{runtimeMessage}</div>
                  <button
                    onClick={retryConnection}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {retryCount > 0 ? 'Retry Again' : 'Retry Preview'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
});

PreviewRunnerPreviewOptimized.displayName = 'PreviewRunnerPreviewOptimized';
