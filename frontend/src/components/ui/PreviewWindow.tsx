'use client';

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { usePreviewStore } from '../../stores/previewStore';
import { useProjectStore } from '../../stores/projectStore';
import { ExternalLink, Loader2 } from 'lucide-react';

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

const OpenLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: all 200ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.10);
    border-color: rgba(34, 211, 238, 0.30);
    color: rgba(255, 255, 255, 0.95);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Content = styled.div`
  position: relative;
  flex: 1;
  background: #0b0f14;
`;

const Frame = styled.iframe`
  width: 100%;
  height: 100%;
  border: 0;
  background: white;
`;

const Overlay = styled(motion.div)`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: 
    radial-gradient(900px 450px at 25% 15%, rgba(34, 211, 238, 0.12), transparent 60%),
    radial-gradient(900px 450px at 75% 85%, rgba(168, 85, 247, 0.12), transparent 60%),
    rgba(13, 17, 23, 0.80);
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  font-weight: 500;
  backdrop-filter: blur(8px);
`;

interface PreviewWindowProps {
  className?: string;
}

export const PreviewWindow: React.FC<PreviewWindowProps> = ({ className }) => {
  const { previewUrl, runtimeStatus, runtimeMessage } = usePreviewStore();
  const { files: projectFiles } = useProjectStore();

  const hasOnlyBaseStructure = projectFiles.length === 0;

  const indexHtmlContent = useMemo(() => {
    const entry = projectFiles.find((file) => {
      const path = (file.path || file.name || '').toLowerCase();
      return path.endsWith('index.html');
    });
    return entry?.content || '';
  }, [projectFiles]);

  const canMountFrame = indexHtmlContent.trim().length > 10;
  const canShowFrame = Boolean(previewUrl) && canMountFrame;
  const showOverlay = !canShowFrame || runtimeStatus !== 'ready';

  const overlayMessage = useMemo(() => {
    if (runtimeStatus === 'error') return runtimeMessage || 'Runtime error. Check logs.';
    if (runtimeMessage) return runtimeMessage;
    if (!canShowFrame) return 'Waiting for Code...';
    return 'Booting container...';
  }, [canShowFrame, runtimeMessage, runtimeStatus]);

  if (hasOnlyBaseStructure) {
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
          <Overlay initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Waiting for Code...
          </Overlay>
        </Content>
      </Window>
    );
  }

  return (
    <Window className={className}>
      <Titlebar>
        <Dots>
          <Dot $color="#ff5f57" />
          <Dot $color="#febc2e" />
          <Dot $color="#28c840" />
        </Dots>
        <Title>Live Preview</Title>
        {previewUrl && (
          <OpenLink href={previewUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
            Open
          </OpenLink>
        )}
      </Titlebar>
      <Content>
        {showOverlay && (
          <Overlay initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {(runtimeStatus !== 'idle' && runtimeStatus !== 'ready') && (
                <Loader2 size={18} className="animate-spin" />
              )}
              {overlayMessage}
            </div>
          </Overlay>
        )}

        {canShowFrame && (
          <Frame
            src={previewUrl ?? undefined}
            className="w-full h-full border-none bg-white"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads"
            allow="cross-origin-isolated; clipboard-read; clipboard-write"
            title="Live Preview"
          />
        )}
      </Content>
    </Window>
  );
};
