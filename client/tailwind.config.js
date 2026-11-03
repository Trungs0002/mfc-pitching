/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        "primary":    "#4645D7",
        "secondary":  "#9EFEFD",
        "tertiary":   "#A896F6",
        "pink":       "#ff4ecb",
        "background": "#01010A",
        "panel":      "#070818",
        "on-surface": "#f7f3ff",
        "on-surface-variant": "#b9b5d6",
        "error":  "#ff6b6b",
      },
      fontFamily: {
        serif:  ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans:   ['"Be Vietnam Pro"', 'Inter', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
      maxWidth: {
        container: '1220px',
      },
      boxShadow: {
        mfc:   '0 0 34px rgba(70,69,215,.25), 0 0 80px rgba(158,254,253,.08)',
        glow:  '0 0 28px rgba(168,150,246,.36)',
      },
    }
  },
  plugins: [],
}
