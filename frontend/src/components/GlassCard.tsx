import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'none' | 'blue' | 'purple' | 'cyan' | 'amber' | 'success' | 'danger';
  animated?: boolean;
  shine?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover = true,
  glow = 'none',
  animated = false,
  shine = false
}) => {
  const glowClasses = {
    none: '',
    blue: 'shadow-[0_0_25px_rgba(59,130,246,0.2)] border-blue-500/25',
    purple: 'shadow-[0_0_25px_rgba(168,85,247,0.2)] border-purple-500/25',
    cyan: 'shadow-[0_0_25px_rgba(34,211,238,0.2)] border-cyan-500/25',
    amber: 'shadow-[0_0_25px_rgba(251,191,36,0.2)] border-amber-500/25',
    success: 'shadow-[0_0_25px_rgba(16,185,129,0.2)] border-emerald-500/25',
    danger: 'shadow-[0_0_25px_rgba(239,68,68,0.2)] border-red-500/25',
  };

  return (
    <div 
      className={`
        relative overflow-hidden
        bg-nexus-glass backdrop-blur-xl border border-nexus-border
        rounded-xl
        transition-all duration-300 ease-apex-smooth
        ${hover ? `
          hover:bg-nexus-glass-hover 
          hover:border-nexus-border-hover 
          hover:shadow-glass-hover 
          hover:-translate-y-[2px]
          active:translate-y-0
          active:shadow-glass-sm
        ` : ''}
        ${glowClasses[glow]}
        ${animated ? 'animate-pulse-slow' : ''}
        ${className}
      `}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {/* Shine effect on hover */}
      {shine && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
      )}
      
      {/* Content */}
      <div className="relative z-10 h-full min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  );
};

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const LiquidButton: React.FC<LiquidButtonProps> = ({
  variant = 'primary',
  size = 'md',
  glow = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-white border-blue-500/40 hover:from-blue-600/40 hover:to-purple-600/40 hover:border-blue-500/60 hover:shadow-[0_0_25px_rgba(59,130,246,0.3)]',
    secondary: 'bg-white/5 text-white/90 border-white/10 hover:bg-white/10 hover:border-white/20 hover:shadow-glass-sm',
    success: 'bg-emerald-600/20 text-emerald-100 border-emerald-500/30 hover:bg-emerald-600/30 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    danger: 'bg-red-600/20 text-red-100 border-red-500/30 hover:bg-red-600/30 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]',
    ghost: 'bg-transparent text-white/70 border-transparent hover:bg-white/5 hover:text-white',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm rounded-lg',
    md: 'px-6 py-3 rounded-xl',
    lg: 'px-8 py-4 text-lg rounded-2xl',
  };

  return (
    <button
      className={`
        relative overflow-hidden group
        ${sizes[size]}
        flex items-center justify-center gap-2
        font-semibold tracking-wide
        transition-all duration-300 ease-apex-smooth
        border backdrop-blur-md
        hover:-translate-y-0.5
        active:translate-y-0 active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100
        ${variants[variant]}
        ${glow ? 'shadow-glow animate-glow-pulse' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />
      
      {/* Hover shine sweep */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
      
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <span className="relative z-10">{children}</span>
      )}
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
  glow?: 'none' | 'blue' | 'purple' | 'cyan' | 'amber' | 'success';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const LiquidPanel: React.FC<LiquidPanelProps> = ({ 
  children, 
  className = '', 
  hover = false, 
  glow = 'none',
  padding = 'md'
}) => {
  const glowClasses = {
    none: '',
    blue: 'shadow-[0_0_20px_rgba(59,130,246,0.15)] border-blue-500/25',
    purple: 'shadow-[0_0_20px_rgba(168,85,247,0.15)] border-purple-500/25',
    cyan: 'shadow-[0_0_20px_rgba(34,211,238,0.15)] border-cyan-500/25',
    amber: 'shadow-[0_0_20px_rgba(251,191,36,0.15)] border-amber-500/25',
    success: 'shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/25',
  };
  
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-8',
  };

  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl
        bg-nexus-glass backdrop-blur-xl border border-nexus-border
        transition-all duration-300 ease-apex-smooth
        ${hover ? 'hover:bg-nexus-glass-hover hover:border-nexus-border-hover hover:-translate-y-1 hover:shadow-glass-hover' : ''} 
        ${glowClasses[glow]}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
