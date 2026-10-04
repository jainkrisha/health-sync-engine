/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Medical color palette — soft blues/teals
        medical: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        teal: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        slate: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Semantic tokens for medical UI
        surface: {
          DEFAULT: '#f8fafc',
          card:    '#ffffff',
          sidebar: '#0f172a',
          overlay: 'rgba(15,23,42,0.6)',
        },
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          danger:  '#ef4444',
          info:    '#0ea5e9',
          conflict: '#f97316',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card: '0.875rem',
        badge: '9999px',
      },
      boxShadow: {
        // Shadows are tinted with slate-900 so depth reads as part of the palette, not grey smudge.
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'card-lg': '0 4px 6px -1px rgb(15 23 42 / 0.06), 0 10px 24px -6px rgb(15 23 42 / 0.10)',
        'card-hover': '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 12px 28px -8px rgb(15 23 42 / 0.14)',
        pop: '0 20px 48px -12px rgb(15 23 42 / 0.28)',
        'teal-glow': '0 6px 16px -6px rgb(13 148 136 / 0.55)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        overlayIn: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fadeIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slideUp 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        'overlay-in': 'overlayIn 0.2s ease-out both',
      },
      zIndex: {
        header: '20',
        drawer: '40',
        overlay: '50',
        toast: '60',
      },
    },
  },
  plugins: [],
}
