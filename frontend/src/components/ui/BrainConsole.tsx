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
  --console-open-height: 30vh;
  height: ${(p) => (p.$open ? 'var(--console-open-height)' : '44px')};
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.8);
  box-shadow: 0 -22px 60px rgba(0, 0, 0, 0.65);
  overflow: hidden;
  z-index: 50;

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
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 0;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--primary-color);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
`;

const Body = styled.div`
  position: relative;
  height: calc(var(--console-open-height) - 44px);
  overflow: auto;
  padding: 12px;
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--primary-color);
  white-space: pre-wrap;
  background: rgba(0, 0, 0, 0.8);
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

const Prefix = styled.span`
  color: var(--primary-color);
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
                <div style={{ marginBottom: 6, color: healthColor }}>
                  <Prefix>[HEALTH]</Prefix> <span>{cleanedHealth}</span>
                </div>
              )}
              <div>
                <Prefix>[STATUS]</Prefix> <span>{cleanedStatus || 'Idle'}</span>
              </div>
              {cleanedError.length > 0 && (
                <div style={{ marginTop: 8, color: 'rgba(248,113,113,0.95)' }}>
                  <Prefix>[ERROR]</Prefix> <span>{cleanedError}</span>
                </div>
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
              <div style={{ marginTop: 10 }}>
                <Prefix>[THOUGHT]</Prefix>{' '}
                {cleanedThought.length === 0 ? <Empty>Reasoning not available.</Empty> : <span>{cleanedThought}</span>}
                <Cursor />
              </div>
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
