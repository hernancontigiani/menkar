import type { ShownState } from '../agentstate/shown'

// What wakes a parent: a child it started waiting at a permission prompt, or ending
// its turn. A parent hears of its children together, once they have been quiet a few seconds, so a
// child that blocks and finishes in a breath costs it one message, not two.

export const WAKE_DELAY_MS = 3000

export function wakeEvent(name: string, previous: ShownState, next: ShownState): string | null {
  if (next === 'blocked' && previous !== 'blocked')
    return `${name} is waiting at a permission prompt`
  if (previous === 'working' && (next === 'idle' || next === 'done'))
    return `${name} finished its turn`
  return null
}

export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

export class WakeBatcher {
  // Per parent, each child's latest event, in the order the children first spoke.
  private readonly pending = new Map<string, { events: Map<string, string>; timer: unknown }>()

  constructor(
    private readonly send: (parent: string, text: string) => void,
    private readonly timers: Timers,
    // Read when the message goes: a child whose current task has the ★ speaks first.
    private readonly isStarred: (child: string) => boolean = () => false,
  ) {}

  note(
    parent: string | null,
    child: string,
    name: string,
    previous: ShownState,
    next: ShownState,
  ): void {
    if (!parent) return
    const event = wakeEvent(name, previous, next)
    if (!event) return
    const entry = this.pending.get(parent) ?? { events: new Map<string, string>(), timer: null }
    entry.events.delete(child)
    entry.events.set(child, event)
    if (entry.timer !== null) this.timers.clear(entry.timer)
    entry.timer = this.timers.set(() => this.flush(parent), WAKE_DELAY_MS)
    this.pending.set(parent, entry)
  }

  private flush(parent: string): void {
    const entry = this.pending.get(parent)
    this.pending.delete(parent)
    if (!entry || entry.events.size === 0) return
    const events = [...entry.events.entries()]
    const first = events.filter(([child]) => this.isStarred(child))
    const rest = events.filter(([child]) => !this.isStarred(child))
    this.send(parent, [...first, ...rest].map(([, text]) => text).join('; '))
  }

  dispose(): void {
    for (const { timer } of this.pending.values()) this.timers.clear(timer)
    this.pending.clear()
  }
}
