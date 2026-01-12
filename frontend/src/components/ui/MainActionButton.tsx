import React from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { Sparkles, Brain, Loader2, Wrench, X, Play } from 'lucide-react';

export type MainActionState = 'idle' | 'planning' | 'coding' | 'interrupted' | 'done';

const shimmer = keyframes`
  0% { transform: translateX(-60%) rotate(12deg); opacity: 0.0; }
  30% { opacity: 0.9; }
  100% { transform: translateX(120%) rotate(12deg); opacity: 0.0; }
`;

const ButtonRoot = styled(motion.button)<{ $state: MainActionState }>`
  position: relative;
  height: 50px;
  padding: 0 20px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.95);
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  backdrop-filter: blur(20px);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.50),
    0 0 0 1px rgba(0, 0, 0, 0.2) inset,
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  overflow: hidden;
  font-size: 13px;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    filter: grayscale(0.25);
  }

  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    background: ${(p) => {
      if (p.$state === 'planning') {
        return `radial-gradient(160px 70px at 16% 38%, rgba(168, 85, 247, 0.35), transparent 70%),
          radial-gradient(160px 70px at 84% 62%, rgba(34, 211, 238, 0.26), transparent 70%)`;
      }
      if (p.$state === 'coding') {
        return `radial-gradient(160px 70px at 16% 38%, rgba(34, 211, 238, 0.35), transparent 70%),
          radial-gradient(160px 70px at 84% 62%, rgba(250, 204, 21, 0.22), transparent 70%)`;
      }
      if (p.$state === 'done') {
        return `radial-gradient(160px 70px at 16% 38%, rgba(34, 197, 94, 0.30), transparent 70%),
          radial-gradient(160px 70px at 84% 62%, rgba(168, 85, 247, 0.22), transparent 70%)`;
      }
      return `radial-gradient(160px 70px at 16% 38%, rgba(34, 211, 238, 0.30), transparent 70%),
        radial-gradient(160px 70px at 84% 62%, rgba(168, 85, 247, 0.26), transparent 70%)`;
    }};
    opacity: 0.98;
    filter: blur(14px);
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
  width: 22px;
  height: 22px;
  min-width: 22px;

  & svg {
    width: 22px;
    height: 22px;
    min-width: 22px;
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
  if (state === 'planning') return 240;
  if (state === 'coding') return 200;
  if (state === 'interrupted') return 200;
  if (state === 'done') return 180;
  return 190;
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
      layout
      animate={{ width: getStateWidth(state) }}
      whileHover={isDisabled ? undefined : { scale: 1.03, y: -2 }}
      whileTap={isDisabled ? undefined : { scale: 0.97, y: 0 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
    >
      <Shine $active={!isDisabled} />
      <Label>
        <IconSlot aria-hidden="true">
          <SwapLayer $visible={state === 'idle'}>
            <Sparkles size={18} />
          </SwapLayer>
          <SwapLayer $visible={state === 'planning'}>
            <X size={18} />
          </SwapLayer>
          <SwapLayer $visible={state === 'coding'}>
            <X size={18} />
          </SwapLayer>
          <SwapLayer $visible={state === 'interrupted'}>
            <Play size={18} />
          </SwapLayer>
          <SwapLayer $visible={state === 'done'}>
            <Wrench size={18} />
          </SwapLayer>
        </IconSlot>
        <SwapSlot aria-hidden="true">
          <SwapLayer $visible={state === 'idle'}>Generate</SwapLayer>
          <SwapLayer $visible={state === 'planning'}>Stop</SwapLayer>
          <SwapLayer $visible={state === 'coding'}>Stop</SwapLayer>
          <SwapLayer $visible={state === 'interrupted'}>Continue</SwapLayer>
          <SwapLayer $visible={state === 'done'}>Fix / Edit</SwapLayer>
        </SwapSlot>
      </Label>
    </ButtonRoot>
  );
};
