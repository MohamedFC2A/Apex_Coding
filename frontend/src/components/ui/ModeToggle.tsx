import React from 'react';
import styled from 'styled-components';
import { motion, LayoutGroup } from 'framer-motion';
import { useAIStore } from '../../stores/aiStore';
import { Zap, Brain, Rocket } from 'lucide-react';

const Container = styled(motion.div)`
  position: relative;
  display: inline-flex;
  padding: 4px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
`;

const Item = styled.button<{ $isActive: boolean; $mode: string }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  z-index: 2;
  font-family: inherit;
  font-weight: 600;
  font-size: 13px;
  color: ${p => p.$isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'};
  transition: color 0.3s ease;
  outline: none;

  &:hover {
    color: ${p => p.$isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.9)'};
  }

  svg {
    width: 16px;
    height: 16px;
    opacity: ${p => p.$isActive ? 1 : 0.7};
  }
`;

const ActiveBackground = styled(motion.div)<{ $mode: string }>`
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 12px;
  z-index: 1;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  
  ${p => {
    switch(p.$mode) {
      case 'fast':
        return 'background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);';
      case 'thinking':
        return 'background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);';
      case 'super':
        return 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);';
      default:
        return 'background: #333;';
    }
  }}
`;

interface ModeToggleProps {
  className?: string;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ className }) => {
  const { modelMode, setModelMode, isGenerating } = useAIStore();

  const modes = [
    { id: 'fast', label: 'Fast', icon: Zap },
    { id: 'thinking', label: 'Thinking', icon: Brain },
    { id: 'super', label: 'Super', icon: Rocket },
  ] as const;

  return (
    <LayoutGroup>
      <Container className={className} layout>
        {modes.map((mode) => {
          const isActive = modelMode === mode.id;
          const Icon = mode.icon;
          
          return (
            <div key={mode.id} style={{ position: 'relative' }}>
              {isActive && (
                <ActiveBackground
                  layoutId="active-bg"
                  $mode={mode.id}
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Item
                onClick={() => !isGenerating && setModelMode(mode.id)}
                $isActive={isActive}
                $mode={mode.id}
                disabled={isGenerating}
                style={{ opacity: isGenerating ? 0.5 : 1 }}
              >
                <Icon strokeWidth={2.5} />
                <span>{mode.label}</span>
              </Item>
            </div>
          );
        })}
      </Container>
    </LayoutGroup>
  );
};
