import { useEffect, useMemo, useState } from 'react'
import { runCriticalDecisionAgent } from '../agents/criticalDecisionAgent'

export default function MissionDebrief({
  completedCount,
  totalCount,
  sacrificeCount,
  timeRemaining,
  probabilityBefore,
  probabilityAfter,
  replansCount,
  situationText,
  onRestart,
}) {
  const [decision, setDecision] = useState('The most important decision was cutting low-output work before it consumed the mission clock.')

  useEffect(() => {
    let alive = true
    runCriticalDecisionAgent(situationText)
      .then((data) => alive && setDecision(data.decision || decision))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [situationText])

  const summary = useMemo(
    () => `LimitBreaker AI Debrief\nTasks completed: ${completedCount}/${totalCount}\nTasks eliminated: ${sacrificeCount}\nTime remaining: ${timeRemaining > 0 ? `${Math.floor(timeRemaining / 60)}m` : '00:00'}\nReplans triggered: ${replansCount}\nProbability: ${probabilityBefore ?? '--'}% -> ${probabilityAfter ?? '--'}%\nCritical decision: ${decision}`,
    [completedCount, totalCount, sacrificeCount, timeRemaining, replansCount, probabilityBefore, probabilityAfter, decision],
  )

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-void/90 px-5 py-24 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[rgba(15,10,30,0.9)] p-6 text-center shadow-accent animate-scale-in md:p-10">
        <h1 className="font-orbitron text-4xl font-black text-white md:text-5xl">{timeRemaining > 0 ? 'MISSION COMPLETE' : 'MISSION ENDED'}</h1>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[
            ['Tasks completed', `${completedCount}/${totalCount}`],
            ['Tasks eliminated', sacrificeCount],
            ['Time remaining', timeRemaining > 0 ? `${Math.floor(timeRemaining / 60)}m` : '00:00'],
            ['Replans triggered', replansCount],
          ].map(([label, value], index) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 animate-cascade-in" style={{ animationDelay: `${index * 80}ms` }}>
              <div className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
              <div className="mt-2 font-orbitron text-2xl font-black text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-5 font-orbitron">
          <div className="text-critical">BEFORE PLAN: {probabilityBefore ?? '--'}%</div>
          <div className="text-slate-400">-&gt;</div>
          <div className="text-3xl font-black text-done">AFTER PLAN: {probabilityAfter ?? '--'}%</div>
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-xl italic text-white">{decision}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn-primary h-11 px-5" onClick={onRestart}>Start new mission -&gt;</button>
          <button className="btn-ghost h-11 px-5" onClick={() => navigator.clipboard?.writeText(summary)}>Copy debrief</button>
        </div>
      </div>
    </div>
  )
}
