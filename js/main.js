import { drawText } from './font.js'
import {
  PALETTE, makeCarSprite, makeCarShadow, drawCar, drawSynthScene, buildDriftWorld,
  nearestOnTrack, buildDragWorld, DRAG, drawCarPreview, drawSparkle,
} from './art.js'
import { Sound } from './audio.js'

const W = 384
const H = 216
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d', { alpha: false })
ctx.imageSmoothingEnabled = false

const SAVE_KEY = 'neon-apex-save-v1'

const CARS = [
  { id: 'vulcan', name: 'VULCAN GT', kind: 'cyan', price: 0, stats: { spd: 3, acc: 3, grip: 3, drift: 3 }, tag: 'STREET' },
  { id: 'komet', name: 'KOMET R', kind: 'orange', price: 900, stats: { spd: 4, acc: 4, grip: 3, drift: 4 }, tag: 'SPORT' },
  { id: 'phantom', name: 'PHANTOM X', kind: 'magenta', price: 2200, stats: { spd: 4, acc: 4, grip: 5, drift: 5 }, tag: 'PRO' },
  { id: 'oni', name: 'ONI TYPE-Z', kind: 'lime', price: 4200, stats: { spd: 5, acc: 5, grip: 5, drift: 4 }, tag: 'WORKS' },
]

const GEAR_MAX = [112, 176, 244, 312, 380, 452]
const GEAR_TORQUE = [1.35, 1.16, 1.02, 0.9, 0.8, 0.72]
const REDLINE = 7560
const PERFECT_ZONE = 6600
const DRIFT_TIME = 90

function loadSave() {
  const def = {
    cash: 350,
    owned: ['vulcan'],
    selected: 'vulcan',
    bestDrag: null,
    bestDrift: 0,
    muted: false,
    runs: 0,
  }
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY))
    if (!raw || typeof raw !== 'object') return def
    const owned = Array.isArray(raw.owned) ? raw.owned.filter((id) => CARS.some((c) => c.id === id)) : def.owned
    if (!owned.includes('vulcan')) owned.unshift('vulcan')
    const selected = owned.includes(raw.selected) ? raw.selected : 'vulcan'
    return {
      cash: Number.isFinite(raw.cash) ? Math.max(0, Math.floor(raw.cash)) : def.cash,
      owned,
      selected,
      bestDrag: Number.isFinite(raw.bestDrag) && raw.bestDrag > 0 ? raw.bestDrag : null,
      bestDrift: Number.isFinite(raw.bestDrift) ? Math.max(0, Math.floor(raw.bestDrift)) : 0,
      muted: Boolean(raw.muted),
      runs: Number.isFinite(raw.runs) ? raw.runs : 0,
    }
  } catch {
    return def
  }
}

const save = loadSave()
const sound = new Sound(save.muted)
const game = {
  screen: 'title',
  t: 0,
  st: 0,
  paused: false,
  fade: 1,
  shake: 0,
  flash: 0,
  flashColor: '255,61,127',
  hover: null,
  hits: [],
  menuIndex: 0,
  garageIndex: 0,
  drift: null,
  drag: null,
  toast: null,
  driftWorld: null,
  dragWorld: null,
  skid: null,
  bestTag: null,
}

const spriteCache = new Map()
const shadowSprite = makeCarShadow()

function carById(id) {
  return CARS.find((c) => c.id === id) || CARS[0]
}
function selectedCar() {
  return carById(save.selected)
}
function spriteFor(kind) {
  if (!spriteCache.has(kind)) spriteCache.set(kind, makeCarSprite(kind))
  return spriteCache.get(kind)
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch {}
}
function money(n) {
  return '$' + Math.max(0, Math.floor(n)).toLocaleString('en-US')
}
function timeStr(t) {
  return t === null || t === undefined ? '---' : t.toFixed(3)
}
function clockStr(t) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t % 1) * 100)
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
function shortClock(t) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v }
function lerp(a, b, t) { return a + (b - a) * t }
function rand(a, b) { return a + Math.random() * (b - a) }

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const input = {
  held: new Set(),
  pressed: new Set(),
  down(action) {
    if (!action) return
    if (!this.held.has(action)) this.pressed.add(action)
    this.held.add(action)
  },
  up(action) {
    this.held.delete(action)
  },
  consume(action) {
    if (!this.pressed.has(action)) return false
    this.pressed.delete(action)
    return true
  },
  heldAny(...actions) {
    return actions.some((a) => this.held.has(a))
  },
  clear() {
    this.held.clear()
    this.pressed.clear()
  },
}

const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'space',
  Enter: 'confirm',
  Shift: 'shift', j: 'shift', J: 'shift',
  n: 'nitro', N: 'nitro',
  Escape: 'pause', p: 'pause', P: 'pause',
  m: 'mute', M: 'mute',
}

function onKeyDown(e) {
  if (e.key === 'm' || e.key === 'M') {
    if (!e.repeat) toggleMute()
    e.preventDefault()
    return
  }
  const action = KEYMAP[e.key]
  if (!action) return
  sound.ensure()
  if (!e.repeat) input.down(action)
  e.preventDefault()
}
function onKeyUp(e) {
  const action = KEYMAP[e.key]
  if (!action) return
  input.up(action)
  e.preventDefault()
}
window.addEventListener('keydown', onKeyDown, { passive: false })
window.addEventListener('keyup', onKeyUp, { passive: false })
window.addEventListener('blur', () => input.clear())

// ---------------------------------------------------------------------------
// Touch buttons
// ---------------------------------------------------------------------------
const pointerActions = new Map()
document.querySelectorAll('[data-act]').forEach((button) => {
  const action = button.dataset.act
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    sound.ensure()
    button.setPointerCapture?.(e.pointerId)
    pointerActions.set(e.pointerId, { action, button })
    input.down(action)
    button.classList.add('active')
  })
  button.addEventListener('contextmenu', (e) => e.preventDefault())
})
function releaseTouch(e) {
  const entry = pointerActions.get(e.pointerId)
  if (!entry) return
  input.up(entry.action)
  entry.button.classList.remove('active')
  pointerActions.delete(e.pointerId)
}
window.addEventListener('pointerup', releaseTouch)
window.addEventListener('pointercancel', releaseTouch)

// ---------------------------------------------------------------------------
// Responsive sizing
// ---------------------------------------------------------------------------
function touchDevice() {
  return matchMedia('(pointer: coarse)').matches || window.innerWidth < 760
}
function resize() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const touch = touchDevice()
  const portrait = vh > vw * 1.02
  const playing = game.screen === 'drag' || game.screen === 'drift'
  document.body.classList.toggle('touch', touch)
  document.body.classList.toggle('portrait', portrait)
  document.body.classList.toggle('landscape', !portrait)

  let sw
  let sh
  if (touch && portrait) {
    const deckH = playing ? 168 : 0
    const availH = Math.max(180, vh - deckH - 38)
    sw = Math.min(vw - 16, availH * (16 / 9), 560)
    sh = sw * (9 / 16)
  } else {
    const hintH = touch ? 8 : 34
    const availH = Math.max(200, vh - hintH - 26)
    sh = Math.min(availH, (vw - 22) * (9 / 16))
    sw = sh * (16 / 9)
  }
  if (sh < 120) {
    sh = Math.min(216, vh - 24)
    sw = sh * (16 / 9)
  }
  document.documentElement.style.setProperty('--sw', Math.floor(sw) + 'px')
  document.documentElement.style.setProperty('--sh', Math.floor(sh) + 'px')
}
window.addEventListener('resize', resize)
window.addEventListener('orientationchange', () => setTimeout(resize, 60))
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize)

// ---------------------------------------------------------------------------
// Screen management
// ---------------------------------------------------------------------------
function setScreen(name) {
  game.screen = name
  game.st = 0
  game.paused = false
  game.hits = []
  game.hover = null
  game.fade = 1
  input.clear()
  for (const entry of pointerActions.values()) entry.button.classList.remove('active')
  pointerActions.clear()
  const playing = name === 'drag' || name === 'drift'
  document.body.classList.toggle('playing', playing)
  document.body.classList.toggle('menu-mode', !playing)
  document.body.classList.toggle('mode-drag', name === 'drag')
  document.body.classList.toggle('mode-drift', name === 'drift')
  resize()
  if (name === 'drag') {
    initDrag()
    sound.setMusic(true)
  } else if (name === 'drift') {
    initDrift()
    sound.setMusic(true)
  } else {
    sound.stopCarSounds()
    sound.setMusic(true)
  }
  if (name === 'menu') game.menuIndex = clamp(game.menuIndex, 0, 3)
  if (name === 'garage') {
    const idx = CARS.findIndex((c) => c.id === save.selected)
    game.garageIndex = Math.max(0, idx)
  }
}

function enterMenu() {
  sound.ensure()
  sound.select()
  setScreen('menu')
}

function toggleMute() {
  save.muted = !save.muted
  sound.setMuted(save.muted)
  persist()
  const btn = document.getElementById('muteBtn')
  btn.classList.toggle('muted', save.muted)
  btn.textContent = save.muted ? 'OFF' : 'SND'
  btn.setAttribute('aria-pressed', String(save.muted))
}

function togglePause() {
  if (game.screen !== 'drag' && game.screen !== 'drift') return
  if (game.screen === 'drag' && game.drag?.phase === 'done') return
  if (game.screen === 'drift' && game.drift?.phase === 'done') return
  game.paused = !game.paused
  if (game.paused) sound.stopCarSounds()
  sound.select()
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
function rect(x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}
function text(str, x, y, opts = {}) {
  return drawText(ctx, str, x, y, opts)
}
function pixelCircle(x, y, r, color) {
  ctx.fillStyle = color
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)))
    ctx.fillRect(Math.round(x - dx), Math.round(y + dy), dx * 2 + 1, 1)
  }
}
function triangle(x, y, dir, color, size = 4) {
  ctx.fillStyle = color
  for (let i = 0; i < size; i++) {
    const w = size - i
    if (dir === 'left') ctx.fillRect(Math.round(x + i), Math.round(y - w + 1), 1, w * 2)
    else if (dir === 'right') ctx.fillRect(Math.round(x + size - i), Math.round(y - w + 1), 1, w * 2)
    else if (dir === 'up') ctx.fillRect(Math.round(x - w + 1), Math.round(y + i), w * 2, 1)
    else ctx.fillRect(Math.round(x - w + 1), Math.round(y + size - i), w * 2, 1)
  }
}
function addHit(id, x, y, w, h, fn) {
  game.hits.push({ id, x, y, w, h, fn })
}
function hovered(id) {
  return game.hover === id
}
function drawButton(id, label, x, y, w, h, opts = {}) {
  const selected = opts.selected || hovered(id)
  const disabled = opts.disabled
  const accent = opts.accent || PALETTE.pink
  const fill = disabled ? '#181425' : selected ? accent : opts.fill || '#1a1429'
  const border = disabled ? '#2e2740' : selected ? accent : opts.border || '#453663'
  const txt = disabled ? '#776b90' : selected ? (opts.darkText || '#100611') : opts.color || '#e8e2f5'
  rect(x, y, w, h, fill)
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1)
  if (selected && !disabled) rect(x + 2, y + 2, w - 4, 1, 'rgba(255,255,255,0.28)')
  text(label, x + w / 2, y + Math.floor((h - 7 * (opts.scale || 1)) / 2), {
    scale: opts.scale || 1,
    color: txt,
    align: 'center',
  })
  if (!disabled) addHit(id, x, y, w, h, opts.onClick)
}
function drawStatBars(x, y, stat, color, width = 65) {
  for (let i = 0; i < 5; i++) {
    const filled = i < stat
    rect(x + i * 13, y, 10, 4, filled ? color : '#2a2140')
    if (filled) rect(x + i * 13, y, 10, 1, 'rgba(255,255,255,0.35)')
  }
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------
function updateTitle() {
  if (input.consume('confirm') || input.consume('space') || input.consume('up') || input.consume('down')) {
    enterMenu()
  }
}
function drawTitle() {
  drawSynthScene(ctx, game.t, selectedCar().kind, false)
  const grad = ctx.createLinearGradient(0, 0, 0, 108)
  grad.addColorStop(0, 'rgba(5,3,12,0.55)')
  grad.addColorStop(0.65, 'rgba(5,3,12,0.12)')
  grad.addColorStop(1, 'rgba(5,3,12,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, 110)

  ctx.globalAlpha = 0.9 + Math.sin(game.t * 18) * 0.02
  text('NEON', 57, 19, { scale: 5, color: PALETTE.cyan, shadow: '#041412', shadowX: 2, shadowY: 2, glow: true })
  text('APEX', 196, 19, { scale: 5, color: PALETTE.pink, shadow: '#1d0410', shadowX: 2, shadowY: 2, glow: true })
  ctx.globalAlpha = 1

  rect(105, 62, 34, 1, 'rgba(67,246,224,0.6)')
  rect(245, 62, 34, 1, 'rgba(255,61,127,0.6)')
  text('DRAG & DRIFT', 192, 68, { scale: 2, color: '#f6edff', align: 'center', shadow: '#0a0512' })
  text('PIXEL RACING // 199X', 192, 88, { scale: 1, color: '#c49ad3', align: 'center', shadow: '#0a0512' })

  text('BEST DRAG', 14, 130, { scale: 1, color: '#7f7299' })
  text(timeStr(save.bestDrag), 14, 139, { scale: 1, color: PALETTE.yellow })
  text('BEST DRIFT', 370, 130, { scale: 1, color: '#7f7299', align: 'right' })
  text(save.bestDrift ? save.bestDrift.toLocaleString('en-US') : '---', 370, 139, { scale: 1, color: PALETTE.cyan, align: 'right' })

  const blink = Math.floor(game.t * 2.2) % 2 === 0
  if (blink) {
    const label = touchDevice() ? 'TAP TO START' : 'PRESS ENTER TO START'
    text(label, 192, 109, { scale: 1, color: '#ffffff', align: 'center', shadow: '#0a0512', glow: true })
  }
  text('CREDIT 01', 14, 203, { scale: 1, color: 'rgba(255,255,255,0.3)' })
  text('V1.0', 370, 203, { scale: 1, color: 'rgba(255,255,255,0.3)', align: 'right' })
}

// ---------------------------------------------------------------------------
// Main menu
// ---------------------------------------------------------------------------
const MENU_ITEMS = [
  { id: 'drag', label: 'DRAG RACE', desc: '1/4 MILE. MANUAL GEARS. WAIT FOR GREEN.' },
  { id: 'drift', label: 'DRIFT RUN', desc: '90 SECONDS. CHAIN DRIFTS. AVOID THE WALLS.' },
  { id: 'garage', label: 'GARAGE', desc: 'BUY CARS AND PICK YOUR MACHINE.' },
  { id: 'help', label: 'HOW TO PLAY', desc: 'EVERY CONTROL, EXPLAINED.' },
]

function updateMenu() {
  if (input.consume('up')) {
    game.menuIndex = (game.menuIndex + MENU_ITEMS.length - 1) % MENU_ITEMS.length
    sound.ui()
  }
  if (input.consume('down')) {
    game.menuIndex = (game.menuIndex + 1) % MENU_ITEMS.length
    sound.ui()
  }
  if (input.consume('confirm') || input.consume('space')) {
    activateMenu(game.menuIndex)
  }
  if (input.consume('pause')) {
    sound.back()
    setScreen('title')
  }
}
function activateMenu(index) {
  sound.select()
  const item = MENU_ITEMS[index]
  if (!item) return
  if (item.id === 'drag') setScreen('drag')
  else if (item.id === 'drift') setScreen('drift')
  else if (item.id === 'garage') setScreen('garage')
  else if (item.id === 'help') setScreen('help')
}
function drawMenu() {
  drawSynthScene(ctx, game.t, selectedCar().kind, true)
  ctx.fillStyle = 'rgba(6,4,13,0.68)'
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(10,6,20,0.12)')
  g.addColorStop(1, 'rgba(6,4,13,0.6)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  text('NEON', 14, 9, { scale: 2, color: PALETTE.cyan, glow: true })
  text('APEX', 76, 9, { scale: 2, color: PALETTE.pink, glow: true })
  text('MAIN MENU', 14, 27, { scale: 1, color: '#7f7299' })

  rect(276, 7, 94, 30, 'rgba(16,11,28,0.85)')
  ctx.strokeStyle = '#4c3868'
  ctx.strokeRect(276.5, 7.5, 93, 29)
  text('CREDITS', 282, 10, { scale: 1, color: '#7f7299' })
  text(money(save.cash), 366, 18, { scale: 2, color: PALETTE.yellow, align: 'right' })

  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const x = 14
    const y = 45 + i * 30
    const w = 190
    const selected = game.menuIndex === i
    const hov = hovered('menu-' + MENU_ITEMS[i].id)
    rect(x, y, w, 26, selected ? '#ff3d7f' : hov ? '#241a38' : '#151026')
    ctx.strokeStyle = selected ? '#ff9bbd' : '#342846'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 25)
    if (selected) triangle(x + 6, y + 13, 'right', '#2a0714', 3)
    text(String(i + 1).padStart(2, '0'), x + 14, y + 10, {
      scale: 1,
      color: selected ? 'rgba(26,4,13,0.65)' : '#6b5e83',
    })
    text(MENU_ITEMS[i].label, x + 30, y + 9, {
      scale: 2,
      color: selected ? '#1c0410' : '#efe8fa',
      shadow: selected ? null : '#07040c',
    })
    addHit('menu-' + MENU_ITEMS[i].id, x, y, w, 26, () => {
      game.menuIndex = i
      activateMenu(i)
    })
  }

  const car = selectedCar()
  rect(212, 45, 158, 121, '#100c1c')
  ctx.strokeStyle = '#3b2b55'
  ctx.strokeRect(212.5, 45.5, 157, 120)
  rect(212, 45, 158, 1, 'rgba(255,61,127,0.6)')
  text('YOUR MACHINE', 220, 51, { scale: 1, color: '#776a8f' })
  text(car.name, 291, 63, { scale: 2, color: '#f2ecff', align: 'center', shadow: '#08050f' })
  text(car.tag + ' CLASS', 291, 79, { scale: 1, color: PALETTE.cyan, align: 'center' })
  drawCarPreview(ctx, spriteFor(car.kind), shadowSprite, 291, 116, 1.5, -0.5, game.t)
  text('SPD ' + car.stats.spd + '   ACC ' + car.stats.acc, 291, 149, {
    scale: 1, color: '#a99cc0', align: 'center',
  })
  text('GRIP ' + car.stats.grip + '   DRIFT ' + car.stats.drift, 291, 158, {
    scale: 1, color: '#a99cc0', align: 'center',
  })

  rect(14, 178, 356, 17, 'rgba(12,8,22,0.9)')
  ctx.strokeStyle = '#2c2142'
  ctx.strokeRect(14.5, 178.5, 355, 16)
  text(MENU_ITEMS[game.menuIndex].desc, 22, 184, { scale: 1, color: '#bfb4d4' })
  text(touchDevice() ? 'TAP A MENU ITEM' : 'UP/DOWN SELECT   ENTER/SPACE GO', 192, 202, {
    scale: 1, color: '#6f6384', align: 'center',
  })
  if (save.muted) text('SOUND OFF', 370, 202, { scale: 1, color: '#6f6384', align: 'right' })
  text('M SOUND', 14, 202, { scale: 1, color: '#42385a' })
}

// ---------------------------------------------------------------------------
// Garage
// ---------------------------------------------------------------------------
function garageAction() {
  const car = CARS[game.garageIndex]
  if (!car) return
  if (save.owned.includes(car.id)) {
    if (save.selected !== car.id) {
      save.selected = car.id
      persist()
      game.toast = { text: car.name + ' SELECTED', t: 1.8 }
      sound.select()
    }
    return
  }
  if (save.cash >= car.price) {
    save.cash -= car.price
    save.owned.push(car.id)
    save.selected = car.id
    persist()
    game.toast = { text: car.name + ' UNLOCKED', t: 2.2 }
    sound.reward()
  } else {
    sound.fail()
  }
}

function updateGarage() {
  if (input.consume('left')) {
    game.garageIndex = (game.garageIndex + CARS.length - 1) % CARS.length
    game.toast = null
    sound.ui()
  }
  if (input.consume('right')) {
    game.garageIndex = (game.garageIndex + 1) % CARS.length
    game.toast = null
    sound.ui()
  }
  if (input.consume('confirm') || input.consume('space')) garageAction()
  if (input.consume('pause')) {
    sound.back()
    setScreen('menu')
  }
}

function drawGarage() {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#100a20')
  bg.addColorStop(0.6, '#0d0818')
  bg.addColorStop(1, '#07050d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  rect(0, 0, W, 6, '#1c1230')
  rect(0, 6, W, 1, 'rgba(67,246,224,0.45)')
  rect(0, 98, W, 1, 'rgba(255,61,127,0.28)')
  for (let i = 0; i < 4; i++) {
    const x = 52 + i * 96
    rect(x - 16, 12, 32, 3, '#2c2144')
    rect(x - 10, 15, 20, 2, PALETTE.yellow)
    const gl = ctx.createRadialGradient(x, 20, 0, x, 20, 34)
    gl.addColorStop(0, 'rgba(255,211,78,0.10)')
    gl.addColorStop(1, 'rgba(255,211,78,0)')
    ctx.fillStyle = gl
    ctx.fillRect(x - 34, 0, 68, 60)
  }
  rect(0, 116, W, 100, '#0a0712')
  ctx.strokeStyle = 'rgba(67,246,224,0.10)'
  ctx.lineWidth = 1
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath()
    ctx.moveTo(192, 116)
    ctx.lineTo(192 + i * 42, H)
    ctx.stroke()
  }
  for (let i = 0; i < 5; i++) {
    const y = 122 + i * i * 4.4
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  rect(0, 114, W, 2, 'rgba(255,61,127,0.55)')
  for (const side of [0, 1]) {
    const x = side ? 336 : 42
    const y = 146
    for (let i = 0; i < 5; i++) {
      pixelCircle(x, y + i * 8, 9, '#0c0a12')
      pixelCircle(x, y + i * 8, 6, side ? '#171222' : '#15101f')
      rect(x - 7, y + i * 8 - 1, 14, 1, 'rgba(255,255,255,0.06)')
    }
  }

  text('GARAGE', 14, 8, { scale: 2, color: PALETTE.cyan, glow: true })
  text(money(save.cash), 368, 10, { scale: 2, color: PALETTE.yellow, align: 'right' })

  const car = CARS[game.garageIndex]
  const owned = save.owned.includes(car.id)
  const selected = save.selected === car.id
  text(car.name, 192, 36, { scale: 2, color: '#fff4ff', align: 'center', shadow: '#090410', glow: selected })
  text(car.tag, 192, 52, { scale: 1, color: PALETTE.cyan, align: 'center' })
  if (selected) {
    text('EQUIPPED', 90, 39, { scale: 1, color: PALETTE.cyan, align: 'right' })
    drawSparkle(ctx, 80, 36, game.t, PALETTE.cyan)
  }

  drawCarPreview(ctx, spriteFor(car.kind), shadowSprite, 152, 118, 2.85, -0.42, game.t)

  drawButton('gar-prev', '<', 16, 100, 22, 38, { accent: PALETTE.cyan, darkText: '#04110f', scale: 2, onClick: () => {
    game.garageIndex = (game.garageIndex + CARS.length - 1) % CARS.length
    game.toast = null
    sound.ui()
  } })
  drawButton('gar-next', '>', 224, 100, 22, 38, { accent: PALETTE.cyan, darkText: '#04110f', scale: 2, onClick: () => {
    game.garageIndex = (game.garageIndex + 1) % CARS.length
    game.toast = null
    sound.ui()
  } })

  rect(252, 62, 120, 108, 'rgba(12,8,22,0.92)')
  ctx.strokeStyle = '#3b2b55'
  ctx.strokeRect(252.5, 62.5, 119, 107)
  text('SPECS', 260, 68, { scale: 1, color: '#8a7fa2' })
  const rows = [
    ['SPD', car.stats.spd, PALETTE.cyan],
    ['ACC', car.stats.acc, PALETTE.yellow],
    ['GRIP', car.stats.grip, PALETTE.orange],
    ['DRIFT', car.stats.drift, PALETTE.pink],
  ]
  for (let i = 0; i < rows.length; i++) {
    const y = 82 + i * 19
    text(rows[i][0], 260, y + 4, { scale: 1, color: '#a99cc0' })
    drawStatBars(288, y + 5, rows[i][1], rows[i][2], 62)
  }
  text(owned ? (selected ? 'IN YOUR GARAGE' : 'READY TO DRIVE') : 'SHOWROOM LOCKED', 312, 154, {
    scale: 1, color: owned ? '#796d92' : '#6f6384', align: 'center',
  })

  drawButton('gar-back', 'BACK', 14, 180, 56, 20, { accent: PALETTE.pink, darkText: '#1a0410', onClick: () => {
    sound.back()
    setScreen('menu')
  } })
  if (!owned) {
    drawButton('gar-action', 'BUY  ' + money(car.price), 103, 180, 178, 20, {
      accent: PALETTE.yellow, darkText: '#1b1102', scale: 2,
      disabled: save.cash < car.price,
      onClick: garageAction,
    })
    if (save.cash < car.price) {
      text('NEED ' + money(car.price - save.cash) + ' MORE', 192, 204, { scale: 1, color: '#ff8fb0', align: 'center' })
    }
  } else {
    drawButton('gar-action', selected ? 'SELECTED' : 'SELECT', 103, 180, 178, 20, {
      accent: PALETTE.cyan, darkText: '#04110f', scale: 2,
      disabled: selected,
      onClick: garageAction,
    })
  }
  text((game.garageIndex + 1) + ' / ' + CARS.length, 370, 204, { scale: 1, color: '#594d72', align: 'right' })

  if (game.toast) {
    const a = Math.min(1, game.toast.t * 2)
    rect(94, 202, 196, 13, 'rgba(10,6,20,' + (0.9 * a) + ')')
    text(game.toast.text, 192, 204, { scale: 1, color: PALETTE.yellow, align: 'center', alpha: a })
  }
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------
function updateHelp() {
  if (input.consume('pause') || input.consume('confirm') || input.consume('space')) {
    sound.back()
    setScreen('menu')
  }
}

function drawHelp() {
  drawSynthScene(ctx, game.t, selectedCar().kind, true)
  ctx.fillStyle = 'rgba(6,4,13,0.82)'
  ctx.fillRect(0, 0, W, H)
  rect(12, 10, 360, 188, '#0e0a1a')
  ctx.strokeStyle = '#44305f'
  ctx.strokeRect(12.5, 10.5, 359, 187)
  rect(12, 10, 360, 2, PALETTE.pink)
  text('HOW TO PLAY', 192, 20, { scale: 2, color: '#fff2ff', align: 'center', glow: true })
  text('DRIFT RUN', 28, 45, { scale: 1, color: PALETTE.pink })
  text('W / UP ......... GAS', 28, 56, { scale: 1, color: '#c5b9d8' })
  text('S / DOWN ....... BRAKE', 28, 66, { scale: 1, color: '#c5b9d8' })
  text('A D / LEFT RIGHT  STEER', 28, 76, { scale: 1, color: '#c5b9d8' })
  text('SPACE .......... DRIFT', 28, 86, { scale: 1, color: PALETTE.cyan })
  text('N / NOS ........ NITRO', 28, 96, { scale: 1, color: PALETTE.yellow })
  text('P / ESC ........ PAUSE', 28, 106, { scale: 1, color: '#c5b9d8' })
  text('M .............. SOUND', 28, 116, { scale: 1, color: '#c5b9d8' })

  text('DRAG RACE', 204, 45, { scale: 1, color: PALETTE.cyan })
  text('HOLD GAS ONLY ON GREEN.', 204, 56, { scale: 1, color: '#c5b9d8' })
  text('SPACE / SHIFT ... UPSHIFT', 204, 66, { scale: 1, color: '#c5b9d8' })
  text('SHIFT IN THE GREEN ZONE', 204, 76, { scale: 1, color: '#c5b9d8' })
  text('FOR PERFECT SHIFTS.', 204, 86, { scale: 1, color: '#c5b9d8' })
  text('N / NOS ........ NITRO', 204, 96, { scale: 1, color: PALETTE.yellow })
  text('6 GEARS. DO NOT REDLINE.', 204, 106, { scale: 1, color: '#8f829f' })

  rect(22, 128, 340, 1, '#2e2444')
  text('TIPS', 28, 136, { scale: 1, color: PALETTE.yellow })
  const tips = [
    'DRIFT: THROTTLE + HANDBRAKE + STEER. HOLD THE SLIDE.',
    'CHAIN DRIFTS TO RAISE THE MULTIPLIER UP TO X8.',
    'WALLS KILL YOUR COMBO. NITRO IS FREE SPEED.',
  ]
  for (let i = 0; i < tips.length; i++) {
    text(tips[i], 28, 148 + i * 10, { scale: 1, color: '#a99cc0' })
  }
  text('TOUCH: USE THE BUTTONS BELOW THE SCREEN.', 28, 181, { scale: 1, color: '#776a8f' })
  drawButton('help-back', 'BACK', 294, 176, 66, 18, { accent: PALETTE.pink, darkText: '#1a0410', onClick: () => {
    sound.back()
    setScreen('menu')
  } })
}

// ---------------------------------------------------------------------------
// Result overlays + pause
// ---------------------------------------------------------------------------
function drawResultPanel(kind) {
  ctx.fillStyle = 'rgba(4,2,9,0.72)'
  ctx.fillRect(0, 0, W, H)
  const x = 52
  const y = 22
  const w = 280
  const h = 172
  rect(x, y, w, h, '#0f0a1c')
  ctx.strokeStyle = kind === 'win' ? PALETTE.cyan : PALETTE.pink
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  rect(x, y, w, 2, kind === 'win' ? PALETTE.cyan : PALETTE.pink)
  const title = game.screen === 'drift' ? "TIME'S UP" : kind === 'win' ? 'RACE WON' : kind === 'tie' ? 'PHOTO FINISH' : 'RACE LOST'
  text(title, 192, y + 12, {
    scale: 3,
    color: kind === 'win' ? PALETTE.cyan : kind === 'lose' ? PALETTE.pink : PALETTE.yellow,
    align: 'center',
    glow: true,
    shadow: '#05030a',
  })

  const d = game.screen === 'drag' ? game.drag : game.drift
  if (!d) return
  let rows = []
  if (game.screen === 'drag' && d.result) {
    rows = [
      ['YOUR TIME', timeStr(d.result.time), '#ffffff'],
      ['RIVAL TIME', timeStr(d.result.oppTime), '#b8adc9'],
      ['BEST TIME', timeStr(save.bestDrag), PALETTE.cyan],
      ['REWARD', money(d.result.reward), PALETTE.yellow],
    ]
  } else if (game.screen === 'drift' && d.result) {
    rows = [
      ['SCORE', d.result.score.toLocaleString('en-US'), '#ffffff'],
      ['BEST COMBO', 'X' + d.result.bestCombo, PALETTE.pink],
      ['WALL HITS', String(d.result.walls), '#b8adc9'],
      ['REWARD', money(d.result.reward), PALETTE.yellow],
    ]
  }
  for (let i = 0; i < rows.length; i++) {
    const ry = y + 50 + i * 17
    text(rows[i][0], 76, ry, { scale: 1, color: '#8d809f' })
    text(rows[i][1], 300, ry, { scale: 2, color: rows[i][2], align: 'right' })
  }
  if (game.bestTag) {
    const pulse = 0.65 + Math.sin(game.t * 8) * 0.25
    text('NEW BEST!', 192, y + 122, { scale: 1, color: PALETTE.yellow, align: 'center', alpha: pulse, glow: true })
  }
  drawButton('res-retry', 'RETRY', 82, y + 140, 100, 22, {
    accent: PALETTE.cyan, darkText: '#04110f', scale: 2,
    onClick: () => { sound.select(); game.bestTag = null; setScreen(game.screen) },
  })
  drawButton('res-menu', 'MENU', 202, y + 140, 100, 22, {
    accent: PALETTE.pink, darkText: '#1a0410', scale: 2,
    onClick: () => { sound.back(); game.bestTag = null; setScreen('menu') },
  })
}
function drawPausePanel() {
  ctx.fillStyle = 'rgba(4,2,9,0.74)'
  ctx.fillRect(0, 0, W, H)
  rect(107, 58, 170, 102, '#0f0a1c')
  ctx.strokeStyle = PALETTE.cyan
  ctx.strokeRect(107.5, 58.5, 169, 101)
  rect(107, 58, 170, 2, PALETTE.cyan)
  text('PAUSED', 192, 72, { scale: 2, color: PALETTE.cyan, align: 'center', glow: true })
  drawButton('pause-resume', 'RESUME', 126, 96, 132, 20, {
    accent: PALETTE.cyan, darkText: '#04110f', scale: 2,
    onClick: () => { game.paused = false; sound.select() },
  })
  drawButton('pause-quit', 'QUIT TO MENU', 126, 124, 132, 20, {
    accent: PALETTE.pink, darkText: '#1a0410', scale: 2,
    onClick: () => { game.paused = false; sound.back(); setScreen('menu') },
  })
  text(save.muted ? 'SOUND OFF' : 'SOUND ON', 192, 150, { scale: 1, color: '#7f7299', align: 'center' })
}
// ---------------------------------------------------------------------------
// World access
// ---------------------------------------------------------------------------
function getDriftWorld() {
  if (!game.driftWorld) game.driftWorld = buildDriftWorld()
  return game.driftWorld
}
function getDragWorld() {
  if (!game.dragWorld) game.dragWorld = buildDragWorld()
  return game.dragWorld
}
function makeSkidLayer(width, height) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}
function blitWorld(worldCanvas, camX, camY) {
  const maxX = Math.max(0, worldCanvas.width - W)
  const maxY = Math.max(0, worldCanvas.height - H)
  const sx = clamp(Math.round(camX), 0, maxX)
  const sy = clamp(Math.round(camY), 0, maxY)
  ctx.drawImage(worldCanvas, sx, sy, W, H, 0, 0, W, H)
  return { x: sx, y: sy }
}
function blitLayer(layer, camX, camY) {
  if (!layer) return
  const maxX = Math.max(0, layer.width - W)
  const maxY = Math.max(0, layer.height - H)
  const sx = clamp(Math.round(camX), 0, maxX)
  const sy = clamp(Math.round(camY), 0, maxY)
  ctx.drawImage(layer, sx, sy, W, H, 0, 0, W, H)
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
function spawnParticle(list, x, y, vx, vy, life, size, color, grow = 0) {
  if (list.length > 240) list.shift()
  list.push({ x, y, vx, vy, life, max: life, size, color, grow })
}
function updateParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 1 - 2.3 * dt
    p.vy *= 1 - 2.3 * dt
    p.size += p.grow * dt
    p.life -= dt
    if (p.life <= 0) list.splice(i, 1)
  }
}
function drawParticles(list) {
  for (const p of list) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.8
    ctx.fillStyle = p.color
    const s = Math.max(1, Math.round(p.size))
    ctx.fillRect(Math.round(p.x) - (s >> 1), Math.round(p.y) - (s >> 1), s, s)
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// Drag race
// ---------------------------------------------------------------------------
function makeDragCar(isPlayer) {
  return {
    isPlayer,
    x: 0,
    y: DRAG.startY,
    distance: 0,
    speed: 0,
    gear: 0,
    rpm: 900,
    shiftT: 0,
    boost: 0,
    nitroT: 0,
    nitroUsed: false,
    launched: false,
    finished: false,
    finishTime: null,
    launchDelay: 0,
    autoAt: 6800,
    wheelspin: 0,
  }
}

function initDrag() {
  const track = getDragWorld()
  const car = selectedCar()
  const oppStats = { spd: 3.4 + rand(-0.15, 0.15), acc: 3.4 + rand(-0.15, 0.15) }
  const d = {
    phase: 'count',
    phaseT: 0,
    goT: 0,
    green: false,
    falseStart: false,
    falseMsgT: 0,
    firstFinish: 0,
    result: null,
    player: makeDragCar(true),
    opp: makeDragCar(false),
    playerStats: { spd: car.stats.spd, acc: car.stats.acc },
    oppStats,
    particles: [],
    shiftMsg: '',
    shiftMsgT: 0,
    launchFlash: 0,
    shake: 0,
    camY: DRAG.startY - 148,
    track,
    carKind: car.kind,
    oppKind: 'red',
    oppColor: 'red',
    lastShift: '',
    limitHit: 0,
  }
  d.player.x = track.centerX + track.laneOffset
  d.opp.x = track.centerX - track.laneOffset
  d.opp.launchDelay = rand(0.16, 0.36)
  d.opp.autoAt = 6820 + rand(-120, 260)
  game.drag = d
  game.skid = makeSkidLayer(track.width, track.height)
  game.bestTag = null
}

function dragGearMax(car, stats) {
  return GEAR_MAX[car.gear] * (0.95 + stats.spd * 0.02)
}

function updateDragCar(d, car, dt, throttle, stats) {
  if (!car.launched) {
    car.rpm = 900 + (throttle ? 4300 + Math.sin(game.t * 40) * 160 : 0)
    return
  }
  const gearMax = dragGearMax(car, stats)
  car.rpm = clamp(820 + (car.speed / gearMax) * 6800, 780, 7900)
  car.shiftT = Math.max(0, car.shiftT - dt)
  car.boost = Math.max(0, car.boost - dt)
  let nitroOn = false
  if (car.nitroT > 0) {
    car.nitroT = Math.max(0, car.nitroT - dt)
    nitroOn = true
  }

  if (throttle && car.shiftT <= 0) {
    if (car.rpm < REDLINE + 20) {
      const t = clamp(car.speed / gearMax, 0, 1)
      const falloff = 1 - Math.pow(t, 2.4) * 0.64
      let accel = (92 + stats.acc * 16) * GEAR_TORQUE[car.gear] * falloff
      if (car.boost > 0) accel += 85
      if (nitroOn) accel += 185
      car.speed += accel * dt
    } else {
      car.speed = Math.max(0, car.speed - 28 * dt)
      if (Math.random() < dt * 14) {
        spawnParticle(d.particles, car.x + rand(-8, 8), car.y + 22, rand(-30, 30), rand(20, 80), 0.4, 2, '#ffd34e', 2)
      }
    }
  } else if (!throttle) {
    car.speed = Math.max(0, car.speed - 30 * dt)
  }
  if (car.shiftT > 0) car.speed = Math.max(0, car.speed - 24 * dt)

  // Drag and gear cap.
  car.speed -= car.speed * 0.045 * dt
  const cap = gearMax * (nitroOn ? 1.18 : 1.02)
  if (car.speed > cap) car.speed = cap
  if (car.speed < 0) car.speed = 0

  car.distance += car.speed * dt
  car.y = DRAG.startY - car.distance

  // Wheelspin smoke.
  if (car.speed < 55 && throttle) {
    car.wheelspin += dt
    if (Math.random() < dt * 34) {
      spawnParticle(d.particles, car.x + rand(-10, 10), car.y + 18, rand(-24, 24), rand(10, 55), rand(0.35, 0.8), 2, Math.random() > 0.4 ? '#d0c9dc' : '#8e86a8', 5)
    }
  }
  if (nitroOn && Math.random() < dt * 50) {
    spawnParticle(d.particles, car.x + rand(-5, 5), car.y + 23, rand(-40, 40), rand(40, 110), 0.35, 2, Math.random() > 0.45 ? '#43f6e0' : '#ffd34e', 1)
  }
}

function playerShift() {
  const d = game.drag
  if (!d || d.phase !== 'run' || !d.player.launched) return
  const p = d.player
  if (p.shiftT > 0) return
  if (p.gear >= 5) {
    d.shiftMsg = 'TOP GEAR'
    d.shiftMsgT = 0.8
    return
  }
  const rpm = p.rpm
  const perfect = rpm >= PERFECT_ZONE && rpm <= REDLINE
  const early = rpm < PERFECT_ZONE
  p.gear++
  if (perfect) {
    p.shiftT = 0.09
    p.boost = 0.62
    p.speed *= 1.006
    d.shiftMsg = 'PERFECT SHIFT'
    d.shiftMsgT = 1.0
    sound.shift(true)
  } else if (early) {
    p.shiftT = 0.27
    p.speed *= 0.982
    d.shiftMsg = 'EARLY SHIFT'
    d.shiftMsgT = 0.9
    sound.shift(false)
  } else {
    p.shiftT = 0.18
    p.speed *= 0.995
    d.shiftMsg = 'SHIFT'
    d.shiftMsgT = 0.6
    sound.shift(false)
  }
}

function oppShift(d) {
  const o = d.opp
  if (o.shiftT > 0 || o.gear >= 5) return
  if (o.rpm > o.autoAt) {
    o.gear++
    o.shiftT = rand(0.12, 0.22)
    o.autoAt = 6820 + rand(-200, 330)
  }
}

function updateDrag(dt) {
  const d = game.drag
  if (!d) return
  if (d.phase === 'done') {
    if (input.consume('confirm') || input.consume('space')) {
      sound.select()
      setScreen('drag')
    } else if (input.consume('pause')) {
      sound.back()
      setScreen('menu')
    }
    if (game.toast) game.toast.t -= dt
    return
  }

  d.shiftMsgT = Math.max(0, d.shiftMsgT - dt)
  d.falseMsgT = Math.max(0, d.falseMsgT - dt)
  d.shake = Math.max(0, d.shake - dt * 18)
  game.flash = Math.max(0, game.flash - dt * 2.5)
  updateParticles(d.particles, dt)

  if (d.phase === 'count') {
    d.phaseT += dt
    const p = d.player
    p.rpm = 900 + (input.heldAny('up', 'throttle') ? 4300 + Math.sin(game.t * 42) * 180 : 0)
    // Jump start.
    if (!d.falseStart && input.heldAny('up', 'throttle')) {
      d.falseStart = true
      d.falseMsgT = 2.2
      sound.fail()
    }
    const lightTimes = [0.6, 1.1, 1.6]
    for (let i = 0; i < lightTimes.length; i++) {
      if (d.phaseT >= lightTimes[i] && !d['l' + i]) {
        d['l' + i] = true
        sound.countdown(i + 1)
      }
    }
    if (d.phaseT >= 2.25) {
      d.phase = 'run'
      d.green = true
      d.goT = 0
      d.lightsOn = true
      sound.countdown(0)
      d.opp.launched = false
    }
    sound.engine(p.rpm / 8000, 0.45, true)
    sound.tire(0)
    return
  }

  // Race running.
  d.goT += dt
  const p = d.player
  const o = d.opp
  const throttle = input.heldAny('up', 'throttle')
  const pStats = d.playerStats

  if (!p.launched) {
    if (!d.falseStart && throttle) {
      p.launched = true
      p.launchAt = d.goT
      d.shake = 3
      d.launchFlash = 0.4
      for (let i = 0; i < 14; i++) {
        spawnParticle(d.particles, p.x + rand(-13, 13), p.y + 19, rand(-40, 40), rand(20, 90), rand(0.4, 1.0), 2, '#cfc8dd', 5)
      }
      sound.shift(true)
    } else if (d.falseStart && d.goT > 0.9) {
      p.launched = true
      p.launchAt = d.goT
      d.shake = 2
      for (let i = 0; i < 10; i++) {
        spawnParticle(d.particles, p.x + rand(-13, 13), p.y + 19, rand(-40, 40), rand(20, 90), rand(0.4, 1.0), 2, '#cfc8dd', 4)
      }
    }
  }

  if (o.launched && o.distance >= d.track.distance) {
    // already finished
  } else if (!o.launched && d.goT > o.launchDelay) {
    o.launched = true
    for (let i = 0; i < 8; i++) {
      spawnParticle(d.particles, o.x + rand(-13, 13), o.y + 19, rand(-30, 30), rand(20, 70), rand(0.3, 0.7), 2, '#cfc8dd', 4)
    }
  }

  // Input.
  if (input.consume('space') || input.consume('shift')) playerShift()
  if (input.consume('nitro') && !p.nitroUsed && p.launched) {
    p.nitroUsed = true
    p.nitroT = 2.15
    d.shiftMsg = 'NITRO!'
    d.shiftMsgT = 1.0
    sound.nitroWhoosh()
  }

  updateDragCar(d, p, dt, throttle, pStats)
  updateDragCar(d, o, dt, o.launched, d.oppStats)
  if (o.launched) oppShift(d)

  // Stamp a little launch rubber.
  if (p.launched && p.distance < 70 && game.skid) {
    const sg = game.skid.getContext('2d')
    sg.fillStyle = 'rgba(8,6,14,0.45)'
    sg.fillRect(Math.round(p.x - 11), Math.round(p.y + 14), 3, 5)
    sg.fillRect(Math.round(p.x + 8), Math.round(p.y + 14), 3, 5)
  }

  // Finish detection.
  if (!p.finished && p.distance >= d.track.distance) {
    p.finished = true
    p.finishTime = d.goT
    d.firstFinish = d.firstFinish || d.goT
    game.flash = 0.35
    game.flashColor = '67,246,224'
  }
  if (!o.finished && o.distance >= d.track.distance) {
    o.finished = true
    o.finishTime = d.goT
    d.firstFinish = d.firstFinish || d.goT
    if (!p.finished) {
      game.flash = 0.25
      game.flashColor = '255,61,127'
    }
  }

  const bothDone = p.finished && o.finished
  const waited = p.finished && d.goT - p.finishTime > 2.0
  const stalled = !p.launched && d.goT > 4.5
  const timeout = d.goT > 30
  if (bothDone || waited || stalled || timeout) {
    finishDrag(d)
  }

  // Car audio.
  const rpmN = clamp(p.rpm / 8000, 0, 1)
  sound.engine(rpmN, p.launched ? 0.8 : 0.4, true)
  sound.tire(p.launched && p.speed < 70 && throttle ? 0.5 : 0)
  sound.nitro(p.nitroT > 0)
}

function finishDrag(d) {
  d.phase = 'done'
  d.gameOverT = 0
  const p = d.player
  const o = d.opp
  const it = p.finished ? p.finishTime : null
  const ot = o.finished ? o.finishTime : null
  let outcome = 'lose'
  if (it !== null && (ot === null || it < ot - 0.002)) outcome = 'win'
  else if (it !== null && ot !== null && Math.abs(it - ot) <= 0.002) outcome = 'tie'
  let reward = outcome === 'win' ? 420 + Math.max(0, Math.floor((8.5 - it) * 55)) : 70
  let newBest = false
  if (it !== null && (save.bestDrag === null || it < save.bestDrag)) {
    save.bestDrag = it
    newBest = true
    if (outcome === 'win') reward += 150
  }
  if (outcome === 'lose') reward = 70
  save.cash += reward
  save.runs++
  persist()
  d.result = { time: it, oppTime: ot, outcome, reward, newBest }
  game.bestTag = newBest
  if (outcome === 'win' || outcome === 'tie') sound.reward()
  else sound.fail()
  sound.stopCarSounds()
}

function drawDrag() {
  const d = game.drag
  if (!d) return
  ctx.fillStyle = '#07060d'
  ctx.fillRect(0, 0, W, H)
  const track = d.track
  const shakeX = d.shake > 0 ? Math.round(rand(-d.shake, d.shake)) : 0
  const shakeY = d.shake > 0 ? Math.round(rand(-d.shake, d.shake)) : 0
  const pScreenTargetY = d.player.y - d.camY
  const cam = blitWorld(track.canvas, track.centerX - 192 + shakeX, d.player.y - 148 + shakeY)
  blitLayer(game.skid, cam.x, cam.y)

  // World-space effects.
  ctx.save()
  ctx.translate(-cam.x, -cam.y)
  drawParticles(d.particles)
  // Cars
  const oppAngle = -Math.PI / 2
  const pAngle = -Math.PI / 2 + Math.sin(game.t * 9) * 0.006 * clamp(d.player.speed / 200, 0, 1)
  if (d.opp.finished) {
    // parked beyond the finish, keep it visible
  }
  drawCar(ctx, spriteFor('red'), shadowSprite, d.opp.x, d.opp.y, oppAngle, 1, d.phase === 'done' ? 0.9 : 1)
  drawCar(ctx, spriteFor(d.carKind), shadowSprite, d.player.x, d.player.y, pAngle, 1)
  ctx.restore()

  // Speed streaks.
  if (d.phase === 'run') {
    const sp = d.player.speed
    if (sp > 170) {
      const amount = Math.floor(clamp((sp - 170) / 25, 1, 14))
      for (let i = 0; i < amount; i++) {
        const x = (i * 61 + 23) % 384
        if (x > 120 && x < 264) continue
        const y = (i * 97 + game.t * 900) % 216
        ctx.globalAlpha = 0.12 + (sp / 800)
        ctx.fillStyle = i % 3 ? '#ffffff' : '#43f6e0'
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 7 + (i % 4) * 4)
      }
      ctx.globalAlpha = 1
    }
  }

  // HUD ---------------------------------------------------------------
  const runTime = d.phase === 'count' ? 0 : d.goT
  rect(7, 7, 92, 36, 'rgba(10,7,20,0.8)')
  ctx.strokeStyle = 'rgba(67,246,224,0.35)'
  ctx.strokeRect(7.5, 7.5, 91, 35)
  text('TIME', 13, 11, { scale: 1, color: '#7f7299' })
  text(timeStr(runTime), 13, 21, { scale: 2, color: '#ffffff' })
  if (save.bestDrag !== null) text('BEST ' + timeStr(save.bestDrag), 13, 36, { scale: 1, color: '#6f6384' })

  // Progress.
  rect(108, 9, 168, 5, '#201830')
  ctx.strokeStyle = '#392c52'
  ctx.strokeRect(108.5, 9.5, 167, 4)
  const pProg = clamp(d.player.distance / track.distance, 0, 1)
  const oProg = clamp(d.opp.distance / track.distance, 0, 1)
  rect(108, 9, Math.floor(pProg * 168), 2, PALETTE.cyan)
  rect(108, 13, Math.floor(oProg * 168), 1, PALETTE.pink)
  text('1/4 MILE', 192, 18, { scale: 1, color: '#6f6384', align: 'center' })
  const gap = d.player.distance - d.opp.distance
  text(gap >= 0 ? '+' + Math.floor(gap / 10) + 'M' : Math.floor(gap / 10) + 'M', 192, 26, {
    scale: 1, color: gap >= 0 ? PALETTE.cyan : PALETTE.pink, align: 'center',
  })

  // Countdown tree.
  if (d.phase === 'count' || d.goT < 1.4) {
    const tx = 12
    const ty = 50
    rect(tx, ty, 32, 62, 'rgba(9,6,16,0.88)')
    ctx.strokeStyle = '#342846'
    ctx.strokeRect(tx + 0.5, ty + 0.5, 31, 61)
    const lit = [d.l0, d.l1, d.l2]
    for (let i = 0; i < 3; i++) {
      pixelCircle(tx + 16, ty + 10 + i * 15, 5, lit[i] ? '#ffb02e' : '#332a3f')
      if (lit[i]) {
        ctx.globalAlpha = 0.25
        pixelCircle(tx + 16, ty + 10 + i * 15, 8, '#ffb02e')
        ctx.globalAlpha = 1
      }
    }
    const green = d.phase === 'run'
    pixelCircle(tx + 16, ty + 54, 5, green ? '#4dff9e' : '#332a3f')
    if (green) {
      ctx.globalAlpha = 0.3
      pixelCircle(tx + 16, ty + 54, 9, '#4dff9e')
      ctx.globalAlpha = 1
    }
    if (d.phase === 'count') {
      const warm = Math.floor(game.t * 3) % 2 === 0
      text(warm ? 'WAIT FOR GREEN' : 'DO NOT JUMP', 192, 114, {
        scale: 1, color: warm ? '#ffd34e' : '#ff8fb0', align: 'center', shadow: '#08040d',
      })
    }
  }
  if (d.phase === 'run' && d.goT < 1.1) {
    const a = 1 - d.goT / 1.1
    text('GO!', 192, 46, { scale: 5, color: PALETTE.cyan, align: 'center', alpha: a, glow: true })
  }
  if (d.falseMsgT > 0) {
    text('JUMP START!', 192, 130, { scale: 2, color: PALETTE.pink, align: 'center', shadow: '#14020a', glow: true })
    text('PENALTY 0.9s', 192, 146, { scale: 1, color: '#ff8fb0', align: 'center' })
  }
  if (d.shiftMsgT > 0) {
    const a = Math.min(1, d.shiftMsgT * 2)
    text(d.shiftMsg, 192, 132, {
      scale: 2, color: d.shiftMsg === 'PERFECT SHIFT' ? PALETTE.yellow : '#d8cfe8', align: 'center', alpha: a, shadow: '#07040c',
    })
  }

  // Bottom dash.
  const grd = ctx.createLinearGradient(0, 158, 0, H)
  grd.addColorStop(0, 'rgba(7,5,14,0)')
  grd.addColorStop(0.35, 'rgba(7,5,14,0.82)')
  grd.addColorStop(1, 'rgba(7,5,14,0.96)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 156, W, 60)
  rect(0, 156, W, 1, 'rgba(255,61,127,0.35)')
  text('GEAR', 12, 164, { scale: 1, color: '#776a8f' })
  text(String(d.player.gear + 1), 12, 171, { scale: 4, color: d.player.rpm > PERFECT_ZONE ? PALETTE.yellow : '#f4f0ff' })
  text('KM/H', 52, 164, { scale: 1, color: '#776a8f' })
  text(String(Math.round(d.player.speed * 0.6)), 52, 172, { scale: 2, color: '#ffffff' })
  text('NOS', 52, 190, { scale: 1, color: d.player.nitroUsed ? '#4b405e' : PALETTE.yellow })

  text('RPM', 104, 164, { scale: 1, color: '#776a8f' })
  const rpmPct = clamp(d.player.rpm / 8000, 0, 1)
  rect(104, 174, 268, 8, '#1c152a')
  // perfect band
  rect(104 + (PERFECT_ZONE / 8000) * 268, 174, ((REDLINE - PERFECT_ZONE) / 8000) * 268, 8, 'rgba(67,246,224,0.16)')
  rect(104 + (REDLINE / 8000) * 268, 174, 268 - (REDLINE / 8000) * 268, 8, 'rgba(255,61,127,0.18)')
  for (let i = 0; i <= 20; i++) rect(104 + (i / 20) * 268, 172, 1, 2, '#4a3b63')
  const fillCol = d.player.rpm > REDLINE ? PALETTE.pink : d.player.rpm > PERFECT_ZONE ? PALETTE.yellow : PALETTE.cyan
  rect(104, 174, Math.floor(rpmPct * 268), 8, fillCol)
  rect(104, 174, Math.floor(rpmPct * 268), 2, 'rgba(255,255,255,0.35)')
  if (d.player.rpm > PERFECT_ZONE && d.player.rpm <= REDLINE && d.player.launched) {
    if (Math.floor(game.t * 10) % 2 === 0) text('SHIFT!', 372, 164, { scale: 1, color: PALETTE.yellow, align: 'right', glow: true })
  }
  text('DIST ' + Math.round(clamp(d.player.distance, 0, track.distance)) + ' / ' + track.distance, 372, 198, {
    scale: 1, color: '#6f6384', align: 'right',
  })
  rect(104, 196, 88, 4, '#241c36')
  rect(104, 196, d.player.nitroUsed ? 0 : 88, 4, PALETTE.cyan)
  text('NITRO', 196, 196, { scale: 1, color: '#6f6384' })
  text('SPACE / SHIFT TO UPSHIFT', 372, 188, { scale: 1, color: '#4d4264', align: 'right' })

  drawOverlays(d, 'drag')
}

// ---------------------------------------------------------------------------
// Drift run
// ---------------------------------------------------------------------------
function initDrift() {
  const world = getDriftWorld()
  const car = selectedCar()
  const spawn = world.spawn
  game.drift = {
    phase: 'count',
    phaseT: 0,
    timer: DRIFT_TIME,
    result: null,
    car: {
      x: spawn.x,
      y: spawn.y,
      angle: spawn.angle,
      vx: 0,
      vy: 0,
      steer: 0,
      slip: 0,
      speed: 0,
      nitroT: 0,
      nitroUsed: false,
    },
    stats: car.stats,
    carKind: car.kind,
    particles: [],
    popups: [],
    cam: { x: spawn.x - 192, y: spawn.y - 108 },
    shake: 0,
    scoreF: 0,
    combo: 1,
    comboT: 0,
    comboAnnounce: 0,
    driftHold: 0,
    drifting: false,
    walls: 0,
    wallCooldown: 0,
    bestCombo: 1,
    chainStart: 0,
    skidTimer: 0,
    countStep: -1,
    startT: 0,
    finishT: 0,
  }
  game.skid = makeSkidLayer(world.width, world.height)
  game.bestTag = null
}

function updateDrift(dt) {
  const d = game.drift
  if (!d) return
  if (d.phase === 'done') {
    if (input.consume('confirm') || input.consume('space')) {
      sound.select()
      setScreen('drift')
    } else if (input.consume('pause')) {
      sound.back()
      setScreen('menu')
    }
    if (game.toast) game.toast.t -= dt
    return
  }

  d.phaseT += dt
  d.shake = Math.max(0, d.shake - dt * 22)
  d.wallCooldown = Math.max(0, d.wallCooldown - dt)
  game.flash = Math.max(0, game.flash - dt * 3)
  updateParticles(d.particles, dt)
  for (let i = d.popups.length - 1; i >= 0; i--) {
    const pop = d.popups[i]
    pop.life -= dt
    pop.y -= 14 * dt
    if (pop.life <= 0) d.popups.splice(i, 1)
  }

  const car = d.car
  if (d.phase === 'count') {
    car.steer = 0
    sound.engine(0.1, 0.4, true)
    const label = d.phaseT < 0.95 ? 3 : d.phaseT < 1.8 ? 2 : d.phaseT < 2.65 ? 1 : 0
    if (label !== d.countStep) {
      d.countStep = label
      sound.countdown(label)
    }
    if (d.phaseT >= 3.5) {
      d.phase = 'run'
      d.startT = 0
    }
    return
  }

  // Run phase.
  d.timer = Math.max(0, d.timer - dt)
  const throttle = input.heldAny('up', 'throttle')
  const brake = input.heldAny('down', 'brake')
  const drift = input.heldAny('space', 'drift')
  const steerTarget = (input.heldAny('right') ? 1 : 0) - (input.heldAny('left') ? 1 : 0)
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 9)

  if (input.consume('nitro') && !car.nitroUsed) {
    car.nitroUsed = true
    car.nitroT = 2.2
    sound.nitroWhoosh()
    d.popups.push({ x: car.x, y: car.y - 24, life: 1.1, max: 1.1, text: 'NITRO!', color: PALETTE.yellow })
  }

  const fwdX = Math.cos(car.angle)
  const fwdY = Math.sin(car.angle)
  const rgtX = -fwdY
  const rgtY = fwdX
  let vf = car.vx * fwdX + car.vy * fwdY
  let vr = car.vx * rgtX + car.vy * rgtY
  const stats = d.stats
  const top = 292 + stats.spd * 16
  const engine = 205 + stats.acc * 30
  const grip = (4.1 + stats.grip * 0.52) * (drift ? 0.2 : 1) * (brake ? 0.82 : 1)

  if (car.nitroT > 0) {
    car.nitroT = Math.max(0, car.nitroT - dt)
    vf += 300 * dt
  }
  if (throttle) {
    const falloff = 1 - Math.pow(clamp(vf / (top + (car.nitroT > 0 ? 80 : 0)), 0, 1), 3)
    vf += engine * falloff * dt
  }
  if (brake) vf -= 230 * dt
  if (drift) vf -= 24 * dt
  if (!throttle && !brake) vf -= vf * 0.38 * dt
  vf -= vf * 0.045 * dt
  vr *= Math.exp(-grip * dt)

  car.vx = fwdX * vf + rgtX * vr
  car.vy = fwdY * vf + rgtY * vr
  const speedBefore = Math.hypot(car.vx, car.vy)
  const speedFactor = clamp(speedBefore / 95, 0.32, 1)
  const dir = vf < -5 ? -1 : 1
  const turnRate = (2.05 + (drift ? 0.72 : 0)) * car.steer * speedFactor * dir
  car.angle += turnRate * dt * (drift ? 1.12 : 1)
  car.speed = speedBefore

  // Integrate & wall collide.
  car.x += car.vx * dt
  car.y += car.vy * dt
  const world = getDriftWorld()
  const near = nearestOnTrack(world, car.x, car.y)
  const limit = world.halfWidth - 7
  if (near.dist > limit) {
    const dx = car.x - near.sample.x
    const dy = car.y - near.sample.y
    const len = Math.hypot(dx, dy) || 1
    const nx = dx / len
    const ny = dy / len
    car.x = near.sample.x + nx * limit
    car.y = near.sample.y + ny * limit
    const vn = car.vx * nx + car.vy * ny
    if (vn > 0) {
      car.vx -= 1.55 * vn * nx
      car.vy -= 1.55 * vn * ny
    }
    const impact = Math.abs(vn)
    if (impact <= 26) {
      car.vx *= 0.996
      car.vy *= 0.996
    }
    if (impact > 26 && d.wallCooldown <= 0) {
      d.wallCooldown = 0.6
      d.walls++
      d.shake = clamp(impact / 18, 2, 7)
      d.flash = 0.5
      game.flash = 0.4
      game.flashColor = '255,61,127'
      car.vx *= 0.86
      car.vy *= 0.86
      sound.crash(clamp(impact / 160, 0.25, 1))
      d.combo = 1
      d.comboT = 0
      d.chainStart = d.scoreF
      d.popups.push({ x: car.x, y: car.y - 20, life: 1.3, max: 1.3, text: 'COMBO LOST', color: PALETTE.pink })
      for (let i = 0; i < 12; i++) {
        spawnParticle(d.particles, car.x + nx * 6, car.y + ny * 6, rand(-80, 80), rand(-80, 80), rand(0.2, 0.55), 2, i % 2 ? '#ffd34e' : '#ff8f4d', 0)
      }
    } else if (impact <= 26) {
      car.vx *= 0.95
      car.vy *= 0.95
    }
  }

  // Slip & score.
  const nfX = Math.cos(car.angle)
  const nfY = Math.sin(car.angle)
  const along = car.vx * nfX + car.vy * nfY
  const cross = nfX * car.vy - nfY * car.vx
  const slip = Math.abs(Math.atan2(cross, Math.abs(along))) * 180 / Math.PI
  car.slip = slip
  car.speed = Math.hypot(car.vx, car.vy)
  const isDrift = car.speed > 72 && slip > 10.5
  d.drifting = isDrift

  if (isDrift) {
    d.driftHold = 0
    d.comboT += dt
    const oldCombo = d.combo
    d.combo = clamp(1 + Math.floor(d.comboT / 1.25), 1, 8)
    if (d.combo > oldCombo) {
      d.comboAnnounce = 1.2
      sound.blip(620 + d.combo * 55, 0.09, 'square', 0.08, 140)
    }
    d.bestCombo = Math.max(d.bestCombo, d.combo)
    const mult = d.combo
    d.scoreF += car.speed * slip * (0.0095 + d.stats.drift * 0.0009) * mult * dt
    if (d.chainStart === 0) d.chainStart = d.scoreF
    // smoke
    if (Math.random() < dt * 55) {
      const rearX = car.x - nfX * 13
      const rearY = car.y - nfY * 13
      const side = Math.random() > 0.5 ? 1 : -1
      spawnParticle(
        d.particles,
        rearX + (-nfY) * 7 * side,
        rearY + nfX * 7 * side,
        rand(-28, 28) - car.vx * 0.08,
        rand(-28, 28) - car.vy * 0.08,
        rand(0.45, 1.05), rand(2, 4), Math.random() > 0.3 ? '#cfc8dd' : '#9b93b2', 6,
      )
    }
  } else {
    d.driftHold += dt
    if (d.driftHold > 0.8) {
      if (d.combo > 1) {
        const gained = Math.max(0, Math.floor(d.scoreF - d.chainStart))
        if (gained > 250) {
          d.scoreF += gained * 0.12
          d.popups.push({ x: car.x, y: car.y - 22, life: 1.4, max: 1.4, text: 'CLEAN +' + Math.floor(gained * 1.12), color: PALETTE.cyan })
          sound.blip(880, 0.12, 'square', 0.08, 160)
        }
      }
      d.combo = 1
      d.comboT = 0
      d.chainStart = 0
    }
  }
  d.comboAnnounce = Math.max(0, d.comboAnnounce - dt)

  // Skid marks.
  d.skidTimer += dt
  if (isDrift && d.skidTimer > 0.025 && game.skid) {
    d.skidTimer = 0
    const sg = game.skid.getContext('2d')
    sg.fillStyle = 'rgba(6,4,11,0.5)'
    const rearX = car.x - nfX * 13
    const rearY = car.y - nfY * 13
    for (const side of [-1, 1]) {
      sg.fillRect(Math.round(rearX + (-nfY) * 7 * side), Math.round(rearY + nfX * 7 * side), 2, 2)
    }
  }

  // Camera.
  const tx = car.x - 192 + car.vx * 0.28
  const ty = car.y - 108 + car.vy * 0.28
  const camK = Math.min(1, dt * 7)
  d.cam.x += (tx - d.cam.x) * camK
  d.cam.y += (ty - d.cam.y) * camK

  if (d.timer <= 0) {
    finishDrift(d)
    return
  }

  sound.engine(clamp(car.speed / (top + 40), 0, 1) * 0.85 + 0.08, throttle ? 0.8 : 0.2, true)
  sound.tire(isDrift ? clamp(slip / 32, 0.15, 1) : 0)
  sound.nitro(car.nitroT > 0)
}

function finishDrift(d) {
  d.phase = 'done'
  const score = Math.floor(d.scoreF)
  const newBest = score > save.bestDrift
  let reward = 180 + Math.floor(score / 55)
  if (newBest) {
    save.bestDrift = score
    reward += 150
    game.bestTag = true
  } else game.bestTag = false
  save.cash += reward
  save.runs++
  persist()
  d.result = {
    score,
    bestCombo: d.bestCombo,
    walls: d.walls,
    reward,
    newBest,
  }
  sound.reward()
  sound.stopCarSounds()
}

function drawDrift() {
  const d = game.drift
  if (!d) return
  ctx.fillStyle = '#07060d'
  ctx.fillRect(0, 0, W, H)
  const world = getDriftWorld()
  const shakeX = d.shake > 0 ? Math.round(rand(-d.shake, d.shake)) : 0
  const shakeY = d.shake > 0 ? Math.round(rand(-d.shake, d.shake)) : 0
  const cam = blitWorld(world.canvas, d.cam.x + shakeX, d.cam.y + shakeY)
  blitLayer(game.skid, cam.x, cam.y)

  ctx.save()
  ctx.translate(-cam.x, -cam.y)
  drawParticles(d.particles)
  const car = d.car
  drawCar(ctx, spriteFor(d.carKind), shadowSprite, car.x, car.y, car.angle, 1)
  // Popups.
  for (const pop of d.popups) {
    const a = clamp(pop.life / pop.max, 0, 1)
    text(pop.text, pop.x, pop.y, {
      scale: 1, color: pop.color || PALETTE.yellow, align: 'center', alpha: a, shadow: '#07040c', glow: true,
    })
  }
  ctx.restore()

  // HUD ---------------------------------------------------------------
  // Score panel
  rect(7, 7, 145, 44, 'rgba(10,7,20,0.82)')
  ctx.strokeStyle = 'rgba(255,61,127,0.38)'
  ctx.strokeRect(7.5, 7.5, 144, 43)
  text('SCORE', 13, 11, { scale: 1, color: '#7f7299' })
  text(Math.floor(d.scoreF).toLocaleString('en-US'), 13, 20, { scale: 2, color: '#ffffff' })
  if (d.combo > 1) {
    text('X' + d.combo, 145, 20, { scale: 2, color: PALETTE.yellow, align: 'right', glow: true })
  } else {
    text('X1', 145, 20, { scale: 2, color: '#5c5172', align: 'right' })
  }
  rect(13, 38, 132, 3, '#241c36')
  if (d.combo > 1) rect(13, 38, 132 * clamp(d.combo / 8, 0, 1), 3, PALETTE.pink)

  // Timer
  const low = d.timer < 10
  const blink = low ? Math.floor(game.t * 4) % 2 === 0 : true
  text('TIME', 232, 8, { scale: 1, color: '#7f7299', align: 'center' })
  if (blink) {
    text(clockStr(d.timer), 232, 17, { scale: 3, color: low ? PALETTE.pink : '#ffffff', align: 'center', glow: low })
  }

  // Minimap
  drawMinimap(world, car, 314, 34, 62, 54)

  // Bottom dash
  const grd = ctx.createLinearGradient(0, 158, 0, H)
  grd.addColorStop(0, 'rgba(7,5,14,0)')
  grd.addColorStop(0.4, 'rgba(7,5,14,0.9)')
  grd.addColorStop(1, 'rgba(7,5,14,0.95)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 156, W, 60)
  rect(0, 156, W, 1, 'rgba(67,246,224,0.3)')
  text('KM/H', 12, 163, { scale: 1, color: '#776a8f' })
  text(String(Math.round(car.speed * 0.6)), 12, 171, { scale: 3, color: car.nitroT > 0 ? PALETTE.cyan : '#ffffff' })
  text('SLIP', 12, 194, { scale: 1, color: '#776a8f' })
  text(Math.floor(car.slip) + ' DEG', 12, 203, { scale: 1, color: car.slip > 10 ? PALETTE.pink : '#6f6384' })

  text('CHAIN', 130, 163, { scale: 1, color: '#776a8f' })
  const chainBar = clamp(d.combo / 8, 0, 1)
  rect(130, 174, 150, 6, '#1c152a')
  rect(130, 174, Math.floor(chainBar * 150), 6, d.combo > 4 ? PALETTE.pink : PALETTE.cyan)
  text(d.drifting ? 'HOLDING' : 'CHAIN A DRIFT', 130, 184, {
    scale: 1, color: d.drifting ? PALETTE.yellow : '#5c5172',
  })
  text('NITRO', 130, 196, { scale: 1, color: '#776a8f' })
  rect(130, 204, 150, 3, '#241c36')
  rect(130, 204, car.nitroUsed ? 0 : 150, 3, PALETTE.cyan)

  const pop = 0.55 + Math.abs(Math.sin(game.t * 3)) * 0.45
  text('BEST ' + save.bestDrift.toLocaleString('en-US'), 372, 198, { scale: 1, color: '#6f6384', align: 'right' })
  text(touchDevice() ? 'DRIFT + GAS' : 'SPACE + GAS TO DRIFT', 372, 188, { scale: 1, color: '#4d4264', align: 'right', alpha: pop })

  // Countdown.
  if (d.phase === 'count') {
    const label = d.phaseT < 0.95 ? '3' : d.phaseT < 1.8 ? '2' : d.phaseT < 2.65 ? '1' : 'DRIFT'
    text(label, 192, 78, { scale: 6, color: label === 'DRIFT' ? PALETTE.pink : PALETTE.yellow, align: 'center', glow: true, shadow: '#0a0512' })
    text('HOLD GAS + HANDBRAKE TO SLIDE', 192, 132, { scale: 1, color: '#d8cfe8', align: 'center', shadow: '#0a0512' })
    text('CHAIN DRIFTS FOR A BIGGER MULTIPLIER', 192, 144, { scale: 1, color: '#8f829f', align: 'center' })
  }

  drawOverlays(d, 'drift')
}

function drawMinimap(world, car, x, y, w, h) {
  rect(x, y, w, h, 'rgba(9,6,18,0.75)')
  ctx.strokeStyle = 'rgba(67,246,224,0.28)'
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  const scale = Math.min((w - 10) / world.width, (h - 10) / world.height)
  const ox = x + (w - world.width * scale) / 2
  const oy = y + (h - world.height * scale) / 2
  ctx.strokeStyle = 'rgba(67,246,224,0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  const samples = world.samples
  ctx.moveTo(ox + samples[0].x * scale, oy + samples[0].y * scale)
  for (let i = 1; i < samples.length; i += 2) {
    ctx.lineTo(ox + samples[i].x * scale, oy + samples[i].y * scale)
  }
  ctx.closePath()
  ctx.stroke()
  // start notch
  rect(ox + world.start.x * scale - 1, oy + world.start.y * scale - 1, 2, 2, PALETTE.yellow)
  const pulse = Math.floor(game.t * 5) % 2 === 0
  pixelCircle(ox + car.x * scale, oy + car.y * scale, pulse ? 2 : 1, PALETTE.pink)
}

// ---------------------------------------------------------------------------
// Shared race overlays
// ---------------------------------------------------------------------------
function drawOverlays(d, mode) {
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(${game.flashColor},${game.flash * 0.5})`
    ctx.fillRect(0, 0, W, H)
  }
  if (d.phase === 'done' && d.result) {
    let kind
    if (mode === 'drag') kind = d.result.outcome
    else kind = 'win'
    drawResultPanel(kind === 'win' ? 'win' : kind === 'tie' ? 'tie' : 'lose')
    const prompt = touchDevice() ? 'TAP RETRY OR MENU' : 'ENTER RETRY   ESC MENU'
    text(prompt, 192, 201, { scale: 1, color: '#8d809f', align: 'center', shadow: '#05030a' })
  }
  if (game.paused) drawPausePanel()
}

// ---------------------------------------------------------------------------
// Global update / render
// ---------------------------------------------------------------------------
function update(dt) {
  game.t += dt
  game.st += dt
  game.fade = Math.max(0, game.fade - dt * 3.2)
  if (game.toast) {
    game.toast.t -= dt
    if (game.toast.t <= 0) game.toast = null
  }

  if (game.screen === 'title') {
    updateTitle()
    return
  }
  if (game.screen === 'menu') {
    updateMenu()
    return
  }
  if (game.screen === 'garage') {
    updateGarage()
    return
  }
  if (game.screen === 'help') {
    updateHelp()
    return
  }
  if (game.screen === 'drag' || game.screen === 'drift') {
    if (input.consume('pause')) {
      togglePause()
      return
    }
    if (game.paused) {
      if (input.consume('confirm') || input.consume('space')) {
        game.paused = false
        sound.select()
      }
      return
    }
    if (game.screen === 'drag') updateDrag(dt)
    else updateDrift(dt)
  }
}

function render() {
  game.hits = []
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = 1
  if (game.screen === 'title') drawTitle()
  else if (game.screen === 'menu') drawMenu()
  else if (game.screen === 'garage') drawGarage()
  else if (game.screen === 'help') drawHelp()
  else if (game.screen === 'drag') drawDrag()
  else if (game.screen === 'drift') drawDrift()

  if (game.fade > 0) {
    ctx.fillStyle = `rgba(5,3,10,${game.fade})`
    ctx.fillRect(0, 0, W, H)
  }
}

let last = performance.now()
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
  last = now
  update(dt)
  render()
  input.pressed.clear()
  requestAnimationFrame(frame)
}

// ---------------------------------------------------------------------------
// Pointer input
// ---------------------------------------------------------------------------
function toVirtual(e) {
  const r = canvas.getBoundingClientRect()
  return {
    x: ((e.clientX - r.left) / r.width) * W,
    y: ((e.clientY - r.top) / r.height) * H,
  }
}
function hitAt(x, y) {
  for (let i = game.hits.length - 1; i >= 0; i--) {
    const h = game.hits[i]
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h
  }
  return null
}
canvas.addEventListener('pointerdown', (e) => {
  sound.ensure()
  const { x, y } = toVirtual(e)
  if (game.screen === 'title') {
    enterMenu()
    return
  }
  if (game.screen === 'drag' || game.screen === 'drift') {
    if (game.paused || (game.screen === 'drag' ? game.drag?.phase === 'done' : game.drift?.phase === 'done')) {
      const hit = hitAt(x, y)
      if (hit) {
        sound.ensure()
        hit.fn?.()
      }
    }
    return
  }
  const hit = hitAt(x, y)
  if (hit) {
    sound.ensure()
    hit.fn?.()
  }
})
canvas.addEventListener('pointermove', (e) => {
  if (touchDevice()) return
  const { x, y } = toVirtual(e)
  const hit = hitAt(x, y)
  const id = hit ? hit.id : null
  if (id !== game.hover) game.hover = id
})
canvas.addEventListener('pointerleave', () => { game.hover = null })
canvas.addEventListener('contextmenu', (e) => e.preventDefault())

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.getElementById('muteBtn').addEventListener('click', () => {
  sound.ensure()
  toggleMute()
})
document.getElementById('pauseBtn').addEventListener('click', () => {
  sound.ensure()
  togglePause()
})
document.getElementById('startBtn').addEventListener('click', () => {
  sound.ensure()
  if (game.screen === 'title') enterMenu()
  else if (game.screen === 'menu') activateMenu(game.menuIndex)
})

const muteBtn = document.getElementById('muteBtn')
muteBtn.classList.toggle('muted', save.muted)
muteBtn.textContent = save.muted ? 'OFF' : 'SND'
muteBtn.setAttribute('aria-pressed', String(save.muted))

document.body.classList.add('menu-mode')
resize()
requestAnimationFrame((t) => {
  last = t
  requestAnimationFrame(frame)
})

// Debug handle (used by the automated smoke tests).
window.__NEON_APEX__ = { game, save, setScreen }
