/** Sonido / música mina — Web Audio procedural DEMO */

let ctx: AudioContext | null = null
let musicNodes: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null
let muted = false
let musicOn = false

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

export function isMuted(): boolean {
  return muted
}

export function isMusicOn(): boolean {
  return musicOn && !muted
}

export function setMuted(v: boolean): void {
  muted = v
  if (muted) stopMusic()
  try {
    localStorage.setItem('cava-audio-mute', v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadMutePref(): boolean {
  try {
    muted = localStorage.getItem('cava-audio-mute') === '1'
  } catch {
    muted = false
  }
  return muted
}

export function playPickHit(): void {
  if (muted) return
  const c = ac()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(180, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.08)
  g.gain.setValueAtTime(0.12, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1)
  o.connect(g)
  g.connect(c.destination)
  o.start()
  o.stop(c.currentTime + 0.12)
}

export function playBreak(): void {
  if (muted) return
  const c = ac()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'square'
  o.frequency.setValueAtTime(320, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(90, c.currentTime + 0.18)
  g.gain.setValueAtTime(0.08, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
  o.connect(g)
  g.connect(c.destination)
  o.start()
  o.stop(c.currentTime + 0.22)
}

export function startMusic(): void {
  if (muted || musicOn) return
  const c = ac()
  void c.resume()
  const osc = c.createOscillator()
  const gain = c.createGain()
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = 110
  lfo.frequency.value = 0.12
  lfoGain.gain.value = 8
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  gain.gain.value = 0.035
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start()
  lfo.start()
  musicNodes = { osc, gain, lfo }
  musicOn = true
}

export function stopMusic(): void {
  if (!musicNodes) {
    musicOn = false
    return
  }
  try {
    musicNodes.osc.stop()
    musicNodes.lfo.stop()
  } catch {
    /* ignore */
  }
  musicNodes = null
  musicOn = false
}

export function toggleMusic(): boolean {
  if (musicOn) stopMusic()
  else startMusic()
  return musicOn
}
