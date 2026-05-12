/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bordo: {
          50: '#f6effd',
          100: '#ebdbfb',
          200: '#d8b8f6',
          300: '#c18ced',
          400: '#a45fdf',
          500: '#8838cc',
          600: '#6f26ad',
          700: '#5b1f8d',
          800: '#47196f',
          900: '#341351',
          950: '#220a37'
        },
        dourado: {
          50: '#f4fcea',
          100: '#e8f8d4',
          200: '#d2f1ab',
          300: '#b4e77b',
          400: '#95db52',
          500: '#77c92f',
          600: '#5fa320',
          700: '#4a7f19',
          800: '#365d13',
          900: '#26410d',
          950: '#132306'
        },
        escuro: {
          50: '#f5f4f8',
          100: '#e8e6ee',
          200: '#d2cddd',
          300: '#b3abc5',
          400: '#8e84a6',
          500: '#6f6688',
          600: '#574f6c',
          700: '#433d53',
          800: '#302c3c',
          900: '#1f1c27',
          950: '#111018'
        }
      },
      boxShadow: {
        cartao: '0 2px 8px rgba(34, 10, 55, 0.07)'
      }
    }
  },
  plugins: []
}
