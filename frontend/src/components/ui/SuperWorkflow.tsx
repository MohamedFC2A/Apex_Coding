import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAIStore } from '@/stores/aiStore';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { Maximize, Minimize, RotateCcw } from 'lucide-react';

const Wrap = styled.div`
  position: relative;
  width: 100%;
  height: 400px;
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,0.12);
  background: radial-gradient(circle at 50% 50%, rgba(13, 17, 23, 0.95), #000);
  overflow: hidden;
  box-shadow: inset 0 0 80px rgba(0,0,0,0.8);

  @media (max-width: 768px) {
    height: 320px;
    border-radius: 16px;
  }
`;

const OverlayControls = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 12px;
  z-index: 10;
  padding: 8px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
`;

const ControlButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.9);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255,255,255,0.15);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const WorkflowHeader = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  pointer-events: none;
`;

const Title = styled.h3`
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.9);
  display: flex;
  align-items: center;
  gap: 8px;
  text-shadow: 0 2px 10px rgba(0,0,0,0.5);

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    background: #22d3ee;
    border-radius: 50%;
    box-shadow: 0 0 12px #22d3ee;
  }
`;

const Status = styled.div`
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  margin-top: 4px;
  margin-left: 16px;
`;

const CanvasContent = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
`;

const Node = styled.div<{ $active?: boolean; $type?: string }>`
  min-width: 180px;
  padding: 16px 20px;
  border-radius: 16px;
  border: 1px solid ${(p) => (p.$active ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255,255,255,0.1)')};
  background: ${(p) => 
    p.$active 
      ? 'linear-gradient(145deg, rgba(34, 211, 238, 0.15), rgba(168, 85, 247, 0.15))' 
      : 'rgba(13, 17, 23, 0.8)'};
  color: rgba(255,255,255,0.95);
  backdrop-filter: blur(12px);
  box-shadow: ${(p) => (p.$active ? '0 0 40px rgba(34, 211, 238, 0.2), inset 0 0 20px rgba(34, 211, 238, 0.05)' : '0 4px 20px rgba(0,0,0,0.2)')};
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 2;
  transform: ${(p) => (p.$active ? 'scale(1.05)' : 'scale(1)')};

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(255,255,255,0.3);
  }
`;

const NodeTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.9);
`;

const NodeDesc = styled.div`
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  line-height: 1.4;
`;

const Connector = styled.div`
  flex: 1;
  height: 2px;
  background: rgba(255,255,255,0.1);
  min-width: 60px;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.8), transparent);
    transform: translateX(-100%);
    animation: flow 2s linear infinite;
  }

  @keyframes flow {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;

const GraphContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  padding: 100px;
`;

export const SuperWorkflow: React.FC = () => {
  const { isGenerating } = useAIStore();
  const [activeStep, setActiveStep] = useState(0);
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  const nodes = [
    { title: 'Architect', desc: 'Analyzing requirements & structure' },
    { title: 'Planner', desc: 'Breaking down tasks & dependencies' },
    { title: 'Coder', desc: 'Writing implementation code' },
    { title: 'Reviewer', desc: 'Verifying logic & syntax' }
  ];

  // Auto-navigation logic
  useEffect(() => {
    if (!isGenerating) {
      setActiveStep(0);
      // Reset view when stopped
      if (transformRef.current) {
        transformRef.current.resetTransform(1000, 'easeInOutQuad');
      }
      return;
    }

    const interval = setInterval(() => {
      setActiveStep((prev) => {
        const next = (prev + 1) % nodes.length;
        
        // Smart navigation to the next node
        const nodeEl = nodeRefs.current[next];
        if (nodeEl && transformRef.current) {
          // Zoom to element with smooth animation
          transformRef.current.zoomToElement(nodeEl, 1.2, 1200, 'easeInOutQuad');
        }
        
        return next;
      });
    }, 3500); // Slower interval for better readability

    return () => clearInterval(interval);
  }, [isGenerating, nodes.length]);

  return (
    <Wrap>
      <WorkflowHeader>
        <Title>Deep-Thinking Workflow</Title>
        <Status>{isGenerating ? 'Auto-Navigating Active Tasks...' : 'System Ready'}</Status>
      </WorkflowHeader>

      <TransformWrapper
        ref={transformRef}
        initialScale={0.85}
        minScale={0.4}
        maxScale={2.5}
        centerOnInit
        wheel={{ step: 0.1 }}
        smooth={true}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <OverlayControls>
              <ControlButton onClick={() => zoomIn()} aria-label="Zoom In">
                <Maximize size={18} />
              </ControlButton>
              <ControlButton onClick={() => zoomOut()} aria-label="Zoom Out">
                <Minimize size={18} />
              </ControlButton>
              <ControlButton onClick={() => resetTransform()} aria-label="Reset View">
                <RotateCcw size={18} />
              </ControlButton>
            </OverlayControls>

            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%' }}
            >
              <CanvasContent>
                <GraphContainer>
                  {nodes.map((node, i) => (
                    <React.Fragment key={i}>
                      <Node
                        ref={(el) => {
                          nodeRefs.current[i] = el;
                        }}
                        $active={activeStep === i}
                      >
                        <NodeTitle>{node.title}</NodeTitle>
                        <NodeDesc>{node.desc}</NodeDesc>
                      </Node>
                      {i < nodes.length - 1 && <Connector />}
                    </React.Fragment>
                  ))}
                </GraphContainer>
              </CanvasContent>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </Wrap>
  );
};

