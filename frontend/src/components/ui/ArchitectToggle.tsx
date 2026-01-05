import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useAIStore } from '../../stores/aiStore';

const Root = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  user-select: none;
`;

const Label = styled.div`
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.70);
  white-space: nowrap;
`;

const Switch = styled.button`
  position: relative;
  width: 54px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(16px);
  box-shadow:
    0 14px 30px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  cursor: pointer;
  padding: 0;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TrackGlow = styled.div<{ $on: boolean }>`
  position: absolute;
  inset: -1px;
  border-radius: 999px;
  pointer-events: none;
  background:
    radial-gradient(120px 60px at 20% 30%, rgba(34, 211, 238, 0.25), transparent 60%),
    radial-gradient(140px 70px at 80% 70%, rgba(168, 85, 247, 0.25), transparent 60%);
  filter: blur(10px);
  opacity: ${(p) => (p.$on ? 1 : 0.4)};
  transition: opacity 200ms ease;
`;

const Thumb = styled(motion.div)<{ $on: boolean }>`
  position: absolute;
  top: 5px;
  left: 5px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: ${(p) =>
    p.$on
      ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.55), rgba(168, 85, 247, 0.42))'
      : 'rgba(255, 255, 255, 0.18)'};
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 10px 22px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
`;

export interface ArchitectToggleProps {
  className?: string;
}

export const ArchitectToggle: React.FC<ArchitectToggleProps> = ({ className }) => {
  const { architectMode, setArchitectMode, isGenerating, isPlanning } = useAIStore();

  return (
    <Root className={className}>
      <Label>Architect Mode</Label>
      <Switch
        type="button"
        aria-label="Architect Mode"
        aria-pressed={architectMode}
        onClick={() => setArchitectMode(!architectMode)}
        disabled={isGenerating || isPlanning}
      >
        <TrackGlow $on={architectMode} />
        <Thumb
          $on={architectMode}
          animate={{ x: architectMode ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        />
      </Switch>
    </Root>
  );
};

