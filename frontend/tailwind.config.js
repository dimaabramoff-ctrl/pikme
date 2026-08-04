/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e8f4f5',
          100: '#d4ecee',
          500: '#0f5a63',
          600: '#0b4750',
          700: '#08373d',
        },
      },
    },
  },
  plugins: [],
}

