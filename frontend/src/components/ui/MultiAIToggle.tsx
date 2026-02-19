import React from 'react';
import styled from 'styled-components';
import { Network } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';

const Root = styled.div`
  width: 100%;
  display: flex;
  user-select: none;
`;

const ToggleButton = styled.button<{ $on: boolean }>`
  width: 100%;
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$on ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.14)')};
  background: ${(p) => (p.$on ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 255, 255, 0.04)')};
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
  color: ${(p) => (p.$on ? 'rgba(16, 185, 129, 0.96)' : 'rgba(255, 255, 255, 0.56)')};
`;

export interface MultiAIToggleProps {
  className?: string;
}

export const MultiAIToggle: React.FC<MultiAIToggleProps> = ({ className }) => {
  const { multiAgentEnabled, setMultiAgentEnabled, isGenerating, isPlanning } = useAIStore();

  return (
    <Root className={className}>
      <ToggleButton
        $on={multiAgentEnabled}
        type="button"
        aria-label="Multi AI"
        aria-pressed={multiAgentEnabled}
        onClick={() => setMultiAgentEnabled(!multiAgentEnabled)}
        disabled={isGenerating || isPlanning}
      >
        <Left>
          <Network />
          <span>Multi AI</span>
        </Left>
        <Status $on={multiAgentEnabled}>{multiAgentEnabled ? 'On' : 'Off'}</Status>
      </ToggleButton>
    </Root>
  );
};
