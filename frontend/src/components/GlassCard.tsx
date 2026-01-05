import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'none' | 'blue' | 'purple' | 'cyan';
  animated?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover = true,
  glow = 'none',
  animated = false
}) => {
  return (
    <div 
      className={`
        liquid-glass 
        ${hover ? 'hover:transform hover:translate-y-[-2px]' : ''}
        ${glow === 'blue' ? 'glow-blue' : ''}
        ${glow === 'purple' ? 'glow-purple' : ''}
        ${glow === 'cyan' ? 'glow-cyan' : ''}
        ${animated ? 'glass-shimmer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  glow?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const LiquidButton: React.FC<LiquidButtonProps> = ({
  variant = 'primary',
  glow = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'liquid-button px-6 py-3 flex items-center justify-center gap-2';
  
  return (
    <button
      className={`${baseClasses} ${glow ? 'glow-blue' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </>
      ) : children}
    </button>
  );
};

interface LiquidInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const LiquidInput: React.FC<LiquidInputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-semibold text-white/80">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50">{icon}</div>}
        <input className={`liquid-input w-full p-4 text-white placeholder-gray-400 ${icon ? 'pl-10' : ''} ${error ? 'border-red-500/50' : ''} ${className}`} {...props} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
};

interface LiquidPanelProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'none' | 'blue' | 'purple' | 'cyan';
}

export const LiquidPanel: React.FC<LiquidPanelProps> = ({ children, className = '', hover = false, glow = 'none' }) => {
  return (
    <div className={`liquid-panel ${hover ? 'hover:bg-white/5 transition-colors' : ''} ${glow === 'blue' ? 'glow-blue' : ''} ${glow === 'purple' ? 'glow-purple' : ''} ${glow === 'cyan' ? 'glow-cyan' : ''} ${className}`}>
      {children}
    </div>
  );
};
