import React from 'react';
import styled from 'styled-components';
import { useAIStore } from '../../stores/aiStore';
import { Compass } from 'lucide-react';

const Root = styled.div`
  width: 100%;
  display: flex;
  user-select: none;
`;

const ToggleButton = styled.button<{ $on: boolean }>`
  width: 100%;
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$on ? 'rgba(34, 211, 238, 0.34)' : 'rgba(255, 255, 255, 0.14)')};
  background: ${(p) => (p.$on ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255, 255, 255, 0.04)')};
  color: ${(p) => (p.$on ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.8)')};
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    height: 42px;
  }
`;

const Left = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const Status = styled.span<{ $on: boolean }>`
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${(p) => (p.$on ? 'rgba(34, 211, 238, 0.95)' : 'rgba(255, 255, 255, 0.56)')};
`;

export interface ArchitectToggleProps {
  className?: string;
}

export const ArchitectToggle: React.FC<ArchitectToggleProps> = ({ className }) => {
  const { architectMode, setArchitectMode, isGenerating, isPlanning } = useAIStore();

  return (
    <Root className={className}>
      <ToggleButton
        $on={architectMode}
        type="button"
        aria-label="Architect Mode"
        aria-pressed={architectMode}
        onClick={() => setArchitectMode(!architectMode)}
        disabled={isGenerating || isPlanning}
      >
        <Left>
          <Compass />
          <span>Architect</span>
        </Left>
        <Status $on={architectMode}>{architectMode ? 'On' : 'Off'}</Status>
      </ToggleButton>
    </Root>
  );
};
