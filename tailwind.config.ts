import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#221711",
        cream: "#fffaf2",
        saffron: "#dc6b20",
        moss: "#506b48",
      },
      boxShadow: {
        float: "0 24px 80px rgba(47, 26, 13, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
