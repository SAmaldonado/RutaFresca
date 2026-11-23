import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rf: {
          green: "#3A9D4A",
          "green-dark": "#2E7D3B",
          "green-soft": "#E8F5EA",
          graphite: "#263238",
          "graphite-light": "#37474F",
          yellow: "#F4B400",
          "yellow-dark": "#D69E00",
          "yellow-soft": "#FFF8E1",
          bg: "#F2F5F0",
          border: "#DCE3DA",
          danger: "#D32F2F",
          "danger-soft": "#FDECEA",
        },
      },
      fontFamily: {
        display: ["var(--font-poppins)", "Poppins", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(38, 50, 56, 0.06), 0 4px 12px rgba(38, 50, 56, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
