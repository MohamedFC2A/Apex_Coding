'use client';

import React, { useMemo } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Zap } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export interface PlanChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  category?: 'config' | 'frontend' | 'backend' | 'integration' | 'testing' | 'deployment';
  files?: string[];
  description?: string;
}

const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.45), 0 0 18px rgba(245, 158, 11, 0.18);
  }
  50% {
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.75), 0 0 26px rgba(245, 158, 11, 0.35);
  }
  100% {
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.45), 0 0 18px rgba(245, 158, 11, 0.18);
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
  border-color: rgba(255, 255, 255, 0.08);
  opacity: 0.6;
`;

const activeStyles = css`
  border-color: rgba(245, 158, 11, 0.6);
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
  color: #F59E0B;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 900;
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
    #F59E0B,
    #FFFFFF,
    #F59E0B
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
    if (p.$status === 'active') return '#F59E0B';
    if (p.$status === 'done') return 'rgba(34, 197, 94, 0.95)';
    return 'rgba(255, 255, 255, 0.45)';
  }};
`;

const StatusStack = styled.div`
  display: grid;
  gap: 4px;
`;

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  config: { bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.4)', text: 'rgba(251, 191, 36, 0.95)' },
  frontend: { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.2)', text: 'rgba(255, 255, 255, 0.95)' },
  backend: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)', text: 'rgba(245, 158, 11, 0.95)' },
  integration: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.4)', text: 'rgba(34, 197, 94, 0.95)' },
  testing: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.4)', text: 'rgba(239, 68, 68, 0.95)' },
  deployment: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)', text: 'rgba(245, 158, 11, 0.95)' }
};

const getCategoryFromItem = (item: PlanChecklistItem): string => {
  if (item.category) return item.category;
  const lower = item.title.toLowerCase();
  if (['config', 'setup', 'package', 'tsconfig', 'tailwind', 'dependencies'].some(h => lower.includes(h))) return 'config';
  if (['backend', 'api', 'server', 'database', 'convex', 'auth', 'route'].some(h => lower.includes(h))) return 'backend';
  if (['test', 'spec', 'jest', 'cypress'].some(h => lower.includes(h))) return 'testing';
  if (['deploy', 'build', 'vercel', 'netlify'].some(h => lower.includes(h))) return 'deployment';
  if (['connect', 'integrate', 'hook'].some(h => lower.includes(h))) return 'integration';
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
  const { t, isRTL } = useLanguage();
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const pct = total > 0 ? completed / total : 0;

  const grouped = useMemo(() => {
    const config: PlanChecklistItem[] = [];
    const frontend: PlanChecklistItem[] = [];
    const backend: PlanChecklistItem[] = [];
    const integration: PlanChecklistItem[] = [];
    const testing: PlanChecklistItem[] = [];
    const deployment: PlanChecklistItem[] = [];

    for (const item of items) {
      const category = getCategoryFromItem(item);
      switch (category) {
        case 'config': config.push(item); break;
        case 'backend': backend.push(item); break;
        case 'integration': integration.push(item); break;
        case 'testing': testing.push(item); break;
        case 'deployment': deployment.push(item); break;
        default: frontend.push(item);
      }
    }

    return { config, frontend, backend, integration, testing, deployment };
  }, [items]);

  const renderItem = (item: PlanChecklistItem) => {
    const isActive = currentStepId === item.id && !item.completed;
    const status = item.completed ? 'done' : isActive ? 'active' : 'pending';
    const statusLabel = status === 'pending' 
      ? t('app.plan.status.pending') 
      : status === 'active' 
        ? t('app.plan.status.working') 
        : t('app.plan.status.done');
    const category = getCategoryFromItem(item);
    const categoryColors = CATEGORY_COLORS[category] || CATEGORY_COLORS.frontend;

    return (
      <ItemCard
        key={item.id}
        $status={status}
        initial={{ opacity: 0, x: isRTL ? 6 : -6 }}
        animate={{ opacity: 1, x: 0 }}
        style={{
          gridTemplateColumns: isRTL ? 'auto 1fr 24px' : '24px 1fr auto',
          textAlign: isRTL ? 'right' : 'left'
        }}
      >
        {isRTL && <ItemStatus $status={status}>{statusLabel}</ItemStatus>}
        
        {!isRTL && (status === 'done' ? (
          <CheckCircle2 size={20} color="rgba(34, 197, 94, 0.95)" />
        ) : status === 'active' ? (
          <Zap size={20} color="#F59E0B" />
        ) : (
          <Circle size={20} color="rgba(255, 255, 255, 0.4)" />
        ))}

        <StatusStack style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: categoryColors.bg,
              border: `1px solid ${categoryColors.border}`,
              color: categoryColors.text,
              padding: '2px 6px',
              borderRadius: 4
            }}>
              {category}
            </span>
          </div>
          <ItemTitle>{item.title}</ItemTitle>
          {item.description && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              {item.description}
            </div>
          )}
          {item.files && item.files.length > 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {item.files.slice(0, 5).map((file, idx) => (
                <span key={idx} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                  📄 {file.split('/').pop()}
                </span>
              ))}
              {item.files.length > 5 && (
                <span style={{ opacity: 0.6 }}>+{item.files.length - 5} {t('app.plan.more')}</span>
              )}
            </div>
          )}
          {status === 'active' && <ItemStatus $status={status}>{t('app.plan.status.working')}...</ItemStatus>}
        </StatusStack>

        {isRTL ? (status === 'done' ? (
          <CheckCircle2 size={20} color="rgba(34, 197, 94, 0.95)" />
        ) : status === 'active' ? (
          <Zap size={20} color="#F59E0B" />
        ) : (
          <Circle size={20} color="rgba(255, 255, 255, 0.4)" />
        )) : (
          <ItemStatus $status={status}>{statusLabel}</ItemStatus>
        )}
      </ItemCard>
    );
  };

  const content = (
    <>
      {total > 0 && (
        <div style={{ display: 'grid', gap: 8, direction: isRTL ? 'rtl' : 'ltr' }}>
          <ProgressMeta>
            <span>{t('app.plan.progress')}</span>
            <span>{completed}/{total}</span>
          </ProgressMeta>
          <ProgressRail aria-hidden="true">
            <ProgressFill $pct={pct} style={{ transformOrigin: isRTL ? 'right' : 'left' }} />
          </ProgressRail>
        </div>
      )}
      {total === 0 ? (
        <Empty>{t('app.plan.empty')}</Empty>
      ) : (
        <ListContainer className="scrollbar-thin scrollbar-glass plan-container" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
          {grouped.config.length > 0 && (
            <Section>
              <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>⚙️ {t('app.plan.category.config')}</SectionTitle>
              {grouped.config.map(renderItem)}
            </Section>
          )}
          {grouped.frontend.length > 0 && (
            <Section>
              <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>🎨 {t('app.plan.category.frontend')}</SectionTitle>
              {grouped.frontend.map(renderItem)}
            </Section>
          )}
          {grouped.backend.length > 0 && (
            <Section>
              <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>🔧 {t('app.plan.category.backend')}</SectionTitle>
              {grouped.backend.map(renderItem)}
            </Section>
          )}
          {grouped.integration.length > 0 && (
            <Section>
              <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>🔗 {t('app.plan.category.integration')}</SectionTitle>
              {grouped.integration.map(renderItem)}
            </Section>
          )}
          {grouped.testing.length > 0 && (
            <Section>
              <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>🧪 {t('app.plan.category.testing')}</SectionTitle>
              {grouped.testing.map(renderItem)}
            </Section>
          )}
          {grouped.deployment.length > 0 && (
            <Section>
              <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>🚀 {t('app.plan.category.deployment')}</SectionTitle>
              {grouped.deployment.map(renderItem)}
            </Section>
          )}
          {items.length > 0 && grouped.config.length === 0 && grouped.frontend.length === 0 && grouped.backend.length === 0 && (
            <Section>
              <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>📋 {t('app.plan.category.tasks')}</SectionTitle>
              {items.map(renderItem)}
            </Section>
          )}
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
      <Header style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <Zap size={14} />
        {t('app.plan.title')}
      </Header>
      <Body>{content}</Body>
    </Panel>
  );
};
