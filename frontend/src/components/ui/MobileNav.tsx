import React from 'react';
import styled from 'styled-components';
import { Code2, MonitorPlay, Terminal, Sparkles } from 'lucide-react';

const NavContainer = styled.div`
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: rgba(10, 12, 16, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 50;
  padding-bottom: env(safe-area-inset-bottom);

  @media (max-width: 768px) {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }
`;

const NavItem = styled.button<{ $active?: boolean }>`
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: none;
  border: none;
  color: ${(p) => (p.$active ? 'rgba(34, 211, 238, 1)' : 'rgba(255, 255, 255, 0.5)')};
  transition: all 0.2s ease;
  cursor: pointer;

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 20px;
    height: 20px;
    filter: ${(p) => (p.$active ? 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.5))' : 'none')};
  }

  span {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
`;

interface MobileNavProps {
  activeTab: 'editor' | 'preview' | 'ai';
  onTabChange: (tab: 'editor' | 'preview' | 'ai') => void;
  isGenerating?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onTabChange, isGenerating }) => {
  return (
    <NavContainer>
      <NavItem $active={activeTab === 'editor'} onClick={() => onTabChange('editor')}>
        <Code2 />
        <span>Code</span>
      </NavItem>
      
      <NavItem $active={activeTab === 'ai'} onClick={() => onTabChange('ai')}>
        {isGenerating ? (
          <div className="animate-spin text-cyan-400">
            <Sparkles size={20} />
          </div>
        ) : (
          <Sparkles />
        )}
        <span>AI</span>
      </NavItem>

      <NavItem $active={activeTab === 'preview'} onClick={() => onTabChange('preview')}>
        <MonitorPlay />
        <span>Preview</span>
      </NavItem>
    </NavContainer>
  );
};
