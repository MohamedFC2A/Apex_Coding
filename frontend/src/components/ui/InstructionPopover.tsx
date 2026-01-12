import React, { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openNow: () => void;
  scheduleOpen: () => void;
  scheduleClose: () => void;
  triggerEl: HTMLElement | null;
  setTriggerEl: (el: HTMLElement | null) => void;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

const Root = styled.div`
  position: relative;
  display: inline-flex;
`;

const ContentRoot = styled.div<{ $open: boolean; $left: number; $top: number; $placement: 'top' | 'bottom' }>`
  position: fixed;
  left: ${(p) => `${p.$left}px`};
  top: ${(p) => `${p.$top}px`};
  transform: translateX(-50%)
    translateY(${(p) => {
      if (p.$open) return '0px';
      return p.$placement === 'bottom' ? '-6px' : '6px';
    }});
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity 140ms cubic-bezier(0.2, 0.9, 0.2, 1), transform 140ms cubic-bezier(0.2, 0.9, 0.2, 1);
  z-index: 9999;
`;

const Card = styled.div`
  width: 320px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(9, 12, 18, 0.78);
  backdrop-filter: blur(22px);
  box-shadow:
    0 26px 74px rgba(0, 0, 0, 0.70),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  padding: 14px 14px 13px;
`;

const Arrow = styled.div<{ $placement: 'top' | 'bottom' }>`
  position: absolute;
  left: 50%;
  ${(p) => (p.$placement === 'bottom' ? 'top: -6px;' : 'bottom: -6px;')}
  width: 12px;
  height: 12px;
  transform: translateX(-50%) rotate(45deg);
  background: rgba(9, 12, 18, 0.78);
  border-left: 1px solid rgba(255, 255, 255, 0.14);
  border-top: 1px solid rgba(255, 255, 255, 0.14);
`;

const HeadingText = styled.div`
  font-weight: 900;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.78);
`;

const DescriptionText = styled.div`
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  color: rgba(255, 255, 255, 0.68);
`;

const TriggerWrap = styled.span`
  display: inline-flex;
`;

export interface PopoverProps {
  children: React.ReactNode;
  openDelayMs?: number;
  closeDelayMs?: number;
}

const getOverlayRoot = () => {
  if (typeof document === 'undefined') return null;
  const existing = document.getElementById('overlay-root');
  if (existing) return existing;
  const root = document.createElement('div');
  root.id = 'overlay-root';
  document.body.appendChild(root);
  return root;
};

export const Popover: React.FC<PopoverProps> = ({ children, openDelayMs = 0, closeDelayMs = 0 }) => {
  const [open, setOpen] = useState(false);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    closeTimerRef.current = null;
  };

  const openNow = () => {
    clearTimers();
    setOpen(true);
  };

  const scheduleOpen = () => {
    clearTimers();
    openTimerRef.current = window.setTimeout(() => setOpen(true), openDelayMs);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), closeDelayMs);
  };

  const context = useMemo<PopoverContextValue>(
    () => ({ open, setOpen, openNow, scheduleOpen, scheduleClose, triggerEl, setTriggerEl }),
    [open, openNow, scheduleOpen, scheduleClose, triggerEl]
  );

  return (
    <PopoverContext.Provider value={context}>
      <Root>{children}</Root>
    </PopoverContext.Provider>
  );
};

export const Trigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('InstructionPopover.Trigger must be used within <Popover>.');

  return (
    <TriggerWrap
      ref={(node) => ctx.setTriggerEl(node as HTMLElement | null)}
      onMouseEnter={ctx.scheduleOpen}
      onMouseLeave={ctx.scheduleClose}
      onClick={() => {
        if (ctx.open) ctx.setOpen(false);
        else ctx.openNow();
      }}
      onFocusCapture={ctx.openNow}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) ctx.setOpen(false);
      }}
    >
      {children}
    </TriggerWrap>
  );
};

export const Content: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('InstructionPopover.Content must be used within <Popover>.');

  const overlayRoot = useMemo(() => getOverlayRoot(), []);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; placement: 'top' | 'bottom' }>({
    left: 0,
    top: 0,
    placement: 'bottom'
  });

  useLayoutEffect(() => {
    if (!ctx.open) return;
    if (!ctx.triggerEl) return;
    if (!cardRef.current) return;

    const margin = 10;
    const gap = 10;

    const update = () => {
      if (!ctx.triggerEl || !cardRef.current) return;

      const rect = ctx.triggerEl.getBoundingClientRect();
      const cardRect = cardRef.current.getBoundingClientRect();

      const idealLeft = rect.left + rect.width / 2;
      const clampedLeft = Math.min(
        Math.max(idealLeft, margin + cardRect.width / 2),
        window.innerWidth - margin - cardRect.width / 2
      );

      const bottomTop = rect.bottom + gap;
      const bottomFits = bottomTop + cardRect.height <= window.innerHeight - margin;
      const topTop = rect.top - gap - cardRect.height;
      const topFits = topTop >= margin;

      const placement: 'top' | 'bottom' = bottomFits || !topFits ? 'bottom' : 'top';
      const top = placement === 'bottom' ? bottomTop : Math.max(margin, topTop);

      setPos({ left: clampedLeft, top, placement });
    };

    update();

    const onScroll = () => update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [ctx.open, ctx.triggerEl]);

  useLayoutEffect(() => {
    if (!ctx.open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') ctx.setOpen(false);
    };

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (cardRef.current && cardRef.current.contains(target)) return;
      if (ctx.triggerEl && ctx.triggerEl.contains(target)) return;
      ctx.setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [ctx.open, ctx.triggerEl, ctx.setOpen]);

  if (!overlayRoot) return null;

  return createPortal(
    <ContentRoot
      $open={ctx.open}
      $left={pos.left}
      $top={pos.top}
      $placement={pos.placement}
      role="tooltip"
      onMouseEnter={ctx.openNow}
      onMouseLeave={ctx.scheduleClose}
    >
      <Card ref={cardRef}>
        <Arrow $placement={pos.placement} />
        {children}
      </Card>
    </ContentRoot>,
    overlayRoot
  );
};

export const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <HeadingText>{children}</HeadingText>
);

export const Description: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DescriptionText>{children}</DescriptionText>
);
