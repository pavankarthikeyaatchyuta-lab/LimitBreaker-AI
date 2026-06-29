const styles = {
  CRITICAL: 'border-l-critical shadow-critical task-critical',
  SIMPLIFY: 'border-l-simplify shadow-simplify',
  DROP: 'border-l-slate-500 opacity-75',
}

const badge = {
  CRITICAL: 'bg-critical/15 text-critical border-critical/40',
  SIMPLIFY: 'bg-simplify/15 text-simplify border-simplify/40',
  DROP: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
}

export default function TriageOutput({ tasks = [], fallbackMode = false }) {
  if (!tasks.length) return null
  return (
    <section className="mx-auto w-full max-w-5xl px-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-sm uppercase tracking-[0.24em] text-slate-400">Triage Complete</h2>
        {fallbackMode ? (
          <span className="rounded-full border border-simplify/40 bg-simplify/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-simplify">
            Offline heuristic fallback
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {tasks.map((task, index) => (
          <article
            key={`${task.name}-${index}`}
            className={`rounded-xl border border-white/10 border-l-4 bg-[rgba(15,10,30,0.85)] p-4 backdrop-blur-xl animate-card-in ${styles[task.classification] || ''}`}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-flex rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${badge[task.classification]}`}>
                  {task.classification}
                </span>
                {fallbackMode ? (
                  <span className="ml-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    Heuristic
                  </span>
                ) : null}
                <h3 className={`mt-2 text-lg font-bold text-white ${task.classification === 'DROP' ? 'line-through decoration-slate-500' : ''}`}>{task.name}</h3>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-slate-300">{task.estimated_minutes ?? 0} min</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{task.reasoning}</p>
            {task.specific_instruction ? <p className="mt-3 border-t border-white/10 pt-3 text-sm italic text-simplify">-&gt; {task.specific_instruction}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
