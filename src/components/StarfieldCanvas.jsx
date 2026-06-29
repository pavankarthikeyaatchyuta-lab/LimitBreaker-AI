import { useEffect, useRef } from 'react'

function makeStar(width, height, layer) {
  const sizes = [0.5, 1, 2]
  const speeds = [0.1, 0.2, 0.4]
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: sizes[layer],
    speed: speeds[layer],
    alpha: 0.35 + Math.random() * 0.65,
  }
}

function drawNebula(ctx, width, height, time) {
  const drift = Math.sin(time / 9000) * 30
  const clouds = [
    { x: width * 0.28 + drift, y: height * 0.18, r: Math.max(width, height) * 0.42, color: [82, 39, 180], alpha: 0.14 },
    { x: width * 0.72 - drift, y: height * 0.68, r: Math.max(width, height) * 0.34, color: [14, 165, 233], alpha: 0.08 },
    { x: width * 0.5, y: height * 0.45 + drift * 0.3, r: Math.max(width, height) * 0.5, color: [244, 63, 94], alpha: 0.06 },
  ]

  clouds.forEach((cloud) => {
    const gradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r)
    gradient.addColorStop(0, `rgba(${cloud.color.join(',')},${cloud.alpha})`)
    gradient.addColorStop(0.45, `rgba(${cloud.color.join(',')},${cloud.alpha * 0.28})`)
    gradient.addColorStop(1, `rgba(${cloud.color.join(',')},0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  })
}

function drawPlanet(ctx, width, height, time) {
  const x = width * 0.86
  const y = height * 0.24 + Math.sin(time / 7000) * 8
  const radius = Math.min(width, height) * 0.075
  const glow = ctx.createRadialGradient(x, y, radius * 0.65, x, y, radius * 2.8)
  glow.addColorStop(0, 'rgba(59,130,246,0.18)')
  glow.addColorStop(1, 'rgba(59,130,246,0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6)

  const planet = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius)
  planet.addColorStop(0, 'rgba(191,219,254,0.95)')
  planet.addColorStop(0.38, 'rgba(59,130,246,0.82)')
  planet.addColorStop(0.72, 'rgba(30,64,175,0.75)')
  planet.addColorStop(1, 'rgba(8,13,35,0.96)')
  ctx.beginPath()
  ctx.fillStyle = planet
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.23)
  ctx.strokeStyle = 'rgba(226,232,240,0.26)'
  ctx.lineWidth = Math.max(1, radius * 0.08)
  ctx.beginPath()
  ctx.ellipse(0, 0, radius * 1.55, radius * 0.33, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawBlackHole(ctx, width, height, time) {
  const x = width * 0.16
  const y = height * 0.72
  const radius = Math.min(width, height) * 0.052
  const rotation = time / 2500

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  const disc = ctx.createRadialGradient(0, 0, radius * 0.45, 0, 0, radius * 3.4)
  disc.addColorStop(0, 'rgba(0,0,0,0)')
  disc.addColorStop(0.28, 'rgba(251,146,60,0.85)')
  disc.addColorStop(0.42, 'rgba(59,130,246,0.32)')
  disc.addColorStop(0.72, 'rgba(168,85,247,0.16)')
  disc.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.scale(1.9, 0.48)
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(0, 0, radius * 3.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const lens = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8)
  lens.addColorStop(0, 'rgba(0,0,0,1)')
  lens.addColorStop(0.45, 'rgba(0,0,0,0.96)')
  lens.addColorStop(0.65, 'rgba(255,255,255,0.08)')
  lens.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = lens
  ctx.beginPath()
  ctx.arc(x, y, radius * 2.4, 0, Math.PI * 2)
  ctx.fill()
}

export default function StarfieldCanvas() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let width = window.innerWidth
    let height = window.innerHeight
    let animation
    let lastFrame = 0
    let nextShootingStar = performance.now() + 5000 + Math.random() * 3000
    let streak = null
    const stars = []

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
    }

    resize()
    for (let i = 0; i < 300; i += 1) stars.push(makeStar(width, height, i % 3))

    const draw = (time) => {
      if (time - lastFrame < 16) {
        animation = requestAnimationFrame(draw)
        return
      }
      lastFrame = time
      ctx.clearRect(0, 0, width, height)
      drawNebula(ctx, width, height, time)
      const nebula = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, Math.max(width, height) * 0.75)
      nebula.addColorStop(0, 'rgba(26,10,58,0.4)')
      nebula.addColorStop(1, 'rgba(2,0,8,0)')
      ctx.fillStyle = nebula
      ctx.fillRect(0, 0, width, height)
      drawPlanet(ctx, width, height, time)
      drawBlackHole(ctx, width, height, time)

      stars.forEach((star) => {
        star.x += star.speed
        star.y += star.speed * 0.22
        if (star.x > width + 4 || star.y > height + 4) {
          star.x = -4
          star.y = Math.random() * height
        }
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,255,255,${star.alpha})`
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
      })

      if (!streak && time > nextShootingStar) {
        streak = {
          x: Math.random() * width * 0.85,
          y: Math.random() * height * 0.35,
          vx: 8 + Math.random() * 5,
          vy: 4 + Math.random() * 3,
          life: 42,
        }
        nextShootingStar = time + 5000 + Math.random() * 3000
      }

      if (streak) {
        const gradient = ctx.createLinearGradient(streak.x, streak.y, streak.x - 160, streak.y - 70)
        gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(streak.x, streak.y)
        ctx.lineTo(streak.x - 160, streak.y - 70)
        ctx.stroke()
        streak.x += streak.vx
        streak.y += streak.vy
        streak.life -= 1
        if (streak.life <= 0) streak = null
      }

      animation = requestAnimationFrame(draw)
    }

    window.addEventListener('resize', resize)
    animation = requestAnimationFrame(draw)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animation)
    }
  }, [])

  return <canvas ref={ref} className="fixed inset-0 z-0 bg-void" aria-hidden="true" />
}
