/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#EDE8DE',
        'paper-dim': '#E1DACB',
        ink: '#3B3B05',
        'ink-deep': '#232303',
        stone: '#C9C0AE',
        smoke: '#3A3A0E',
        camel: '#9C6B3E',
        'camel-soft': '#B98F5F',
        sand: '#8F7F57',
        mist: '#6D7566',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['"Jost"', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.28em',
        widest3: '0.32em',
      },
    },
  },
  plugins: [],
};
