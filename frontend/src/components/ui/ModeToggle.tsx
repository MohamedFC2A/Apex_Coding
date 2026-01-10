import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { useAIStore } from '../../stores/aiStore';

const ToggleRoot = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  user-select: none;
`;

const ToggleTrackGlow = styled.div`
  position: absolute;
  inset: -1px;
  border-radius: 999px;
  pointer-events: none;
  background: radial-gradient(120px 60px at 20% 30%, rgba(56, 189, 248, 0.25), transparent 60%),
    radial-gradient(140px 70px at 80% 70%, rgba(168, 85, 247, 0.25), transparent 60%);
  filter: blur(10px);
  opacity: 0.9;
`;

const ToggleButton = styled.div<{ $columns: number }>`
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(${(p) => p.$columns}, 1fr);
  gap: 4px;
  align-items: center;
  pointer-events: auto;
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.5), 0 0 0 0 rgba(234, 179, 8, 0.45); }
  50% { box-shadow: 0 0 16px 6px rgba(168, 85, 247, 0.35), 0 0 28px 10px rgba(234, 179, 8, 0.30); }
  100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.5), 0 0 0 0 rgba(234, 179, 8, 0.45); }
`;

const Segment = styled.div<{ $active?: boolean; $super?: boolean }>`
  position: relative;
  height: 38px;
  min-width: 88px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-weight: 800;
  letter-spacing: 0.12em;
  font-size: 12px;
  color: ${(p) => (p.$active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)')};
  transition: all 0.3s ease;

  ${(p) =>
    p.$active
      ? `
    background: ${p.$super
      ? 'linear-gradient(135deg, rgba(126,34,206,0.28), rgba(234,179,8,0.24))'
      : 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(168,85,247,0.22))'};
    border: 1px solid rgba(255,255,255,0.16);
  `
      : 'background: transparent; border: 1px solid rgba(255,255,255,0.08);'}
  ${(p) => (p.$super && p.$active ? css`animation: ${pulse} 3s ease-in-out infinite;` : '')}

  &:hover {
    color: rgba(255, 255, 255, 0.95);
    background: ${(p) => (!p.$active ? 'rgba(255, 255, 255, 0.04)' : '')};
  }
`;

interface ModeToggleProps {
  className?: string;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ className }) => {
  const { modelMode, setModelMode, isGenerating } = useAIStore();
  const isThinking = modelMode === 'thinking';
  const isSuper = modelMode === 'super';

  return (
    <ToggleRoot className={className}>
      {/* Glow removed as requested */}
      <ToggleButton
        $columns={isSuper ? 1 : 3}
      >
        {!isSuper && (
          <Segment
            $active={modelMode === 'fast'}
            onClick={() => {
              if (isGenerating) return;
              setModelMode('fast');
            }}
          >
            FAST
          </Segment>
        )}
        {!isSuper && (
          <Segment
            $active={modelMode === 'thinking'}
            onClick={() => {
              if (isGenerating) return;
              setModelMode('thinking');
            }}
          >
            THINKING
          </Segment>
        )}
        <Segment
          $active={isSuper}
          $super
          onClick={() => {
            if (isGenerating) return;
            setModelMode(isSuper ? 'fast' : 'super');
          }}
        >
          SUPER-THINKING (BETA)
        </Segment>
      </ToggleButton>
    </ToggleRoot>
  );
};
