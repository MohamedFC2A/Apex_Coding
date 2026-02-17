import React, { useMemo, useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { FileText, MessageSquare, CheckSquare, Layers, Zap, AlertTriangle } from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';
import { useProjectStore } from '@/stores/projectStore';

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
`;

const Title = styled.h3`
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Content = styled.div<{ $compact?: boolean }>`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px;
  max-height: ${props => props.$compact ? '120px' : '200px'};
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(34, 211, 238, 0.12);
  color: rgba(34, 211, 238, 0.95);
  border: 1px solid rgba(34, 211, 238, 0.2);
`;

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
`;

const EmptyHint = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  padding: 8px;
  text-align: center;
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const ContextBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
`;

const ContextBarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
`;

const ContextProgress = styled.div<{ $percentage: number; $warning: boolean; $critical: boolean }>`
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: ${props => Math.min(100, props.$percentage)}%;
    background: ${props => 
      props.$critical ? 'rgba(239, 68, 68, 0.9)' : 
      props.$warning ? 'rgba(251, 191, 36, 0.9)' : 
      'rgba(34, 211, 238, 0.9)'};
    border-radius: 3px;
    transition: width 0.3s ease, background 0.3s ease;
    ${props => props.$critical && css`animation: ${pulse} 1s ease-in-out infinite;`}
  }
`;

const StatusIndicator = styled.span<{ $status: 'ok' | 'warning' | 'critical' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  color: ${props => 
    props.$status === 'critical' ? 'rgba(239, 68, 68, 0.95)' :
    props.$status === 'warning' ? 'rgba(251, 191, 36, 0.95)' :
    'rgba(34, 197, 94, 0.95)'};
`;

const LiveDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.9);
  animation: ${pulse} 2s ease-in-out infinite;
`;

export const ContextPreview: React.FC = () => {
  const { prompt, chatHistory, planSteps, lastPlannedPrompt, isGenerating, contextBudget, compressionSnapshot } = useAIStore();
  const { files, projectName, stack } = useProjectStore();
  const [, forceUpdate] = useState(0);

  // Force update every 2 seconds for live display
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  const contextSize = contextBudget.usedChars;
  const contextPercentage = contextBudget.utilizationPct;
  const isWarning = contextBudget.status === 'warning';
  const isCritical = contextBudget.status === 'critical';
  const isCompressed = (compressionSnapshot?.compressedMessagesCount || 0) > 0;

  const contextSummary = useMemo(() => {
    const fileCount = files.length;
    const messageCount = chatHistory.length;
    const stepCount = planSteps.filter(s => s.completed).length;
    const totalSteps = planSteps.length;

    return { fileCount, messageCount, stepCount, totalSteps };
  }, [files.length, chatHistory.length, planSteps]);

  const fileList = useMemo(() => {
    return files.slice(0, 10).map(f => f.path || f.name);
  }, [files]);

  const formatSize = (size: number) => {
    if (size < 1000) return `${size} chars`;
    if (size < 100000) return `${(size / 1000).toFixed(1)}K`;
    return `${(size / 1000).toFixed(0)}K`;
  };

  const contextStatus = isCritical ? 'critical' : isWarning ? 'warning' : 'ok';

  return (
    <Wrapper>
      <Title>
        <Layers size={16} />
        Live Context
        <LiveDot title="Live updating" />
        {isGenerating && <Zap size={12} style={{ color: 'rgba(251, 191, 36, 0.9)' }} />}
      </Title>

      {/* Context Size Bar */}
      <ContextBar>
        <ContextBarHeader>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Context Size</span>
            {isCompressed && (
              <span style={{ 
                fontSize: 9, 
                background: 'rgba(251, 191, 36, 0.2)', 
                color: 'rgba(251, 191, 36, 0.95)',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600
              }}>
                COMPRESSED
              </span>
            )}
          </span>
          <StatusIndicator $status={contextStatus}>
            {isCritical && <AlertTriangle size={10} />}
            {formatSize(contextSize)} / {formatSize(contextBudget.maxChars)}
          </StatusIndicator>
        </ContextBarHeader>
        <ContextProgress 
          $percentage={contextPercentage} 
          $warning={isWarning} 
          $critical={isCritical} 
        />
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>
          {contextPercentage.toFixed(1)}% used
        </div>
      </ContextBar>

      <Section>
        <SectionHeader>
          <FileText size={12} />
          Project Info
        </SectionHeader>
        <Content $compact>
          <div><strong>Name:</strong> {projectName || 'Untitled'}</div>
          <div><strong>Stack:</strong> {stack || 'Not detected'}</div>
          <div><strong>Files:</strong> {contextSummary.fileCount}</div>
        </Content>
      </Section>

      <Section>
        <SectionHeader>
          <MessageSquare size={12} />
          Current Prompt
        </SectionHeader>
        <Content $compact>
          {prompt || lastPlannedPrompt || <EmptyHint>No active prompt</EmptyHint>}
        </Content>
      </Section>

      <Section>
        <SectionHeader>
          <Badge>
            {contextSummary.messageCount} messages
          </Badge>
        </SectionHeader>
        <Content $compact>
          {chatHistory.length > 0 ? (
            chatHistory.map((msg, idx) => (
              <div key={idx}>
                <strong>{msg.role}:</strong> {msg.content.slice(0, 100)}
                {msg.content.length > 100 && '...'}
              </div>
            ))
          ) : (
            <EmptyHint>No chat history</EmptyHint>
          )}
        </Content>
      </Section>

      <Section>
        <SectionHeader>
          <CheckSquare size={12} />
          Plan Progress
        </SectionHeader>
        <Content $compact>
          {planSteps.length > 0 ? (
            <>
              <div>Progress: {contextSummary.stepCount} / {contextSummary.totalSteps}</div>
              {planSteps.map((step) => (
                <div key={step.id} style={{ opacity: step.completed ? 1 : 0.5 }}>
                  {step.completed ? '✓' : '○'} {step.title}
                </div>
              ))}
            </>
          ) : (
            <EmptyHint>No plan steps</EmptyHint>
          )}
        </Content>
      </Section>

      <Section>
        <SectionHeader>
          <FileText size={12} />
          Files ({files.length})
        </SectionHeader>
        <FileList>
          {fileList.length > 0 ? (
            fileList.map((file, idx) => (
              <FileItem key={idx}>
                📄 {file}
              </FileItem>
            ))
          ) : (
            <EmptyHint>No files yet</EmptyHint>
          )}
          {files.length > 10 && (
            <FileItem>... and {files.length - 10} more</FileItem>
          )}
        </FileList>
      </Section>
    </Wrapper>
  );
};
