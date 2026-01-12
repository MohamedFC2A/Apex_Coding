'use client';

import React, { useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Copy, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { PreviewRunnerPreview, PreviewRunnerPreviewHandle } from '../Preview/PreviewRunnerPreview';
import { ErrorBoundary } from './ErrorBoundary';
import { usePreviewStore } from '@/stores/previewStore';
import { Content as PopoverContent, Description, Heading, Popover, Trigger } from './InstructionPopover';

const Window = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(24px);
  box-shadow:
    0 28px 80px rgba(0, 0, 0, 0.60),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  overflow: hidden;
  transition: all 300ms ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.18);
    box-shadow:
      0 32px 90px rgba(0, 0, 0, 0.65),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }
`;

const Titlebar = styled.div`
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(13, 17, 23, 0.40);
  backdrop-filter: blur(20px);
`;

const Dots = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const Dot = styled.span<{ $color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: ${(p) => p.$color};
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35) inset, 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 200ms ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const Title = styled.div`
  flex: 1;
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.10em;
  text-transform: uppercase;
`;

const Right = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`;

const StatusPill = styled.div<{ $tone: 'idle' | 'busy' | 'ready' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: ${(p) => {
    if (p.$tone === 'ready') return 'rgba(34, 197, 94, 0.14)';
    if (p.$tone === 'error') return 'rgba(239, 68, 68, 0.14)';
    if (p.$tone === 'busy') return 'rgba(34, 211, 238, 0.14)';
    return 'rgba(255, 255, 255, 0.06)';
  }};
`;

const StatusDot = styled.span<{ $tone: 'idle' | 'busy' | 'ready' | 'error' }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) => {
    if (p.$tone === 'ready') return '#22c55e';
    if (p.$tone === 'error') return '#ef4444';
    if (p.$tone === 'busy') return '#22d3ee';
    return 'rgba(255,255,255,0.55)';
  }};
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.22);
`;

const IconButton = styled.button`
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;

  &:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.92);
  }

  &:active {
    transform: translateY(0px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.16);
    border-color: rgba(34, 211, 238, 0.35);
  }
`;

const Content = styled.div`
  position: relative;
  flex: 1;
  background: #0b0f14;
`;

interface PreviewWindowProps {
  className?: string;
  enabled?: boolean;
}

type PreviewConfig = {
  provider?: string;
  configured?: boolean;
  baseUrl?: string | null;
  tokenPresent?: boolean;
  tokenLast4?: string | null;
  missing?: string[];
};

export const PreviewWindow: React.FC<PreviewWindowProps> = ({ className, enabled = true }) => {
  const previewRef = useRef<PreviewRunnerPreviewHandle>(null);
  const previewUrl = usePreviewStore((s) => s.previewUrl);
  const runtimeStatus = usePreviewStore((s) => s.runtimeStatus);
  const runtimeMessage = usePreviewStore((s) => s.runtimeMessage);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<PreviewConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const statusTone = useMemo<'idle' | 'busy' | 'ready' | 'error'>(() => {
    if (!enabled) return 'idle';
    if (runtimeStatus === 'error') return 'error';
    if (runtimeStatus === 'ready') return 'ready';
    if (runtimeStatus === 'idle') return 'idle';
    return 'busy';
  }, [enabled, runtimeStatus]);

  const statusLabel = useMemo(() => {
    if (!enabled) return 'Closed';
    if (runtimeStatus === 'ready') return 'Ready';
    if (runtimeStatus === 'error') return 'Error';
    if (runtimeStatus === 'booting') return 'Booting';
    if (runtimeStatus === 'installing') return 'Installing';
    if (runtimeStatus === 'starting') return 'Starting';
    if (runtimeStatus === 'mounting') return 'Mounting';
    return 'Idle';
  }, [enabled, runtimeStatus]);

  const loadConfig = async () => {
    if (configLoading) return;
    setConfigLoading(true);
    setConfigError(null);

    try {
      const res = await fetch('/api/preview/config', { cache: 'no-store' });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(text || `Config failed (${res.status})`);
      const parsed = JSON.parse(text);
      setConfig(parsed && typeof parsed === 'object' ? (parsed as PreviewConfig) : null);
    } catch (err: any) {
      setConfigError(String(err?.message || err || 'Failed to load preview config'));
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  };

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
          <StatusPill $tone={statusTone} title={runtimeMessage || statusLabel}>
            <StatusDot $tone={statusTone} />
            {statusLabel}
          </StatusPill>

          <Popover openDelayMs={80} closeDelayMs={120}>
            <Trigger>
              <IconButton
                type="button"
                onClick={() => void loadConfig()}
                aria-label="Preview configuration"
                title="Preview configuration"
              >
                <Info size={16} />
              </IconButton>
            </Trigger>
            <PopoverContent>
              <Heading>Preview Configuration</Heading>
              <Description>
                {configLoading
                  ? 'Loading…'
                  : configError
                    ? configError
                    : config
                      ? [
                          `Provider: ${String(config.provider || '(unknown)')}`,
                          `Configured: ${Boolean(config.configured)}`,
                          `Base URL: ${String(config.baseUrl || '(none)')}`,
                          `Token present: ${Boolean(config.tokenPresent)}${config.tokenLast4 ? ` (…${String(config.tokenLast4)})` : ''}`,
                          Array.isArray(config.missing) && config.missing.length > 0
                            ? `Missing: ${config.missing.join(', ')}`
                            : ''
                        ]
                          .filter(Boolean)
                          .join('\n')
                      : 'Not loaded.'}
              </Description>
            </PopoverContent>
          </Popover>

          <IconButton
            type="button"
            onClick={() => previewRef.current?.resetSession()}
            aria-label="Restart preview"
            title="Restart preview"
            disabled={!enabled}
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
        <ErrorBoundary onReset={() => previewRef.current?.resetSession()} fallback={
            <div style={{ padding: 20, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                <div style={{ marginBottom: 10, fontWeight: 'bold', color: '#ef4444' }}>Preview Failed to Load</div>
                <div>This might be due to ad-blockers or network restrictions.</div>
                <div style={{ marginTop: 5, fontSize: 12 }}>Please disable ad-blockers for Live Preview to work.</div>
            </div>
        }>
            {enabled ? (
              <PreviewRunnerPreview ref={previewRef} enabled />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/60 bg-black/30 text-center px-6">
                Live Preview is closed.
              </div>
            )}
        </ErrorBoundary>
      </Content>
    </Window>
  );
};
