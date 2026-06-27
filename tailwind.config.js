export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bunker: "#050607",
        armor: "#0b0f13",
        hazard: "#ff9f1c",
        kill: "#ef233c",
        signal: "#d7ff4f",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        hostile: "0 0 0 1px rgba(255,255,255,.08), 0 24px 80px rgba(0,0,0,.45)",
      },
    },
  },
  plugins: [],
};
