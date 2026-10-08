/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // HealthSync palette: warm charcoal and cream neutrals, a deep pine
        // teal brand, ink blue for information and a navy for conflict cards.
        // The scales keep their old names so every component picks the
        // palette up without per-file changes:
        //   teal    → pine (brand / primary action)
        //   slate   → charcoal ↔ cream neutrals
        //   medical → ink blue (info, links) with navy at 700-900
        //   orange  → ochre (conflicts / needs review)
        //   amber   → ochre (warnings)
        //   rose    → clinical red (danger, severe allergy)
        medical: {
          50:  '#eef3f9',
          100: '#dbe6f2',
          200: '#b9cde6',
          300: '#9db9dc',
          400: '#7ea3cf',
          500: '#4f7cb0',
          600: '#2f5f94',
          700: '#2b3d55',
          800: '#22303f',
          900: '#1d2733',
          950: '#121922',
        },
        teal: {
          50:  '#eef6f3',
          100: '#d5ebe3',
          200: '#acd6c8',
          300: '#8cc7b5',
          400: '#5faf98',
          500: '#3a8f7a',
          600: '#2a7564',
          700: '#22665a',
          800: '#1d5349',
          900: '#173a33',
          950: '#0e231f',
        },
        orange: {
          50:  '#fbf3e2',
          100: '#f6e5c0',
          200: '#eed192',
          300: '#e6b95e',
          400: '#d9a23c',
          500: '#c8901f',
          600: '#a87714',
          700: '#8a5a0b',
          800: '#6b4510',
          900: '#4a3212',
          950: '#33270f',
        },
        amber: {
          50:  '#fbf3e2',
          100: '#f6e5c0',
          200: '#eed192',
          300: '#e6b95e',
          400: '#d9a23c',
          500: '#c8901f',
          600: '#a87714',
          700: '#8a5a0b',
          800: '#6b4510',
          900: '#4a3212',
          950: '#33270f',
        },
        rose: {
          50:  '#fbe6e2',
          100: '#f7d3cc',
          200: '#f2b8ae',
          300: '#f09488',
          400: '#e3705f',
          500: '#c8463b',
          600: '#b23a30',
          700: '#9e2f26',
          800: '#7e271f',
          900: '#5a1e18',
          950: '#3a1a16',
        },
        slate: {
          50:  '#f7f4ee',
          100: '#efe9dd',
          200: '#e2dbcc',
          300: '#cdc4b1',
          400: '#a39a88',
          500: '#7a7263',
          600: '#5c554a',
          700: '#423d35',
          800: '#2a2620',
          900: '#1b1814',
          950: '#110f0c',
        },
        // Muted green from the ID pass stripe: "done / synced / online".
        sage: {
          50:  '#eef5f1',
          100: '#d9e9e0',
          200: '#b5d3c3',
          300: '#8bb8a1',
          400: '#6e9f86',
          500: '#5f8f7a',
          600: '#4a7562',
          700: '#3c5f50',
          800: '#2f4a3f',
          900: '#233830',
          950: '#132019',
        },
        // Semantic tokens for medical UI
        surface: {
          DEFAULT: '#f7f4ee',
          card:    '#fdfbf7',
          sidebar: '#1b1814',
          overlay: 'rgba(17,15,12,0.6)',
        },
        status: {
          success: '#2a7564',
          warning: '#c8901f',
          danger:  '#b23a30',
          info:    '#2f5f94',
          conflict: '#c8901f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card: '0.875rem',
        badge: '9999px',
      },
      boxShadow: {
        // Shadows are tinted with slate-900 so depth reads as part of the palette, not grey smudge.
        card: '0 1px 2px 0 rgb(27 24 20 / 0.04), 0 1px 3px 0 rgb(27 24 20 / 0.06)',
        'card-lg': '0 4px 6px -1px rgb(27 24 20 / 0.06), 0 10px 24px -6px rgb(27 24 20 / 0.10)',
        'card-hover': '0 2px 4px -1px rgb(27 24 20 / 0.06), 0 12px 28px -8px rgb(27 24 20 / 0.14)',
        pop: '0 20px 48px -12px rgb(27 24 20 / 0.28)',
        // Kept so existing classes still compile; coloured glows are gone.
        'teal-glow': '0 0 #0000',
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
