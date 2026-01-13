import React from 'react';
import styled from 'styled-components';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { Code2, FileText, Zap } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const Bar = styled.div`
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(13, 17, 23, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
  gap: 16px;
`;

const Section = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Item = styled.div<{ $clickable?: boolean; $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  transition: all 0.15s ease;
  color: ${(p) => (p.$active ? '#F59E0B' : 'inherit')};

  &:hover {
    background: ${(p) => (p.$clickable ? 'rgba(255, 255, 255, 0.05)' : 'transparent')};
    color: ${(p) => (p.$clickable ? '#F59E0B' : 'inherit')};
  }

  svg {
    width: 12px;
    height: 12px;
    opacity: ${(p) => (p.$active ? 1 : 0.7)};
  }
`;

const Separator = styled.div`
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
`;

export const StatusBar: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { activeFile, files } = useProjectStore();
  const { modelMode, isGenerating, architectMode } = useAIStore();

  const currentFile = files.find((f) => f.path === activeFile);
  const language = currentFile
    ? getLanguageFromExtension(currentFile.path || currentFile.name || '')
    : 'plaintext';

  const lineCount = currentFile?.content?.split('\n').length || 0;
  const charCount = currentFile?.content?.length || 0;

  return (
    <Bar style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <Section style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <Item>
          <FileText />
          <span>{files.length} {t('app.sidebar.files')}</span>
        </Item>
        
        {currentFile && (
          <>
            <Separator />
            <Item $clickable>
              <Code2 />
              <span>{language.toUpperCase()}</span>
            </Item>
            <Item>
              <span>{t('app.status.line')} {lineCount}</span>
            </Item>
            <Item>
              <span>{charCount} {t('app.status.chars')}</span>
            </Item>
          </>
        )}
      </Section>

      <Section style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {isGenerating && (
          <>
            <Item $active>
              <div className="animate-pulse flex items-center gap-1">
                <Zap size={12} fill="#F59E0B" />
                <span>{t('app.plan.status.working')}...</span>
              </div>
            </Item>
            <Separator />
          </>
        )}
        
        <Item $clickable>
          <Zap size={12} />
          <span>{architectMode ? t('app.mode.architect') : t('app.mode.editor')}</span>
        </Item>
      </Section>
    </Bar>
  );
};
