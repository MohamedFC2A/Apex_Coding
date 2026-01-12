'use client';

import React, { useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { PreviewRunnerPreview, PreviewRunnerPreviewHandle } from '../Preview/PreviewRunnerPreview';
import { ErrorBoundary } from './ErrorBoundary';

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

const Content = styled.div`
  position: relative;
  flex: 1;
  background: #0b0f14;
`;

interface PreviewWindowProps {
  className?: string;
  enabled?: boolean;
}

export const PreviewWindow: React.FC<PreviewWindowProps> = ({ className, enabled = true }) => {
  const previewRef = useRef<PreviewRunnerPreviewHandle>(null);
  return (
    <Window className={className}>
      <Titlebar>
        <Dots>
          <Dot $color="#ff5f57" />
          <Dot $color="#febc2e" />
          <Dot $color="#28c840" />
        </Dots>
        <Title>Live Preview</Title>
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
