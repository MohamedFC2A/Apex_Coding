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
        'nexus-darker': '#0F172A',
        'nexus-deepest': '#060911',
        'nexus-border': 'rgba(255, 255, 255, 0.06)',
        'nexus-text': 'rgba(255, 255, 255, 0.9)',
        'nexus-muted': 'rgba(255, 255, 255, 0.5)',
      },
      backdropBlur: {
        'glass': '30px',
      }
    },
  },
  plugins: [],
}
