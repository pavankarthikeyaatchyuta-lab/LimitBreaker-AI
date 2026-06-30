import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
  const ref = useRef(null)
  const trailRef = useRef(null)
  const target = useRef({ x: -100, y: -100 })
  const current = useRef({ x: -100, y: -100 })
  const previous = useRef({ x: -100, y: -100 })
  const trail = useRef(Array.from({ length: 9 }, () => ({ x: -100, y: -100, age: 1 })))
  const frame = useRef(null)
  const [mode, setMode] = useState('default')
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const oldCursor = document.body.style.cursor
    document.body.style.cursor = 'none'
    const move = (event) => {
      target.current = { x: event.clientX, y: event.clientY }
      const typingTarget = event.target?.closest?.('textarea,input,[contenteditable="true"]')
      setHidden(Boolean(typingTarget))
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
      if (speed > 0.08) {
        trail.current.unshift({ x: current.current.x, y: current.current.y, angle, age: 0, speed })
        trail.current = trail.current.slice(0, 9).map((point, index) => ({ ...point, age: Math.min(1, point.age + 0.08 + index * 0.01) }))
      } else {
        trail.current = trail.current.map((point) => ({ ...point, age: Math.min(1, point.age + 0.1) }))
      }
      if (ref.current) {
        ref.current.style.transform = `translate3d(${current.current.x - 12}px, ${current.current.y - 12}px, 0)`
      }
      if (trailRef.current) {
        Array.from(trailRef.current.children).forEach((node, index) => {
          const point = trail.current[index]
          if (!point) return
          const opacity = Math.max(0, (1 - point.age) * (0.42 - index * 0.025))
          const length = 28 + Math.max(0, point.speed || 0) * 42 - index * 2
          node.style.width = `${Math.max(12, length)}px`
          node.style.opacity = `${opacity}`
          node.style.transform = `translate3d(${point.x - length - 4}px, ${point.y - 1}px, 0) rotate(${point.angle || angle}deg)`
        })
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
      <div ref={trailRef} className={`cursor-trail ${hotClass} ${hidden ? 'cursor-comet-hidden' : ''}`}>
        {trail.current.map((_, index) => <span key={index} />)}
      </div>
      <div ref={ref} className={`cursor-comet ${hotClass} ${hidden ? 'cursor-comet-hidden' : ''}`} style={{ '--comet-color': color }}>
        <span className="cursor-comet-core" />
      </div>
    </>
  )
}
