import React from 'react';

interface CustomIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
  'aria-label'?: string;
}

/**
 * Apex Coding Logo Icon
 * Custom SVG with gradient fill
 */
export const LogoIcon: React.FC<CustomIconProps> = ({
  size = 24,
  className = '',
  style = {},
  'aria-label': ariaLabel = 'Apex logo',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="apexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L22 8V16L12 22L2 16V8L12 2Z"
        fill="url(#apexGradient)"
        opacity="0.8"
      />
      <path
        d="M12 2L22 8V16L12 22L2 16V8L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
};

/**
 * AI Brain Icon
 * Represents artificial intelligence with neural network theme
 */
export const AIBrainIcon: React.FC<CustomIconProps> = ({
  size = 24,
  className = '',
  style = {},
  'aria-label': ariaLabel = 'AI brain',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="5" cy="15" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="19" cy="15" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="8" cy="20" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="20" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      
      {/* Connections */}
      <line x1="10" y1="11" x2="7" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="14" y1="11" x2="17" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="5" y1="18" x2="8" y2="17.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="19" y1="18" x2="16" y2="17.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="12" y1="12" x2="12" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      
      <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.2" />
    </svg>
  );
};

/**
 * Fast Zap Icon
 * Represents speed and energy
 */
export const FastZapIcon: React.FC<CustomIconProps> = ({
  size = 24,
  className = '',
  style = {},
  strokeWidth = 2,
  'aria-label': ariaLabel = 'Fast zap',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      <path
        d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" opacity="0.15" />
    </svg>
  );
};

/**
 * Super Rocket Icon
 * Represents power and launch
 */
export const SuperRocketIcon: React.FC<CustomIconProps> = ({
  size = 24,
  className = '',
  style = {},
  strokeWidth = 1.5,
  'aria-label': ariaLabel = 'Super rocket',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {/* Rocket body */}
      <path
        d="M12 2C12 2 8 6 8 12C8 18 12 22 12 22C12 22 16 18 16 12C16 6 12 2 12 2Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
      />
      
      {/* Rocket window */}
      <circle cx="12" cy="7" r="2" stroke="currentColor" strokeWidth={strokeWidth} fill="currentColor" opacity="0.6" />
      
      {/* Left fin */}
      <path
        d="M8 15L5 20"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Right fin */}
      <path
        d="M16 15L19 20"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Flames */}
      <path
        d="M10 20L9 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        opacity="0.7"
      />
      <path
        d="M12 21L12 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        opacity="0.7"
      />
      <path
        d="M14 20L15 24"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
};

/**
 * Preview Window Icon
 * Represents live preview
 */
export const PreviewWindowIcon: React.FC<CustomIconProps> = ({
  size = 24,
  className = '',
  style = {},
  strokeWidth = 1.5,
  'aria-label': ariaLabel = 'Preview window',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {/* Window frame */}
      <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth={strokeWidth} />
      
      {/* Title bar */}
      <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.5" />
      
      {/* Window buttons */}
      <circle cx="6" cy="5.5" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="5.5" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="14" cy="5.5" r="1" fill="currentColor" opacity="0.6" />
      
      {/* Content area - browser window elements */}
      <circle cx="8" cy="14" r="3" fill="currentColor" opacity="0.3" />
      <rect x="13" y="12" width="6" height="2" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="13" y="15" width="4" height="2" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
};

/**
 * Connected Dots Icon
 * Represents project interconnectedness and integration
 */
export const ConnectedDotsIcon: React.FC<CustomIconProps> = ({
  size = 24,
  className = '',
  style = {},
  strokeWidth = 1.5,
  'aria-label': ariaLabel = 'Connected dots',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {/* Connecting lines */}
      <line x1="6" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.5" />
      <line x1="18" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.5" />
      <line x1="18" y1="18" x2="6" y2="18" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.5" />
      <line x1="6" y1="18" x2="6" y2="6" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.5" />
      
      {/* Center connection */}
      <line x1="6" y1="6" x2="12" y2="12" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.4" />
      <line x1="18" y1="6" x2="12" y2="12" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.4" />
      <line x1="18" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.4" />
      <line x1="6" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.4" />
      
      {/* Corner dots */}
      <circle cx="6" cy="6" r="2" fill="currentColor" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
      <circle cx="18" cy="18" r="2" fill="currentColor" />
      <circle cx="6" cy="18" r="2" fill="currentColor" />
      
      {/* Center dot */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
};
