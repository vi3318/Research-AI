/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#edf3ff',
          100: '#dce9ff',
          200: '#b9d4ff',
          300: '#94bdff',
          400: '#6fa1ff',
          500: '#4f85fb',
          600: '#3566d6',
          700: '#274da6',
          800: '#1c387a',
          900: '#132853',
        }
      }
    },
  },
  plugins: [],
}

