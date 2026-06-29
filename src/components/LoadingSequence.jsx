import { useEffect, useState } from 'react'

export const LOADING_LINES = [
  'Initializing triage sequence...',
  'Parsing situation data...',
  'Generating mission triage packet...',
  'Classifying critical, simplify, and drop tasks...',
  'Generating scope cuts and sacrifice report...',
  'Running Reality Check...',
  'Building rescue schedule and survival probability...',
  'Mission plan locked.',
]

export default function LoadingSequence({ lines = LOADING_LINES }) {
  const [visible, setVisible] = useState(0)
  useEffect(() => {
    setVisible(0)
    const timer = window.setInterval(() => setVisible((value) => Math.min(lines.length, value + 1)), 400)
    return () => window.clearInterval(timer)
  }, [lines])

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center px-5 pt-20">
      <div className="w-full rounded-xl border border-white/10 bg-[rgba(15,10,30,0.85)] p-6 font-mono text-sm shadow-accent backdrop-blur-xl md:p-8">
        {lines.slice(0, visible).map((line) => (
          <div key={line} className="mb-3 animate-cascade-in text-slate-200">
            <span className="text-accent">v </span>
            {line}
          </div>
        ))}
      </div>
    </main>
  )
}
