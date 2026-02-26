import React from 'react';
import styled from 'styled-components';
import { Sparkles, Wrench, X, Play } from 'lucide-react';

export type MainActionState = 'idle' | 'planning' | 'coding' | 'interrupted' | 'done';

const ButtonRoot = styled.button<{ $state: MainActionState }>`
  position: relative;
  height: 48px;
  padding: 0 18px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: ${(p) => {
    if (p.$state === 'planning' || p.$state === 'coding') return 'rgba(239, 68, 68, 0.15)';
    if (p.$state === 'done') return 'rgba(16, 185, 129, 0.14)';
    if (p.$state === 'interrupted') return 'rgba(59, 130, 246, 0.16)';
    return 'rgba(34, 211, 238, 0.18)';
  }};
  color: rgba(255, 255, 255, 0.98);
  font-weight: 800;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  backdrop-filter: blur(16px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  font-size: 14px;
  min-width: 170px;
  max-width: 100%;
  transition: border-color 140ms ease, background 140ms ease, transform 120ms ease, opacity 140ms ease, box-shadow 140ms ease;

  &:disabled {
    opacity: 0.52;
    cursor: not-allowed;
    transform: none;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  }

  &:not(:disabled):active {
    transform: translateY(0);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  }

  @media (max-width: 900px) {
    min-width: 0;
  }

  @media (max-width: 768px) {
    height: 46px;
    padding: 0 16px;
    font-size: 13px;
    border-radius: 12px;
    width: 100%;
    min-width: 0;
  }
`;

const Label = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
`;

const IconSlot = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
`;

const getLabel = (state: MainActionState) => {
  if (state === 'planning' || state === 'coding') return 'Stop';
  if (state === 'interrupted') return 'Continue';
  if (state === 'done') return 'Fix / Edit';
  return 'Generate';
};

const getIcon = (state: MainActionState) => {
  if (state === 'planning' || state === 'coding') return <X size={20} />;
  if (state === 'interrupted') return <Play size={20} />;
  if (state === 'done') return <Wrench size={20} />;
  return <Sparkles size={20} />;
};

export interface MainActionButtonProps {
  state: MainActionState;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export const MainActionButton: React.FC<MainActionButtonProps> = ({ state, disabled, onClick, className }) => {
  const isBusy = state === 'planning' || state === 'coding';
  const isDisabled = Boolean(disabled);

  return (
    <ButtonRoot
      className={className}
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={isBusy}
      aria-label={
        state === 'planning' || state === 'coding'
          ? 'Stop'
            : state === 'interrupted'
              ? 'Continue'
            : state === 'done'
                ? 'Fix or edit'
                : 'Generate'
      }
      $state={state}
    >
      <Label>
        <IconSlot aria-hidden="true">{getIcon(state)}</IconSlot>
        <span>{getLabel(state)}</span>
      </Label>
    </ButtonRoot>
  );
};
