// lib/sounds.ts
// Pass 3 — Web Audio API notification sounds (no external files needed)
let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.15) {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gainNode = ac.createGain()
  osc.connect(gainNode)
  gainNode.connect(ac.destination)
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ac.currentTime)
  gainNode.gain.setValueAtTime(gain, ac.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + duration)
}

export function playMessageSound() {
  tone(880, 0.12, 'sine', 0.12)
}

export function playDMSound() {
  const ac = getCtx()
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.connect(g); g.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(660, t)
  osc.frequency.setValueAtTime(880, t + 0.08)
  g.gain.setValueAtTime(0.14, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  osc.start(t); osc.stop(t + 0.22)
}

export function playMentionSound() {
  const ac = getCtx()
  const t = ac.currentTime
  ;[0, 0.1, 0.2].forEach((offset, i) => {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.value = 660 + i * 110
    g.gain.setValueAtTime(0.13, t + offset)
    g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15)
    osc.start(t + offset); osc.stop(t + offset + 0.15)
  })
}

export function playIssueAssignedSound() {
  const ac = getCtx()
  const t = ac.currentTime
  ;[440, 550].forEach((freq, i) => {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.12, t + i * 0.1)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.18)
    osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.18)
  })
}

export function playMeetingStartSound() {
  const ac = getCtx()
  const t = ac.currentTime
  ;[523, 659, 784].forEach((freq, i) => {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.14, t + i * 0.12)
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.2)
    osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.2)
  })
}

export function playNotificationSound(type: string) {
  try {
    switch (type) {
      case 'message':       return playMessageSound()
      case 'dm':            return playDMSound()
      case 'mention':       return playMentionSound()
      case 'issue_assigned':return playIssueAssignedSound()
      case 'meeting_start': return playMeetingStartSound()
      default:              return playMessageSound()
    }
  } catch {
    // AudioContext may be unavailable (e.g., tests, SSR)
  }
}
