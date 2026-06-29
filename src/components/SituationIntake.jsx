import { useState } from 'react'

const templates = [
  ['Exam panic', "Chemistry exam in 3 hours. 6 chapters total, only covered 2 so far. Chapters 3 and 4 are the heaviest and I haven't started them. Exam is MCQs plus 2 essays."],
  ['Hackathon crunch', 'Hackathon closes in 4 hours. PPT is 60% done, no README, demo video not recorded, backend works but frontend has 3 broken features. Need GitHub + deployed link + Google Doc.'],
  ['Assignment due', "Report due in 2.5 hours. 5 sections total. Done: intro and literature review. Missing: methodology, results, conclusion. 1500 word minimum. Have raw data but haven't analyzed it."],
  ['Job application', "Application closes in 90 minutes. Resume needs updating, cover letter is blank, need to fill their online form, and portfolio link isn't live yet."],
]

export function parseDeadlineMinutes(text) {
  const hour = text.match(/(\d+\.?\d*)\s*(hours?|hrs?|h)\b/i)
  if (hour) return Math.max(1, Math.round(Number(hour[1]) * 60))
  const minute = text.match(/(\d+)\s*(minutes?|mins?|m)\b/i)
  if (minute) return Math.max(1, Number(minute[1]))
  const at = text.match(/at\s+(\d{1,2}):?(\d{0,2})\s*(am|pm)/i)
  if (at) {
    const now = new Date()
    let hours = Number(at[1]) % 12
    if (at[3].toLowerCase() === 'pm') hours += 12
    const target = new Date(now)
    target.setHours(hours, Number(at[2] || 0), 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)
    return Math.max(1, Math.round((target - now) / 60000))
  }
  return null
}

export default function SituationIntake({ onSubmit, savedSession, onResume, onDiscard }) {
  const [text, setText] = useState('')
  const [manualMinutes, setManualMinutes] = useState('')
  const [needsDeadline, setNeedsDeadline] = useState(false)

  const submit = (event) => {
    event.preventDefault()
    const parsed = parseDeadlineMinutes(text)
    const deadlineMinutes = parsed ?? Number(manualMinutes)
    if (!deadlineMinutes) {
      setNeedsDeadline(true)
      return
    }
    onSubmit(text.trim(), deadlineMinutes)
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center px-5 pb-10 pt-24">
      <div className="w-full">
        {savedSession ? (
          <div className="mb-5 rounded-lg border border-accent/40 bg-accent/10 p-4">
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Mission in progress</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-primary h-10 px-4" onClick={onResume}>Resume</button>
              <button className="btn-ghost h-10 px-4" onClick={onDiscard}>Discard</button>
            </div>
          </div>
        ) : null}
        <form onSubmit={submit} className="animate-scale-in">
          <div className="font-mono text-xs uppercase tracking-[0.24em] text-slate-400">Emergency Deadline Triage System</div>
          <h1 className="mt-3 text-4xl font-black text-white md:text-5xl">What's the situation?</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-400">Describe your deadline, what's done, and what isn't. No structure needed - just dump it all.</p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="mt-7 min-h-[150px] w-full rounded-xl border border-white/10 bg-[rgba(15,10,30,0.6)] p-4 text-[15px] text-white outline-none transition focus:border-accent/70 focus:shadow-accent"
            placeholder="Example: Hackathon submission in 4 hours. PPT is half done, no README, demo not recorded, backend works."
            required
          />
          {needsDeadline ? (
            <label className="mt-3 block font-mono text-sm text-simplify">
              How many minutes until deadline?
              <input
                value={manualMinutes}
                onChange={(event) => setManualMinutes(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none focus:border-accent"
                type="number"
                min="1"
              />
            </label>
          ) : null}
          <button type="submit" className="btn-primary mt-4 h-[52px] w-full font-orbitron font-bold">ACTIVATE LIMITBREAKER -&gt;</button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {templates.map(([label, value]) => (
              <button key={label} type="button" onClick={() => setText(value)} className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left text-sm text-slate-200 transition hover:border-accent/50 hover:bg-white/[0.07]">
                {label}
              </button>
            ))}
          </div>
        </form>
      </div>
    </main>
  )
}
