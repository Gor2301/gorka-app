import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'gorka-cream': '#fbf9f4',
        'gorka-dark': '#1a1a1a',
        'gorka-black': '#000000',
        'gorka-violet': '#712fff',
        'gorka-red': '#f01428',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      spacing: {
        'section-y-sm': '80px',
        'section-y-md': '100px',
        'section-y-lg': '160px',
        'section-x': '40px',
      },
      maxWidth: {
        container: '1200px',
        'container-dark': '1440px',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-40px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite alternate',
        'float-slow': 'float-slow 20s ease-in-out infinite alternate',
        'pulse-soft': 'pulse-soft 8s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
}

export default config