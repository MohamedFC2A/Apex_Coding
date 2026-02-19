'use client';

import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { AlertTriangle, MonitorPlay, ExternalLink, Copy, Check } from 'lucide-react';
import { PreviewRunnerPreview } from '../Preview/PreviewRunnerPreview';
import { usePreviewStore } from '@/stores/previewStore';
import { ErrorBoundary } from './ErrorBoundary';

const Window = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.3),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

  &:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.03);
    box-shadow:
      0 30px 60px rgba(0, 0, 0, 0.4),
      inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }
`;

const Titlebar = styled.div`
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(12px);
`;

const Dots = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const Dot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: ${(p) => p.$color};
  opacity: 0.8;
  box-shadow: 0 0 10px ${(p) => p.$color}66;
  transition: all 0.2s ease;

  &:hover {
    opacity: 1;
    transform: scale(1.1);
    box-shadow: 0 0 15px ${(p) => p.$color}99;
  }
`;

const Title = styled.div`
  flex: 1;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: center;
`;

const Right = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const StatusPill = styled.div<{ $tone: 'idle' | 'busy' | 'ready' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: ${(p) => {
    if (p.$tone === 'ready') return 'rgba(34, 197, 94, 0.15)';
    if (p.$tone === 'error') return 'rgba(239, 68, 68, 0.15)';
    if (p.$tone === 'busy') return 'rgba(34, 211, 238, 0.15)';
    return 'rgba(255, 255, 255, 0.05)';
  }};
  box-shadow: ${(p) => {
    if (p.$tone === 'ready') return '0 0 10px rgba(34, 197, 94, 0.2)';
    if (p.$tone === 'error') return '0 0 10px rgba(239, 68, 68, 0.2)';
    if (p.$tone === 'busy') return '0 0 10px rgba(34, 211, 238, 0.2)';
    return 'none';
  }};
`;

const StatusDot = styled.span<{ $tone: 'idle' | 'busy' | 'ready' | 'error' }>`
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: ${(p) => {
    if (p.$tone === 'ready') return '#22c55e';
    if (p.$tone === 'error') return '#ef4444';
    if (p.$tone === 'busy') return '#22d3ee';
    return 'rgba(255,255,255,0.4)';
  }};
  box-shadow: 0 0 8px ${(p) => {
    if (p.$tone === 'ready') return '#22c55e';
    if (p.$tone === 'error') return '#ef4444';
    if (p.$tone === 'busy') return '#22d3ee';
    return 'transparent';
  }};
`;

const Content = styled.div`
  position: relative;
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
  backdrop-filter: blur(8px);
`;

interface PreviewWindowProps {
  className?: string;
  enabled?: boolean;
  projectProfile?: 'frontend' | null;
}

export const PreviewWindow: React.FC<PreviewWindowProps> = ({ className, enabled = true }) => {
  const previewUrl = usePreviewStore((state) => state.previewUrl);
  const runtimeStatus = usePreviewStore((state) => state.runtimeStatus);
  const [copied, setCopied] = useState(false);

  const statusTone: 'idle' | 'busy' | 'ready' | 'error' = useMemo(() => {
    if (!enabled) return 'idle';
    if (runtimeStatus === 'error') return 'error';
    if (runtimeStatus === 'ready') return 'ready';
    if (runtimeStatus === 'idle') return 'idle';
    return 'busy';
  }, [enabled, runtimeStatus]);

  const statusLabel = useMemo(() => {
    if (!enabled) return 'Closed';
    if (statusTone === 'error') return 'Error';
    if (statusTone === 'busy') return 'Starting';
    if (statusTone === 'ready') return previewUrl ? 'Live · External' : 'Live · Pending';
    return 'Idle';
  }, [enabled, previewUrl, statusTone]);

  const handleReset = () => {
    if (typeof window === 'undefined') return;
    window.location.reload();
  };

  const handleOpenExternal = () => {
    if (!previewUrl || typeof window === 'undefined') return;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyExternal = async () => {
    if (!previewUrl || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore clipboard failures
    }
  };

  const fallback = (
    <div className="w-full h-full flex flex-col items-center justify-center px-6 text-center">
      <AlertTriangle size={48} className="text-red-400 mb-4" />
      <p className="text-lg font-semibold text-white mb-1">Preview failed to load</p>
      <p className="text-sm text-white/70 mb-4">Refresh the page to restart the preview.</p>
      <button
        type="button"
        className="px-4 py-2 rounded-md border border-white/20 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/20"
        onClick={handleReset}
      >
        Reload Preview
      </button>
    </div>
  );

  return (
    <Window className={className}>
      <Titlebar>
        <Dots>
          <Dot $color="#ff5f57" />
          <Dot $color="#febc2e" />
          <Dot $color="#28c840" />
        </Dots>
        <Title>Live Preview</Title>
        <Right>
          {enabled && previewUrl ? (
            <>
              <button
                type="button"
                onClick={handleCopyExternal}
                title="Copy external link"
                className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/20"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleOpenExternal}
                title="Open external link"
                className="inline-flex items-center gap-1 rounded-md border border-cyan-300/35 bg-cyan-300/15 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-300/25"
              >
                <ExternalLink size={12} />
                Open
              </button>
            </>
          ) : null}
          <StatusPill $tone={statusTone} title={statusLabel}>
            <StatusDot $tone={statusTone} />
            {statusLabel}
          </StatusPill>
        </Right>
      </Titlebar>
      <Content>
        <ErrorBoundary onReset={handleReset} fallback={fallback}>
          {enabled ? (
            <PreviewRunnerPreview />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/60 bg-black/30">
              <MonitorPlay size={48} className="mx-auto mb-4 opacity-60" />
              <div className="text-sm font-semibold">Live Preview is closed</div>
              <div className="text-xs mt-2 opacity-70">Generate some code to enable preview.</div>
            </div>
          )}
        </ErrorBoundary>
      </Content>
    </Window>
  );
};
