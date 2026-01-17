import React, { useEffect, useState, useRef, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Cpu,
  GitBranch,
  Zap,
  CheckCircle,
  Activity,
  Maximize2,
  Minimize2,
  Layers,
  Code2,
  Database,
  Search,
  Lock
} from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';

// ============================================================================
// ANIMATIONS & KEYFRAMES
// ============================================================================

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.4); }
  70% { box-shadow: 0 0 0 15px rgba(34, 211, 238, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
`;

const scanline = keyframes`
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
`;

const rotateSlow = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const WidgetContainer = styled(motion.div)<{ $collapsed: boolean }>`
  position: fixed;
  z-index: 1000;
  bottom: 100px;
  right: 20px;

  display: flex;
  flex-direction: column;
  background: rgba(10, 12, 16, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 0 20px rgba(34, 211, 238, 0.05);

  overflow: hidden;
  transition: border-radius 0.4s cubic-bezier(0.23, 1, 0.32, 1);

  ${p => p.$collapsed ? css`
    width: 64px;
    height: 64px;
    border-radius: 32px;
    align-items: center;
    justify-content: center;
    cursor: grab;
    &:active { cursor: grabbing; }
  ` : css`
    width: 480px;
    height: 600px;
    border-radius: 24px;
    max-height: calc(100vh - 120px);
  `}

  @media (max-width: 768px) {
    ${p => !p.$collapsed && css`
      width: calc(100vw - 32px);
      right: 16px;
      bottom: 100px;
      height: 500px;
    `}
  }
`;

// --- COLLAPSED STATE ---
const CollapsedOrb = styled(motion.div)`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.2), transparent);
  }
`;

const OrbCore = styled.div<{ $active: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${p => p.$active ? '#22d3ee' : 'rgba(255,255,255,0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.$active ? '#000' : 'rgba(255,255,255,0.8)'};
  animation: ${p => p.$active ? pulseGlow : 'none'} 2s infinite;
  transition: all 0.3s ease;
`;

const OrbRing = styled.div<{ $active: boolean }>`
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 2px dashed ${p => p.$active ? 'rgba(34, 211, 238, 0.3)' : 'rgba(255,255,255,0.1)'};
  animation: ${rotateSlow} 10s linear infinite;
`;

// --- EXPANDED STATE ---
const Header = styled.div`
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  cursor: grab;
  &:active { cursor: grabbing; }
`;

const TitleArea = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TitleText = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  gap: 8px;

  span.tag {
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(34, 211, 238, 0.15);
    color: #22d3ee;
    border: 1px solid rgba(34, 211, 238, 0.3);
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 8px;
`;

const ControlBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
`;

// --- HUD / VISUALIZATION ---

const HudGrid = styled.div`
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(34, 211, 238, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 211, 238, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  opacity: 0.5;
`;

const ScanLine = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.5), transparent);
  animation: ${scanline} 4s linear infinite;
  opacity: 0.3;
  pointer-events: none;
`;

const ProcessorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 20px;
  position: relative;
  z-index: 1;
`;

const NodeCard = styled(motion.div)<{ $status: 'idle' | 'active' | 'done' }>`
  background: rgba(13, 17, 23, 0.6);
  border: 1px solid ${p => {
    if (p.$status === 'active') return 'rgba(34, 211, 238, 0.5)';
    if (p.$status === 'done') return 'rgba(34, 197, 94, 0.3)';
    return 'rgba(255, 255, 255, 0.08)';
  }};
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;

  ${p => p.$status === 'active' && css`
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.1);
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      background: #22d3ee;
      width: 100%;
      animation: ${scanline} 2s linear infinite;
      /* Reusing scanline conceptually for a progress bar here? actually let's just use width */
    }
  `}
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
`;

const NodeIcon = styled.div<{ $color: string }>`
  color: ${p => p.$color};
`;

const NodeValue = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  height: 32px;
  overflow: hidden;
  position: relative;
`;

const TerminalOutput = styled.div`
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  margin: 0 20px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
`;

const LogLine = styled(motion.div)`
  display: flex;
  gap: 8px;

  span.time { color: rgba(255, 255, 255, 0.3); }
  span.msg { color: #a5f3fc; }
  span.cursor {
    display: inline-block;
    width: 6px;
    height: 12px;
    background: #22d3ee;
    animation: ${pulseGlow} 1s infinite;
  }
`;

const MetricsRow = styled.div`
  display: flex;
  gap: 12px;
  padding: 0 20px 12px;
`;

const Metric = styled.div`
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 9px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 700;
  }

  div {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #22d3ee;
    font-weight: 600;
  }
`;

// ============================================================================
// COMPONENT
// ============================================================================

export const SuperWorkflow: React.FC = () => {
  const { isGenerating, thinkingContent, planSteps } = useAIStore();
  const [collapsed, setCollapsed] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fake some metrics
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, ops: 0 });

  useEffect(() => {
    if (!isGenerating || collapsed) {
      if (!isGenerating) setMetrics({ cpu: 12, ram: 24, ops: 0 });
      return;
    }

    const interval = setInterval(() => {
      setMetrics({
        cpu: Math.floor(Math.random() * 40) + 40,
        ram: Math.floor(Math.random() * 30) + 40,
        ops: Math.floor(Math.random() * 1000) + 5000
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isGenerating, collapsed]);

  // Parse thinking content for "log-like" updates
  useEffect(() => {
    if (!thinkingContent) return;
    const lines = thinkingContent.split('\n').filter(l => l.trim().length > 0);
    const lastFew = lines.slice(-5);
    setLogs(lastFew);

    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinkingContent]);

  const activeNodes = useMemo(() => {
    const defaultNodes = [
      { id: 'arch', name: 'Architecture', icon: Layers, status: 'idle', val: 'Waiting...' },
      { id: 'plan', name: 'Strategic Plan', icon: GitBranch, status: 'idle', val: 'Pending...' },
      { id: 'code', name: 'Code Synthesis', icon: Code2, status: 'idle', val: 'Standby' },
      { id: 'rev', name: 'Security Audit', icon: Lock, status: 'idle', val: 'Inactive' }
    ];

    if (!isGenerating) return defaultNodes;

    // Simulate active state based on content length or keywords
    const len = thinkingContent.length;

    // Simple state machine simulation
    if (len < 50) {
      defaultNodes[0].status = 'active';
      defaultNodes[0].val = 'Analyzing Prompt...';
    } else if (len < 300) {
      defaultNodes[0].status = 'done';
      defaultNodes[0].val = 'Context Resolved';
      defaultNodes[1].status = 'active';
      defaultNodes[1].val = 'Mapping Dependencies...';
    } else if (len < 800) {
      defaultNodes[0].status = 'done';
      defaultNodes[1].status = 'done';
      defaultNodes[2].status = 'active';
      defaultNodes[2].val = 'Generating Logic...';
    } else {
      defaultNodes[0].status = 'done';
      defaultNodes[1].status = 'done';
      defaultNodes[2].status = 'active'; // Coding is long
      defaultNodes[2].val = `Synthesizing ${Math.floor(len / 10)} LoC...`;
      defaultNodes[3].status = 'active';
      defaultNodes[3].val = 'Real-time Checks...';
    }

    return defaultNodes;
  }, [isGenerating, thinkingContent]);

  return (
    <WidgetContainer
      drag
      dragMomentum={false}
      $collapsed={collapsed}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 20 }}
    >
      <AnimatePresence mode="wait">
        {collapsed ? (
          <CollapsedOrb
            key="collapsed"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => setCollapsed(false)}
          >
            <OrbRing $active={isGenerating} />
            <OrbCore $active={isGenerating}>
              <Brain size={18} />
            </OrbCore>
          </CollapsedOrb>
        ) : (
          <ContentArea
            key="expanded"
            as={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Header>
              <TitleArea>
                <Activity size={16} color="#22d3ee" />
                <TitleText>
                  DeepThinking
                  <span className="tag">v2.0</span>
                </TitleText>
              </TitleArea>
              <Controls>
                <ControlBtn onClick={() => setCollapsed(true)}>
                  <Minimize2 size={16} />
                </ControlBtn>
              </Controls>
            </Header>

            <HudGrid />
            <ScanLine />

            <ProcessorGrid>
              {activeNodes.map((node, i) => (
                <NodeCard key={node.id} $status={node.status as any}>
                  <NodeHeader>
                    {node.name}
                    <NodeIcon $color={node.status === 'active' ? '#22d3ee' : node.status === 'done' ? '#4ade80' : 'rgba(255,255,255,0.2)'}>
                      <node.icon size={14} />
                    </NodeIcon>
                  </NodeHeader>
                  <NodeValue>
                    {node.status === 'active' && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ repeat: Infinity, duration: 0.8, repeatType: 'reverse' }}
                      >
                        ●
                      </motion.span>
                    )} {node.val}
                  </NodeValue>
                </NodeCard>
              ))}
            </ProcessorGrid>

            <MetricsRow>
              <Metric>
                <label>CPU Load</label>
                <div>{metrics.cpu}%</div>
              </Metric>
              <Metric>
                <label>Memory</label>
                <div>{metrics.ram}GB</div>
              </Metric>
              <Metric>
                <label>Ops/Sec</label>
                <div>{metrics.ops}</div>
              </Metric>
            </MetricsRow>

            <TerminalOutput ref={scrollRef}>
              {logs.length === 0 ? (
                <div style={{ opacity: 0.3, fontStyle: 'italic' }}>// System Idle... Waiting for input</div>
              ) : (
                logs.map((log, i) => (
                  <LogLine key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <span className="time">{new Date().toISOString().split('T')[1].slice(0, 12)}</span>
                    <span className="msg">{log}</span>
                  </LogLine>
                ))
              )}
              {isGenerating && (
                <LogLine>
                  <span className="cursor" />
                </LogLine>
              )}
            </TerminalOutput>
          </ContentArea>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};
