/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // TubeOS Design System
        base: {
          900: '#06060A',
          800: '#0A0A12',
          700: '#0F0F1A',
          600: '#141422',
          500: '#1A1A2E',
          400: '#22223D',
          300: '#2D2D50',
        },
        brand: {
          DEFAULT: '#4F46E5',
          light: '#6366F1',
          dark: '#3730A3',
          glow: 'rgba(79,70,229,0.3)',
        },
        cyan: {
          DEFAULT: '#06B6D4',
          light: '#22D3EE',
          glow: 'rgba(6,182,212,0.3)',
        },
        rose: {
          DEFAULT: '#F43F5E',
          light: '#FB7185',
          glow: 'rgba(244,63,94,0.25)',
        },
        emerald: {
          DEFAULT: '#10B981',
          light: '#34D399',
          glow: 'rgba(16,185,129,0.25)',
        },
        amber: {
          DEFAULT: '#F59E0B',
          light: '#FCD34D',
        },
        muted: '#6B7280',
        surface: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'brand-gradient': 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(79,70,229,0.1) 0%, rgba(6,182,212,0.05) 100%)',
      },
      boxShadow: {
        'brand': '0 0 30px rgba(79,70,229,0.3)',
        'cyan': '0 0 30px rgba(6,182,212,0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'glow': '0 0 60px rgba(79,70,229,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
        'pulse-brand': 'pulseBrand 2s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: 0, transform: 'translateX(-16px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        pulseBrand: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(79,70,229,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(79,70,229,0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
