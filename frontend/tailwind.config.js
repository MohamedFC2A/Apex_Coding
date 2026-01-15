/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nexus-dark': '#0B0F14',
        'nexus-darker': '#050505', // Deeper black for contrast
        'nexus-deepest': '#000000',
        'nexus-glass': 'rgba(255, 255, 255, 0.03)',
        'nexus-glass-hover': 'rgba(255, 255, 255, 0.08)',
        'nexus-glass-active': 'rgba(255, 255, 255, 0.12)',
        'nexus-border': 'rgba(255, 255, 255, 0.08)',
        'nexus-border-hover': 'rgba(255, 255, 255, 0.15)',
        'nexus-text': 'rgba(255, 255, 255, 0.95)',
        'nexus-text-secondary': 'rgba(255, 255, 255, 0.6)',
        'nexus-muted': 'rgba(255, 255, 255, 0.4)',
        'nexus-primary': '#3b82f6', // Blue accent
        'nexus-accent': '#8b5cf6', // Purple accent
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
        'glass': '20px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
        'glass-shine': 'linear-gradient(125deg, transparent 30%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.0) 50%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.36)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.2)',
        'glass-hover': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        }
      }
    },
  },
  plugins: [],
}
