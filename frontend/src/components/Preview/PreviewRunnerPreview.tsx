import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { Loader2, RefreshCw, AlertTriangle, Settings, ExternalLink, Info, AlertCircle } from 'lucide-react';

import { useAIStore } from '@/stores/aiStore';
import { usePreviewStore } from '@/stores/previewStore';
import { useProjectStore } from '@/stores/projectStore';
import { diffPreviewFileMaps, toPreviewFileMap, type FileMap } from '@/utils/previewFilesUtils';
import { apiUrl } from '@/services/apiBase';
import { normalizePreviewUrl } from '@/utils/previewUrl';

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
  const previewApi = useCallback((path: string) => apiUrl(path.startsWith('/preview') ? path : `/preview${path}`), []);
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
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const logStatus = useCallback((line: string) => {
    appendSystemConsoleContent(`${new Date().toLocaleTimeString([], { hour12: false })} [PREVIEW] ${line}\n`);
  }, [appendSystemConsoleContent]);

  const checkPreviewConfig = useCallback(async () => {
    try {
      const res = await fetch(previewApi('/config'));
      if (!res.ok) throw new Error(`Config check failed: ${res.status}`);
      const data = await res.json();

      if (!data.configured) {
        const errorMsg = `⚙️ Preview Configuration Required\n\nCodeSandbox API key is not configured.\n\n📋 To fix this:\n1. Visit: https://codesandbox.io/dashboard/settings/api-keys\n2. Create a new API key\n3. Add to .env: CSB_API_KEY=csb_v1_YOUR_KEY_HERE\n4. Restart the development server\n\nFor frontend-only projects, consider using WebContainer instead.`;
        setConfigError(errorMsg);
        setRuntimeStatus('error', 'Preview configuration required');
        logStatus('Configuration error: CSB_API_KEY not set');
        return false;
      }

      if (data.missing && data.missing.length > 0) {
        const errorMsg = `Configuration incomplete: ${data.missing.join(', ')}\n\nPlease check your environment variables and restart the server.`;
        setConfigError(errorMsg);
        setRuntimeStatus('error', 'Preview configuration incomplete');
        return false;
      }

      setConfigError(null);
      return true;
    } catch (err: any) {
      const message = String(err?.message || err || 'Failed to check preview configuration');
      const errorMsg = `Preview Error: ${message}\n\nMake sure your backend server is running on the configured port.`;
      setConfigError(errorMsg);
      setRuntimeStatus('error', 'Preview configuration error');
      logStatus(`Configuration check failed: ${message}`);
      return false;
    }
  }, [setRuntimeStatus, previewApi, logStatus]);

  const createSession = useCallback(async (initialFiles = filesRef.current) => {
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

    const timeoutMs = 300000; // 5 minutes for cold start
    const longLoadingTimer = setTimeout(() => {
      if (creatingSessionRef.current) setIsLongLoading(true);
    }, 15000); // Show message after 15 seconds

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(previewApi('/sessions'), {
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
        } catch {}

        // Handle specific error codes
        if (res.status === 502 || res.status === 503) {
          message = '🌐 Preview server is temporarily unavailable.\n\nPlease try again in a moment.';
        } else if (res.status === 429) {
          message = '⏱️ Too many preview requests.\n\nPlease wait a moment before trying again.';
        } else if (res.status === 401 || res.status === 400) {
          message = `🔐 Configuration error: ${message}\n\nPlease verify your CodeSandbox API key is valid.`;
        }

        throw new Error(message);
      }

      const data: any = await res.json();
      const id = typeof data?.id === 'string' ? data.id : null;
      const normalizedUrl = normalizePreviewUrl(typeof data?.url === 'string' ? data.url : null);

      if (!id || !normalizedUrl) throw new Error('Invalid preview runner response');

      // Success!
      setSessionId(id);
      sessionIdRef.current = id;
      setIframeUrl(normalizedUrl);
      setPreviewUrl(normalizedUrl);
      setRuntimeStatus('starting');
      prevMapRef.current = toPreviewFileMap(initialFiles);
      logStatus(`✅ Session ready: ${id}`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      let msg = String(err?.message || err || 'Preview failed');

      if (err.name === 'AbortError') {
        msg = '⏰ Preview timeout after 5 minutes.\n\nCodeSandbox environment is taking too long to boot. This sometimes happens on first load.\n\nPlease try again.';
      }

      setRuntimeStatus('error', msg);
      logStatus(`❌ ERROR: ${msg}`);
      setIframeUrl(null);
      setSessionId(null);
      sessionIdRef.current = null;
    } finally {
      clearTimeout(longLoadingTimer);
      setIsLoading(false);
      setIsLongLoading(false);
      creatingSessionRef.current = false;
    }
  }, [setRuntimeStatus, setPreviewUrl, logStatus, checkPreviewConfig, previewApi]);

  const resetSessionInternal = useCallback(async () => {
    const currentId = sessionIdRef.current;
    if (currentId) {
      try {
        await fetch(previewApi(`/sessions/${encodeURIComponent(currentId)}`), { method: 'DELETE' });
      } catch {}
    }
    await createSession(filesRef.current);
  }, [createSession, previewApi]);

  const retryConnection = useCallback(() => {
    createSession(filesRef.current);
  }, [createSession]);

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
        createSession(filesRef.current);
      }
    };

    initPreview();

    return () => {
      const currentId = sessionIdRef.current;
      if (currentId) {
        fetch(previewApi(`/sessions/${encodeURIComponent(currentId)}`), { method: 'DELETE' }).catch(() => {});
      }
    };
  }, [enabled, createSession, setRuntimeStatus, setPreviewUrl, checkPreviewConfig, previewApi]);

  // Update preview when files change
  useEffect(() => {
    if (!enabled) return;
    if (sessionIdRef.current) return;
    if (filesRef.current.length === 0) return;
    if (isGenerating || isPlanning) return;

    const delay = setTimeout(() => {
      createSession(filesRef.current);
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
        logStatus(`Syncing ${Object.keys(create).length + destroy.length} file(s)…`);

        try {
          const res = await fetch(previewApi(`/sessions/${encodeURIComponent(sessionId)}`), {
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
            const nextUrl = normalizePreviewUrl(typeof parsed?.url === 'string' ? parsed.url : null);
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
          logStatus('✅ Files synced');
        } catch (err: any) {
          const msg = String(err?.message || err || 'Sync failed');
          setRuntimeStatus('error', msg);
          logStatus(`❌ Sync error: ${msg}`);
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
    }, 800); // Faster sync

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
    setPreviewUrl,
    previewApi
  ]);

  useImperativeHandle(ref, () => ({
    resetSession: resetSessionInternal,
    retryConnection,
    checkConfig: checkPreviewConfig
  }));

  const renderLoadingState = () => {
    if (runtimeStatus === 'configuring') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black/80 backdrop-blur-sm z-10 p-4">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-8 h-8 animate-spin text-blue-400" />
            <span className="text-white font-semibold text-lg">Checking Configuration…</span>
          </div>
          <p className="text-white/70 text-sm max-w-md text-center">
            Verifying CodeSandbox API setup
          </p>
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black/80 backdrop-blur-sm z-10 p-4">
        <div className="flex items-center gap-3 mb-6">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-white font-semibold text-lg">
            {runtimeStatus === 'booting' ? '🚀 Booting Preview…' :
             runtimeStatus === 'starting' ? '⚡ Starting Server…' :
             '⏳ Initializing…'}
          </span>
        </div>
        {isLongLoading && (
          <div className="text-center max-w-md animate-fade-in">
            <p className="text-yellow-400 text-sm font-medium mb-2">
              This is taking longer than expected
            </p>
            <p className="text-white/60 text-xs leading-relaxed">
              First-time setup can take 1-3 minutes while CodeSandbox prepares your environment.
              Subsequent previews will load much faster.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderErrorState = () => {
    const isConfigError = configError ||
      (runtimeMessage && (
        runtimeMessage.includes('configuration') ||
        runtimeMessage.includes('CSB_API_KEY') ||
        runtimeMessage.includes('API key') ||
        runtimeMessage.includes('unauthorized')
      ));

    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black/40 to-black/60 text-white p-6">
        <div className="max-w-2xl w-full">
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-red-500/10 rounded-full mb-4">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Preview Not Available</h3>
            <p className="text-white/60 text-sm text-center">
              {isConfigError ? 'Setup required to enable live preview' :
               'Preview environment encountered an issue'}
            </p>
          </div>

          {(runtimeMessage || configError) && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-800/50 rounded-lg backdrop-blur-sm">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-semibold text-sm mb-2">Error Details</p>
                  <div className="text-red-200/80 text-xs font-mono whitespace-pre-wrap break-words">
                    {configError || runtimeMessage}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <button
              onClick={retryConnection}
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/30"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Preview
            </button>

            {isConfigError && (
              <a
                href="https://codesandbox.io/dashboard/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/30"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Get API Key
              </a>
            )}
          </div>

          {isConfigError && (
            <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-lg">
              <p className="text-amber-300 font-semibold text-sm mb-3">
                How to set up CodeSandbox Preview:
              </p>
              <ol className="space-y-2 text-amber-200/80 text-sm">
                <li className="flex gap-3">
                  <span className="font-bold text-amber-400 flex-shrink-0">1.</span>
                  <span>Visit <a href="https://codesandbox.io/dashboard/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline">CodeSandbox API Keys</a> and create a new API key</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-amber-400 flex-shrink-0">2.</span>
                  <span>Add to your <code className="bg-black/30 px-2 py-1 rounded text-amber-100">.env</code> file: <code className="bg-black/30 px-2 py-1 rounded text-amber-100">CSB_API_KEY=csb_v1_your_key_here</code></span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-amber-400 flex-shrink-0">3.</span>
                  <span>Restart your development server</span>
                </li>
              </ol>
              <p className="text-amber-300/70 text-xs mt-4">
                💡 For frontend-only projects without a backend, you can use WebContainer preview instead, which does not require an API key.
              </p>
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
            logStatus('✨ Preview ready');
          }}
          onError={() => {
            setRuntimeStatus('error', 'Preview failed to render');
            logStatus('❌ Preview failed to render');
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
