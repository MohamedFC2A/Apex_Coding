import { usePreviewStore } from '@/stores/previewStore';
import { useAIStore } from '@/stores/aiStore';

export interface PreviewStatus {
  isConfigured: boolean;
  isConnected: boolean;
  lastError: string | null;
  lastCheck: Date | null;
  sandboxId: string | null;
}

class PreviewMonitor {
  private static instance: PreviewMonitor;
  private checkInterval: NodeJS.Timeout | null = null;
  private status: PreviewStatus = {
    isConfigured: false,
    isConnected: false,
    lastError: null,
    lastCheck: null,
    sandboxId: null
  };
  private listeners: ((status: PreviewStatus) => void)[] = [];

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): PreviewMonitor {
    if (!PreviewMonitor.instance) {
      PreviewMonitor.instance = new PreviewMonitor();
    }
    return PreviewMonitor.instance;
  }

  private async checkPreviewConfig(): Promise<boolean> {
    try {
      const res = await fetch('/api/preview/config');
      if (!res.ok) {
        this.updateStatus({
          isConfigured: false,
          lastError: `Config check failed: ${res.status}`,
          lastCheck: new Date()
        });
        return false;
      }

      const data = await res.json();
      const isConfigured = data.configured && data.tokenValid;
      
      this.updateStatus({
        isConfigured,
        lastError: isConfigured ? null : 'CodeSandbox API key not configured',
        lastCheck: new Date()
      });

      return isConfigured;
    } catch (error) {
      this.updateStatus({
        isConfigured: false,
        lastError: `Failed to check config: ${error}`,
        lastCheck: new Date()
      });
      return false;
    }
  }

  private async testSandboxConnection(): Promise<boolean> {
    try {
      const res = await fetch('/api/preview/diagnostics');
      if (!res.ok) {
        this.updateStatus({
          isConnected: false,
          lastError: `Diagnostics failed: ${res.status}`,
          lastCheck: new Date()
        });
        return false;
      }

      const data = await res.json();
      const isConnected = data.sandboxConnection === 'ok';
      
      this.updateStatus({
        isConnected,
        lastError: isConnected ? null : 'CodeSandbox connection failed',
        lastCheck: new Date()
      });

      return isConnected;
    } catch (error) {
      this.updateStatus({
        isConnected: false,
        lastError: `Connection test failed: ${error}`,
        lastCheck: new Date()
      });
      return false;
    }
  }

  private updateStatus(updates: Partial<PreviewStatus>) {
    this.status = { ...this.status, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.status));
  }

  public startMonitoring(intervalMs: number = 30000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Initial check
    this.performCheck();

    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.performCheck();
    }, intervalMs);
  }

  public stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public async performCheck(): Promise<void> {
    const configOk = await this.checkPreviewConfig();
    if (configOk) {
      await this.testSandboxConnection();
    }
  }

  public getStatus(): PreviewStatus {
    return { ...this.status };
  }

  public subscribe(listener: (status: PreviewStatus) => void): () => void {
    this.listeners.push(listener);
    // Immediately notify with current status
    listener(this.status);

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public logPreviewEvent(event: string, details?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[PreviewMonitor] ${timestamp} - ${event}`, details || '');
    
    // You could send this to analytics or error tracking service
    // Example: Sentry.captureMessage(`Preview: ${event}`, { level: 'info', extra: details });
  }

  public reportError(error: string, context?: any) {
    this.updateStatus({
      lastError: error,
      lastCheck: new Date()
    });

    this.logPreviewEvent('ERROR', { error, context });
    
    // You could send this to error tracking
    // Example: Sentry.captureException(new Error(error), { extra: context });
  }

  public reportSandboxCreated(sandboxId: string) {
    this.updateStatus({
      sandboxId,
      isConnected: true,
      lastError: null
    });

    this.logPreviewEvent('SANDBOX_CREATED', { sandboxId });
  }

  public reportSandboxError(sandboxId: string, error: string) {
    this.updateStatus({
      sandboxId,
      isConnected: false,
      lastError: error
    });

    this.logPreviewEvent('SANDBOX_ERROR', { sandboxId, error });
  }
}

// Hook for React components
export const usePreviewMonitor = () => {
  const previewStore = usePreviewStore();
  const aiStore = useAIStore();

  const monitor = PreviewMonitor.getInstance();

  // Subscribe to preview store changes
  const unsubscribePreview = previewStore.subscribe((state) => {
    if (state.runtimeStatus === 'error' && state.runtimeMessage) {
      monitor.reportError(state.runtimeMessage, { status: state.runtimeStatus });
    } else if (state.runtimeStatus === 'ready' && state.previewUrl) {
      monitor.reportSandboxCreated(state.previewUrl);
    }
  });

  // Subscribe to AI store for generation events
  const unsubscribeAI = aiStore.subscribe((state) => {
    if (state.isGenerating) {
      monitor.logPreviewEvent('GENERATION_STARTED');
    }
  });

  // Cleanup on unmount
  return () => {
    unsubscribePreview();
    unsubscribeAI();
  };
};

// Export singleton instance
export const previewMonitor = PreviewMonitor.getInstance();

export default PreviewMonitor;