export default function CheckInOverlay({ currentTask, onDone, onPartial, onBehind }) {
  if (!currentTask) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80 px-5 backdrop-blur-md">
      <div className="w-[90%] max-w-[460px] rounded-2xl border border-white/10 bg-[rgba(15,10,30,0.95)] p-6 animate-scale-in md:p-8">
        <h2 className="font-orbitron text-2xl font-black text-white">TIME CHECK</h2>
        <p className="mt-4 text-slate-400">Did you finish:</p>
        <div className="mt-2 text-2xl font-black text-white">{currentTask.task_name}</div>
        <div className="mt-6 space-y-3">
          <button onClick={onDone} className="w-full rounded-lg border border-done/50 p-3 text-left font-mono text-done">DONE</button>
          <button onClick={onPartial} className="w-full rounded-lg border border-simplify/50 p-3 text-left font-mono text-simplify">PARTIAL</button>
          <button onClick={onBehind} className="w-full rounded-lg border border-critical/50 p-3 text-left font-mono text-critical">BEHIND</button>
        </div>
      </div>
    </div>
  )
}

