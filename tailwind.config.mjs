/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#07121f',
        abyss: '#0a2a4a',
        sea: '#1273c4',
        lagoon: '#3fd0d4',
        foam: '#f3fbff',
        brass: {
          DEFAULT: '#d4a94a',
          light: '#f1d58a',
          dark: '#8a6a2a',
        },
        parchment: '#f3e7cc',
        vermilion: '#e0483a',
      },
      fontFamily: {
        display: ['"IM Fell English SC"', 'Georgia', 'serif'],
        body: ['Spectral', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        chart: '0.22em',
      },
      keyframes: {
        'led-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.82)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'led-pulse': 'led-pulse 1.4s ease-in-out infinite',
        'rise-in': 'rise-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
