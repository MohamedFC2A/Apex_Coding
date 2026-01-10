import React from 'react';
import styled from 'styled-components';
import { useProjectStore } from '@/stores/projectStore';
import { useAIStore } from '@/stores/aiStore';
import { getLanguageFromExtension } from '@/utils/stackDetector';
import { Code2, FileText, Zap } from 'lucide-react';

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

const Item = styled.div<{ $clickable?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  transition: background 0.15s ease;

  &:hover {
    background: ${(p) => (p.$clickable ? 'rgba(255, 255, 255, 0.05)' : 'transparent')};
  }

  svg {
    width: 12px;
    height: 12px;
    opacity: 0.7;
  }
`;

const Separator = styled.div`
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
`;

export const StatusBar: React.FC = () => {
  const { activeFile, files } = useProjectStore();
  const { modelMode, isGenerating } = useAIStore();

  const currentFile = files.find((f) => f.path === activeFile);
  const language = currentFile
    ? getLanguageFromExtension(currentFile.path || currentFile.name || '')
    : 'plaintext';

  const lineCount = currentFile?.content?.split('\n').length || 0;
  const charCount = currentFile?.content?.length || 0;

  return (
    <Bar>
      <Section>
        <Item>
          <FileText />
          <span>{files.length} files</span>
        </Item>
        
        {currentFile && (
          <>
            <Separator />
            <Item $clickable>
              <Code2 />
              <span>{language.toUpperCase()}</span>
            </Item>
            <Item>
              <span>Ln {lineCount}</span>
            </Item>
            <Item>
              <span>{charCount} chars</span>
            </Item>
          </>
        )}
      </Section>

      <Section>
        {isGenerating && (
          <>
            <Item>
              <div className="animate-pulse">
                <span>⚡ Generating...</span>
              </div>
            </Item>
            <Separator />
          </>
        )}
        <Item $clickable title={`AI Mode: ${
          modelMode === 'super'
            ? 'Super-Thinking (hybrid fast + deep)'
            : modelMode === 'thinking'
              ? 'Thinking (slower, better)'
              : 'Fast (quick responses)'
        }`}>
          <Zap />
          <span>{
            modelMode === 'super'
              ? '✨ Super-Thinking (Beta)'
              : modelMode === 'thinking'
                ? '🧠 Thinking'
                : '⚡ Fast'
          }</span>
        </Item>
        <Item>
          <span>UTF-8</span>
        </Item>
        <Item>
          <span>LF</span>
        </Item>
        <Item $clickable title="Spaces: 2">
          <span>Spaces: 2</span>
        </Item>
      </Section>
    </Bar>
  );
};
