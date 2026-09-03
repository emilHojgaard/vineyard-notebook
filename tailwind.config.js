/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: '#F2EEE5',
          2: '#E9E3D5',
        },
        'paper-line': '#DDD5C3',
        ink: {
          DEFAULT: '#232019',
          soft: '#6A6153',
          faint: '#9B9182',
        },
        surface: {
          DEFAULT: '#FBF9F4',
          2: '#F5F1E8',
        },
        border: '#D6CBB0',
        burgundy: {
          DEFAULT: '#7C2E3A',
          deep: '#5C2029',
        },
        grape: '#6B2D5C',
        barrel: '#93765F',
        vine: '#4A5D23',
        'red-wine': '#8B1538',
        'white-wine': '#97731C',
        cellar: '#211A14',
        status: {
          have: '#4A5D23',
          partial: '#97731C',
          need: '#8B1538',
        },
        st: {
          upcoming: '#8C8275',
          active: '#2E6E8E',
          done: '#4A5D23',
        },
        'page-bg': '#E4DFD2',
        'focus-ring': '#2F6FB0',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(30, 24, 17, 0.10)',
        'phone': '0 18px 40px rgba(30, 24, 17, 0.10)',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
