import type { ShownState } from '../agentstate/shown'

export interface PromptAnswered {
  readonly kind: 'prompt_answered'
  // Absent for a pane not yet joined to a session.
  readonly sessionId?: string
  readonly next: Exclude<ShownState, 'blocked'>
  readonly blockedSeconds: number
}

// A pane leaving `blocked` for any state is a prompt the human answered (refusing included). A pane
// closed while blocked, or blocked before this tracker existed, gives nothing: nobody saw the answer.
export class PromptTracker {
  // Seconds, by pane id.
  private readonly enteredBlocked = new Map<string, number>()

  change(
    paneId: string,
    sessionId: string | null,
    previous: ShownState,
    next: ShownState,
    atSeconds: number,
  ): PromptAnswered | undefined {
    if (next === 'blocked') {
      if (previous !== 'blocked' || !this.enteredBlocked.has(paneId))
        this.enteredBlocked.set(paneId, atSeconds)
      return undefined
    }
    const since = this.enteredBlocked.get(paneId)
    this.enteredBlocked.delete(paneId)
    if (previous !== 'blocked' || since === undefined) return undefined
    return {
      kind: 'prompt_answered',
      ...(sessionId !== null ? { sessionId: sessionId } : {}),
      next,
      blockedSeconds: Math.max(0, atSeconds - since),
    }
  }

  closed(paneId: string): void {
    this.enteredBlocked.delete(paneId)
  }
}
