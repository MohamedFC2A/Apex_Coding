import React from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';

const shimmer = keyframes`
  0% { transform: translateX(-60%) rotate(12deg); opacity: 0.0; }
  30% { opacity: 0.9; }
  100% { transform: translateX(120%) rotate(12deg); opacity: 0.0; }
`;

const ButtonRoot = styled(motion.button)`
  position: relative;
  height: 44px;
  padding: 0 18px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.16), rgba(168, 85, 247, 0.14));
  color: rgba(255, 255, 255, 0.92);
  font-weight: 800;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  gap: 10px;
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
    background: radial-gradient(120px 40px at 10% 50%, rgba(34, 211, 238, 0.30), transparent 70%),
      radial-gradient(120px 40px at 90% 50%, rgba(168, 85, 247, 0.28), transparent 70%);
    opacity: 0.9;
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
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.35),
      transparent
    );
    filter: blur(2px);
    animation: ${shimmer} 1.3s linear infinite;
  }
`;

const Label = styled.span`
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  min-width: fit-content;
`;

const SwapSlot = styled.span`
  display: inline-grid;
  grid-template-areas: 'stack';
  align-items: center;
`;

const IconSlot = styled(SwapSlot)`
  width: 18px;
  height: 18px;
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

interface GenerateButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
}

export const GenerateButton: React.FC<GenerateButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  label = 'Generate',
  loadingLabel = 'Generating…',
  className
}) => {
  return (
    <ButtonRoot
      className={className}
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-label={isLoading ? loadingLabel : label}
      whileHover={disabled || isLoading ? undefined : { scale: 1.02 }}
      whileTap={disabled || isLoading ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
    >
      <Shine $active={!isLoading && !disabled} />
      <Label>
        <IconSlot aria-hidden="true">
          <SwapLayer $visible={!isLoading}>
            <Sparkles size={18} />
          </SwapLayer>
          <SwapLayer $visible={isLoading}>
            <Loader2 size={18} className="animate-spin" />
          </SwapLayer>
        </IconSlot>
        <SwapSlot aria-hidden="true">
          <SwapLayer $visible={!isLoading}>{label}</SwapLayer>
          <SwapLayer $visible={isLoading}>{loadingLabel}</SwapLayer>
        </SwapSlot>
      </Label>
    </ButtonRoot>
  );
};
