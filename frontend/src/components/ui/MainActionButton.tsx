import React from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { Sparkles, Brain, Loader2, Wrench } from 'lucide-react';

export type MainActionState = 'idle' | 'planning' | 'coding' | 'done';

const shimmer = keyframes`
  0% { transform: translateX(-60%) rotate(12deg); opacity: 0.0; }
  30% { opacity: 0.9; }
  100% { transform: translateX(120%) rotate(12deg); opacity: 0.0; }
`;

const ButtonRoot = styled(motion.button)<{ $state: MainActionState }>`
  position: relative;
  height: 46px;
  padding: 0 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.92);
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  backdrop-filter: blur(16px);
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(0, 0, 0, 0.2) inset,
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  overflow: hidden;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    filter: grayscale(0.2);
  }

  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    background: ${(p) => {
      if (p.$state === 'planning') {
        return `radial-gradient(140px 60px at 18% 40%, rgba(168, 85, 247, 0.30), transparent 70%),
          radial-gradient(140px 60px at 82% 60%, rgba(34, 211, 238, 0.22), transparent 70%)`;
      }
      if (p.$state === 'coding') {
        return `radial-gradient(140px 60px at 18% 40%, rgba(34, 211, 238, 0.30), transparent 70%),
          radial-gradient(140px 60px at 82% 60%, rgba(250, 204, 21, 0.18), transparent 70%)`;
      }
      if (p.$state === 'done') {
        return `radial-gradient(140px 60px at 18% 40%, rgba(34, 197, 94, 0.26), transparent 70%),
          radial-gradient(140px 60px at 82% 60%, rgba(168, 85, 247, 0.18), transparent 70%)`;
      }
      return `radial-gradient(140px 60px at 18% 40%, rgba(34, 211, 238, 0.26), transparent 70%),
        radial-gradient(140px 60px at 82% 60%, rgba(168, 85, 247, 0.22), transparent 70%)`;
    }};
    opacity: 0.95;
    filter: blur(12px);
    pointer-events: none;
  }
`;

const Shine = styled.div<{ $active: boolean }>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: ${(p) => (p.$active ? 1 : 0)};
  transition: opacity 200ms ease;

  &::after {
    content: '';
    position: absolute;
    top: -40%;
    left: -30%;
    width: 45%;
    height: 180%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.30), transparent);
    filter: blur(2px);
    animation: ${shimmer} 1.35s linear infinite;
  }
`;

const Label = styled.span`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
`;

const SwapSlot = styled.span`
  display: inline-grid;
  grid-template-areas: 'stack';
  align-items: center;
  min-width: fit-content;
`;

const IconSlot = styled(SwapSlot)`
  width: 20px;
  height: 20px;
  min-width: 20px;

  & svg {
    width: 20px;
    height: 20px;
    min-width: 20px;
  }
`;

const SwapLayer = styled.span<{ $visible: boolean }>`
  grid-area: stack;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: scale(${(p) => (p.$visible ? 1 : 0.92)});
  transition: opacity 160ms ease, transform 160ms ease;
  pointer-events: none;
`;

const getStateWidth = (state: MainActionState) => {
  if (state === 'planning') return 220;
  if (state === 'coding') return 180;
  if (state === 'done') return 160;
  return 170;
};

export interface MainActionButtonProps {
  state: MainActionState;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export const MainActionButton: React.FC<MainActionButtonProps> = ({ state, disabled, onClick, className }) => {
  const isBusy = state === 'planning' || state === 'coding';

  return (
    <ButtonRoot
      className={className}
      type="button"
      onClick={onClick}
      disabled={disabled || isBusy}
      aria-busy={isBusy}
      aria-label={
        state === 'planning'
          ? 'Architecting'
          : state === 'coding'
            ? 'Coding'
            : state === 'done'
              ? 'Fix or edit'
              : 'Generate'
      }
      $state={state}
      layout
      animate={{ width: getStateWidth(state) }}
      whileHover={disabled || isBusy ? undefined : { scale: 1.02 }}
      whileTap={disabled || isBusy ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
    >
      <Shine $active={!disabled && !isBusy} />
      <Label>
        <IconSlot aria-hidden="true">
          <SwapLayer $visible={state === 'idle'}>
            <Sparkles size={18} />
          </SwapLayer>
          <SwapLayer $visible={state === 'planning'}>
            <Brain size={18} />
          </SwapLayer>
          <SwapLayer $visible={state === 'coding'}>
            <Loader2 size={18} className="animate-spin" />
          </SwapLayer>
          <SwapLayer $visible={state === 'done'}>
            <Wrench size={18} />
          </SwapLayer>
        </IconSlot>
        <SwapSlot aria-hidden="true">
          <SwapLayer $visible={state === 'idle'}>Generate</SwapLayer>
          <SwapLayer $visible={state === 'planning'}>Architecting…</SwapLayer>
          <SwapLayer $visible={state === 'coding'}>Coding…</SwapLayer>
          <SwapLayer $visible={state === 'done'}>Fix / Edit</SwapLayer>
        </SwapSlot>
      </Label>
    </ButtonRoot>
  );
};
