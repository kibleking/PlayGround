// Tiny synthesized arcade sound engine. No audio files, everything is oscillators.
export class Sound {
  constructor(muted = false) {
    this.muted = muted
    this.ctx = null
    this.master = null
    this.engineNodes = null
    this.tireNodes = null
    this.nitroNodes = null
    this.musicOn = false
    this.musicTimer = null
    this.nextNoteTime = 0
    this.step = 0
    this.noiseBuffer = null
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return false
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.5
      this.master.connect(this.ctx.destination)
      this._buildEngine()
      this._buildTire()
      this._buildNitro()
      this.noiseBuffer = this._makeNoise(1.5)
      this.nextNoteTime = this.ctx.currentTime
      if (this.musicOn) this._startMusicLoop()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return true
  }

  setMuted(muted) {
    this.muted = muted
    if (!this.ctx) return
    this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.04)
  }

  _makeNoise(seconds) {
    const ctx = this.ctx
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  _buildEngine() {
    const ctx = this.ctx
    const gain = ctx.createGain()
    gain.gain.value = 0
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 640
    filter.Q.value = 2
    const saw = ctx.createOscillator()
    saw.type = 'sawtooth'
    saw.frequency.value = 55
    const square = ctx.createOscillator()
    square.type = 'square'
    square.frequency.value = 27.5
    const squareGain = ctx.createGain()
    squareGain.gain.value = 0.35
    saw.connect(filter)
    square.connect(squareGain).connect(filter)
    filter.connect(gain).connect(this.master)
    saw.start()
    square.start()
    this.engineNodes = { saw, square, filter, gain }
  }

  _buildTire() {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this._makeNoise(0.7)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2100
    filter.Q.value = 1.1
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter).connect(gain).connect(this.master)
    src.start()
    this.tireNodes = { src, filter, gain }
  }

  _buildNitro() {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this._makeNoise(0.7)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 900
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter).connect(gain).connect(this.master)
    src.start()
    this.nitroNodes = { src, filter, gain }
  }

  engine(rpm, load, active) {
    if (!this.ctx || !this.engineNodes) return
    const t = this.ctx.currentTime
    const n = this.engineNodes
    const freq = 42 + rpm * 138
    n.saw.frequency.setTargetAtTime(freq, t, 0.035)
    n.square.frequency.setTargetAtTime(freq * 0.5, t, 0.04)
    n.filter.frequency.setTargetAtTime(360 + rpm * 1500, t, 0.05)
    const target = active ? 0.035 + load * 0.055 : 0
    n.gain.gain.setTargetAtTime(target, t, active ? 0.055 : 0.15)
  }

  tire(slip) {
    if (!this.ctx || !this.tireNodes) return
    const t = this.ctx.currentTime
    this.tireNodes.gain.gain.setTargetAtTime(Math.min(0.16, slip * 0.2), t, 0.06)
    this.tireNodes.filter.frequency.setTargetAtTime(1700 + slip * 1700, t, 0.08)
  }

  nitro(on) {
    if (!this.ctx || !this.nitroNodes) return
    this.nitroNodes.gain.gain.setTargetAtTime(on ? 0.09 : 0, this.ctx.currentTime, 0.05)
  }

  stopCarSounds() {
    if (!this.ctx) return
    this.engine(0, 0, false)
    this.tire(0)
    this.nitro(false)
  }

  blip(freq = 440, dur = 0.08, type = 'square', vol = 0.12, slide = 0) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  ui() { this.blip(660, 0.05, 'square', 0.07, 220) }
  select() { this.blip(440, 0.07, 'square', 0.08, 260) }
  back() { this.blip(300, 0.07, 'square', 0.07, -120) }
  shift(perfect = false) {
    if (perfect) {
      this.blip(980, 0.11, 'square', 0.11, 420)
      setTimeout(() => this.blip(1320, 0.09, 'square', 0.07, 300), 55)
    } else this.blip(540, 0.05, 'square', 0.07, -100)
  }
  countdown(n) {
    if (n <= 0) this.blip(1040, 0.28, 'square', 0.16, 120)
    else this.blip(440 + (3 - n) * 40, 0.14, 'square', 0.13)
  }
  crash(strength = 1) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this._makeNoise(0.3)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.22 * strength, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    src.connect(filter).connect(gain).connect(this.master)
    src.start(t)
    this.blip(120, 0.18, 'sawtooth', 0.13, -60)
  }
  reward() {
    const notes = [523, 659, 784, 1046]
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'square', 0.12), i * 95))
  }
  fail() {
    const notes = [330, 262, 196]
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.13), i * 130))
  }
  nitroWhoosh() { this.blip(190, 0.5, 'sawtooth', 0.12, 700) }

  setMusic(on) {
    this.musicOn = on
    if (!this.ctx) return
    if (on) this._startMusicLoop()
    else this._stopMusicLoop()
  }

  _startMusicLoop() {
    if (this.musicTimer) return
    this.nextNoteTime = this.ctx.currentTime + 0.1
    this.musicTimer = setInterval(() => this._scheduleMusic(), 90)
  }

  _stopMusicLoop() {
    if (this.musicTimer) clearInterval(this.musicTimer)
    this.musicTimer = null
  }

  _scheduleMusic() {
    if (!this.ctx || !this.musicOn) return
    if (this.ctx.state !== 'running') return
    const stepDur = 0.146 // ~206 bpm sixteenths, moody and light
    const lookAhead = 0.25
    const bass = [55, 55, 43.65, 43.65, 65.41, 65.41, 49, 49]
    const arpSets = [
      [220, 261.63, 329.63, 261.63],
      [174.61, 220, 261.63, 220],
      [261.63, 329.63, 392, 329.63],
      [196, 246.94, 293.66, 246.94],
    ]
    while (this.nextNoteTime < this.ctx.currentTime + lookAhead) {
      const t = this.nextNoteTime
      const beat = this.step % 16
      const bar = Math.floor(this.step / 16) % 4
      const arp = arpSets[bar]
      if (beat % 2 === 0) this._note(bass[Math.floor(beat / 2)], t, stepDur * 1.6, 'triangle', 0.05, 340)
      const arpNote = arp[beat % 4]
      this._note(arpNote, t, stepDur * 0.8, 'square', 0.018, 2200)
      if (beat % 4 === 2) this._note(arpNote * 2, t + 0.02, stepDur * 0.45, 'square', 0.008, 4200)
      this.step++
      this.nextNoteTime += stepDur
    }
  }

  _note(freq, when, dur, type, vol, cutoff) {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(vol, when + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(filter).connect(gain).connect(this.master)
    osc.start(when)
    osc.stop(when + dur + 0.03)
  }
}
