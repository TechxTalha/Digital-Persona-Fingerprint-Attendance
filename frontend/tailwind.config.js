/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        medical: {
          50: '#f0fdfa', // teal-50
          100: '#ccfbf1', // teal-100
          500: '#14b8a6', // teal-500
          600: '#0d9488', // teal-600
          700: '#0f766e', // teal-700
          800: '#115e59', // teal-800
          900: '#134e4a', // teal-900
        },
        primary: {
          50: '#f0f9ff', // sky-50
          100: '#e0f2fe', // sky-100
          500: '#0ea5e9', // sky-500
          600: '#0284c7', // sky-600
          700: '#0369a1', // sky-700
          900: '#0c4a6e', // sky-900
        },
        slate: {
          850: '#1e293b',
          950: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
