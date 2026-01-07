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
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px);
  box-shadow:
    0 22px 60px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  overflow: hidden;
`;

const Titlebar = styled.div`
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(13, 17, 23, 0.35);
`;

const Dots = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 7px;
`;

const Dot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: ${(p) => p.$color};
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35) inset;
`;

const Title = styled.div`
  flex: 1;
  color: rgba(255, 255, 255, 0.70);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const OpenLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  text-decoration: none;
  transition: background 160ms ease, border-color 160ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(34, 211, 238, 0.24);
    color: rgba(255, 255, 255, 0.92);
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
  background: radial-gradient(800px 400px at 30% 20%, rgba(34, 211, 238, 0.10), transparent 60%),
    radial-gradient(800px 400px at 70% 80%, rgba(168, 85, 247, 0.10), transparent 60%),
    rgba(13, 17, 23, 0.72);
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
`;

interface PreviewWindowProps {
  className?: string;
}

export const PreviewWindow: React.FC<PreviewWindowProps> = ({ className }) => {
  const { previewUrl, runtimeStatus, runtimeMessage } = usePreviewStore();
  const { files: projectFiles, projectId, isHydrating } = useProjectStore();
  const convexEnabled = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

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
  const mustWaitForConvex = convexEnabled && (isHydrating || !projectId);
  const showOverlay = mustWaitForConvex || !canShowFrame || runtimeStatus !== 'ready';

  const overlayMessage = useMemo(() => {
    if (mustWaitForConvex) return 'Initializing Development Environment...';
    if (runtimeStatus === 'error') return runtimeMessage || 'Runtime error. Check logs.';
    if (runtimeMessage) return runtimeMessage;
    if (!canShowFrame) return 'Waiting for Code...';
    return 'Booting container...';
  }, [canShowFrame, mustWaitForConvex, runtimeMessage, runtimeStatus]);

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
              {(mustWaitForConvex || (runtimeStatus !== 'idle' && runtimeStatus !== 'ready')) && (
                <Loader2 size={18} className="animate-spin" />
              )}
              {overlayMessage}
            </div>
          </Overlay>
        )}

        {canShowFrame && !mustWaitForConvex && (
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
