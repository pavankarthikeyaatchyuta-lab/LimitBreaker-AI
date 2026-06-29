export default function RescuePlan({ schedule = [], totalTasksCut = 0, currentTaskName = '', completedTasks = [], onCompleteTask, fallbackMode = false }) {
  if (!schedule.length) return null
  return (
    <section className="mx-auto mt-8 w-full max-w-5xl px-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-mono text-sm uppercase tracking-[0.24em] text-slate-400">Rescue Plan</h2>
        <div className="flex flex-wrap items-center gap-2">
          {fallbackMode ? (
            <span className="rounded-full border border-simplify/40 bg-simplify/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.12em] text-simplify">
              Offline schedule
            </span>
          ) : null}
          {totalTasksCut ? <div className="font-mono text-xs uppercase tracking-[0.12em] text-critical">Warning: {totalTasksCut} task(s) cut - insufficient time</div> : null}
        </div>
      </div>
      <div className="relative space-y-3 before:absolute before:bottom-0 before:left-[11px] before:top-0 before:w-px before:bg-white/10">
        {schedule.map((block, index) => {
          const isCurrent = block.task_name === currentTaskName && block.type === 'TASK'
          const isDone = completedTasks.includes(block.task_name)
          return (
            <div key={`${block.task_name}-${index}`} className="relative flex gap-4 animate-cascade-in" style={{ animationDelay: `${index * 60}ms` }}>
              <div className={`relative z-10 mt-5 h-3 w-3 rounded-full ${block.type === 'CUT' ? 'bg-critical' : isCurrent ? 'bg-accent shadow-accent' : 'bg-white/50'}`} />
              <div className={`w-full rounded-xl border p-4 transition ${isCurrent ? 'border-accent/70 bg-accent/10 shadow-accent' : 'border-white/10 bg-[rgba(15,10,30,0.78)]'} ${block.type === 'CUT' ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-xs text-slate-400">{block.start_time}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-slate-300">{block.duration_minutes} min</span>
                </div>
                <div className={`mt-1 text-lg font-semibold ${block.type === 'CUT' ? 'text-slate-500 line-through' : block.type === 'BUFFER' ? 'text-slate-400' : 'text-white'}`}>
                  {block.task_name}{block.type === 'BUFFER' ? ' - buffer' : ''}
                </div>
                {block.type === 'CUT' ? <span className="mt-2 inline-flex rounded-full bg-critical/15 px-2 py-1 font-mono text-xs text-critical">NO TIME</span> : null}
                {block.cut_reason ? <p className="mt-2 text-sm text-slate-400">{block.cut_reason}</p> : null}
                {onCompleteTask && block.type === 'TASK' && !isDone ? (
                  <button onClick={() => onCompleteTask(block.task_name)} className="btn-ghost mt-3 h-9 px-3 text-xs">MARK DONE</button>
                ) : null}
                {isDone ? <div className="mt-3 font-mono text-xs text-done">DONE</div> : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
