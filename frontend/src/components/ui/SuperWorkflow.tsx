import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAIStore } from '@/stores/aiStore';
import { ZoomIn, ZoomOut, Move } from 'lucide-react';

const Wrap = styled.div`
  position: relative;
  width: 100%;
  height: 360px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: radial-gradient(180px 80px at 20% 30%, rgba(56,189,248,0.10), transparent 60%),
              radial-gradient(200px 120px at 80% 70%, rgba(168,85,247,0.10), transparent 60%);
  overflow: hidden;
`;

const Controls = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  z-index: 2;
  button {
    height: 28px;
    width: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.90);
    cursor: pointer;
  }
`;

const Canvas = styled.div`
  position: absolute;
  inset: 0;
  touch-action: none;
`;

const Node = styled.div<{ $active?: boolean }>`
  position: absolute;
  min-width: 160px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.16);
  background: ${(p) => (p.$active ? 'linear-gradient(135deg, rgba(126,34,206,0.28), rgba(234,179,8,0.24))' : 'rgba(255,255,255,0.06)')};
  color: rgba(255,255,255,0.92);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: ${(p) => (p.$active ? '0 0 18px rgba(168,85,247,0.55), 0 0 8px rgba(234,179,8,0.45)' : 'none')};
  pointer-events: none;
`;

const EdgeSvg = styled.svg`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

interface Point {
  x: number;
  y: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const SuperWorkflow: React.FC = () => {
  const { isGenerating } = useAIStore();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<Point | null>(null);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setStage(0);
      return;
    }
    let i = 0;
    const timer = window.setInterval(() => {
      i = (i + 1) % 5;
      setStage(i);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: e.clientX - d.x, y: e.clientY - d.y });
  };

  const onPointerUp = () => {
    setDragging(false);
    dragRef.current = null;
  };

  const zoom = (delta: number) => {
    setScale((s) => {
      const next = Math.max(0.6, Math.min(2.2, s + delta));
      return Math.round(next * 100) / 100;
    });
  };

  const base: Point[] = [
    { x: 80, y: 120 },
    { x: 320, y: 80 },
    { x: 580, y: 120 },
    { x: 820, y: 160 },
    { x: 1080, y: 140 }
  ];

  const nodes = [
    { label: 'Entry Point', pos: base[0] },
    { label: 'Logic Gates', pos: base[1] },
    { label: 'Data Flow', pos: base[2] },
    { label: 'Components Tree', pos: base[3] },
    { label: 'Final Output', pos: base[4] }
  ];

  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4]
  ] as const;

  const toScreen = (p: Point): Point => ({
    x: p.x * scale + offset.x,
    y: p.y * scale + offset.y
  });

  return (
    <Wrap>
      <Controls>
        <button type="button" aria-label="Zoom in" onClick={() => zoom(0.15)}>
          <ZoomIn size={16} />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoom(-0.15)}>
          <ZoomOut size={16} />
        </button>
        <button type="button" aria-label="Drag">
          <Move size={16} />
        </button>
      </Controls>
      <Canvas
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <EdgeSvg viewBox="0 0 1200 400" preserveAspectRatio="none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.6)" />
            </marker>
          </defs>
          {edges.map(([a, b], idx) => {
            const p1 = nodes[a].pos;
            const p2 = nodes[b].pos;
            const s1 = toScreen(p1);
            const s2 = toScreen(p2);
            const mx = lerp(s1.x, s2.x, 0.5);
            const my = lerp(s1.y, s2.y, 0.5);
            return (
              <path
                key={idx}
                d={`M ${s1.x},${s1.y} C ${mx},${s1.y} ${mx},${s2.y} ${s2.x},${s2.y}`}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={2}
                fill="none"
                markerEnd="url(#arrow)"
              />
            );
          })}
        </EdgeSvg>
        {nodes.map((n, i) => {
          const p = toScreen(n.pos);
          const active = stage >= i;
          return (
            <Node
              key={n.label}
              $active={active}
              style={{
                transform: `translate(${p.x - 80}px, ${p.y - 20}px) scale(${scale})`
              }}
            >
              {n.label}
            </Node>
          );
        })}
      </Canvas>
    </Wrap>
  );
};

