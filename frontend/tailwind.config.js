/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        eci: {
          blue:    '#1a3a8f',
          navy:    '#0f2460',
          saffron: '#FF9933',
          green:   '#138808',
        },
        mdis: {
          navy:    '#0f2460',
          blue:    '#1a3272',
          accent:  '#e63329',
          gold:    '#f5a623',
        },
      },
      fontFamily: {
        devanagari: ['"Noto Sans Devanagari"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
