/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./screens/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'display': ['Montserrat', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
        'luxury': ['"Cormorant Garamond"', 'Cormorant', 'Georgia', 'serif'],
      },
      colors: {
        primary: '#2B6AFF',
        'primary-hover': '#1A53D9',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: 'hsl(var(--surface))',
        'surface-low': 'hsl(var(--surface-low))',
        'surface-lowest': 'hsl(var(--surface-lowest))',
        'on-surface': 'hsl(var(--on-surface))',
        'on-surface-variant': 'hsl(var(--on-surface-variant))',
        brand: {
          navy: '#0B2149',
          teal: '#00A896',
          gray: '#F3F4F6',
          gold: '#C9A96E',
        },
        sky: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#00A896',
          600: '#008c7d',
          700: '#0B2149',
        },
        gold: {
          light: '#F5E6C8',
          DEFAULT: '#C9A96E',
          dark: '#8B6914',
        }
      }
    },
  },
  plugins: [],
};
