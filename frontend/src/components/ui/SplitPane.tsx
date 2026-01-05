import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

const Root = styled.div`
  height: 100%;
  display: flex;
  min-width: 0;
  position: relative;
`;

const Pane = styled.div<{ $basis: string }>`
  flex: 0 0 ${(p) => p.$basis};
  min-width: 0;
  height: 100%;
`;

const Fill = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
`;

const Divider = styled.div`
  width: 10px;
  cursor: col-resize;
  display: grid;
  place-items: center;
  position: relative;
  flex: 0 0 10px;

  &::before {
    content: '';
    width: 2px;
    height: 60%;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.25) inset,
      0 0 18px rgba(34, 211, 238, 0.18);
    transition: background 160ms ease, box-shadow 160ms ease;
  }

  &:hover::before {
    background: rgba(255, 255, 255, 0.22);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.25) inset,
      0 0 28px rgba(168, 85, 247, 0.22);
  }
`;

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftPercent?: number; // 0..100
  minLeftPx?: number;
  minRightPx?: number;
  className?: string;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  initialLeftPercent = 55,
  minLeftPx = 360,
  minRightPx = 360,
  className
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(initialLeftPercent);
  const draggingRef = useRef(false);

  const clampPercent = useCallback(
    (percent: number) => {
      const root = rootRef.current;
      if (!root) return Math.max(10, Math.min(90, percent));

      const width = root.getBoundingClientRect().width;
      const minLeft = (minLeftPx / Math.max(width, 1)) * 100;
      const minRight = (minRightPx / Math.max(width, 1)) * 100;

      const clamped = Math.max(minLeft, Math.min(100 - minRight, percent));
      return Math.max(5, Math.min(95, clamped));
    },
    [minLeftPx, minRightPx]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const root = rootRef.current;
      if (!root) return;

      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = (x / rect.width) * 100;
      setLeftPercent(clampPercent(percent));
    },
    [clampPercent]
  );

  const stopDragging = useCallback(() => {
    draggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const startDragging = useCallback(() => {
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopDragging);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [onMouseMove, stopDragging]);

  useEffect(() => {
    setLeftPercent(clampPercent(initialLeftPercent));
  }, [clampPercent, initialLeftPercent]);

  const leftBasis = useMemo(() => `${leftPercent}%`, [leftPercent]);

  return (
    <Root ref={rootRef} className={className}>
      <Pane $basis={leftBasis}>{left}</Pane>
      <Divider role="separator" aria-orientation="vertical" onMouseDown={startDragging} />
      <Fill>{right}</Fill>
    </Root>
  );
};

