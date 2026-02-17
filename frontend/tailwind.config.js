/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Mobile-first responsive breakpoints
    screens: {
      'xs': '320px',
      'sm': '480px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      // Touch-friendly sizes
      'touch': { 'raw': '(pointer: coarse)' },
      'no-touch': { 'raw': '(pointer: fine)' },
    },
    extend: {
      colors: {
        // Core backgrounds
        'nexus-dark': '#0B0F14',
        'nexus-darker': '#050505',
        'nexus-deepest': '#000000',
        'nexus-surface': '#181818',
        
        // Glass effects
        'nexus-glass': 'rgba(255, 255, 255, 0.03)',
        'nexus-glass-hover': 'rgba(255, 255, 255, 0.06)',
        'nexus-glass-active': 'rgba(255, 255, 255, 0.10)',
        
        // Borders
        'nexus-border': 'rgba(255, 255, 255, 0.08)',
        'nexus-border-hover': 'rgba(255, 255, 255, 0.15)',
        'nexus-border-active': 'rgba(255, 255, 255, 0.22)',
        
        // Text
        'nexus-text': 'rgba(255, 255, 255, 0.95)',
        'nexus-text-secondary': 'rgba(255, 255, 255, 0.7)',
        'nexus-muted': 'rgba(255, 255, 255, 0.4)',
        
        // Primary palette
        'nexus-primary': '#3b82f6',
        'nexus-accent': '#8b5cf6',
        
        // Semantic colors
        'apex-primary': '#3b82f6',
        'apex-accent': '#8b5cf6',
        'apex-success': '#10b981',
        'apex-warning': '#f59e0b',
        'apex-danger': '#ef4444',
        'apex-cyan': '#22d3ee',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
        'glass': '24px',
        'heavy': '40px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
        'glass-shine': 'linear-gradient(125deg, transparent 30%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.0) 50%)',
        'apex-gradient': 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        'gold-gradient': 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 50%, #B45309 100%)',
        'silver-gradient': 'linear-gradient(135deg, #FFFFFF 0%, #CBD5E1 50%, #FFFFFF 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.2)',
        'glass-hover': '0 12px 48px 0 rgba(0, 0, 0, 0.45)',
        'glass-lg': '0 16px 48px 0 rgba(0, 0, 0, 0.55)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
        'glow-purple': '0 0 30px rgba(139, 92, 246, 0.25)',
        'glow-cyan': '0 0 30px rgba(34, 211, 238, 0.25)',
        'glow-gold': '0 0 25px rgba(245, 158, 11, 0.2)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'inner-light-strong': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
      },
      borderRadius: {
        'apex-sm': '8px',
        'apex-md': '12px',
        'apex-lg': '16px',
        'apex-xl': '20px',
        'apex-2xl': '24px',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'touch': '44px', // Touch target minimum
        'touch-lg': '48px', // Large touch target
      },
      minWidth: {
        'touch': '44px', // Touch target minimum
        'touch-lg': '48px', // Large touch target
      },
      padding: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'fade-in': 'fadeIn 0.3s ease forwards',
        'fade-in-scale': 'fadeInScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'float': 'float 4s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(8px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          'from': { opacity: '0', transform: 'scale(0.95)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.25)' },
          '50%': { boxShadow: '0 0 40px rgba(59, 130, 246, 0.4)' },
        },
      },
      transitionTimingFunction: {
        'apex-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'apex-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'apex-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'arabic': ['Cairo', 'Noto Sans Arabic', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
