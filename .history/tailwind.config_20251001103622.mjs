module.exports = {
  content: [
    "./src/**/*.{astro,html,md,mdx,js,jsx,ts,tsx}",
    "./public/**/*.html",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        charcoal: "#0B0F17",
        neon: { cyan: "#00E5FF", magenta: "#FF2BD1", lime: "#C6FF00" },
      },
      boxShadow: {
        neon: "0 0 12px rgba(0,229,255,.55), 0 0 24px rgba(255,43,209,.25)",
      },
    },
  },
  plugins: [],
};
