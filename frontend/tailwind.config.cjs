/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#EE7E00', light: '#FFF3E0', dark: '#B85E00' },
        surface: '#f6f8f5',
      },
    },
  },
  plugins: [],
};
