import type { Timers } from '../control/events'
import type { NewTopic, Topic } from './topics'

// Menkar's own blocking topic for a session of the orchestrator waiting at a permission prompt the
// human is not looking at: the orchestrator is not woken for it, the topic holds it for the human.

// Out of the prompt this long, the prompt counts as answered: a chain of prompts is one topic.
export const PERMISSION_CLOSE_MS = 3000

// Stored in English, as topic_list gives it; main shows it in the user's language.
export function permissionTopic(name: string, from: string, task?: number): NewTopic {
  return {
    title: `${name} is waiting at a permission prompt`,
    context: 'Answer it in its tab. Menkar closes this topic once it is answered.',
    from,
    blocking: true,
    ...(task !== undefined ? { task } : {}),
    kind: 'permission',
  }
}

export const PERMISSION_ANSWERED = 'The prompt was answered'

// The open (or discussing) permission topic of a session, which no second one duplicates.
export function openPermissionTopic(list: readonly Topic[], from: string): Topic | undefined {
  return list.find((x) => x.kind === 'permission' && x.from === from && x.status !== 'closed')
}

export interface PermissionSubject {
  readonly pane: string
  readonly session: string
  readonly parentIsOrchestrator: boolean
  readonly withYou: boolean
  // The human is looking at the pane.
  readonly seen: boolean
}

export interface PermissionActions {
  // The number of the session's open or discussing permission topic, null when it has none.
  openTopic(session: string): number | null
  // Raises the topic and gives its number.
  raise(subject: PermissionSubject): number
  close(session: string, number: number): void
}

export class PermissionTopics {
  // The topic each pane raised, while it may still close it.
  private readonly raised = new Map<string, { session: string; number: number; timer: unknown }>()
  private readonly actions: PermissionActions
  private readonly timers: Timers

  constructor(actions: PermissionActions, timers: Timers) {
    this.actions = actions
    this.timers = timers
  }

  blocked(subject: PermissionSubject): void {
    const own = this.raised.get(subject.pane)
    if (own && own.timer !== null) {
      this.timers.clear(own.timer)
      own.timer = null
    }
    const open = this.actions.openTopic(subject.session)
    if (open !== null) {
      this.raised.set(subject.pane, { session: subject.session, number: open, timer: null })
      return
    }
    this.raised.delete(subject.pane)
    if (!subject.parentIsOrchestrator || subject.withYou || subject.seen) return
    const number = this.actions.raise(subject)
    this.raised.set(subject.pane, { session: subject.session, number, timer: null })
  }

  // Out of the prompt: answered, unless another prompt comes within the wait.
  unblocked(pane: string): void {
    const own = this.raised.get(pane)
    if (!own || own.timer !== null) return
    own.timer = this.timers.set(() => this.close(pane), PERMISSION_CLOSE_MS)
  }

  exited(pane: string): void {
    const own = this.raised.get(pane)
    if (own && own.timer !== null) this.timers.clear(own.timer)
    if (own) this.close(pane)
  }

  private close(pane: string): void {
    const own = this.raised.get(pane)
    this.raised.delete(pane)
    // The human or the orchestrator may have closed it by hand already.
    if (own && this.actions.openTopic(own.session) === own.number)
      this.actions.close(own.session, own.number)
  }

  dispose(): void {
    for (const { timer } of this.raised.values()) if (timer !== null) this.timers.clear(timer)
    this.raised.clear()
  }
}
