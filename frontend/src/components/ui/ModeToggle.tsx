import React from 'react';
import styled from 'styled-components';
import { useAIStore } from '../../stores/aiStore';
import { Zap, Brain } from 'lucide-react';

const Root = styled.div`
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(9, 14, 24, 0.74);
  padding: 4px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
`;

const Option = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.36)' : 'rgba(255, 255, 255, 0.1)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.17)' : 'rgba(255, 255, 255, 0.025)')};
  color: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.72)')};
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.02em;
  height: 40px;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
  min-width: 0;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  svg {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    height: 40px;
    font-size: 11px;
    gap: 4px;

    span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

interface ModeToggleProps {
  className?: string;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ className }) => {
  const { modelMode, setModelMode, isGenerating } = useAIStore();

  const modes = [
    { id: 'fast', label: 'Fast', icon: Zap },
    { id: 'thinking', label: 'Think', icon: Brain }
  ] as const;

  return (
    <Root className={className} aria-label="Model mode selector">
      <Grid>
        {modes.map((mode) => {
          const Icon = mode.icon;
          const active = modelMode === mode.id;
          return (
            <Option
              key={mode.id}
              type="button"
              $active={active}
              onClick={() => {
                if (!isGenerating) setModelMode(mode.id);
              }}
              disabled={isGenerating}
              aria-pressed={active}
              title={mode.label}
            >
              <Icon />
              <span>{mode.label}</span>
            </Option>
          );
        })}
      </Grid>
    </Root>
  );
};
