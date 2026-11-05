import { drawText } from './font.js'

export const PALETTE = {
  ink: '#07060d',
  asphalt: '#282433',
  asphaltLight: '#302b40',
  lane: '#e8e2ef',
  cyan: '#43f6e0',
  pink: '#ff3d7f',
  yellow: '#ffd34e',
  orange: '#ff9f43',
  white: '#f4f0ff',
  muted: '#8a7fa2',
  dark: '#14101f',
}

const CAR_CONFIGS = {
  cyan: { body: '#35e6d0', accent: '#d3fff9', shade: '#0e8d83', glass: '#0a1a2c' },
  orange: { body: '#ff9f43', accent: '#ffedbe', shade: '#a94f0b', glass: '#22120a' },
  magenta: { body: '#ff3d7f', accent: '#ffd7e4', shade: '#981748', glass: '#1e0a18' },
  lime: { body: '#b8ff4e', accent: '#f0ffd0', shade: '#548f16', glass: '#111c08' },
  red: { body: '#ff4655', accent: '#ffd0d4', shade: '#981422', glass: '#1c090c' },
  purple: { body: '#9a6bff', accent: '#e5dbff', shade: '#4d2a9e', glass: '#100a20' },
}

function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  r = Math.max(0, Math.min(255, Math.round(r + amount)))
  g = Math.max(0, Math.min(255, Math.round(g + amount)))
  b = Math.max(0, Math.min(255, Math.round(b + amount)))
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}

export function makeCarSprite(kind = 'cyan') {
  const c = CAR_CONFIGS[kind] || CAR_CONFIGS.cyan
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 48
  const g = canvas.getContext('2d')
  const row = (x, y, w, h, color) => {
    g.fillStyle = color
    g.fillRect(x, y, w, h)
  }
  // Wheels first so the body overlaps their inner edge.
  for (const wy of [12, 31]) {
    row(2, wy, 5, 7, '#0a0810')
    row(2, wy + 2, 5, 2, '#5b5470')
    row(25, wy, 5, 7, '#0a0810')
    row(25, wy + 2, 5, 2, '#5b5470')
  }
  // Pixel-rounded body silhouette.
  row(9, 5, 14, 2, c.shade)
  row(7, 7, 18, 4, c.body)
  row(6, 11, 20, 26, c.body)
  row(5, 14, 22, 20, c.body)
  row(6, 34, 20, 7, c.body)
  row(8, 41, 16, 2, c.shade)
  row(10, 43, 12, 1, c.body)
  // Side shading and highlights.
  row(5, 14, 2, 20, shade(c.body, -38))
  row(25, 14, 2, 20, shade(c.body, -38))
  row(6, 11, 2, 3, c.accent)
  row(24, 11, 2, 3, c.accent)
  row(8, 8, 3, 1, c.accent)
  // Mirrors.
  row(3, 18, 3, 2, c.shade)
  row(26, 18, 3, 2, c.shade)
  // Windshield, roof and rear glass.
  row(8, 13, 16, 7, c.glass)
  row(9, 14, 4, 2, shade(c.glass, 26))
  row(10, 20, 12, 10, shade(c.body, 12))
  row(9, 22, 2, 6, c.accent)
  row(21, 22, 2, 6, c.accent)
  row(8, 30, 16, 5, c.glass)
  row(9, 31, 5, 1, shade(c.glass, 22))
  // Headlights and taillights.
  row(7, 8, 4, 3, '#fff8c9')
  row(21, 8, 4, 3, '#fff8c9')
  row(6, 38, 6, 3, '#ff365d')
  row(20, 38, 6, 3, '#ff365d')
  row(6, 40, 6, 1, '#ff8fa4')
  row(20, 40, 6, 1, '#ff8fa4')
  // Twin racing stripes.
  row(12, 7, 2, 4, c.accent)
  row(18, 7, 2, 4, c.accent)
  row(12, 20, 2, 9, c.accent)
  row(18, 20, 2, 9, c.accent)
  // Spoiler.
  row(4, 2, 24, 2, shade(c.body, -58))
  row(6, 0, 20, 2, c.shade)
  row(6, 2, 2, 3, shade(c.body, -40))
  row(24, 2, 2, 3, shade(c.body, -40))
  row(11, 2, 10, 1, c.accent)
  // Exhaust glow.
  row(9, 44, 3, 2, '#4b445e')
  row(20, 44, 3, 2, '#4b445e')
  return canvas
}

export function makeCarShadow() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 48
  const g = canvas.getContext('2d')
  g.fillStyle = 'rgba(3,2,8,0.42)'
  g.fillRect(8, 7, 18, 38)
  g.fillRect(6, 13, 22, 26)
  g.fillRect(10, 3, 14, 4)
  return canvas
}

export function drawCar(ctx, sprite, shadow, x, y, angle, scale = 1, alpha = 1) {
  const px = Math.round(x)
  const py = Math.round(y)
  const prev = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(angle + Math.PI / 2)
  if (scale !== 1) ctx.scale(scale, scale)
  if (shadow) {
    ctx.globalAlpha = alpha
    ctx.drawImage(shadow, -16, -24)
  }
  ctx.globalAlpha = alpha
  ctx.drawImage(sprite, -16, -24)
  ctx.restore()
  ctx.imageSmoothingEnabled = prev
}

// --------------------------------------------------------------------------
// Title / menu backdrop
// --------------------------------------------------------------------------

const STARS = (() => {
  const rnd = seeded(1991)
  return Array.from({ length: 70 }, () => ({
    x: Math.floor(rnd() * 384),
    y: Math.floor(rnd() * 96),
    p: rnd() * 6.28,
    s: rnd() > 0.8 ? 2 : 1,
  }))
})()

const CITY = (() => {
  const rnd = seeded(808)
  const buildings = []
  let x = -6
  while (x < 392) {
    const w = 9 + Math.floor(rnd() * 20)
    const h = 6 + Math.floor(rnd() * 22)
    buildings.push({ x, w, h, lights: Array.from({ length: 8 }, () => rnd()) })
    x += w + 2 + Math.floor(rnd() * 5)
  }
  return buildings
})()

function drawPalmSilhouette(g, x, y, s = 1, color = '#1a0d2a') {
  g.fillStyle = color
  g.fillRect(x - 1 * s, y - 18 * s, 2 * s, 20 * s)
  g.fillRect(x - 7 * s, y - 20 * s, 14 * s, 2 * s)
  g.fillRect(x - 10 * s, y - 17 * s, 8 * s, 2 * s)
  g.fillRect(x + 2 * s, y - 17 * s, 8 * s, 2 * s)
  g.fillRect(x - 8 * s, y - 22 * s, 5 * s, 2 * s)
  g.fillRect(x + 3 * s, y - 22 * s, 5 * s, 2 * s)
}

function drawRearCar(ctx, x, y, t, kind = 'cyan') {
  const c = CAR_CONFIGS[kind] || CAR_CONFIGS.cyan
  const bob = Math.sin(t * 6) * 0.8
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y + bob))
  // ground shadow
  ctx.fillStyle = 'rgba(2,1,8,0.55)'
  ctx.fillRect(-30, 22, 60, 7)
  ctx.fillRect(-26, 27, 52, 3)
  // exhaust smoke
  for (let i = 0; i < 7; i++) {
    const p = ((t * 0.55 + i / 7) % 1)
    const sx = (i % 2 === 0 ? -1 : 1) * (20 + p * 26) + Math.sin(i * 4 + t) * 4
    const sy = 18 - p * 42
    ctx.globalAlpha = (1 - p) * 0.18
    ctx.fillStyle = i % 2 ? '#8e86a8' : '#ff6b9d'
    const size = 3 + Math.floor(p * 7)
    ctx.fillRect(Math.round(sx), Math.round(sy), size, size)
  }
  ctx.globalAlpha = 1
  // wheels
  ctx.fillStyle = '#08060d'
  ctx.fillRect(-30, -8, 9, 28)
  ctx.fillRect(21, -8, 9, 28)
  ctx.fillStyle = '#4b445e'
  ctx.fillRect(-29, 8, 7, 3)
  ctx.fillRect(22, 8, 7, 3)
  // body
  ctx.fillStyle = c.shade
  ctx.fillRect(-24, 12, 48, 12)
  ctx.fillStyle = c.body
  ctx.fillRect(-22, -12, 44, 26)
  ctx.fillRect(-18, -18, 36, 8)
  ctx.fillRect(-25, 8, 50, 8)
  ctx.fillStyle = shade(c.body, -34)
  ctx.fillRect(-25, 8, 4, 8)
  ctx.fillRect(21, 8, 4, 8)
  ctx.fillStyle = c.accent
  ctx.fillRect(-16, 14, 4, 4)
  ctx.fillRect(12, 14, 4, 4)
  // rear window
  ctx.fillStyle = c.glass
  ctx.fillRect(-16, -17, 32, 10)
  ctx.fillStyle = shade(c.glass, 28)
  ctx.fillRect(-13, -16, 13, 2)
  // spoiler
  ctx.fillStyle = '#0e0b16'
  ctx.fillRect(-27, -25, 54, 4)
  ctx.fillRect(-19, -21, 3, 6)
  ctx.fillRect(16, -21, 3, 6)
  ctx.fillStyle = c.accent
  ctx.fillRect(-23, -24, 10, 1)
  ctx.fillRect(13, -24, 10, 1)
  // taillights with glow
  ctx.globalAlpha = 0.28
  ctx.fillStyle = '#ff2f63'
  ctx.fillRect(-25, 0, 19, 9)
  ctx.fillRect(6, 0, 19, 9)
  ctx.globalAlpha = 1
  ctx.fillStyle = '#ff3d6a'
  ctx.fillRect(-21, 1, 13, 5)
  ctx.fillRect(8, 1, 13, 5)
  ctx.fillStyle = '#ffb0c2'
  ctx.fillRect(-20, 1, 11, 2)
  ctx.fillRect(9, 1, 11, 2)
  // plate
  ctx.fillStyle = '#e8e2ef'
  ctx.fillRect(-7, 7, 14, 6)
  ctx.fillStyle = '#201a2c'
  ctx.fillRect(-5, 9, 2, 2)
  ctx.fillRect(-1, 9, 2, 2)
  ctx.fillRect(3, 9, 2, 2)
  // bumper vents
  ctx.fillStyle = '#0c0a14'
  ctx.fillRect(-18, 18, 9, 3)
  ctx.fillRect(9, 18, 9, 3)
  ctx.restore()
}

export function drawSynthScene(ctx, t, carKind = 'cyan', compact = false) {
  const horizon = compact ? 100 : 112
  // Sky bands
  const bands = [
    [0, 34, '#0d0620'],
    [34, 58, '#1c0a33'],
    [58, 78, '#3b1248'],
    [78, 94, '#7f1e55'],
    [94, 104, '#d63c62'],
    [104, horizon, '#ff7a45'],
  ]
  for (const [y, h, color] of bands) {
    ctx.fillStyle = color
    ctx.fillRect(0, y, 384, h - y)
  }
  // Stars
  for (const star of STARS) {
    if (star.y > horizon - 20) continue
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.4 + star.p))
    ctx.globalAlpha = tw * 0.8
    ctx.fillStyle = tw > 0.8 ? '#fff2c9' : '#b6d8ff'
    ctx.fillRect(star.x, star.y, star.s, star.s)
  }
  ctx.globalAlpha = 1

  // Sun with retro slats
  const sunX = 286
  const sunY = compact ? 72 : 82
  const sunR = compact ? 27 : 33
  const sunColors = ['#fff3a0', '#ffd36e', '#ff9f57', '#ff5d7e']
  for (let y = -sunR; y <= sunR; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, sunR * sunR - y * y)))
    const seg = Math.floor(((y + sunR) / (sunR * 2)) * 4)
    ctx.fillStyle = sunColors[Math.min(3, seg)]
    ctx.fillRect(sunX - w, sunY + y, w * 2, 1)
  }
  // Slats
  ctx.fillStyle = '#7f1e55'
  const slats = [12, 18, 23, 27, 30]
  for (let i = 0; i < slats.length; i++) {
    const sy = sunY + slats[i]
    const h = 1 + Math.floor(i / 2)
    ctx.fillRect(sunX - 34, sy, 68, h)
  }

  // City / hills silhouette
  ctx.fillStyle = '#160b24'
  ctx.beginPath()
  ctx.moveTo(0, horizon)
  for (const b of CITY) {
    ctx.lineTo(b.x, horizon - 4)
    ctx.lineTo(b.x, horizon - b.h)
    ctx.lineTo(b.x + b.w, horizon - b.h)
    ctx.lineTo(b.x + b.w, horizon - 4)
  }
  ctx.lineTo(384, horizon)
  ctx.closePath()
  ctx.fill()
  // Window pixels
  for (const b of CITY) {
    for (let i = 0; i < b.lights.length; i++) {
      if (b.lights[i] < 0.45) continue
      const wx = b.x + 3 + ((i * 7) % Math.max(4, b.w - 5))
      const wy = horizon - b.h + 4 + ((i * 11) % Math.max(6, b.h - 7))
      ctx.fillStyle = i % 3 === 0 ? '#43f6e0' : '#ffd34e'
      ctx.globalAlpha = 0.55
      ctx.fillRect(wx, wy, 1, 2)
    }
  }
  ctx.globalAlpha = 1
  drawPalmSilhouette(ctx, 44, horizon + 2, 1.3)
  drawPalmSilhouette(ctx, 338, horizon + 3, 1.1)

  // Ground
  ctx.fillStyle = '#0c0718'
  ctx.fillRect(0, horizon, 384, 216 - horizon)
  // Perspective grid
  ctx.strokeStyle = 'rgba(255,61,127,0.20)'
  ctx.lineWidth = 1
  const vp = { x: 192, y: horizon + 1 }
  for (let i = -12; i <= 12; i++) {
    const bx = 192 + i * 42
    ctx.beginPath()
    ctx.moveTo(vp.x, vp.y)
    ctx.lineTo(bx, 216)
    ctx.stroke()
  }
  const speed = 0.35
  for (let i = 0; i < 14; i++) {
    const z = ((i / 14 + t * speed) % 1)
    const y = horizon + 2 + z * z * (216 - horizon)
    ctx.globalAlpha = 0.08 + z * 0.28
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(384, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  // Horizon glow
  const glow = ctx.createLinearGradient(0, horizon - 6, 0, horizon + 8)
  glow.addColorStop(0, 'rgba(255,122,69,0)')
  glow.addColorStop(0.5, 'rgba(255,61,127,0.5)')
  glow.addColorStop(1, 'rgba(255,61,127,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, horizon - 6, 384, 14)

  if (!compact) {
    drawRearCar(ctx, 192, 181, t, carKind)
    // Speed streaks
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 97 + t * 180) % 420) - 18
      const sy = horizon + 8 + ((i * 53) % 86)
      const len = 6 + (i % 4) * 6
      ctx.fillRect(sx, sy, len, 1)
    }
  }
}

// --------------------------------------------------------------------------
// Drift circuit
// --------------------------------------------------------------------------

const DRIFT_CONTROL = [
  [310, -300],
  [310, -180],
  [310, -60],
  [310, 60],
  [310, 300],
  [295, 360],
  [230, 400],
  [120, 415],
  [-20, 405],
  [-160, 365],
  [-270, 290],
  [-330, 180],
  [-340, 40],
  [-310, -120],
  [-240, -240],
  [-140, -315],
  [-20, -350],
  [100, -335],
  [210, -300],
  [275, -240],
]

function catmullRomClosed(points, perSeg = 24) {
  const out = []
  const n = points.length
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg
      const t2 = t * t
      const t3 = t2 * t
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      out.push({ x, y })
    }
  }
  return out
}

function strokeTrack(g, samples, width, color, dash = null, offset = 0, alpha = 1) {
  g.save()
  g.globalAlpha = alpha
  g.strokeStyle = color
  g.lineWidth = width
  g.lineJoin = 'round'
  g.lineCap = 'round'
  if (dash) g.setLineDash(dash)
  if (offset) g.lineDashOffset = offset
  g.beginPath()
  g.moveTo(samples[0].x, samples[0].y)
  for (let i = 1; i < samples.length; i++) g.lineTo(samples[i].x, samples[i].y)
  g.closePath()
  g.stroke()
  g.restore()
}

function drawPalmTop(g, x, y, size = 1, alpha = 1) {
  g.save()
  g.globalAlpha = alpha
  g.translate(Math.round(x), Math.round(y))
  g.fillStyle = 'rgba(0,0,0,0.3)'
  g.fillRect(-2, 1, 8, 4)
  g.fillStyle = '#0b3a2d'
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3
    const len = (7 + (i % 3) * 3) * size
    const px = Math.cos(a) * len
    const py = Math.sin(a) * len
    g.strokeStyle = i % 2 ? '#177a5e' : '#1b9874'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(px, py)
    g.stroke()
    g.fillStyle = i % 2 ? '#229c79' : '#2bd4a0'
    g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2)
  }
  g.fillStyle = '#0a2b23'
  g.fillRect(-2, -2, 4, 4)
  g.fillStyle = '#3be0ad'
  g.fillRect(-1, -1, 2, 2)
  g.restore()
}

function drawTireBarrier(g, x, y, angle, count = 3) {
  for (let i = 0; i < count; i++) {
    const ox = Math.cos(angle) * i * 9
    const oy = Math.sin(angle) * i * 9
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.fillRect(Math.round(x + ox) - 4, Math.round(y + oy) - 2, 10, 10)
    g.fillStyle = '#16121f'
    g.beginPath()
    g.arc(Math.round(x + ox), Math.round(y + oy), 4.5, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#8f849f'
    g.lineWidth = 1
    g.beginPath()
    g.arc(Math.round(x + ox), Math.round(y + oy), 4.5, 0, Math.PI * 2)
    g.stroke()
    if (i === 1) {
      g.fillStyle = '#ff3d7f'
      g.fillRect(Math.round(x + ox) - 1, Math.round(y + oy) - 4, 2, 8)
    }
  }
}

export function buildDriftWorld() {
  const halfWidth = 70
  const margin = 120
  let points = catmullRomClosed(DRIFT_CONTROL, 24)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const offsetX = -minX + margin
  const offsetY = -minY + margin
  const width = Math.ceil(maxX - minX + margin * 2)
  const height = Math.ceil(maxY - minY + margin * 2)
  points = points.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY }))

  const samples = points.map((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length]
    const next = points[(i + 1) % points.length]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    return {
      x: p.x,
      y: p.y,
      tx: dx / len,
      ty: dy / len,
      nx: -dy / len,
      ny: dx / len,
      angle: Math.atan2(dy, dx),
      index: i,
    }
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')
  const rnd = seeded(4242)

  // Void ground with a faint grid.
  g.fillStyle = '#080611'
  g.fillRect(0, 0, width, height)
  g.strokeStyle = 'rgba(67,246,224,0.035)'
  g.lineWidth = 1
  for (let x = 0; x < width; x += 36) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, height)
    g.stroke()
  }
  for (let y = 0; y < height; y += 36) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(width, y)
    g.stroke()
  }
  // Ground debris / glints.
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(rnd() * width)
    const y = Math.floor(rnd() * height)
    g.fillStyle = rnd() > 0.9 ? 'rgba(255,61,127,0.14)' : 'rgba(255,255,255,0.035)'
    g.fillRect(x, y, rnd() > 0.85 ? 2 : 1, 1)
  }

  // Track aura and asphalt.
  strokeTrack(g, samples, 156, 'rgba(255,61,127,0.06)')
  strokeTrack(g, samples, 144, 'rgba(67,246,224,0.08)')
  strokeTrack(g, samples, 134, '#100b1c')
  // Alternating red/white curbs.
  strokeTrack(g, samples, 130, '#e9e3f0', [13, 13], 0)
  strokeTrack(g, samples, 130, '#ff3d7f', [13, 13], 13)
  strokeTrack(g, samples, 122, '#242030')
  strokeTrack(g, samples, 112, '#2a2638')

  // Asphalt texture speckles inside the ribbon.
  g.save()
  g.beginPath()
  g.moveTo(samples[0].x, samples[0].y)
  for (let i = 1; i < samples.length; i++) g.lineTo(samples[i].x, samples[i].y)
  g.closePath()
  g.lineWidth = 110
  g.strokeStyle = '#2a2638'
  g.stroke()
  g.clip()
  for (let i = 0; i < 900; i++) {
    const s = samples[Math.floor(rnd() * samples.length)]
    const off = (rnd() - 0.5) * 104
    const x = s.x + s.nx * off
    const y = s.y + s.ny * off
    g.fillStyle = rnd() > 0.93 ? 'rgba(255,61,127,0.15)' : 'rgba(255,255,255,0.035)'
    g.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
  // Old skid arcs.
  g.strokeStyle = 'rgba(5,4,10,0.28)'
  g.lineWidth = 3
  for (let i = 0; i < 14; i++) {
    const s = samples[Math.floor(rnd() * samples.length)]
    const off = (rnd() - 0.5) * 70
    g.beginPath()
    g.arc(s.x + s.nx * off, s.y + s.ny * off, 18 + rnd() * 30, rnd() * 6, rnd() * 6 + 1.4)
    g.stroke()
  }
  g.restore()

  // Center dashes.
  strokeTrack(g, samples, 2, 'rgba(255,211,78,0.32)', [12, 22], 0)

  // Start line and grid box.
  const startIndex = 60
  const start = samples[startIndex]
  const sx = start.x
  const sy = start.y
  g.save()
  g.translate(sx, sy)
  g.rotate(start.angle + Math.PI / 2)
  for (let col = 0; col < 12; col++) {
    for (let rowI = 0; rowI < 2; rowI++) {
      g.fillStyle = (col + rowI) % 2 ? '#ece7f4' : '#171320'
      g.fillRect(-60 + col * 10, -7 + rowI * 7, 10, 7)
    }
  }
  g.restore()

  // Painted direction chevrons.
  for (let i = 26; i < samples.length; i += 38) {
    const s = samples[i]
    g.save()
    g.translate(s.x, s.y)
    g.rotate(s.angle)
    g.strokeStyle = 'rgba(67,246,224,0.30)'
    g.lineWidth = 3
    for (let k = 0; k < 2; k++) {
      g.beginPath()
      g.moveTo(-7 + k * 9, -8)
      g.lineTo(2 + k * 9, 0)
      g.lineTo(-7 + k * 9, 8)
      g.stroke()
    }
    g.restore()
  }

  // Road paint.
  g.save()
  g.translate(sx + start.nx * 0, sy + start.ny * 0)
  g.rotate(start.angle)
  g.globalAlpha = 0.5
  drawText(g, 'NEON APEX', -34, -3, { scale: 1, color: '#8f86aa' })
  g.restore()

  // Decorate the outside of the circuit.
  for (let i = 0; i < samples.length; i += 9) {
    const s = samples[i]
    const side = i % 18 === 0 ? 1 : -1
    const off = halfWidth + 26 + ((i * 7) % 18)
    const x = s.x + s.nx * off * side
    const y = s.y + s.ny * off * side
    if (x < 10 || y < 10 || x > width - 10 || y > height - 10) continue
    drawPalmTop(g, x, y, 0.8 + ((i * 13) % 5) * 0.08, 0.95)
  }

  // Warm lamp pools.
  for (let i = 12; i < samples.length; i += 20) {
    const s = samples[i]
    const x = s.x + s.nx * (halfWidth + 10)
    const y = s.y + s.ny * (halfWidth + 10)
    const grad = g.createRadialGradient(x, y, 0, x, y, 36)
    grad.addColorStop(0, 'rgba(255,211,78,0.10)')
    grad.addColorStop(1, 'rgba(255,211,78,0)')
    g.fillStyle = grad
    g.fillRect(x - 36, y - 36, 72, 72)
    g.fillStyle = '#2b2438'
    g.fillRect(x - 1, y - 1, 2, 2)
    g.fillStyle = '#ffd34e'
    g.fillRect(x - 1, y - 1, 1, 1)
  }

  // Tire barriers on the sharpest outside corners.
  for (let i = 0; i < samples.length; i += 6) {
    const a = samples[i]
    const b = samples[(i + 4) % samples.length]
    const c = samples[(i + 8) % samples.length]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    const k = samples[i]
    const sign = Math.sign(cross) || 1
    if (Math.abs(cross) > 140 && i % 18 === 0) {
      const off = halfWidth + 12
      drawTireBarrier(g, k.x + k.nx * off * sign, k.y + k.ny * off * sign, k.angle + Math.PI / 2, 3)
    }
  }

  // Neon gates / signs.
  const signSpots = [42, 112, 176, 232]
  for (const idx of signSpots) {
    const s = samples[idx % samples.length]
    const off = halfWidth + 36
    const x = s.x + s.nx * off
    const y = s.y + s.ny * off
    g.save()
    g.translate(x, y)
    g.rotate(s.angle + Math.PI / 2)
    g.fillStyle = '#120d20'
    g.fillRect(-1, -1, 20, 12)
    g.strokeStyle = idx % 2 ? '#ff3d7f' : '#43f6e0'
    g.lineWidth = 1
    g.strokeRect(-1, -1, 20, 12)
    g.fillStyle = idx % 2 ? '#ff3d7f' : '#43f6e0'
    g.fillRect(3, 2, 12, 2)
    g.fillRect(3, 6, 8, 2)
    g.globalAlpha = 0.2
    g.fillRect(-4, -4, 26, 18)
    g.restore()
  }

  // Border frame.
  g.globalAlpha = 1

  return {
    canvas,
    width,
    height,
    samples,
    halfWidth,
    start: { x: start.x, y: start.y, angle: start.angle },
    startLine: { x: sx, y: sy, angle: start.angle },
    spawn: {
      x: start.x + start.tx * 22,
      y: start.y + start.ty * 22,
      angle: start.angle,
    },
  }
}

export function nearestOnTrack(track, x, y) {
  let best = Infinity
  let bestIndex = 0
  const samples = track.samples
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const dx = x - s.x
    const dy = y - s.y
    const d = dx * dx + dy * dy
    if (d < best) {
      best = d
      bestIndex = i
    }
  }
  const s = samples[bestIndex]
  return {
    index: bestIndex,
    dist: Math.sqrt(best),
    sample: s,
    nx: s.nx,
    ny: s.ny,
  }
}

// --------------------------------------------------------------------------
// Drag strip
// --------------------------------------------------------------------------

export const DRAG = {
  canvasWidth: 560,
  canvasHeight: 2600,
  centerX: 280,
  roadHalf: 92,
  laneOffset: 52,
  startY: 2420,
  finishY: 700,
  distance: 1720,
}

export function buildDragWorld() {
  const { canvasWidth: W, canvasHeight: H, centerX, roadHalf, startY, finishY } = DRAG
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')
  const rnd = seeded(1977)

  // Ground.
  g.fillStyle = '#0a0813'
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(255,61,127,0.05)'
  g.lineWidth = 1
  for (let x = 0; x < W; x += 40) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y < H; y += 40) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() > 0.9 ? 'rgba(255,211,78,0.10)' : 'rgba(255,255,255,0.03)'
    g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1)
  }

  // Run-off shoulders.
  g.fillStyle = '#171320'
  g.fillRect(centerX - roadHalf - 14, 0, roadHalf * 2 + 28, H)
  g.fillStyle = '#1d1826'
  g.fillRect(centerX - roadHalf - 8, 0, roadHalf * 2 + 16, H)

  // Strip.
  g.fillStyle = '#292536'
  g.fillRect(centerX - roadHalf, 0, roadHalf * 2, H)
  // Lane grain.
  for (let y = 0; y < H; y += 4) {
    g.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.035)'
    g.fillRect(centerX - roadHalf, y, roadHalf * 2, 2)
  }
  // Edges.
  g.fillStyle = '#e9e3f0'
  g.fillRect(centerX - roadHalf, 0, 4, H)
  g.fillRect(centerX + roadHalf - 4, 0, 4, H)
  g.fillStyle = '#ff3d7f'
  for (let y = 0; y < H; y += 30) {
    g.fillRect(centerX - roadHalf - 8, y, 4, 15)
    g.fillRect(centerX + roadHalf + 4, y, 4, 15)
  }
  // Center dashes.
  g.fillStyle = 'rgba(255,211,78,0.5)'
  for (let y = 0; y < H; y += 34) g.fillRect(centerX - 1, y, 2, 18)

  // Start line & staging boxes.
  g.fillStyle = '#ece7f4'
  g.fillRect(centerX - roadHalf, startY - 8, roadHalf * 2, 5)
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#171320' : '#ece7f4'
    g.fillRect(centerX - roadHalf + i * 11.5, startY - 26, 11.5, 8)
    g.fillStyle = i % 2 ? '#ece7f4' : '#171320'
    g.fillRect(centerX - roadHalf + i * 11.5, startY - 18, 11.5, 8)
  }
  // Staging boxes.
  for (const dir of [-1, 1]) {
    const lx = centerX + dir * DRAG.laneOffset
    g.strokeStyle = 'rgba(255,211,78,0.55)'
    g.lineWidth = 2
    g.strokeRect(lx - 24, startY + 10, 48, 52)
    g.fillStyle = 'rgba(255,211,78,0.5)'
    g.fillRect(lx - 8, startY + 24, 16, 3)
  }

  // Distance markers every 200 world px.
  const total = startY - finishY
  for (let d = 200; d < total; d += 200) {
    const y = startY - d
    const pct = Math.round((d / total) * 100)
    g.fillStyle = 'rgba(67,246,224,0.55)'
    g.fillRect(centerX - roadHalf, y, roadHalf * 2, 1)
    g.fillStyle = '#43f6e0'
    g.fillRect(centerX + roadHalf + 14, y - 1, 3, 3)
    drawText(g, pct + '%', centerX + roadHalf + 22, y - 3, { scale: 1, color: 'rgba(67,246,224,0.65)' })
    g.fillStyle = '#ffd34e'
    g.fillRect(centerX - roadHalf - 20, y - 1, 6, 2)
    g.fillRect(centerX - roadHalf - 17, y - 4, 2, 8)
  }

  // Skid marks down the strip.
  g.save()
  g.globalAlpha = 0.32
  g.fillStyle = '#0b0912'
  for (let i = 0; i < 26; i++) {
    const x = centerX + (rnd() - 0.5) * 150
    const y = startY - rnd() * total
    g.fillRect(Math.round(x), Math.round(y), 2, 20 + Math.floor(rnd() * 60))
  }
  g.restore()

  // Crowd stands.
  const standSections = [
    [1880, 2400],
    [1230, 1590],
    [830, 1080],
  ]
  for (const [y0, y1] of standSections) {
    for (const side of [-1, 1]) {
      const x = side < 0 ? centerX - roadHalf - 78 : centerX + roadHalf + 26
      g.fillStyle = '#16111f'
      g.fillRect(x, y0, 52, y1 - y0)
      g.fillStyle = '#241a35'
      g.fillRect(x, y0, 52, 5)
      // rows of fans
      g.globalAlpha = 0.55
      for (let yy = y0 + 10; yy < y1 - 6; yy += 9) {
        for (let xx = x + 5; xx < x + 48; xx += 5) {
          const c = rnd()
          g.fillStyle = c > 0.7 ? '#ff3d7f' : c > 0.45 ? '#43f6e0' : c > 0.2 ? '#ffd34e' : '#5a5070'
          g.fillRect(Math.round(xx), Math.round(yy), 2, 3)
        }
      }
      g.globalAlpha = 1
      // rail
      g.fillStyle = '#3a3150'
      g.fillRect(side < 0 ? x + 50 : x - 2, y0, 2, y1 - y0)
    }
  }

  // Light towers.
  for (let y = 400; y < H; y += 330) {
    for (const side of [-1, 1]) {
      const x = centerX + side * (roadHalf + 58)
      g.fillStyle = '#1b1626'
      g.fillRect(x - 3, y - 3, 6, 6)
      g.fillStyle = '#ffd34e'
      g.fillRect(x - 2, y - 2, 4, 4)
      const grad = g.createRadialGradient(x, y, 0, x, y, 44)
      grad.addColorStop(0, 'rgba(255,211,78,0.11)')
      grad.addColorStop(1, 'rgba(255,211,78,0)')
      g.fillStyle = grad
      g.fillRect(x - 44, y - 44, 88, 88)
    }
  }

  // Parked trailers outside the strip.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1
    const x = centerX + side * (roadHalf + 130)
    const y = 900 + i * 170
    g.fillStyle = '#121020'
    g.fillRect(x - 20, y - 30, 40, 60)
    g.fillStyle = i % 3 === 0 ? '#ff3d7f' : '#43f6e0'
    g.fillRect(x - 20, y - 30, 40, 2)
    g.fillStyle = 'rgba(255,255,255,0.06)'
    g.fillRect(x - 12, y - 20, 24, 10)
  }

  // Start gantry.
  drawGantry(g, centerX, startY - 70, 'NEON APEX', '#43f6e0', 'START')
  // Finish gantry.
  drawGantry(g, centerX, finishY, 'FINISH', '#ff3d7f', 'FINISH')

  // Finish checker.
  for (let rowI = 0; rowI < 3; rowI++) {
    for (let i = 0; i < 20; i++) {
      g.fillStyle = (rowI + i) % 2 ? '#ece7f4' : '#171320'
      g.fillRect(centerX - roadHalf + i * (roadHalf / 10), finishY + 8 + rowI * 8, roadHalf / 10, 8)
    }
  }

  return {
    canvas,
    width: W,
    height: H,
    centerX,
    startY,
    finishY,
    laneOffset: DRAG.laneOffset,
    distance: DRAG.distance,
  }
}

function drawGantry(g, cx, y, title, color, small) {
  // Pillars outside the strip.
  g.fillStyle = '#100c1a'
  g.fillRect(cx - 128, y - 46, 16, 54)
  g.fillRect(cx + 112, y - 46, 16, 54)
  g.fillStyle = color
  g.fillRect(cx - 127, y - 44, 3, 48)
  g.fillRect(cx + 113, y - 44, 3, 48)
  // Truss.
  g.fillStyle = '#1a1426'
  g.fillRect(cx - 128, y - 52, 256, 20)
  g.fillStyle = '#2d2540'
  for (let i = 0; i < 12; i++) g.fillRect(cx - 120 + i * 21, y - 50, 8, 2)
  // Banner: starts stay small so the HUD reads clearly, finish gets the drama.
  const big = small === 'FINISH'
  const bw = big ? 164 : 96
  const bh = big ? 16 : 11
  g.fillStyle = '#0c0915'
  g.fillRect(cx - bw / 2, y - 46, bw, bh)
  g.strokeStyle = color
  g.lineWidth = 1
  g.strokeRect(cx - bw / 2, y - 46, bw, bh)
  drawText(g, title, cx, y - 46 + (bh - (big ? 14 : 7)) / 2, { scale: big ? 2 : 1, color, align: 'center' })
  // Small sign.
  g.fillStyle = color
  g.fillRect(cx - 30, y - 26, 60, 7)
  drawText(g, small, cx, y - 25, { scale: 1, color: '#0b0812', align: 'center' })
}

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

export function drawCheckerFlag(ctx, x, y, size = 2, cols = 5, rows = 4) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 ? '#f4f0ff' : '#15111f'
      ctx.fillRect(x + c * size, y + r * size, size, size)
    }
  }
}

export function drawPanel(ctx, x, y, w, h, accent = '#ff3d7f', alpha = 0.9) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#0e0a1a'
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4)
  ctx.fillStyle = '#151026'
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = 1
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.globalAlpha = 0.35
  ctx.fillStyle = accent
  ctx.fillRect(x + 2, y + 2, w - 4, 1)
  ctx.globalAlpha = 1
}

export function drawBar(ctx, x, y, w, h, pct, color, bg = '#241d36') {
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  const fill = Math.max(0, Math.min(1, pct)) * w
  ctx.fillStyle = color
  ctx.fillRect(x, y, Math.floor(fill), h)
  ctx.globalAlpha = 0.35
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, Math.floor(fill), 1)
  ctx.globalAlpha = 1
}

export function drawCarPreview(ctx, sprite, shadow, x, y, scale, angle, t) {
  // Turntable platform.
  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#0b0814'
  ctx.beginPath()
  ctx.ellipse(x, y + 6, 56, 22, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,61,127,0.6)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(x, y + 6, 56, 22, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(67,246,224,0.3)'
  ctx.beginPath()
  ctx.ellipse(x, y + 6, 40, 15, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  drawCar(ctx, sprite, shadow, x, y - 2, angle + Math.sin(t * 0.6) * 0.05, scale)
}

export function drawSparkle(ctx, x, y, t, color = '#43f6e0') {
  const a = Math.sin(t * 3) * 0.5 + 0.5
  ctx.globalAlpha = a
  ctx.fillStyle = color
  ctx.fillRect(x, y - 2, 1, 5)
  ctx.fillRect(x - 2, y, 5, 1)
  ctx.globalAlpha = 1
}

export const CAR_COLORS = CAR_CONFIGS
