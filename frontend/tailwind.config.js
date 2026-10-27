/** @type {import('tailwindcss').Config} */

// India Post brand palette.
// Red is the Department of Posts' primary colour (traditional association with
// the postal service) and yellow/gold is its companion accent.
const brand = {
  50: "#fff1f1",
  100: "#ffdfdf",
  200: "#ffc5c5",
  300: "#ff9d9d",
  400: "#fb6464",
  500: "#e31e24",
  600: "#c8141a",
  700: "#a80f15",
  800: "#8a1014",
  900: "#721114",
  950: "#3f0507",
};

const gold = {
  50: "#fffaeb",
  100: "#fff2c7",
  200: "#ffe58a",
  300: "#ffd54d",
  400: "#ffc61f",
  500: "#fdb913",
  600: "#e09c05",
  700: "#b87705",
  800: "#955c0b",
  900: "#7b4c0d",
  950: "#472a03",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { brand, gold },
      backgroundImage: {
        // India Post photography, served from frontend/public/images.
        "postal-hero": "url('/images/postal-hero.jpg')",
        "postal-desk": "url('/images/postal-desk.jpg')",
        "postal-stamps": "url('/images/postal-stamps.jpg')",
      },
    },
  },
  plugins: [],
};
