import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f6f6",
          100: "#e7e7e7",
          200: "#cfcfcf",
          300: "#b0b0b0",
          400: "#8a8a8a",
          500: "#6e6e6e",
          600: "#5a5a5a",
          700: "#4a4a4a",
          800: "#2f2f2f",
          900: "#1f1f1f"
        },
        brand: {
          50: "#ecf7ff",
          100: "#d7eeff",
          200: "#addcff",
          300: "#7fc6ff",
          400: "#4ba8ff",
          500: "#1e86ff",
          600: "#0f6ce6",
          700: "#0f54b0",
          800: "#0f4185",
          900: "#0c2d5d"
        },
        accent: {
          500: "#ff8a3d",
          600: "#f26b1d"
        }
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Source Sans 3", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 8px 30px rgba(16, 24, 40, 0.12)"
      }
    }
  },
  plugins: []
} satisfies Config;
