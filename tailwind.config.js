/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sophisticated Medical Palette
        primary: {
          DEFAULT: '#147D92',
          deep: '#0F4C5C',
          teal: '#1F8A70',
        },
        surface: {
          bg: '#F6FAFB',
          card: '#FFFFFF',
          accent: '#DFF4F3',
          soft: '#EAF6F8',
          border: '#E2E8F0',
        },
        ink: {
          DEFAULT: '#102A43',
          muted: '#486581',
          subtle: '#627D98',
        },
        status: {
          success: '#2E7D32',
          warning: '#D97706',
          danger: '#C62828',
        },
      },
      boxShadow: {
        bento: '0 2px 10px rgba(15, 76, 92, 0.04), 0 1px 3px rgba(15, 76, 92, 0.02)',
        'bento-hover': '0 8px 25px rgba(15, 76, 92, 0.08), 0 2px 6px rgba(15, 76, 92, 0.04)',
      },
    },
  },
  plugins: [],
}
