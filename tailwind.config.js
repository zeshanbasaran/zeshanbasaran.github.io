/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Orbitron', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: { neon: { 400: '#00f0ff', 500: '#12d5e8' } },
      boxShadow: { glow: '0 0 10px rgba(18,213,232,.6), 0 0 30px rgba(18,213,232,.25)' },
      maxWidth: { content: '1100px' },
    },
  },
  plugins: [],
};
