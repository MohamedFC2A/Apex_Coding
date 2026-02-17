/**
 * API Status Component - displays connection status and diagnostics
 */

import React from 'react';
import styled from 'styled-components';
import { useAPIHealth } from '@/hooks/useAPIHealth';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

const StatusContainer = styled.div<{ $status: 'healthy' | 'degraded' | 'checking' }>`
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid;
  background: ${(p) => {
    switch (p.$status) {
      case 'healthy':
        return 'rgba(16, 185, 129, 0.1)';
      case 'degraded':
        return 'rgba(245, 158, 11, 0.1)';
      case 'checking':
        return 'rgba(59, 130, 246, 0.1)';
    }
  }};
  border-color: ${(p) => {
    switch (p.$status) {
      case 'healthy':
        return 'rgba(16, 185, 129, 0.3)';
      case 'degraded':
        return 'rgba(245, 158, 11, 0.3)';
      case 'checking':
        return 'rgba(59, 130, 246, 0.3)';
    }
  }};
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: ${(p) => {
    switch (p.$status) {
      case 'healthy':
        return '#10b981';
      case 'degraded':
        return '#f59e0b';
      case 'checking':
        return '#3b82f6';
    }
  }};
`;

const StatusIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
`;

const StatusText = styled.div`
  flex: 1;
  font-weight: 500;
`;

const RefreshButton = styled.button`
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.7;
  transition: opacity 200ms ease;

  &:hover {
    opacity: 1;
  }

  &:active {
    transform: scale(0.95);
  }
`;

export interface APIStatusProps {
  showOnHealthy?: boolean;
  showDetails?: boolean;
  onHealthChange?: (isHealthy: boolean) => void;
}

export const APIStatus: React.FC<APIStatusProps> = ({
  showOnHealthy = false,
  showDetails = false,
  onHealthChange
}) => {
  const { isHealthy, isChecking, error, suggestions, checkHealth } = useAPIHealth();

  React.useEffect(() => {
    onHealthChange?.(isHealthy);
  }, [isHealthy, onHealthChange]);

  if (isHealthy && !showOnHealthy) {
    return null;
  }

  const status = isChecking ? 'checking' : isHealthy ? 'healthy' : 'degraded';

  return (
    <StatusContainer $status={status}>
      <StatusIcon>
        {isChecking && <Loader2 size={16} className="animate-spin" />}
        {!isChecking && isHealthy && <CheckCircle2 size={16} />}
        {!isChecking && !isHealthy && <AlertTriangle size={16} />}
      </StatusIcon>
      <StatusText>
        {isChecking && 'Checking connection...'}
        {!isChecking && isHealthy && 'API connection OK'}
        {!isChecking && !isHealthy && (
          <>
            {showDetails ? error : 'Connection issue detected'}
          </>
        )}
      </StatusText>
      {!isChecking && !isHealthy && (
        <RefreshButton onClick={() => checkHealth(true)}>
          <RefreshCw size={12} style={{ display: 'inline' }} /> Retry
        </RefreshButton>
      )}
    </StatusContainer>
  );
};

APIStatus.displayName = 'APIStatus';
