import React from 'react';
import styled from 'styled-components';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const FallbackRoot = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  padding: 18px;
  background: radial-gradient(900px 500px at 20% 10%, rgba(34, 211, 238, 0.10), transparent 55%),
    radial-gradient(900px 500px at 80% 85%, rgba(168, 85, 247, 0.10), transparent 55%),
    #0d1117;
  color: rgba(255, 255, 255, 0.92);
`;

const Card = styled.div`
  width: min(760px, 100%);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px);
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  padding: 16px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
`;

const Message = styled.div`
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.72);
  white-space: pre-wrap;
`;

const Actions = styled.div`
  margin-top: 14px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  height: 40px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.86);
  font-weight: 800;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  &:hover {
    border-color: rgba(34, 211, 238, 0.22);
    background: rgba(255, 255, 255, 0.08);
  }
`;

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI Crash:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <FallbackRoot>
        <Card role="alert" aria-live="polite">
          <TitleRow>
            <AlertTriangle size={18} color="rgba(248,113,113,0.95)" />
            Something crashed
          </TitleRow>
          <Message>
            {this.state.error?.message ||
              'The UI encountered an error while rendering. You can try resetting the view or reloading the page.'}
          </Message>
          <Actions>
            <ActionButton type="button" onClick={this.handleReset}>
              <RefreshCw size={16} />
              Reset view
            </ActionButton>
            <ActionButton type="button" onClick={() => window.location.reload()}>
              Reload
            </ActionButton>
          </Actions>
        </Card>
      </FallbackRoot>
    );
  }
}

