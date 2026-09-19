/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ffcv: {
          navy: '#061338',
          blue: '#002568',
          royal: '#003db3',
          accent: '#ff6600',
          cyan: '#00a3e0',
          bg: '#f4f6fa',
          card: '#ffffff',
          darkBg: '#050c1e'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
