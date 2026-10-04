/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // HealthSync palette, taken from the ID pass: warm charcoal, cream,
        // burnt orange and navy ink. The scales keep their old names so every
        // component picks the palette up without per-file changes:
        //   teal    → burnt orange (primary accent)
        //   slate   → charcoal ↔ cream neutrals
        //   medical → navy (secondary / info)
        medical: {
          50:  '#eef2f6',
          100: '#dbe3ec',
          200: '#b8c6d6',
          300: '#8ea3bb',
          400: '#6a829e',
          500: '#4f6378',
          600: '#3a4b5e',
          700: '#2b3d55',
          800: '#22303f',
          900: '#1d2733',
          950: '#121922',
        },
        teal: {
          50:  '#fdf3ee',
          100: '#fae2d6',
          200: '#f5c3ab',
          300: '#ee9f7a',
          400: '#e7804f',
          500: '#e0663a',
          600: '#bb4f29',
          700: '#9a4022',
          800: '#7d3520',
          900: '#652d1d',
          950: '#36150c',
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
          success: '#3f8f6a',
          warning: '#f0a63a',
          danger:  '#c0392b',
          info:    '#3a4b5e',
          conflict: '#e0663a',
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
        'teal-glow': '0 6px 16px -6px rgb(224 102 58 / 0.55)',
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
