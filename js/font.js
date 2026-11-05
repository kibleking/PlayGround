// 5x7 bitmap font. Every glyph is drawn by hand as pixels so the UI stays crisp.
const RAW = {
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01110/10001/10000/10000/10000/10001/01110',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01110/10001/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '11111/00100/00100/00100/00100/00100/11111',
  J: '00111/00010/00010/00010/00010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/11011/10001',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  0: '01110/10001/10011/10101/11001/10001/01110',
  1: '00100/01100/00100/00100/00100/00100/01110',
  2: '01110/10001/00001/00010/00100/01000/11111',
  3: '11110/00001/00001/01110/00001/00001/11110',
  4: '00010/00110/01010/10010/11111/00010/00010',
  5: '11111/10000/11110/00001/00001/10001/01110',
  6: '00110/01000/10000/11110/10001/10001/01110',
  7: '11111/00001/00010/00100/01000/01000/01000',
  8: '01110/10001/10001/01110/10001/10001/01110',
  9: '01110/10001/10001/01111/00001/00010/01100',
  '.': '00000/00000/00000/00000/00000/01100/01100',
  ',': '00000/00000/00000/00000/01100/01100/01000',
  ':': '00000/01100/01100/00000/01100/01100/00000',
  ';': '00000/01100/01100/00000/01100/01100/01000',
  '!': '00100/00100/00100/00100/00100/00000/00100',
  '?': '01110/10001/00001/00010/00100/00000/00100',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  '/': '00001/00010/00010/00100/01000/01000/10000',
  '\\': '10000/01000/01000/00100/00010/00010/00001',
  "'": '00100/00100/00000/00000/00000/00000/00000',
  '"': '01010/01010/00000/00000/00000/00000/00000',
  '%': '11001/11010/00010/00100/01000/01011/10011',
  '(': '00110/01000/10000/10000/10000/01000/00110',
  ')': '01100/00010/00001/00001/00001/00010/01100',
  '[': '01110/01000/01000/01000/01000/01000/01110',
  ']': '01110/00010/00010/00010/00010/00010/01110',
  '<': '00010/00100/01000/10000/01000/00100/00010',
  '>': '01000/00100/00010/00001/00010/00100/01000',
  '=': '00000/00000/11111/00000/11111/00000/00000',
  '*': '00000/10101/01110/11111/01110/10101/00000',
  '#': '01010/01010/11111/01010/11111/01010/01010',
  '$': '00100/01111/10100/01110/00101/11110/00100',
  '&': '01100/10010/10100/01000/10101/10010/01101',
  '@': '01110/10001/10111/10101/10111/10000/01110',
  '_': '00000/00000/00000/00000/00000/00000/11111',
  '|': '00100/00100/00100/00100/00100/00100/00100',
  '^': '00100/01010/10001/00000/00000/00000/00000',
  '~': '00000/00000/01001/10110/00000/00000/00000',
  ' ': '00000/00000/00000/00000/00000/00000/00000',
}

const CHARS = Object.keys(RAW)
const INDEX = new Map(CHARS.map((c, i) => [c, i]))
const GLYPHS = CHARS.map((c) => RAW[c].split('/'))

const atlasCache = new Map()

function getAtlas(color, scale) {
  const key = color + '|' + scale
  let atlas = atlasCache.get(key)
  if (atlas) return atlas
  const cellW = 6 * scale
  const cellH = 7 * scale
  const canvas = document.createElement('canvas')
  canvas.width = cellW * CHARS.length
  canvas.height = cellH
  const g = canvas.getContext('2d')
  g.fillStyle = color
  for (let i = 0; i < GLYPHS.length; i++) {
    const rows = GLYPHS[i]
    const ox = i * cellW
    for (let y = 0; y < 7; y++) {
      const row = rows[y]
      for (let x = 0; x < 5; x++) {
        if (row[x] === '1') g.fillRect(ox + x * scale, y * scale, scale, scale)
      }
    }
  }
  atlas = { canvas, cellW, cellH }
  atlasCache.set(key, atlas)
  if (atlasCache.size > 80) {
    const first = atlasCache.keys().next().value
    atlasCache.delete(first)
  }
  return atlas
}

export function textWidth(text, scale = 1) {
  return Math.max(0, String(text).length * 6 * scale - scale)
}

export function drawText(ctx, text, x, y, opts = {}) {
  const scale = opts.scale || 1
  const color = opts.color || '#ffffff'
  const align = opts.align || 'left'
  const alpha = opts.alpha === undefined ? 1 : opts.alpha
  const str = String(text).toUpperCase()
  if (alpha <= 0 || !str.length) return textWidth(str, scale)

  const w = textWidth(str, scale)
  let px = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x)
  const py = Math.round(y)
  const prev = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = alpha

  if (opts.glow) {
    const atlas = getAtlas(color, scale)
    ctx.globalAlpha = alpha * 0.22
    for (const [ox, oy] of [[-scale, 0], [scale, 0], [0, -scale], [0, scale]]) {
      for (let i = 0; i < str.length; i++) {
        const idx = INDEX.get(str[i])
        if (idx === undefined) continue
        ctx.drawImage(atlas.canvas, idx * atlas.cellW, 0, 5 * scale, atlas.cellH,
          px + i * 6 * scale + ox, py + oy, 5 * scale, atlas.cellH)
      }
    }
    ctx.globalAlpha = alpha
  }

  if (opts.shadow) {
    const shadow = getAtlas(typeof opts.shadow === 'string' ? opts.shadow : '#05040a', scale)
    const sx = (opts.shadowX === undefined ? 1 : opts.shadowX) * scale
    const sy = (opts.shadowY === undefined ? 1 : opts.shadowY) * scale
    for (let i = 0; i < str.length; i++) {
      const idx = INDEX.get(str[i])
      if (idx === undefined) continue
      ctx.drawImage(shadow.canvas, idx * shadow.cellW, 0, 5 * scale, shadow.cellH,
        px + i * 6 * scale + sx, py + sy, 5 * scale, shadow.cellH)
    }
  }

  const atlas = getAtlas(color, scale)
  for (let i = 0; i < str.length; i++) {
    const idx = INDEX.get(str[i])
    if (idx === undefined) continue
    ctx.drawImage(atlas.canvas, idx * atlas.cellW, 0, 5 * scale, atlas.cellH,
      px + i * 6 * scale, py, 5 * scale, atlas.cellH)
  }

  ctx.globalAlpha = 1
  ctx.imageSmoothingEnabled = prev
  return w
}

export function wrapText(text, maxChars) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      if (line) lines.push(line)
      line = word
    } else {
      line = (line + ' ' + word).trim()
    }
  }
  if (line) lines.push(line)
  return lines
}
