import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ListChecks,
  PauseCircle,
  PlayCircle,
  Terminal,
  Wrench
} from 'lucide-react';
import { stripAnsi } from '@/utils/ansi';
import { useLanguage } from '@/context/LanguageContext';
import type { BrainEvent } from '@/stores/aiStore';
import type { ContextStatus } from '@/types/context';

type BrainTab = 'logs' | 'reasoning' | 'diagnostics';

const Sheet = styled(motion.section)<{ $open: boolean }>`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 52;
  --console-open-height: 42vh;
  height: ${(p) => (p.$open ? 'var(--console-open-height)' : '48px')};
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(180deg, rgba(8, 12, 20, 0.985) 0%, rgba(4, 8, 14, 0.985) 100%);
  backdrop-filter: blur(16px);
  box-shadow: 0 -18px 44px rgba(0, 0, 0, 0.55);
  overflow: hidden;

  @media (max-width: 768px) {
    --console-open-height: 46vh;
    bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
  }
`;

const Header = styled.button`
  width: 100%;
  height: 48px;
  border: 0;
  background: rgba(255, 255, 255, 0.03);
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const Title = styled.span`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const HeaderPill = styled.span<{ $tone: 'ok' | 'warn' | 'error' | 'idle' }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  border: 1px solid
    ${(p) => {
      if (p.$tone === 'ok') return 'rgba(34, 197, 94, 0.35)';
      if (p.$tone === 'warn') return 'rgba(245, 158, 11, 0.35)';
      if (p.$tone === 'error') return 'rgba(239, 68, 68, 0.4)';
      return 'rgba(255, 255, 255, 0.18)';
    }};
  background:
    ${(p) => {
      if (p.$tone === 'ok') return 'rgba(34, 197, 94, 0.12)';
      if (p.$tone === 'warn') return 'rgba(245, 158, 11, 0.12)';
      if (p.$tone === 'error') return 'rgba(239, 68, 68, 0.14)';
      return 'rgba(255, 255, 255, 0.06)';
    }};
  color:
    ${(p) => {
      if (p.$tone === 'ok') return 'rgba(134, 239, 172, 0.95)';
      if (p.$tone === 'warn') return 'rgba(252, 211, 77, 0.95)';
      if (p.$tone === 'error') return 'rgba(252, 165, 165, 0.95)';
      return 'rgba(255, 255, 255, 0.7)';
    }};
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  white-space: nowrap;
`;

const Body = styled.div`
  height: calc(var(--console-open-height) - 48px);
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  padding: 10px 12px 12px;
`;

const Tabs = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 4px;
`;

const TabBtn = styled.button<{ $active: boolean }>`
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.36)' : 'rgba(255, 255, 255, 0.08)')};
  background: ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.16)' : 'rgba(255, 255, 255, 0.03)')};
  color: ${(p) => (p.$active ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.72)')};
  border-radius: 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  height: 28px;
  padding: 0 12px;
  cursor: pointer;
`;

const TabActions = styled.div`
  display: inline-flex;
  gap: 6px;
  margin-inline-start: auto;
`;

const ActionBtn = styled.button`
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
`;

const Panel = styled.section`
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(2, 6, 12, 0.65);
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
`;

const PanelHead = styled.div`
  height: 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.68);
`;

const ScrollArea = styled.div`
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding: 10px;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(226, 232, 240, 0.92);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const Empty = styled.div`
  color: rgba(148, 163, 184, 0.65);
  font-size: 12px;
`;

const ErrorCard = styled.div`
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  color: rgba(254, 202, 202, 0.95);
  padding: 9px 10px;
  font-size: 12px;
  line-height: 1.4;
  margin-bottom: 10px;
`;

const FixButton = styled.button`
  margin-top: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.92);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

const Stat = styled.div`
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  padding: 8px 10px;
  min-width: 0;
`;

const StatLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(255, 255, 255, 0.58);
`;

const StatValue = styled.div`
  margin-top: 4px;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Timeline = styled.div`
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
  display: grid;
  gap: 6px;
`;

const EventRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 11px;
`;

const EventTime = styled.span`
  color: rgba(148, 163, 184, 0.75);
  min-width: 64px;
`;

const EventSource = styled.span`
  color: rgba(34, 211, 238, 0.9);
  min-width: 58px;
  text-transform: uppercase;
  font-weight: 700;
`;

const EventMessage = styled.span`
  color: rgba(226, 232, 240, 0.92);
  min-width: 0;
  overflow-wrap: anywhere;
`;

interface BrainConsoleProps {
  visible: boolean;
  open: boolean;
  onToggle: () => void;
  health?: string;
  thought: string;
  status: string;
  error: string | null;
  logs: string;
  canFixResume?: boolean;
  onFixResume?: () => void;
  events?: BrainEvent[];
  executionPhase?: string;
  writingFilePath?: string | null;
  contextUtilizationPct?: number;
  contextStatus?: ContextStatus;
  runtimeStatus?: string;
  lastTokenAt?: number;
}

const getHealthTone = (health: string): 'ok' | 'warn' | 'error' | 'idle' => {
  const lower = health.toLowerCase();
  if (!lower) return 'idle';
  if (lower.startsWith('ok')) return 'ok';
  if (lower.includes('error') || lower.includes('fail')) return 'error';
  return 'warn';
};

const getStatusTone = (status: string): 'ok' | 'warn' | 'error' | 'idle' => {
  const lower = status.toLowerCase();
  if (!lower) return 'idle';
  if (lower.includes('complete') || lower.includes('ready') || lower.includes('done')) return 'ok';
  if (lower.includes('error') || lower.includes('failed') || lower.includes('interrupted')) return 'error';
  return 'warn';
};

const formatClock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], {
    hour12: false
  });

export const BrainConsole: React.FC<BrainConsoleProps> = ({
  visible,
  open,
  onToggle,
  health,
  thought,
  status,
  error,
  logs,
  canFixResume,
  onFixResume,
  events = [],
  executionPhase,
  writingFilePath,
  contextUtilizationPct = 0,
  contextStatus = 'ok',
  runtimeStatus = 'idle',
  lastTokenAt = 0
}) => {
  const { t, isRTL } = useLanguage();
  const [tab, setTab] = useState<BrainTab>('logs');
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [autoScroll, setAutoScroll] = useState<Record<BrainTab, boolean>>({
    logs: true,
    reasoning: true,
    diagnostics: true
  });
  const logsRef = useRef<HTMLDivElement | null>(null);
  const reasoningRef = useRef<HTMLDivElement | null>(null);
  const diagnosticsRef = useRef<HTMLDivElement | null>(null);

  const cleanedThought = useMemo(() => stripAnsi((thought || '').trim()), [thought]);
  const cleanedLogs = useMemo(() => stripAnsi((logs || '').trim()), [logs]);
  const cleanedError = useMemo(() => stripAnsi((error || '').trim()), [error]);
  const cleanedStatus = useMemo(() => stripAnsi((status || '').trim()), [status]);
  const cleanedHealth = useMemo(() => stripAnsi((health || '').trim()), [health]);
  const healthTone = useMemo(() => getHealthTone(cleanedHealth), [cleanedHealth]);
  const statusTone = useMemo(() => getStatusTone(cleanedStatus), [cleanedStatus]);

  const trimmedLogs = useMemo(() => {
    if (!cleanedLogs) return '';
    const lines = cleanedLogs.split('\n').filter((line) => line.trim().length > 0);
    return lines.slice(-240).join('\n');
  }, [cleanedLogs]);

  const timelineEvents = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return [];
    return events.slice(-140);
  }, [events]);

  const tokenAgeSec = useMemo(() => {
    if (!lastTokenAt) return null;
    return Math.max(0, Math.floor((nowTs - lastTokenAt) / 1000));
  }, [lastTokenAt, nowTs]);

  useEffect(() => {
    if (!open || !lastTokenAt) return;
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lastTokenAt, open]);

  const scrollToBottom = (target: BrainTab) => {
    const node = target === 'logs' ? logsRef.current : target === 'reasoning' ? reasoningRef.current : diagnosticsRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  };

  useEffect(() => {
    if (!open) return;
    if (autoScroll.logs) scrollToBottom('logs');
  }, [open, autoScroll.logs, trimmedLogs, cleanedError]);

  useEffect(() => {
    if (!open) return;
    if (autoScroll.reasoning) scrollToBottom('reasoning');
  }, [open, autoScroll.reasoning, cleanedThought]);

  useEffect(() => {
    if (!open) return;
    if (autoScroll.diagnostics) scrollToBottom('diagnostics');
  }, [open, autoScroll.diagnostics, timelineEvents.length, contextUtilizationPct, runtimeStatus, executionPhase]);

  const handleScroll = (target: BrainTab, el: HTMLDivElement | null) => {
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
    if (!nearBottom && autoScroll[target]) {
      setAutoScroll((prev) => ({ ...prev, [target]: false }));
    }
  };

  const pauseOrResumeLabel = autoScroll[tab] ? 'Pause Auto Scroll' : 'Resume Auto Scroll';

  return (
    <AnimatePresence>
      {visible && (
        <Sheet
          $open={open}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        >
          <Header type="button" onClick={onToggle} aria-expanded={open} style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Terminal size={15} />
            <Title style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>{t('app.console.title')}</Title>
            <HeaderPill $tone={healthTone}>
              <Activity size={12} />
              {cleanedHealth || 'N/A'}
            </HeaderPill>
            <HeaderPill $tone={statusTone}>{cleanedStatus || t('app.editor.ready')}</HeaderPill>
            {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </Header>

          {open && (
            <Body style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
              <Tabs>
                <TabBtn type="button" $active={tab === 'logs'} onClick={() => setTab('logs')}>
                  Logs
                </TabBtn>
                <TabBtn type="button" $active={tab === 'reasoning'} onClick={() => setTab('reasoning')}>
                  Reasoning
                </TabBtn>
                <TabBtn type="button" $active={tab === 'diagnostics'} onClick={() => setTab('diagnostics')}>
                  Diagnostics
                </TabBtn>
                <TabActions>
                  <ActionBtn
                    type="button"
                    onClick={() => setAutoScroll((prev) => ({ ...prev, [tab]: !prev[tab] }))}
                    title={pauseOrResumeLabel}
                  >
                    {autoScroll[tab] ? <PauseCircle size={12} /> : <PlayCircle size={12} />}
                    {autoScroll[tab] ? 'Pause' : 'Resume'}
                  </ActionBtn>
                </TabActions>
              </Tabs>

              {tab === 'logs' && (
                <Panel>
                  <PanelHead>
                    <span>{t('app.logs.title')}</span>
                    <span>{trimmedLogs ? `${trimmedLogs.split('\n').length} lines` : ''}</span>
                  </PanelHead>
                  <ScrollArea ref={logsRef} onScroll={(e) => handleScroll('logs', e.currentTarget)}>
                    {cleanedError && (
                      <ErrorCard>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontWeight: 800 }}>
                          <AlertTriangle size={14} />
                          Error
                        </div>
                        <div>{cleanedError}</div>
                        {canFixResume && onFixResume && (
                          <FixButton type="button" onClick={onFixResume}>
                            <Wrench size={14} />
                            Fix & Resume
                          </FixButton>
                        )}
                      </ErrorCard>
                    )}
                    {trimmedLogs ? trimmedLogs : <Empty>{t('app.logs.empty')}</Empty>}
                  </ScrollArea>
                </Panel>
              )}

              {tab === 'reasoning' && (
                <Panel>
                  <PanelHead>
                    <span>Reasoning</span>
                    <span>{cleanedThought ? `${cleanedThought.length.toLocaleString()} chars` : ''}</span>
                  </PanelHead>
                  <ScrollArea ref={reasoningRef} onScroll={(e) => handleScroll('reasoning', e.currentTarget)}>
                    {cleanedThought || <Empty>{t('app.console.empty')}</Empty>}
                  </ScrollArea>
                </Panel>
              )}

              {tab === 'diagnostics' && (
                <Panel>
                  <PanelHead>
                    <span>Diagnostics</span>
                    <span>{timelineEvents.length} events</span>
                  </PanelHead>
                  <ScrollArea ref={diagnosticsRef} onScroll={(e) => handleScroll('diagnostics', e.currentTarget)}>
                    <Grid>
                      <Stat>
                        <StatLabel>Execution</StatLabel>
                        <StatValue>{executionPhase || 'idle'}</StatValue>
                      </Stat>
                      <Stat>
                        <StatLabel>Runtime</StatLabel>
                        <StatValue>{runtimeStatus || 'idle'}</StatValue>
                      </Stat>
                      <Stat>
                        <StatLabel>Writing File</StatLabel>
                        <StatValue>{writingFilePath || '-'}</StatValue>
                      </Stat>
                      <Stat>
                        <StatLabel>Context</StatLabel>
                        <StatValue>
                          {Number(contextUtilizationPct || 0).toFixed(1)}% ({contextStatus})
                        </StatValue>
                      </Stat>
                      <Stat>
                        <StatLabel>Last Token</StatLabel>
                        <StatValue>{tokenAgeSec === null ? '-' : `${tokenAgeSec}s ago`}</StatValue>
                      </Stat>
                      <Stat>
                        <StatLabel>Health</StatLabel>
                        <StatValue>{cleanedHealth || 'N/A'}</StatValue>
                      </Stat>
                    </Grid>

                    <Timeline>
                      <div
                        style={{
                          fontSize: 10,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'rgba(148, 163, 184, 0.8)',
                          fontWeight: 700
                        }}
                      >
                        Timeline
                      </div>
                      {timelineEvents.length === 0 ? (
                        <Empty>No events yet.</Empty>
                      ) : (
                        timelineEvents.map((event) => (
                          <EventRow key={event.id}>
                            <EventTime>{formatClock(event.ts)}</EventTime>
                            <EventSource>{event.source}</EventSource>
                            <EventMessage>{event.message}</EventMessage>
                          </EventRow>
                        ))
                      )}
                    </Timeline>
                  </ScrollArea>
                </Panel>
              )}
            </Body>
          )}
        </Sheet>
      )}
    </AnimatePresence>
  );
};
