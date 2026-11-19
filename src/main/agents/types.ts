import type { PostOutcome } from '../../core/control/post'
import type { WorkCounts } from '../../core/orchestration/counts'
import type { InboxLine } from '../../core/orchestration/inbox-text'
import type { BridgeState } from '../../core/remote/live'

// The team block's delivery on main's side: how a change is told to a running session.
export interface MainTeamDelivery {
  tell(sessionId: string, text: string, counts: WorkCounts | undefined): Promise<PostOutcome>
}

// What Remote Control's reading needs of a pane.
export interface RemotePane {
  // The pid of the shell the pty runs; the agent is that shell's child.
  shellPid(): number
  sessionId(): string | null
}

// Whether a pane's agent has a Remote Control bridge connected now.
export interface Remote {
  // The folder whose changes can mean a bridge connected or dropped.
  folder(): string
  // 'unknown' when it cannot be read: the caller falls back to the app's own list.
  live(pane: RemotePane): Promise<BridgeState>
}

// How a session is woken with a line of Menkar's while it runs.
export interface Waker {
  wake(sessionId: string, text: string, counts: WorkCounts | undefined): Promise<PostOutcome>
}

// The orchestrator's inbox as its agent is given it: a file its prompt hook reads, and the
// transcript's own record of what the model was given.
export interface PromptInbox {
  // Writes the pane's inbox file whole, or removes it when nothing is pending and the human is not
  // away.
  publish(
    pane: string,
    sessionId: string,
    dropped: number,
    entries: readonly InboxLine[],
    awaySince: number | null,
  ): Promise<void>
  // The highest entry the transcript's records after `from` show the model got, 0 if none, and
  // the offset read to.
  delivered(
    transcript: string,
    from: number,
  ): Promise<{ readonly through: number; readonly offset: number }>
  forget(pane: string): Promise<void>
}

export interface MainAgentKit {
  // The settings file the agent's sessions are started with, written when it changed; null when
  // the agent takes none.
  readonly settings:
    | ((project?: { readonly id: string; readonly folder: string }) => Promise<string>)
    | null
  readonly team: MainTeamDelivery | null
  readonly remote: Remote | null
  readonly waker: Waker | null
  readonly inbox: PromptInbox | null
}
