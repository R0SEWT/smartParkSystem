/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0E7490",
        accent: "#22c55e",
        ink: "#0f172a"
      }
    }
  },
  plugins: []
};
