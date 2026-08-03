/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f6f7',
          100: '#e9f1f1',
          500: '#1a5a63',
          600: '#153E45',
          700: '#0F3137',
        },
      },
    },
  },
  plugins: [],
}

