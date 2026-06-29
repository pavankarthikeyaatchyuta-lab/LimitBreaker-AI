import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
  const ref = useRef(null)
  const tailRef = useRef(null)
  const target = useRef({ x: -100, y: -100 })
  const current = useRef({ x: -100, y: -100 })
  const previous = useRef({ x: -100, y: -100 })
  const frame = useRef(null)
  const [mode, setMode] = useState('default')

  useEffect(() => {
    const oldCursor = document.body.style.cursor
    document.body.style.cursor = 'none'
    const move = (event) => {
      target.current = { x: event.clientX, y: event.clientY }
      const hit = event.target?.closest?.('button,a,[role="button"],.task-critical')
      setMode(hit?.classList?.contains('task-critical') ? 'critical' : hit ? 'button' : 'default')
    }
    const tick = () => {
      previous.current = { ...current.current }
      current.current.x += (target.current.x - current.current.x) * 0.45
      current.current.y += (target.current.y - current.current.y) * 0.45
      const dx = current.current.x - previous.current.x
      const dy = current.current.y - previous.current.y
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      const speed = Math.min(1, Math.hypot(dx, dy) / 24)
      if (ref.current) {
        ref.current.style.transform = `translate3d(${current.current.x - 15}px, ${current.current.y - 15}px, 0)`
      }
      if (tailRef.current) {
        tailRef.current.style.transform = `translate3d(${current.current.x - 158}px, ${current.current.y - 17}px, 0) rotate(${angle}deg) scaleX(${0.82 + speed * 0.62})`
        tailRef.current.style.opacity = `${0.72 + speed * 0.28}`
      }
      frame.current = requestAnimationFrame(tick)
    }
    window.addEventListener('mousemove', move)
    frame.current = requestAnimationFrame(tick)
    return () => {
      document.body.style.cursor = oldCursor
      window.removeEventListener('mousemove', move)
      cancelAnimationFrame(frame.current)
    }
  }, [])

  const color = mode === 'critical' ? '#ef4444' : mode === 'button' ? '#3b82f6' : '#ffffff'
  const hotClass = mode === 'button' ? 'cursor-comet-hot' : mode === 'critical' ? 'cursor-comet-critical' : ''

  return (
    <>
      <div ref={tailRef} className={`cursor-comet-tail ${hotClass}`} />
      <div ref={ref} className={`cursor-comet ${hotClass}`} style={{ '--comet-color': color }}>
        <span className="cursor-comet-core" />
      </div>
    </>
  )
}
