/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (see src/index.css), so the dark screen swaps one
// set of values instead of every class carrying a dark: twin.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: v('ink'), // body text
        muted: v('muted'), // hints and secondary text
        paper: v('paper'), // page
        panel: v('panel'), // table heads, details, quiet areas
        line: v('line'), // form borders and rules
        rule: v('rule'), // light row separators
        link: v('link'),
        band: v('band'), // the header band
        go: v('go'), // primary action
        'go-edge': v('go-edge'),
        alert: v('alert'), // allergies, errors, removal
        'alert-soft': v('alert-soft'),
        warn: v('warn'), // waiting, not sent yet
        'warn-soft': v('warn-soft'),
        ok: v('ok'),
        focus: v('focus'),
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', '"Atkinson Hyperlegible"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      maxWidth: {
        page: '60rem',
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
