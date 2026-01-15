'use client';

import React, { useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Copy, ExternalLink, RefreshCw, AlertTriangle, MonitorPlay } from 'lucide-react';
import { PreviewRunnerPreview, type PreviewRunnerPreviewHandle } from '../Preview/PreviewRunnerPreview';
import { SimplePreview } from '../Preview/SimplePreview';
import { ErrorBoundary } from './ErrorBoundary';
import { usePreviewStore } from '@/stores/previewStore';
import { useProjectStore } from '@/stores/projectStore';

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

const IconButton = styled.button`
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(12px);

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
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
}


export const PreviewWindow: React.FC<PreviewWindowProps> = ({ className, enabled = true }) => {
  const previewRef = useRef<PreviewRunnerPreviewHandle>(null);
  const previewUrl = usePreviewStore((s) => s.previewUrl);
  const runtimeStatus = usePreviewStore((s) => s.runtimeStatus);
  const runtimeMessage = usePreviewStore((s) => s.runtimeMessage);
  const [copied, setCopied] = useState(false);

  const files = useProjectStore((s) => s.files);
  const hasPackageJson = useMemo(() => files.some(f => f.path === 'package.json' || f.name === 'package.json'), [files]);
  // Use legacy (CodeSandbox) preview ONLY if package.json exists. Otherwise use SimplePreview (Natural).
  const useLegacyPreview = hasPackageJson;

  const statusTone = useMemo<'idle' | 'busy' | 'ready' | 'error'>(() => {
    if (!enabled) return 'idle';
    if (!useLegacyPreview) return 'ready'; // Simple preview is always ready-ish
    if (runtimeStatus === 'error') return 'error';
    if (runtimeStatus === 'ready') return 'ready';
    if (runtimeStatus === 'idle') return 'idle';
    return 'busy';
  }, [enabled, runtimeStatus, useLegacyPreview]);

  const statusLabel = useMemo(() => {
    if (!enabled) return 'Closed';
    if (!useLegacyPreview) return 'Live';
    if (runtimeStatus === 'ready') return 'Ready';
    if (runtimeStatus === 'error') return 'Error';
    if (runtimeStatus === 'booting') return 'Booting';
    if (runtimeStatus === 'installing') return 'Installing';
    if (runtimeStatus === 'starting') return 'Starting';
    if (runtimeStatus === 'mounting') return 'Mounting';
    return 'Idle';
  }, [enabled, runtimeStatus, useLegacyPreview]);


  return (
    <Window className={className}>
      <Titlebar>
        <Dots>
          <Dot $color="#ff5f57" />
          <Dot $color="#febc2e" />
          <Dot $color="#28c840" />
        </Dots>
        <Title>Live Preview {useLegacyPreview ? '(Sandbox)' : '(Simple)'}</Title>
        <Right>
          <StatusPill $tone={statusTone} title={runtimeMessage || statusLabel}>
            <StatusDot $tone={statusTone} />
            {statusLabel}
          </StatusPill>


          <IconButton
            type="button"
            onClick={() => useLegacyPreview && previewRef.current?.resetSession()}
            aria-label="Restart preview"
            title="Restart preview"
            disabled={!enabled || !useLegacyPreview}
          >
            <RefreshCw size={16} />
          </IconButton>

          <IconButton
            type="button"
            onClick={async () => {
              if (!previewUrl) return;
              try {
                await navigator.clipboard.writeText(previewUrl);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 900);
              } catch {}
            }}
            aria-label="Copy preview URL"
            title={copied ? 'Copied!' : 'Copy preview URL'}
            disabled={!enabled || !previewUrl}
          >
            <Copy size={16} />
          </IconButton>

          <IconButton
            type="button"
            onClick={() => {
              if (!previewUrl) return;
              window.open(previewUrl, '_blank', 'noopener,noreferrer');
            }}
            aria-label="Open preview in new tab"
            title="Open preview in new tab"
            disabled={!enabled || !previewUrl}
          >
            <ExternalLink size={16} />
          </IconButton>
        </Right>
      </Titlebar>
      <Content>
        <ErrorBoundary 
          onReset={() => previewRef.current?.resetSession()} 
          fallback={
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="mb-4">
                <AlertTriangle size={48} className="text-red-400 mx-auto" />
              </div>
              <div className="mb-2 font-bold text-white">Preview Failed to Load</div>
              <div className="text-sm text-white/60 mb-2 max-w-md">
                Preview failed to load. Please check your configuration and try again.
              </div>
              <button
                onClick={() => previewRef.current?.resetSession()}
                className="mt-4 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors"
              >
                Try Again
              </button>
            </div>
          }
        >
          {enabled ? (
            useLegacyPreview ? (
              <PreviewRunnerPreview ref={previewRef} enabled />
            ) : (
              <SimplePreview />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/60 bg-black/30">
              <div className="text-center">
                <MonitorPlay size={48} className="mx-auto mb-4 opacity-50" />
                <div className="text-sm">Live Preview is closed</div>
                <div className="text-xs mt-2 opacity-70">Generate some code to enable preview</div>
              </div>
            </div>
          )}
        </ErrorBoundary>
      </Content>
    </Window>
  );
};
