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

// How a pane whose agent picks its own session id learns it before the first turn ends.
export interface EarlyBind {
  // The session the agent under this shell runs; null while it cannot be told.
  find(shellPid: number): Promise<string | null>
}

export type NameOutcome = 'named' | 'kept' | 'no session'

// How a session the agent's CLI cannot name at start is given its name once its thread exists.
export interface AfterNamer {
  // Through the agent's own call; 'kept' when the session has that name already, 'no session'
  // while the agent has no such thread.
  after(sessionId: string, name: string): Promise<NameOutcome>
  // Calls `changed` on each change where the files of a session started at `since` appear, so its
  // id is looked for at once; until the returned function is called.
  watch(since: number, changed: () => void): () => void
}

// How a tool call an agent's server makes, naming its session in the call's `_meta`, is traced to
// the pane that shows that session.
export interface Callers {
  // The `_meta` key the agent's server puts its session's id under.
  readonly meta: string
  // The pane, and the session it shows: the one named, or the one a subagent's call descends from.
  paneOf(sessionId: string): Promise<{ readonly pane: string; readonly sessionId: string } | null>
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
  readonly bind: EarlyBind | null
  readonly namer: AfterNamer | null
  readonly callers: Callers | null
}
