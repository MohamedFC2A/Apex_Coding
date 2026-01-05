import React from 'react';
import styled from 'styled-components';
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

const ToggleButton = styled.button`
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  outline: none;
`;

const Segment = styled.div<{ $active?: boolean }>`
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
`;

const Thumb = styled(motion.div)`
  position: absolute;
  top: 6px;
  left: 6px;
  width: calc(50% - 6px);
  height: 38px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(168, 85, 247, 0.22));
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
`;

interface ModeToggleProps {
  className?: string;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ className }) => {
  const { modelMode, setModelMode, isGenerating } = useAIStore();
  const isThinking = modelMode === 'thinking';

  return (
    <ToggleRoot className={className}>
      <ToggleTrackGlow />
      <Thumb
        animate={{ x: isThinking ? '100%' : '0%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      />
      <ToggleButton
        type="button"
        aria-label="Mode toggle"
        aria-pressed={isThinking}
        onClick={() => setModelMode(isThinking ? 'fast' : 'thinking')}
        disabled={isGenerating}
      >
        <Segment $active={!isThinking}>FAST</Segment>
        <Segment $active={isThinking}>THINKING</Segment>
      </ToggleButton>
    </ToggleRoot>
  );
};

