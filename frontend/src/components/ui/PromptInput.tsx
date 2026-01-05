import React, { forwardRef } from 'react';
import styled from 'styled-components';
import { useAIStore } from '../../stores/aiStore';

const Shell = styled.div<{ $mode: 'create' | 'edit' }>`
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  flex-shrink: 0;
  position: relative;
  border-radius: 22px;
  border: 1px solid ${(p) => (p.$mode === 'edit' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(255, 255, 255, 0.14)')};
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px);
  box-shadow:
    0 22px 60px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  overflow: hidden;
  min-height: 92px;

  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 12px;

  @media (max-width: 768px) {
    position: fixed;
    left: 14px;
    right: 14px;
    bottom: 14px;
    max-width: none;
    z-index: 80;
    flex-direction: column;
  }
`;

const Glow = styled.div<{ $mode: 'create' | 'edit' }>`
  position: absolute;
  inset: -10px;
  border-radius: 18px;
  background:
    radial-gradient(260px 140px at 15% 25%, rgba(34, 211, 238, 0.26), transparent 60%),
    radial-gradient(260px 140px at 85% 75%, rgba(168, 85, 247, ${(p) => (p.$mode === 'edit' ? 0.34 : 0.22)}), transparent 60%);
  filter: blur(18px);
  opacity: 0.9;
  pointer-events: none;
`;

const Input = styled.textarea<{ $mode: 'create' | 'edit' }>`
  width: 100%;
  flex: 1;
  min-width: 0;
  min-height: 68px;
  max-height: 220px;
  resize: none;
  padding: 4px 2px;
  border-radius: 0;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 15px;
  line-height: 1.4;
  outline: none;

  &::placeholder {
    color: rgba(255, 255, 255, 0.40);
  }

  &:focus {
    color: rgba(255, 255, 255, 0.96);
  }
`;

const Controls = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding-left: 12px;
  border-left: 1px solid rgba(255, 255, 255, 0.10);

  @media (max-width: 768px) {
    border-left: 0;
    padding-left: 0;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.10);
    justify-content: space-between;
    flex-wrap: wrap;
  }
`;

interface PromptInputProps {
  placeholder?: string;
  controls?: React.ReactNode;
  className?: string;
}

export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(({ placeholder, controls, className }, ref) => {
  const { prompt, setPrompt, isGenerating, interactionMode } = useAIStore();
  const mode = interactionMode === 'edit' ? 'edit' : 'create';

  return (
    <Shell className={className} $mode={mode}>
      <Glow $mode={mode} />
      <Input
        ref={ref}
        $mode={mode}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          placeholder ||
          (mode === 'edit'
            ? 'What would you like to change in the current code?'
            : 'Describe what you want to build…')
        }
        disabled={isGenerating}
      />
      {controls ? <Controls>{controls}</Controls> : null}
    </Shell>
  );
});
PromptInput.displayName = 'PromptInput';
