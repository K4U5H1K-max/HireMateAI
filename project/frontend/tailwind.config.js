/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#05fcd3',
          dim: '#04dab8',
          muted: 'rgba(5, 252, 211, 0.15)',
          border: 'rgba(5, 252, 211, 0.35)',
        },
        surface: {
          DEFAULT: '#05060a',
          raised: '#0b0f17',
          card: 'rgba(17, 24, 39, 0.55)',
          overlay: 'rgba(0, 0, 0, 0.5)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(5, 252, 211, 0.25)',
        'glow-lg': '0 0 40px rgba(5, 252, 211, 0.35)',
        card: '0 0 40px rgba(0, 255, 213, 0.12)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.45s ease-out forwards',
      },
    },
  },
  plugins: [],
};
