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

// One event in a batch, under its key: a later one with the same key replaces it.
export interface WakeEntry {
  readonly key: string
  readonly text: string
}

export class WakeBatcher {
  // Per parent, the human's latest post per key and the children's events per key, each in the
  // order they first came. A child's state change is keyed by the child, so its latest replaces
  // the earlier one; a wake carries its own key, so it stands beside the child's other events.
  private readonly pending = new Map<
    string,
    {
      human: Map<string, string>
      events: Map<string, { child: string; text: string }>
      timer: unknown
    }
  >()
  private readonly send: (parent: string, text: string, entries: readonly WakeEntry[]) => void
  private readonly timers: Timers
  // Read when the message goes: a child whose current task has the ★ speaks first.
  private readonly isStarred: (child: string) => boolean

  constructor(
    send: (parent: string, text: string, entries: readonly WakeEntry[]) => void,
    timers: Timers,
    isStarred: (child: string) => boolean = () => false,
  ) {
    this.send = send
    this.timers = timers
    this.isStarred = isStarred
  }

  note(
    parent: string | null,
    child: string,
    name: string,
    previous: ShownState,
    next: ShownState,
  ): void {
    if (!parent) return
    const event = wakeEvent(name, previous, next)
    if (event) this.add(parent, child, { child, text: event })
  }

  // An event about `child` under a key of its own.
  wake(parent: string, child: string, key: string, text: string): void {
    this.add(parent, key, { child, text })
  }

  // The human's own news ("The human is back"): a later post of the same key replaces it.
  post(parent: string, key: string, text: string): void {
    this.add(parent, key, null, text)
  }

  // A post the parent no longer needs: it did, or learnt, what the post would tell it.
  forget(parent: string, key: string): void {
    this.pending.get(parent)?.human.delete(key)
  }

  private add(
    parent: string,
    key: string,
    event: { child: string; text: string } | null,
    human = '',
  ): void {
    const entry = this.pending.get(parent) ?? { human: new Map(), events: new Map(), timer: null }
    if (event) {
      entry.events.delete(key)
      entry.events.set(key, event)
    } else {
      entry.human.delete(key)
      entry.human.set(key, human)
    }
    if (entry.timer !== null) this.timers.clear(entry.timer)
    entry.timer = this.timers.set(() => this.flush(parent), WAKE_DELAY_MS)
    this.pending.set(parent, entry)
  }

  private flush(parent: string): void {
    const entry = this.pending.get(parent)
    this.pending.delete(parent)
    if (!entry) return
    const events = [...entry.events.entries()]
    const first = events.filter(([, { child }]) => this.isStarred(child))
    const rest = events.filter(([, { child }]) => !this.isStarred(child))
    const entries: WakeEntry[] = [
      ...[...entry.human.entries()].map(([key, text]) => ({ key, text })),
      ...[...first, ...rest].map(([key, { text }]) => ({ key, text })),
    ]
    if (entries.length > 0) this.send(parent, entries.map((x) => x.text).join('; '), entries)
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

// Where an event goes in a project with the orchestration mode on, whose orchestrator has an
// inbox: a wake posts to the orchestrator's chat, the inbox waits for its next prompt, none tells
// it nothing. A session whose parent is another one is woken by that parent's own path.
export interface RouteInput {
  // A child entering a permission prompt, its turn ending, or the human's own news.
  readonly event: 'blocked' | 'turn-end' | 'human'
  readonly parentIsOrchestrator: boolean
  // The session called task_review on its own task during the turn.
  readonly reviewPending: boolean
  // Read before any await: a renew in flight for the pane.
  readonly renewing: boolean
  readonly onlyTeamUpdates: boolean
  readonly reportedToParent: boolean
}

export type Route = 'wake' | 'inbox' | 'none'

// A turn end's rules, in order, the first that applies winning. A pending review always wakes,
// whatever else is true of the turn: one wake too many beats none.
export function route(input: RouteInput): Route {
  if (input.event === 'human') return 'inbox'
  if (input.event === 'blocked') return input.parentIsOrchestrator ? 'inbox' : 'none'
  if (input.reviewPending) return 'wake'
  if (input.renewing || input.onlyTeamUpdates || input.reportedToParent) return 'none'
  return input.parentIsOrchestrator ? 'inbox' : 'none'
}
