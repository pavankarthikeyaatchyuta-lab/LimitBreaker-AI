import { useEffect, useMemo, useRef, useState } from 'react'

export function useCountdown(deadlineMinutes, sessionStartTime, onExpire) {
  const expireRef = useRef(onExpire)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    expireRef.current = onExpire
  }, [onExpire])

  const endTimestamp = useMemo(() => {
    if (!deadlineMinutes || !sessionStartTime) return null
    return Number(sessionStartTime) + Number(deadlineMinutes) * 60 * 1000
  }, [deadlineMinutes, sessionStartTime])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [])

  const totalSecondsLeft = Math.max(0, Math.ceil(((endTimestamp ?? now) - now) / 1000))

  useEffect(() => {
    if (endTimestamp && totalSecondsLeft <= 0) {
      expireRef.current?.()
    }
  }, [endTimestamp, totalSecondsLeft])

  const hours = Math.floor(totalSecondsLeft / 3600)
  const minutes = Math.floor((totalSecondsLeft % 3600) / 60)
  const seconds = totalSecondsLeft % 60

  return {
    hours,
    minutes,
    seconds,
    totalSecondsLeft,
    isWarning: totalSecondsLeft <= 3600,
    isCritical: totalSecondsLeft <= 1800,
  }
}

