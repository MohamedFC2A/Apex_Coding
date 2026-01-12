import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

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

  const sessionIdRef = useRef<string | null>(null);
  const creatingSessionRef = useRef(false);
  const prevMapRef = useRef<FileMap>({});
  const patchTimerRef = useRef<number | null>(null);
  const idleHandleRef = useRef<number | null>(null);

  const logStatus = (line: string) => {
    appendSystemConsoleContent(`${new Date().toLocaleTimeString([], { hour12: false })} [PREVIEW] ${line}\n`);
  };

  const createSession = async (initialFiles = files) => {
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
    logStatus('Starting preview session…');

    // Show "taking longer than expected" after 5s
    const longLoadingTimer = setTimeout(() => {
        if (creatingSessionRef.current) setIsLongLoading(true);
    }, 5000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

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
          throw new Error(message);
        }

      const data: any = await res.json();
      const id = typeof data?.id === 'string' ? data.id : null;
      const url = typeof data?.url === 'string' ? data.url : null;
      if (!id || !url) throw new Error('Invalid preview runner response');

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
        msg = 'Preview timeout: Server took too long to respond. Please check your connection or API Key.';
      }
      setRuntimeStatus('error', msg);
      appendThinkingContent(`[THOUGHT] Preview runner error: ${msg}\n`);
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
  };

  const resetSessionInternal = async () => {
    const currentId = sessionIdRef.current;
    if (currentId) {
      try {
        await fetch(`/api/preview/sessions/${encodeURIComponent(currentId)}`, { method: 'DELETE' });
      } catch {}
    }
    await createSession(files);
  };

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

    void createSession(files);
    return () => {
      const currentId = sessionIdRef.current;
      if (currentId) {
        fetch(`/api/preview/sessions/${encodeURIComponent(currentId)}`, { method: 'DELETE' }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // If the user opened preview before files existed (common), create a session once files arrive.
  useEffect(() => {
    if (!enabled) return;
    if (sessionIdRef.current) return;
    if (!Array.isArray(files) || files.length === 0) return;
    if (isGenerating || isPlanning) return;
    void createSession(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, files.length, isGenerating, isPlanning]);

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
        }, { timeout: 1500 });
        return;
      }

      void run();
    }, 1200);

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
    appendSystemConsoleContent
  ]);

  useImperativeHandle(ref, () => ({
    resetSession: () => {
      void resetSessionInternal();
    }
  }));

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 p-4">
          <div className="flex items-center mb-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-white font-medium">Initializing Preview…</span>
          </div>
          {isLongLoading && (
            <p className="text-yellow-400 text-sm mt-2 animate-pulse text-center max-w-md">
              Connecting to preview environment is taking longer than expected. Please wait...
            </p>
          )}
        </div>
      )}

      {iframeUrl ? (
        <iframe
          src={iframeUrl}
          className="w-full h-full border-0"
          onLoad={() => {
            setRuntimeStatus('ready');
            logStatus('Preview ready.');
          }}
          onError={() => {
            setRuntimeStatus('error', 'preview iframe error');
            logStatus('ERROR: Preview failed to render.');
            appendThinkingContent('[THOUGHT] Detected preview iframe error. Resetting…\n');
            void resetSessionInternal();
          }}
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/60 bg-black/30 text-center px-6">
          {(() => {
            if (!Array.isArray(files) || files.length === 0) return 'Generate a project first, then open Live Preview.';
            if (runtimeStatus === 'error' && runtimeMessage) {
              return (
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                  <div className="text-red-300 max-w-md">{runtimeMessage}</div>
                  <button
                    onClick={() => void resetSessionInternal()}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Preview
                  </button>
                </div>
              );
            }
            return 'Preview is not available. Check preview configuration.';
          })()}
        </div>
      )}
    </div>
  );
});

PreviewRunnerPreview.displayName = 'PreviewRunnerPreview';
