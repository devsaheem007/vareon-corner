/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        crimson: "#E63946",
        ink: "#0D0D0D",
        carbon: "#1A1A1A",
      },
      boxShadow: {
        crimson: "0 8px 18px rgba(230,57,70,.18)",
      }
    },
  },
  plugins: [],
}