import React, { useEffect, useMemo, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { stripAnsi } from '@/utils/ansi';

const Sheet = styled(motion.div)<{ $open: boolean }>`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  --console-open-height: 35vh;
  height: ${(p) => (p.$open ? 'var(--console-open-height)' : '48px')};
  border-top: 1px solid rgba(34, 211, 238, 0.15);
  background: linear-gradient(180deg, rgba(3, 7, 18, 0.98) 0%, rgba(0, 0, 0, 0.98) 100%);
  box-shadow: 0 -24px 80px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(34, 211, 238, 0.08);
  overflow: hidden;
  z-index: 50;
  backdrop-filter: blur(20px);

  @media (max-width: 768px) {
    --console-open-height: 50vh;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }
`;

const Header = styled.button`
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border: 0;
  cursor: pointer;
  background: rgba(3, 7, 18, 0.95);
  border-bottom: 1px solid rgba(34, 211, 238, 0.15);
  color: rgba(34, 211, 238, 0.95);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(3, 7, 18, 1);
    border-bottom-color: rgba(34, 211, 238, 0.3);
  }
`;

const Body = styled.div`
  position: relative;
  height: calc(var(--console-open-height) - 48px);
  overflow: auto;
  padding: 16px;
  font-family: "JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(229, 231, 235, 0.9);
  white-space: pre-wrap;
  background: rgba(0, 0, 0, 0.95);
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(34, 211, 238, 0.3);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(34, 211, 238, 0.5);
  }
`;

const blink = keyframes`
  50% { opacity: 0.0; }
`;

const cursorAnimation = css`
  animation: ${blink} 1.1s steps(1, end) infinite;
`;

const Cursor = styled.span`
  display: inline-block;
  width: 9px;
  height: 14px;
  background: var(--primary-color);
  margin-left: 6px;
  transform: translateY(2px);
  ${cursorAnimation}
`;

const Empty = styled.div`
  color: var(--primary-color);
  opacity: 0.55;
`;

const Prefix = styled.span<{ $type?: 'health' | 'status' | 'error' | 'thought' }>`
  font-weight: 700;
  color: ${p => {
    switch(p.$type) {
      case 'health': return 'rgba(34, 197, 94, 1)';
      case 'status': return 'rgba(251, 191, 36, 1)';
      case 'error': return 'rgba(239, 68, 68, 1)';
      case 'thought': return 'rgba(168, 85, 247, 0.95)';
      default: return 'rgba(34, 211, 238, 0.95)';
    }
  }};
`;

const ThoughtSection = styled.details`
  margin-top: 12px;
  
  summary {
    cursor: pointer;
    user-select: none;
    list-style: none;
    padding: 8px 0;
    font-weight: 700;
    color: rgba(168, 85, 247, 0.95);
    
    &::-webkit-details-marker {
      display: none;
    }
    
    &::before {
      content: '▶ ';
      display: inline-block;
      transition: transform 0.2s;
    }
    
    &:hover {
      color: rgba(168, 85, 247, 1);
    }
  }
  
  &[open] summary::before {
    transform: rotate(90deg);
  }
`;

const ThoughtContent = styled.div`
  padding: 12px;
  margin-top: 4px;
  border-left: 2px solid rgba(168, 85, 247, 0.3);
  background: rgba(168, 85, 247, 0.05);
  border-radius: 4px;
  color: rgba(229, 231, 235, 0.85);
`;

const StatusLine = styled.div<{ $type?: 'health' | 'status' | 'error' }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  
  ${p => p.$type === 'error' && `
    background: rgba(239, 68, 68, 0.08);
    border-left: 3px solid rgba(239, 68, 68, 0.5);
    padding-left: 12px;
    margin-left: -12px;
    margin-top: 8px;
    margin-bottom: 8px;
  `}
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
}

export const BrainConsole: React.FC<BrainConsoleProps> = ({ visible, open, onToggle, health, thought, status, error, logs, canFixResume, onFixResume }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [error, logs, open, status, thought]);

  const cleanedThought = useMemo(() => stripAnsi((thought || '').trim()), [thought]);
  const cleanedLogs = useMemo(() => stripAnsi((logs || '').trim()), [logs]);
  const cleanedError = useMemo(() => stripAnsi((error || '').trim()), [error]);
  const cleanedStatus = useMemo(() => stripAnsi((status || '').trim()), [status]);
  const cleanedHealth = useMemo(() => stripAnsi((health || '').trim()), [health]);
  const healthColor = cleanedHealth.startsWith('OK')
    ? 'rgba(34,197,94,0.92)'
    : cleanedHealth.length === 0
      ? 'rgba(255,255,255,0.55)'
      : 'rgba(250,204,21,0.92)';

  return (
    <AnimatePresence>
      {visible && (
        <Sheet
          $open={open}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          <Header type="button" onClick={onToggle} aria-expanded={open}>
            <Terminal size={16} />
            System Console
            <span style={{ marginLeft: 'auto', opacity: 0.8 }}>
              {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </span>
          </Header>
          {open && (
            <Body>
              {cleanedHealth.length > 0 && (
                <StatusLine $type="health">
                  <Prefix $type="health">[HEALTH]</Prefix>
                  <span style={{ color: healthColor, fontWeight: 600 }}>{cleanedHealth}</span>
                </StatusLine>
              )}
              <StatusLine $type="status">
                <Prefix $type="status">[STATUS]</Prefix>
                <span style={{ color: 'rgba(251, 191, 36, 0.9)', fontWeight: 600 }}>{cleanedStatus || 'Ready'}</span>
              </StatusLine>
              {cleanedError.length > 0 && (
                <StatusLine $type="error">
                  <Prefix $type="error">[ERROR]</Prefix>
                  <span style={{ color: 'rgba(239, 68, 68, 0.95)' }}>{cleanedError}</span>
                </StatusLine>
              )}
              {canFixResume && onFixResume && (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={onFixResume}
                    style={{
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.88)',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      fontWeight: 800
                    }}
                  >
                    Fix & Resume
                  </button>
                </div>
              )}
              <ThoughtSection open={cleanedThought.length > 0}>
                <summary>
                  <Prefix $type="thought">[THOUGHT]</Prefix> AI Reasoning Process
                </summary>
                <ThoughtContent>
                  {cleanedThought.length === 0 ? (
                    <Empty>Waiting for AI response...</Empty>
                  ) : (
                    <>
                      {cleanedThought}
                      <Cursor />
                    </>
                  )}
                </ThoughtContent>
              </ThoughtSection>
              {cleanedLogs.length > 0 && (
                <div style={{ marginTop: 12, opacity: 0.92 }}>
                  {cleanedLogs}
                </div>
              )}
              <div ref={bottomRef} />
            </Body>
          )}
        </Sheet>
      )}
    </AnimatePresence>
  );
};
