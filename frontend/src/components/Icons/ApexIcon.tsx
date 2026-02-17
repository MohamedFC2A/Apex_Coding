import React, { CSSProperties } from 'react';
import * as LucideIcons from 'lucide-react';

// Custom SVG icons
import {
  LogoIcon,
  AIBrainIcon,
  FastZapIcon,
  SuperRocketIcon,
  PreviewWindowIcon,
  ConnectedDotsIcon,
} from './custom/LogoIcon';

type SizeType = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type IconType = 'custom' | 'lucide';

const sizeMap: Record<SizeType, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
};

const customIconMap: Record<string, React.FC<any>> = {
  logo: LogoIcon,
  aiBrain: AIBrainIcon,
  fastZap: FastZapIcon,
  superRocket: SuperRocketIcon,
  previewWindow: PreviewWindowIcon,
  connectedDots: ConnectedDotsIcon,
};

export interface ApexIconProps {
  /** Icon type: custom SVG or Lucide React */
  type?: IconType;
  /** Icon name */
  name: string;
  /** Size of the icon */
  size?: SizeType;
  /** Additional CSS classes */
  className?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Color of the icon */
  color?: string;
  /** Stroke width (for custom icons) */
  strokeWidth?: number;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Whether icon is disabled */
  disabled?: boolean;
}

/**
 * Unified Icon Component
 * Renders either custom SVG icons or Lucide React icons
 * 
 * @example
 * // Custom SVG icon
 * <ApexIcon type="custom" name="logo" size="lg" ariaLabel="App logo" />
 * 
 * // Lucide icon
 * <ApexIcon type="lucide" name="Code" size="md" className="text-blue-500" />
 * 
 * // Default to custom if name matches
 * <ApexIcon name="aiBrain" size="xl" />
 */
export const ApexIcon: React.FC<ApexIconProps> = ({
  type,
  name,
  size = 'md',
  className = '',
  ariaLabel,
  color,
  strokeWidth = 2,
  style = {},
  disabled = false,
}) => {
  const sizeValue = sizeMap[size];
  const iconSize = { width: sizeValue, height: sizeValue };

  // Determine the type automatically if not specified
  let effectiveType = type;
  if (!effectiveType) {
    effectiveType = customIconMap[name] ? 'custom' : 'lucide';
  }

  // Render custom SVG icon
  if (effectiveType === 'custom') {
    const CustomIcon = customIconMap[name];
    if (!CustomIcon) {
      console.warn(`Custom icon "${name}" not found. Check Icons/custom/ folder.`);
      return null;
    }

    return (
      <CustomIcon
        size={sizeValue}
        className={`${className} ${disabled ? 'opacity-50' : ''}`}
        style={{ color, ...style, ...iconSize }}
        aria-label={ariaLabel}
        strokeWidth={strokeWidth}
      />
    );
  }

  // Render Lucide React icon
  if (effectiveType === 'lucide') {
    const LucideIcon = LucideIcons[name as keyof typeof LucideIcons] as React.FC<any>;
    if (!LucideIcon) {
      console.warn(`Lucide icon "${name}" not found.`);
      return null;
    }

    return (
      <LucideIcon
        size={sizeValue}
        className={`${className} ${disabled ? 'opacity-50' : ''}`}
        style={{ color, ...style }}
        aria-label={ariaLabel}
        strokeWidth={strokeWidth}
      />
    );
  }

  return null;
};

ApexIcon.displayName = 'ApexIcon';
