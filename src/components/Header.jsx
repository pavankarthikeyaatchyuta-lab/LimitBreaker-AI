import { useEffect, useState } from 'react'
import { useCountdown } from '../hooks/useCountdown'

const pad = (value) => String(value).padStart(2, '0')
const scoreColor = (score) => (score >= 70 ? 'text-done' : score >= 40 ? 'text-simplify' : 'text-critical')

export default function Header({
  missionCodename,
  probabilityBefore,
  probabilityAfter,
  probabilityCurrent,
  deadlineMinutes,
  sessionStartTime,
  onExpire,
}) {
  const countdown = useCountdown(deadlineMinutes, sessionStartTime, onExpire)
  const targetScore = probabilityCurrent ?? probabilityAfter ?? probabilityBefore
  const [displayScore, setDisplayScore] = useState(targetScore ?? 0)

  useEffect(() => {
    if (targetScore == null) return
    let frame
    const start = displayScore
    const diff = targetScore - start
    const started = performance.now()
    const animate = (time) => {
      const progress = Math.min(1, (time - started) / 700)
      setDisplayScore(Math.round(start + diff * progress))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [targetScore])

  const timerClass = countdown.isCritical ? 'text-critical animate-pulse' : countdown.isWarning ? 'text-simplify' : 'text-white'

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-16 border-b border-white/5 bg-void/90 backdrop-blur-xl md:h-[72px] animate-float">
      <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 md:px-8">
        <div className="min-w-0">
          <div className="truncate font-orbitron text-sm font-black tracking-[0.15em] text-white md:text-lg">LIMITBREAKER AI</div>
          <div className="truncate font-orbitron text-[9px] text-slate-400 md:text-xs">{missionCodename || 'STANDBY MODE'}</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Survival Probability</div>
          <div className={`font-orbitron text-lg font-black md:text-3xl ${scoreColor(targetScore ?? 0)}`}>
            {probabilityBefore != null && probabilityAfter != null ? `${probabilityBefore}% -> ${probabilityAfter}%` : targetScore != null ? `${displayScore}%` : '--%'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Time Remaining</div>
          <div className={`font-orbitron text-base font-bold md:text-2xl ${timerClass}`}>
            {deadlineMinutes ? `${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}` : '--:--:--'}
          </div>
        </div>
      </div>
    </header>
  )
}

