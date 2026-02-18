'use client';

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { CheckCircle2, Circle, Loader2, ListChecks } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { normalizePlanCategory, type NormalizedPlanCategory } from '@/utils/planCategory';

export interface PlanChecklistItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  category?: 'config' | 'frontend' | 'backend' | 'integration' | 'testing' | 'deployment' | 'tasks';
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  files?: string[];
  estimatedSize?: 'small' | 'medium' | 'large';
}

const Panel = styled.div`
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.6) 100%);
  backdrop-filter: blur(20px);
  overflow: hidden;
`;

const Header = styled.div`
  height: 42px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const HeaderTitle = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
`;

const HeaderMeta = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.62);
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: grid;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.5) transparent;

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 999px;
    margin: 2px 0;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(148, 163, 184, 0.4), rgba(100, 150, 200, 0.5));
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: padding-box;
    min-height: 40px;
    transition: all 280ms cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 12px rgba(34, 211, 238, 0.15);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(148, 163, 184, 0.65), rgba(100, 150, 200, 0.75));
    box-shadow: 0 0 16px rgba(34, 211, 238, 0.25);
  }
`;

const ProgressRail = styled.div`
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${(p) => `${Math.round(p.$pct * 100)}%`};
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.95), rgba(245, 158, 11, 0.95));
  transition: width 220ms ease;
`;

const ProgressMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
`;

const Empty = styled.div`
  min-height: 110px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
  text-align: center;
  padding: 14px;
`;

const Section = styled.section`
  display: grid;
  gap: 8px;
`;

const SectionTitle = styled.div`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
`;

const Item = styled.div<{ $state: 'pending' | 'active' | 'done' }>`
  border-radius: 12px;
  border: 1px solid
    ${(p) => {
      if (p.$state === 'done') return 'rgba(34, 197, 94, 0.3)';
      if (p.$state === 'active') return 'rgba(56, 189, 248, 0.4)';
      return 'rgba(255, 255, 255, 0.06)';
    }};
  background:
    ${(p) => {
      if (p.$state === 'done') return 'linear-gradient(90deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02))';
      if (p.$state === 'active') return 'linear-gradient(90deg, rgba(56, 189, 248, 0.08), rgba(56, 189, 248, 0.04))';
      return 'rgba(255, 255, 255, 0.02)';
    }};
  padding: 12px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.15);
  }
`;

const ItemHead = styled.div`
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 8px;
  align-items: center;
`;

const ItemTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.35;
`;

const ItemStatus = styled.div<{ $state: 'pending' | 'active' | 'done' }>`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color:
    ${(p) => {
      if (p.$state === 'done') return 'rgba(134, 239, 172, 0.95)';
      if (p.$state === 'active') return 'rgba(125, 211, 252, 0.95)';
      return 'rgba(255, 255, 255, 0.5)';
    }};
`;

const ItemDescription = styled.div`
  margin-top: 7px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.4;
`;

const FileList = styled.div`
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const FileChip = styled.span`
  font-size: 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  padding: 2px 6px;
`;

interface PlanChecklistProps {
  items: PlanChecklistItem[];
  currentStepId?: string;
  embedded?: boolean;
  className?: string;
}

const ORDERED_CATEGORIES: NormalizedPlanCategory[] = [
  'config',
  'frontend',
  'backend',
  'integration',
  'testing',
  'deployment',
  'tasks'
];

const CATEGORY_LABELS: Record<NormalizedPlanCategory, string> = {
  config: 'app.plan.category.config',
  frontend: 'app.plan.category.frontend',
  backend: 'app.plan.category.backend',
  integration: 'app.plan.category.integration',
  testing: 'app.plan.category.testing',
  deployment: 'app.plan.category.deployment',
  tasks: 'app.plan.category.tasks'
};

const detectCategory = (item: PlanChecklistItem): NormalizedPlanCategory => {
  return normalizePlanCategory(item.category, item.title, Array.isArray(item.files) ? item.files : []);
};

const splitByCategory = (items: PlanChecklistItem[]) => {
  const out: Record<NormalizedPlanCategory, PlanChecklistItem[]> = {
    config: [],
    frontend: [],
    backend: [],
    integration: [],
    testing: [],
    deployment: [],
    tasks: []
  };
  for (const item of items) {
    const cat = detectCategory(item);
    out[cat] = [...out[cat], item];
  }
  return out;
};

export const PlanChecklist: React.FC<PlanChecklistProps> = ({
  items,
  currentStepId,
  embedded = false,
  className
}) => {
  const { t, isRTL } = useLanguage();
  const total = items.length;
  const doneCount = items.filter((item) => item.completed).length;
  const progress = total > 0 ? doneCount / total : 0;
  const grouped = useMemo(() => splitByCategory(items), [items]);
  const hasRenderableSections = useMemo(
    () => ORDERED_CATEGORIES.some((category) => grouped[category].length > 0),
    [grouped]
  );

  const renderItem = (item: PlanChecklistItem) => {
    const state: 'pending' | 'active' | 'done' =
      item.completed ? 'done' : currentStepId === item.id ? 'active' : 'pending';
    const statusLabel =
      state === 'done' ? t('app.plan.status.done') : state === 'active' ? t('app.plan.status.working') : t('app.plan.status.pending');
    const icon =
      state === 'done' ? (
        <CheckCircle2 size={16} color="rgba(134, 239, 172, 0.95)" />
      ) : state === 'active' ? (
        <Loader2 size={16} color="rgba(125, 211, 252, 0.95)" className="animate-spin" />
      ) : (
        <Circle size={16} color="rgba(255, 255, 255, 0.42)" />
      );

    return (
      <Item key={item.id} $state={state}>
        <ItemHead style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
          {icon}
          <ItemTitle>{item.title}</ItemTitle>
          <ItemStatus $state={state}>{statusLabel}</ItemStatus>
        </ItemHead>
        {item.description ? <ItemDescription>{item.description}</ItemDescription> : null}
        {Array.isArray(item.files) && item.files.length > 0 ? (
          <FileList style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
            {item.files.slice(0, 5).map((file) => (
              <FileChip key={`${item.id}-${file}`}>{file.split('/').pop() || file}</FileChip>
            ))}
            {item.files.length > 5 ? <FileChip>+{item.files.length - 5} {t('app.plan.more')}</FileChip> : null}
          </FileList>
        ) : null}
      </Item>
    );
  };

  const content = (
    <>
      {total > 0 ? (
        <>
          <ProgressMeta style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
            <span>{t('app.plan.progress')}</span>
            <span>{doneCount}/{total}</span>
          </ProgressMeta>
          <ProgressRail>
            <ProgressFill $pct={progress} style={{ transformOrigin: isRTL ? 'right' : 'left' }} />
          </ProgressRail>
        </>
      ) : null}

      {total === 0 ? (
        <Empty>{t('app.plan.empty')}</Empty>
      ) : (
        <>
          {ORDERED_CATEGORIES.map((category) => (
            grouped[category].length > 0 ? (
              <Section key={`section-${category}`}>
                <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t(CATEGORY_LABELS[category])}
                </SectionTitle>
                {grouped[category].map(renderItem)}
              </Section>
            ) : null
          ))}
          {!hasRenderableSections ? (
            <Section>
              <SectionTitle style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('app.plan.category.tasks')}
              </SectionTitle>
              {items.map(renderItem)}
            </Section>
          ) : null}
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className={className} style={{ height: '100%', minHeight: 0 }}>
        <Body>{content}</Body>
      </div>
    );
  }

  return (
    <Panel className={className}>
      <Header style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
        <HeaderTitle>
          <ListChecks size={14} />
          {t('app.plan.title')}
        </HeaderTitle>
        <HeaderMeta>{doneCount}/{total}</HeaderMeta>
      </Header>
      <Body>{content}</Body>
    </Panel>
  );
};
