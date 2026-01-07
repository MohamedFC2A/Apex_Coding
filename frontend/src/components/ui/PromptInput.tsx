import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useAIStore } from '../../stores/aiStore';

const CREATIVE_HINTS = [
  'Build a responsive SaaS dashboard...',
  'Create a Neumorphic weather app...',
  'Design a dark-themed 3D portfolio...',
  'Develop a real-time chat with WebSockets...',
  'Code a minimalist coffee brand page...',
  'Build a live crypto price tracker...',
  'Create a glassmorphism login UI...',
  'Design an AI image generator tool...',
  'Develop a fitness dashboard with charts...',
  'Code a cinematic movie preview site...'
] as const;

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
    bottom: calc(14px + 34px);
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

const InputWrap = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
`;

const HintOverlay = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  padding: 4px 2px;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  color: rgba(255, 255, 255, 0.44);
`;

const HintText = styled.span<{ $steps: number; $durationMs: number; $targetWidthCh: number }>`
  --target-width: ${(p) => `${Math.max(1, p.$targetWidthCh)}ch`};
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  width: 0ch;
  max-width: 100%;
  line-height: 1.4;
  font-size: 15px;
  animation: nexus-typing ${(p) => p.$durationMs}ms steps(${(p) => Math.max(12, p.$steps)}, end) infinite;
`;

const Cursor = styled.span`
  display: inline-block;
  width: 10px;
  margin-left: 2px;
  opacity: 0.65;
  animation: nexus-blink 900ms steps(1, end) infinite;
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

  @keyframes nexus-typing {
    0% {
      width: 0ch;
      opacity: 0;
    }
    8% {
      opacity: 1;
    }
    45% {
      width: var(--target-width);
      opacity: 1;
    }
    78% {
      width: var(--target-width);
      opacity: 1;
    }
    100% {
      width: 0ch;
      opacity: 0;
    }
  }

  @keyframes nexus-blink {
    0%,
    49% {
      opacity: 0;
    }
    50%,
    100% {
      opacity: 0.8;
    }
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
  const [focused, setFocused] = useState(false);

  const [hint, setHint] = useState(() => CREATIVE_HINTS[Math.floor(Math.random() * CREATIVE_HINTS.length)]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (focused) return;
    if (prompt.trim().length > 0) return;
    setHint((prev) => prev || CREATIVE_HINTS[Math.floor(Math.random() * CREATIVE_HINTS.length)]);
  }, [focused, mode, prompt]);

  const showCreativeHint = mode === 'create' && !placeholder && !focused && prompt.trim().length === 0 && !isGenerating;
  const hintSteps = hint.length;
  const hintDurationMs = useMemo(() => {
    const base = 2400;
    const perChar = 65;
    const ms = base + perChar * hint.length;
    return Math.max(3200, Math.min(ms, 9000));
  }, [hint.length]);

  const displayedPlaceholder =
    placeholder ||
    (mode === 'edit' ? 'What would you like to change in the current code?' : showCreativeHint ? '' : 'Describe what you want to build…');

  return (
    <Shell className={className} $mode={mode}>
      <Glow $mode={mode} />
      <InputWrap>
        {showCreativeHint ? (
          <HintOverlay aria-hidden="true">
            <HintText
              $steps={hintSteps}
              $durationMs={hintDurationMs}
              $targetWidthCh={hintSteps}
              onAnimationIteration={() => {
                setHint((prev) => {
                  if (CREATIVE_HINTS.length <= 1) return prev;
                  let next = prev;
                  for (let i = 0; i < 6 && next === prev; i++) {
                    next = CREATIVE_HINTS[Math.floor(Math.random() * CREATIVE_HINTS.length)];
                  }
                  return next;
                });
              }}
            >
              {hint}
            </HintText>
            <Cursor aria-hidden="true">|</Cursor>
          </HintOverlay>
        ) : null}
        <Input
          ref={ref}
          $mode={mode}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={displayedPlaceholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={isGenerating}
        />
      </InputWrap>
      {controls ? <Controls>{controls}</Controls> : null}
    </Shell>
  );
});
PromptInput.displayName = 'PromptInput';
