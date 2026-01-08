import React, { useMemo } from 'react';
import styled from 'styled-components';
import { FileText, MessageSquare, CheckSquare, Layers } from 'lucide-react';
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

export const ContextPreview: React.FC = () => {
  const { prompt, chatHistory, planSteps, lastPlannedPrompt } = useAIStore();
  const { files, projectName, stack } = useProjectStore();

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

  return (
    <Wrapper>
      <Title>
        <Layers size={16} />
        Live Context
      </Title>

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
