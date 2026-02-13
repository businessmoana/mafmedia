/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fef7ee',
          100: '#fdecd6',
          200: '#fad5ad',
          300: '#f6b879',
          400: '#f19243',
          500: '#ed751d',
          600: '#de5b13',
          700: '#b84412',
          800: '#933616',
          900: '#772f16',
          950: '#401509',
        },
        slate: {
          850: '#1a2332',
          950: '#0d1321',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.25), 0 1px 2px -1px rgb(0 0 0 / 0.2)',
        'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.35), 0 2px 6px -2px rgb(0 0 0 / 0.2)',
        glow: '0 0 20px -4px rgb(237 117 29 / 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
