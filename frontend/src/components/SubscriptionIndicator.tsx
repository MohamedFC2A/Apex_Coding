import styled from 'styled-components';
import { Zap, Crown } from 'lucide-react';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import Link from 'next/link';

const Indicator = styled(Link)<{ $isPro: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid ${p => p.$isPro ? 'rgba(251, 191, 36, 0.3)' : 'rgba(34, 211, 238, 0.3)'};
  background: ${p => p.$isPro ? 'rgba(251, 191, 36, 0.1)' : 'rgba(34, 211, 238, 0.08)'};
  color: ${p => p.$isPro ? 'rgba(251, 191, 36, 0.95)' : 'rgba(34, 211, 238, 0.95)'};
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${p => p.$isPro ? 'rgba(251, 191, 36, 0.15)' : 'rgba(34, 211, 238, 0.12)'};
    border-color: ${p => p.$isPro ? 'rgba(251, 191, 36, 0.5)' : 'rgba(34, 211, 238, 0.5)'};
    transform: translateY(-1px);
  }
`;

const Count = styled.span`
  font-weight: 900;
  font-variant-numeric: tabular-nums;
`;

export function SubscriptionIndicator() {
  const { tier, getRemainingRequests } = useSubscriptionStore();
  const remaining = getRemainingRequests();
  const isPro = tier === 'PRO';

  return (
    <Indicator href="/pricing" $isPro={isPro}>
      {isPro ? <Crown size={14} /> : <Zap size={14} />}
      <span>{tier}</span>
      <span style={{ opacity: 0.6 }}>•</span>
      <Count>{remaining}</Count>
      <span style={{ opacity: 0.7 }}>left</span>
    </Indicator>
  );
}
