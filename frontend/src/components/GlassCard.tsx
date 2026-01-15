import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'none' | 'blue' | 'purple' | 'cyan' | 'amber';
  animated?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover = true,
  glow = 'none',
  animated = false
}) => {
  const glowClasses = {
    none: '',
    blue: 'shadow-[0_0_20px_rgba(59,130,246,0.15)] border-blue-500/20',
    purple: 'shadow-[0_0_20px_rgba(168,85,247,0.15)] border-purple-500/20',
    cyan: 'shadow-[0_0_20px_rgba(34,211,238,0.15)] border-cyan-500/20',
    amber: 'shadow-[0_0_20px_rgba(251,191,36,0.15)] border-amber-500/20',
  };

  return (
    <div 
      className={`
        glass-card
        bg-nexus-glass backdrop-blur-xl border border-nexus-border
        rounded-xl
        transition-all duration-300 ease-out
        ${hover ? 'hover:bg-nexus-glass-hover hover:border-nexus-border-hover hover:shadow-glass-hover hover:-translate-y-[2px]' : ''}
        ${glowClasses[glow]}
        ${animated ? 'animate-pulse-slow' : ''}
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
  const variants = {
    primary: 'bg-blue-600/20 text-blue-100 border-blue-500/30 hover:bg-blue-600/30 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(37,99,235,0.3)]',
    secondary: 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:border-white/20',
    success: 'bg-green-600/20 text-green-100 border-green-500/30 hover:bg-green-600/30 hover:border-green-500/50 hover:shadow-[0_0_15px_rgba(22,163,74,0.3)]',
    danger: 'bg-red-600/20 text-red-100 border-red-500/30 hover:bg-red-600/30 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)]',
  };

  return (
    <button
      className={`
        relative overflow-hidden
        px-6 py-3 rounded-xl
        flex items-center justify-center gap-2
        font-medium tracking-wide transition-all duration-300
        border backdrop-blur-md
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none
        ${variants[variant]}
        ${glow ? 'shadow-glow' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
      
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
      <div className="relative group">
        {icon && <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 group-focus-within:text-blue-400 transition-colors">{icon}</div>}
        <input 
          className={`
            w-full p-4 rounded-xl
            bg-nexus-glass border border-nexus-border
            text-white placeholder-gray-500
            focus:outline-none focus:bg-nexus-glass-active focus:border-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)]
            transition-all duration-300
            backdrop-blur-md
            ${icon ? 'pl-10' : ''} 
            ${error ? 'border-red-500/50 focus:border-red-500' : ''} 
            ${className}
          `} 
          {...props} 
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
};

interface LiquidPanelProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'none' | 'blue' | 'purple' | 'cyan' | 'amber';
}

export const LiquidPanel: React.FC<LiquidPanelProps> = ({ children, className = '', hover = false, glow = 'none' }) => {
  const glowClasses = {
    none: '',
    blue: 'shadow-[0_0_15px_rgba(59,130,246,0.1)] border-blue-500/20',
    purple: 'shadow-[0_0_15px_rgba(168,85,247,0.1)] border-purple-500/20',
    cyan: 'shadow-[0_0_15px_rgba(34,211,238,0.1)] border-cyan-500/20',
    amber: 'shadow-[0_0_15px_rgba(251,191,36,0.1)] border-amber-500/20',
  };

  return (
    <div 
      className={`
        glass-panel rounded-xl
        bg-nexus-glass backdrop-blur-xl border border-nexus-border
        ${hover ? 'hover:bg-nexus-glass-hover hover:border-nexus-border-hover transition-colors duration-300' : ''} 
        ${glowClasses[glow]} 
        ${className}
      `}
    >
      {children}
    </div>
  );
};
