export default function SacrificeReport({ sacrifices = [] }) {
  if (!sacrifices.length) return null
  return (
    <section className="mx-auto mt-8 w-full max-w-5xl border-l-2 border-critical px-5 pl-6 animate-slide-in-left">
      <h2 className="mb-4 font-mono text-sm uppercase tracking-[0.24em] text-critical">Eliminated</h2>
      <div className="space-y-3">
        {sacrifices.map((item, index) => (
          <div key={`${item.task_name}-${index}`} className="rounded-lg border border-white/10 bg-[rgba(15,10,30,0.72)] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <strong className="text-white">X {item.task_name}</strong>
              <span className="rounded-full bg-critical/15 px-2 py-1 font-mono text-xs text-critical">{item.time_cost_minutes} min saved</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{item.verdict}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

