'use client';

import React, { useMemo } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Zap } from 'lucide-react';

export interface PlanChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.45), 0 0 18px rgba(59, 130, 246, 0.18);
  }
  50% {
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.75), 0 0 26px rgba(59, 130, 246, 0.35);
  }
  100% {
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.45), 0 0 18px rgba(59, 130, 246, 0.18);
  }
`;

const liquidFlow = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 180% 50%; }
`;

const sheen = keyframes`
  0% { transform: translateX(-60%); opacity: 0; }
  20% { opacity: 0.55; }
  100% { transform: translateX(160%); opacity: 0; }
`;

const mercuryPulse = keyframes`
  0% { opacity: 0.85; filter: saturate(1.0); }
  50% { opacity: 1; filter: saturate(1.15); }
  100% { opacity: 0.85; filter: saturate(1.0); }
`;

const pendingStyles = css`
  border-color: rgba(255, 255, 255, 0.16);
  opacity: 0.6;
`;

const activeStyles = css`
  border-color: rgba(59, 130, 246, 0.6);
  animation: ${pulse} 1.6s ease-in-out infinite;
`;

const doneStyles = css`
  border-color: rgba(34, 197, 94, 0.7);
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.22);
`;

const Panel = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(24px);
  box-shadow:
    0 22px 60px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  overflow: hidden;
`;

const Header = styled.div`
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 800;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ListContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

const Empty = styled.div`
  height: 100%;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.50);
  font-size: 13px;
  text-align: center;
  padding: 18px;
`;

const ProgressRail = styled.div`
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.10);
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${(p) => `${Math.round(p.$pct * 100)}%`};
  position: relative;
  background: linear-gradient(
    90deg,
    rgba(34, 211, 238, 0.92),
    rgba(168, 85, 247, 0.88),
    rgba(34, 211, 238, 0.92)
  );
  background-size: 220% 100%;
  animation: ${liquidFlow} 2.2s linear infinite, ${mercuryPulse} 2.6s ease-in-out infinite;
  transition: width 240ms ease;

  &::after {
    content: '';
    position: absolute;
    top: -2px;
    bottom: -2px;
    left: 0;
    width: 55%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
    filter: blur(2px);
    animation: ${sheen} 1.5s linear infinite;
    opacity: 0.22;
    pointer-events: none;
  }
`;

const ProgressMeta = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
`;

const Section = styled.div`
  display: grid;
  gap: 10px;
`;

const SectionTitle = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
`;

const SectionEmpty = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 10px;
  text-align: center;
`;

const ItemCard = styled(motion.div)<{ $status: 'pending' | 'active' | 'done' }>`
  display: grid;
  grid-template-columns: 24px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.035);
  backdrop-filter: blur(18px);
  color: rgba(255, 255, 255, 0.86);

  ${(p) => p.$status === 'pending' && pendingStyles}
  ${(p) => p.$status === 'active' && activeStyles}
  ${(p) => p.$status === 'done' && doneStyles}
`;

const ItemTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.9);
`;

const ItemStatus = styled.div<{ $status: 'pending' | 'active' | 'done' }>`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${(p) => {
    if (p.$status === 'active') return 'rgba(59, 130, 246, 0.95)';
    if (p.$status === 'done') return 'rgba(34, 197, 94, 0.95)';
    return 'rgba(255, 255, 255, 0.45)';
  }};
`;

const StatusStack = styled.div`
  display: grid;
  gap: 4px;
`;

const FRONTEND_HINTS = [
  'frontend',
  'ui',
  'client',
  'component',
  'layout',
  'style',
  'design',
  'page',
  'view',
  'ux',
  'css',
  'react',
  'vite',
  'svelte',
  'vue'
];

const BACKEND_HINTS = [
  'backend',
  'api',
  'server',
  'database',
  'db',
  'auth',
  'route',
  'controller',
  'model',
  'endpoint',
  'express',
  'flask',
  'fastapi',
  'node',
  'python'
];

const categorizeStep = (title: string) => {
  const lower = title.toLowerCase();
  if (BACKEND_HINTS.some((hint) => lower.includes(hint))) return 'backend';
  if (FRONTEND_HINTS.some((hint) => lower.includes(hint))) return 'frontend';
  return 'frontend';
};

interface PlanChecklistProps {
  items: PlanChecklistItem[];
  currentStepId?: string;
  embedded?: boolean;
  className?: string;
}

export const PlanChecklist: React.FC<PlanChecklistProps> = ({
  items,
  currentStepId,
  embedded = false,
  className
}) => {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const pct = total > 0 ? completed / total : 0;

  const grouped = useMemo(() => {
    const frontend: PlanChecklistItem[] = [];
    const backend: PlanChecklistItem[] = [];

    for (const item of items) {
      const group = categorizeStep(item.title);
      if (group === 'backend') backend.push(item);
      else frontend.push(item);
    }

    return { frontend, backend };
  }, [items]);

  const renderItem = (item: PlanChecklistItem) => {
    const isActive = currentStepId === item.id && !item.completed;
    const status = item.completed ? 'done' : isActive ? 'active' : 'pending';
    const statusLabel = status === 'pending' ? 'Pending' : status === 'active' ? 'Working' : 'Done';

    return (
      <ItemCard
        key={item.id}
        $status={status}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {status === 'done' ? (
          <CheckCircle2 size={20} color="rgba(34, 197, 94, 0.95)" />
        ) : status === 'active' ? (
          <Zap size={20} color="rgba(59, 130, 246, 0.95)" />
        ) : (
          <Circle size={20} color="rgba(255, 255, 255, 0.4)" />
        )}
        <StatusStack>
          <ItemTitle>{item.title}</ItemTitle>
          {status === 'active' && <ItemStatus $status={status}>Working...</ItemStatus>}
        </StatusStack>
        <ItemStatus $status={status}>{statusLabel}</ItemStatus>
      </ItemCard>
    );
  };

  const content = (
    <>
      {total > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <ProgressMeta>
            <span>Mission Progress</span>
            <span>{completed}/{total}</span>
          </ProgressMeta>
          <ProgressRail aria-hidden="true">
            <ProgressFill $pct={pct} />
          </ProgressRail>
        </div>
      )}
      {total === 0 ? (
        <Empty>Click “Plan” to generate a step-by-step mission.</Empty>
      ) : (
        <ListContainer className="scrollbar-thin scrollbar-glass plan-container">
          <Section>
            <SectionTitle>Frontend Architecture</SectionTitle>
            {grouped.frontend.length === 0
              ? <SectionEmpty>No frontend tasks yet.</SectionEmpty>
              : grouped.frontend.map(renderItem)}
          </Section>
          <Section>
            <SectionTitle>Backend Logic</SectionTitle>
            {grouped.backend.length === 0
              ? <SectionEmpty>No backend tasks yet.</SectionEmpty>
              : grouped.backend.map(renderItem)}
          </Section>
        </ListContainer>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className={className} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
        <Body>{content}</Body>
      </div>
    );
  }

  return (
    <Panel className={className}>
      <Header>Mission Control</Header>
      <Body>{content}</Body>
    </Panel>
  );
};
