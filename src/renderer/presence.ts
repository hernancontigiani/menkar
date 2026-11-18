import { markDue } from '../core/activity/marks'
import { now } from '../core/clock'

let last: number | null = null

function seen(): void {
  if (!document.hasFocus()) return
  const at = now()
  if (!markDue(last, at)) return
  last = at
  window.menkar.activity.present()
}

// Listened to on the window, in the capture phase, before any handler can stop the event; they only
// observe, so xterm's key handler and the app's shortcuts see every event as before.
export function watchPresence(): void {
  window.addEventListener('keydown', seen, { capture: true, passive: true })
  window.addEventListener('pointerdown', seen, { capture: true, passive: true })
  window.addEventListener('wheel', seen, { capture: true, passive: true })
}
