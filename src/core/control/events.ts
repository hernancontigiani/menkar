import type { ShownState } from '../agentstate/shown'

// What wakes a parent: a child it started waiting at a permission prompt, or ending
// its turn, and the human's own news for the orchestrator. A parent hears of them together, once
// they have been quiet a few seconds: every post is a line in the human's chat with it.

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
  // Per parent, the human's latest post per key and each child's latest event, each in the order
  // they first came.
  private readonly pending = new Map<
    string,
    { human: Map<string, string>; events: Map<string, string>; timer: unknown }
  >()

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
    if (event) this.add(parent, 'events', child, event)
  }

  // The human's own news ("The human is back"): a later post of the same key replaces it.
  post(parent: string, key: string, text: string): void {
    this.add(parent, 'human', key, text)
  }

  // A post the parent no longer needs: it did, or learnt, what the post would tell it.
  forget(parent: string, key: string): void {
    this.pending.get(parent)?.human.delete(key)
  }

  private add(parent: string, kind: 'human' | 'events', key: string, text: string): void {
    const entry = this.pending.get(parent) ?? { human: new Map(), events: new Map(), timer: null }
    entry[kind].delete(key)
    entry[kind].set(key, text)
    if (entry.timer !== null) this.timers.clear(entry.timer)
    entry.timer = this.timers.set(() => this.flush(parent), WAKE_DELAY_MS)
    this.pending.set(parent, entry)
  }

  private flush(parent: string): void {
    const entry = this.pending.get(parent)
    this.pending.delete(parent)
    if (!entry) return
    const events = [...entry.events.entries()]
    const first = events.filter(([child]) => this.isStarred(child))
    const rest = events.filter(([child]) => !this.isStarred(child))
    const texts = [...entry.human.values(), ...[...first, ...rest].map(([, text]) => text)]
    if (texts.length > 0) this.send(parent, texts.join('; '))
  }

  dispose(): void {
    for (const { timer } of this.pending.values()) this.timers.clear(timer)
    this.pending.clear()
  }
}

// A turn Menkar's own team post opened answers nothing the parent waits on, and one the child's
// report to its parent closed has told it already. The team check reads the transcript only when
// the pane was delivered such a post since its last turn end.
export async function wakesParent(
  previous: ShownState,
  next: ShownState,
  postedSinceTurnEnd: boolean,
  onlyTeamUpdates: () => Promise<boolean>,
  reportClosedTurn: () => Promise<boolean>,
): Promise<boolean> {
  const turnEnd = previous === 'working' && (next === 'idle' || next === 'done')
  if (!turnEnd) return true
  if (postedSinceTurnEnd && (await onlyTeamUpdates())) return false
  return !(await reportClosedTurn())
}
