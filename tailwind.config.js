export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Deep concrete dark — not pure black, has warmth
        void: "#080a0c",
        surface: "#0d1117",
        elevated: "#131920",
        border: "#1e2a36",
        // Accents
        threat: "#ff2d4b",       // danger red
        amber: "#f59e0b",        // warning amber
        operative: "#00d4ff",    // cool cyan for active/highlight
        ghost: "#8b9ab0",        // muted text
        // Success
        cleared: "#22c55e",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.04), 0 4px 32px rgba(0,0,0,0.4)",
        threat: "0 0 0 1px rgba(255,45,75,0.3), 0 4px 32px rgba(255,45,75,0.08)",
        operative: "0 0 0 1px rgba(0,212,255,0.2), 0 4px 24px rgba(0,212,255,0.06)",
        glow: "0 0 40px rgba(255,45,75,0.15)",
      },
      backgroundImage: {
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
