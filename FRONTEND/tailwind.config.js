/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // THIS LINE IS CRITICAL
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}