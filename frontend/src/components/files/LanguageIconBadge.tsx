import React from 'react';
import styled from 'styled-components';
import { getLanguageIconMeta } from '@/config/languageIcons';

const Wrap = styled.span<{ $accent: string; $size: 'sm' | 'md' }>`
  width: ${(p) => (p.$size === 'sm' ? '16px' : '18px')};
  height: ${(p) => (p.$size === 'sm' ? '16px' : '18px')};
  border-radius: 5px;
  border: 1px solid color-mix(in oklab, ${(p) => p.$accent} 42%, #ffffff 16%);
  background: color-mix(in oklab, ${(p) => p.$accent} 16%, rgba(255, 255, 255, 0.06));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

interface LanguageIconBadgeProps {
  language?: string;
  size?: 'sm' | 'md';
}

export const LanguageIconBadge: React.FC<LanguageIconBadgeProps> = ({ language, size = 'md' }) => {
  const meta = getLanguageIconMeta(language);
  return (
    <Wrap $accent={meta.accent} $size={size} title={meta.label} aria-label={meta.label}>
      <img src={meta.iconPath} alt={meta.label} loading="lazy" />
    </Wrap>
  );
};
