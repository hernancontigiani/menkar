import { now } from '../core/clock'
import { log } from '../core/log'

// How long each start phase took, written as one line at the default level when the first window
// shows, so a slow start names its slow phase in the user's own log. Each phase is also an info
// line as it ends.
const phases: Record<string, number> = {}
let last = now()
let reported = false

export function startPhase(phase: string): void {
  const at = now()
  phases[phase] = at - last
  last = at
  log.info('start phase', { phase, ms: phases[phase] })
}

// The first window shown ends the start; later windows are not part of it.
export function startShown(): void {
  if (reported) return
  reported = true
  startPhase('first window shown')
  log.notice('start timings', {
    ...Object.fromEntries(Object.entries(phases).map(([k, v]) => [k.replaceAll(' ', '_'), v])),
    sinceProcessStart: Math.round(process.uptime() * 1000),
  })
}

// The first scan of the agents' folders ends after the window shows; when, and how much it found.
export function firstScanDone(sessions: number): void {
  log.notice('first sessions scan', {
    sessions,
    sinceProcessStart: Math.round(process.uptime() * 1000),
  })
}
