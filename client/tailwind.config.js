/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // HealthSync palette: calm clinical blue for actions and links, on
        // Tailwind's own slate neutrals. Status colours are Tailwind's green
        // (done, saved), amber (waiting, needs a look) and red (danger, severe
        // allergy). Every text pairing used in the app meets WCAG AA contrast.
        brand: {
          50: '#eef4fb',
          100: '#d9e6f5',
          200: '#b5cdeb',
          300: '#86acdb',
          400: '#5287c6',
          500: '#2f6bb0',
          600: '#1f5fa6',
          700: '#194e8a',
          800: '#153f6f',
          900: '#12345a',
          950: '#0b2039',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.06)',
        pop: '0 12px 32px -8px rgb(15 23 42 / 0.25)',
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
