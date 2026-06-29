export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        void: '#020008',
        critical: '#ef4444',
        simplify: '#f59e0b',
        done: '#22c55e',
        accent: '#3b82f6',
      },
      boxShadow: {
        critical: '0 0 12px rgba(239,68,68,0.4)',
        simplify: '0 0 12px rgba(245,158,11,0.4)',
        accent: '0 0 24px rgba(59,130,246,0.22)',
      },
    },
  },
  plugins: [],
}
