/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Times New Roman', 'serif'],
      },
      colors: {
        brand: {
          50: '#ddedee',
          100: '#c8e0e1',
          500: '#17666d',
          600: '#13555b',
          700: '#102f35',
          accent: '#c56f4e',
          gold: '#d8b27a',
          milk: '#f7f3ec',
        },
      },
    },
  },
  plugins: [],
}

