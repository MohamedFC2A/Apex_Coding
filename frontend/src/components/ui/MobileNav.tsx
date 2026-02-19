import React from 'react';
import styled from 'styled-components';
import { Code2, History, MonitorPlay, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const NavContainer = styled.div`
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--mobile-nav-height);
  background: rgba(10, 12, 16, 0.95);
  backdrop-filter: blur(var(--glass-blur-strong));
  border-top: 1px solid var(--nexus-border);
  z-index: 50;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);

  @media (max-width: 768px) {
    display: flex;
    justify-content: space-around;
    align-items: center;
    height: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
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
  color: ${(p) => (p.$active ? 'var(--nexus-cyan)' : 'var(--nexus-text-muted)')};
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%) scaleX(${(p) => (p.$active ? 1 : 0)});
    width: 20px;
    height: 2px;
    background: var(--nexus-cyan);
    border-radius: 2px;
    transition: transform 0.2s ease;
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 20px;
    height: 20px;
    transition: all 0.2s ease;
    filter: ${(p) => (p.$active ? 'drop-shadow(0 0 8px var(--nexus-cyan-glow))' : 'none')};
  }

  span {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
`;

interface MobileNavProps {
  activeTab: 'editor' | 'preview' | 'ai';
  onTabChange: (tab: 'editor' | 'preview' | 'ai') => void;
  historyOpen?: boolean;
  onHistoryToggle?: () => void;
  isGenerating?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onTabChange,
  historyOpen = false,
  onHistoryToggle,
  isGenerating
}) => {
  const { t } = useLanguage();

  return (
    <NavContainer>
      <NavItem $active={activeTab === 'editor'} onClick={() => onTabChange('editor')}>
        <Code2 />
        <span>{t('app.mobile.tab.editor')}</span>
      </NavItem>
      
      <NavItem $active={activeTab === 'ai'} onClick={() => onTabChange('ai')}>
        {isGenerating ? (
          <div className="animate-spin text-cyan-400">
            <Sparkles size={20} />
          </div>
        ) : (
          <Sparkles />
        )}
        <span>{t('app.mobile.tab.ai')}</span>
      </NavItem>

      <NavItem $active={activeTab === 'preview'} onClick={() => onTabChange('preview')}>
        <MonitorPlay />
        <span>{t('app.mobile.tab.preview')}</span>
      </NavItem>

      <NavItem
        $active={historyOpen}
        onClick={() => {
          onHistoryToggle?.();
        }}
        aria-label={historyOpen ? 'Close history' : 'Open history'}
      >
        <History />
        <span>{t('app.mobile.tab.history')}</span>
      </NavItem>
    </NavContainer>
  );
};
