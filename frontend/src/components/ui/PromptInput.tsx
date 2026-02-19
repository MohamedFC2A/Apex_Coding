import React, { forwardRef, useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { useAIStore } from '../../stores/aiStore';
import type { ProjectMode } from '@/types/constraints';

const MAX_PROMPT_CHARS = 6000;

const Shell = styled.div<{ $mode: 'create' | 'edit' }>`
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  flex-shrink: 0;
  border-radius: 16px;
  border: 1px solid ${(p) => (p.$mode === 'edit' ? 'rgba(245, 158, 11, 0.44)' : 'rgba(255, 255, 255, 0.14)')};
  background: linear-gradient(180deg, rgba(12, 16, 24, 0.92) 0%, rgba(9, 13, 21, 0.92) 100%);
  backdrop-filter: blur(22px);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.36);
  overflow: hidden;
`;

const TopBar = styled.div<{ $mode: 'create' | 'edit' }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: ${(p) => (p.$mode === 'edit' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 211, 238, 0.08)')};

  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const TopLeft = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ModeBadge = styled.span<{ $mode: 'create' | 'edit' }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${(p) => (p.$mode === 'edit' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(34, 211, 238, 0.95)')};
  border: 1px solid ${(p) => (p.$mode === 'edit' ? 'rgba(245, 158, 11, 0.36)' : 'rgba(34, 211, 238, 0.36)')};
  background: rgba(0, 0, 0, 0.24);
  white-space: nowrap;
`;

const TopInfo = styled.span`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.58);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CounterPill = styled.span<{ $warn: boolean }>`
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  color: ${(p) => (p.$warn ? 'rgba(248, 113, 113, 0.96)' : 'rgba(255, 255, 255, 0.76)')};
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$warn ? 'rgba(248, 113, 113, 0.42)' : 'rgba(255, 255, 255, 0.18)')};
  background: ${(p) => (p.$warn ? 'rgba(248, 113, 113, 0.12)' : 'rgba(255, 255, 255, 0.06)')};
  padding: 5px 9px;
  white-space: nowrap;
`;

const ProjectModeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 9px 10px 10px;
  }
`;

const ProjectModeLabel = styled.span`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
`;

const ProjectModeSwitch = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.26);
`;

const ProjectModeButton = styled.button<{ $active: boolean }>`
  border: 0;
  height: 28px;
  border-radius: 999px;
  padding: 0 12px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.24)' : 'transparent')};
  color: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.74)')};
  transition: background 120ms ease, color 120ms ease;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.52;
  }
`;

const NoticeStack = styled.div`
  display: grid;
  gap: 8px;
  padding: 8px 12px 0;

  @media (max-width: 768px) {
    padding: 8px 10px 0;
  }
`;

const NoticeCard = styled.div<{ $tone: 'warning' | 'info' }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$tone === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 211, 238, 0.27)')};
  background: ${(p) => (p.$tone === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(34, 211, 238, 0.1)')};
  padding: 8px 10px;
`;

const NoticeText = styled.div`
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.9);
`;

const NoticeActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const NoticeActionButton = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  height: 26px;
  padding: 0 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
`;

const NoticeDismissButton = styled.button`
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  line-height: 1;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  cursor: pointer;
`;

const ConstraintsShell = styled.div`
  margin: 8px 12px 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;

  @media (max-width: 768px) {
    margin: 8px 10px 0;
  }
`;

const ConstraintsHeader = styled.button`
  width: 100%;
  min-height: 36px;
  border: 0;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const ConstraintsSummary = styled.span`
  font-size: 10px;
  text-transform: none;
  letter-spacing: 0.01em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
  text-align: end;
`;

const ConstraintsBody = styled.div<{ $open: boolean }>`
  max-height: ${(p) => (p.$open ? '258px' : '0')};
  opacity: ${(p) => (p.$open ? 1 : 0)};
  overflow: hidden;
  transition: max-height 220ms ease, opacity 170ms ease;
`;

const ConstraintsScroll = styled.div`
  max-height: 258px;
  overflow-y: auto;
  padding: 6px 0;
`;

const Composer = styled.div`
  padding: 10px 12px 12px;

  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const InputWrap = styled.div`
  width: 100%;
  display: grid;
  gap: 6px;
`;

const Input = styled.textarea`
  width: 100%;
  min-width: 0;
  min-height: 86px;
  max-height: 260px;
  resize: none;
  border: 1px solid rgba(255, 255, 255, 0.14);
  outline: none;
  border-radius: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.26);
  color: rgba(255, 255, 255, 0.97);
  font-size: 14px;
  line-height: 1.5;

  &::placeholder {
    color: rgba(255, 255, 255, 0.42);
  }

  &:focus {
    border-color: rgba(34, 211, 238, 0.46);
    box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.17);
  }

  &:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    min-height: 92px;
    max-height: min(230px, 38vh);
    font-size: 16px;
    padding: 11px;
  }
`;

const InputHint = styled.div`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  padding: 0 2px;
`;

const Controls = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  > * {
    min-width: 0;
    width: 100%;
    display: flex;
  }

  > * > * {
    min-width: 0;
    width: 100%;
  }

  > :nth-child(3) {
    grid-column: 1 / -1;
  }

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;

    > :nth-child(3) {
      grid-column: auto;
    }
  }
`;

interface PromptInputProps {
  placeholder?: string;
  controls?: React.ReactNode;
  className?: string;
  onSubmit?: () => void;
  projectMode: ProjectMode;
  onProjectModeChange: (mode: ProjectMode) => void;
  recommendation?: { mode: ProjectMode; reason: string } | null;
  onApplyRecommendation?: () => void;
  labels?: {
    projectModeLabel?: string;
    frontendLabel?: string;
    applyLabel?: string;
  };
  constraintsPanel?: React.ReactNode;
  constraintsPanelOpen?: boolean;
  onToggleConstraintsPanel?: () => void;
  constraintsSummary?: string;
  constraintsLabel?: string;
  completionSuggestions?: Array<{ question: string; actionLabel: string }>;
  onApplyCompletionSuggestion?: (index: number) => void;
  onDismissCompletionSuggestions?: () => void;
}

export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(
  (
    {
      placeholder,
      controls,
      className,
      onSubmit,
      projectMode,
      onProjectModeChange,
      recommendation,
      onApplyRecommendation,
      labels,
      constraintsPanel,
      constraintsPanelOpen = false,
      onToggleConstraintsPanel,
      constraintsSummary,
      constraintsLabel,
      completionSuggestions,
      onApplyCompletionSuggestion,
      onDismissCompletionSuggestions
    },
    forwardedRef
  ) => {
    const { prompt, setPrompt, isGenerating, interactionMode } = useAIStore();
    const mode = interactionMode === 'edit' ? 'edit' : 'create';
    const localRef = useRef<HTMLTextAreaElement | null>(null);

    const assignRef = (node: HTMLTextAreaElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    useEffect(() => {
      const el = localRef.current;
      if (!el) return;
      el.style.height = '0px';
      const next = Math.min(260, Math.max(86, el.scrollHeight));
      el.style.height = `${next}px`;
    }, [prompt]);

    const displayedPlaceholder =
      placeholder ||
      (mode === 'edit'
        ? [
            'Fix/Edit Request',
            '1) What is wrong now?',
            '2) What exact behavior do you want?',
            '3) Which file/section should change?',
            '4) What must stay unchanged?'
          ].join('\n')
        : [
            'Project Brief',
            '1) Goal and target audience',
            '2) Main pages/sections',
            '3) Preferred style (frontend-first visual direction)',
            '4) Required interactions/features',
            '5) Constraints (performance, accessibility, responsive)'
          ].join('\n'));

    const remaining = useMemo(() => MAX_PROMPT_CHARS - prompt.length, [prompt.length]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (onSubmit && prompt.trim()) onSubmit();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_PROMPT_CHARS) setPrompt(value);
      else setPrompt(value.slice(0, MAX_PROMPT_CHARS));
    };

    return (
      <Shell className={className} $mode={mode}>
        <TopBar $mode={mode}>
          <TopLeft>
            <ModeBadge $mode={mode}>{mode === 'edit' ? 'Edit Mode' : 'Create Mode'}</ModeBadge>
            <TopInfo>{mode === 'edit' ? 'Targeted project updates' : 'Describe your request clearly'}</TopInfo>
          </TopLeft>
          <CounterPill $warn={remaining < 120}>{remaining.toLocaleString()} chars</CounterPill>
        </TopBar>

        <ProjectModeRow>
          <ProjectModeLabel>{labels?.projectModeLabel || 'Project Mode'}</ProjectModeLabel>
          <ProjectModeSwitch aria-label={labels?.projectModeLabel || 'Project mode'}>
            <ProjectModeButton
              type="button"
              $active={projectMode === 'FRONTEND_ONLY'}
              onClick={() => onProjectModeChange('FRONTEND_ONLY')}
              disabled={isGenerating}
            >
              {labels?.frontendLabel || 'Frontend'}
            </ProjectModeButton>
          </ProjectModeSwitch>
        </ProjectModeRow>

        {recommendation || (completionSuggestions && completionSuggestions.length > 0) ? (
          <NoticeStack>
            {recommendation ? (
              <NoticeCard $tone="warning">
                <NoticeText>{recommendation.reason}</NoticeText>
                <NoticeActions>
                  <NoticeActionButton type="button" onClick={onApplyRecommendation}>
                    {labels?.applyLabel || 'Apply'}
                  </NoticeActionButton>
                </NoticeActions>
              </NoticeCard>
            ) : null}

            {completionSuggestions && completionSuggestions.length > 0 ? (
              <>
                {completionSuggestions.map((suggestion, idx) => (
                  <NoticeCard $tone="info" key={suggestion.actionLabel + idx}>
                    <NoticeText>{suggestion.question}</NoticeText>
                    <NoticeActions>
                      <NoticeActionButton type="button" onClick={() => onApplyCompletionSuggestion?.(idx)}>
                        {suggestion.actionLabel || 'Apply'}
                      </NoticeActionButton>
                    </NoticeActions>
                  </NoticeCard>
                ))}
                <NoticeDismissButton
                  type="button"
                  onClick={onDismissCompletionSuggestions}
                  aria-label="Dismiss all suggestions"
                  style={{ alignSelf: 'flex-end', marginTop: '-4px' }}
                >
                  × Dismiss All
                </NoticeDismissButton>
              </>
            ) : null}
          </NoticeStack>
        ) : null}

        {constraintsPanel ? (
          <ConstraintsShell>
            <ConstraintsHeader
              type="button"
              onClick={onToggleConstraintsPanel}
              aria-expanded={constraintsPanelOpen}
            >
              <span>{constraintsLabel || 'Feature Constraints'}</span>
              <ConstraintsSummary>{constraintsSummary || ''}</ConstraintsSummary>
            </ConstraintsHeader>
            <ConstraintsBody $open={constraintsPanelOpen}>
              <ConstraintsScroll className="scrollbar-thin scrollbar-glass">{constraintsPanel}</ConstraintsScroll>
            </ConstraintsBody>
          </ConstraintsShell>
        ) : null}

        <Composer>
          <InputWrap>
            <Input
              ref={assignRef}
              value={prompt}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={displayedPlaceholder}
              disabled={isGenerating}
              spellCheck={false}
            />
            <InputHint>
              Enter to send • Shift+Enter for new line • Better results: include pages, style, and must-have interactions.
            </InputHint>
          </InputWrap>
          {controls ? <Controls>{controls}</Controls> : null}
        </Composer>
      </Shell>
    );
  }
);

PromptInput.displayName = 'PromptInput';
