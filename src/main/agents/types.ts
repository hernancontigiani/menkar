import type { Start } from '../../core/command'
import type { PostOutcome } from '../../core/control/post'
import type { WorkCounts } from '../../core/orchestration/counts'
import type { InboxLine } from '../../core/orchestration/inbox-text'
import type { BridgeState } from '../../core/remote/live'
import type { TeamText } from '../../core/team/posts'

// How a change is told: 'posted' as a message the session takes as a turn, 'stored' where the
// session's agent keeps it for its next request without a turn, 'held' kept by Menkar until the
// session can be handed it, which `held.delivered` then says.
export type TeamOutcome = PostOutcome | 'stored' | 'held'

// Where a told change goes, for a teller that holds it: the pane that shows the session, and what
// to call once the session was handed what was held.
export interface TeamHeld {
  readonly pane: string
  delivered(): void
}

// The team block's delivery on main's side: how a change is told to a running session. `text` is
// the post, `current` the whole block it now holds (null when it holds none).
export interface MainTeamDelivery {
  tell(
    sessionId: string,
    text: string,
    counts: WorkCounts | undefined,
    current: TeamText | null,
    // Absent where no pane shows the session: a teller that holds then has nowhere to hold.
    held?: TeamHeld,
  ): Promise<TeamOutcome>
  // A held change no longer to be told, since the session holds the facts it would tell; null for
  // a teller that holds nothing.
  readonly withdraw: ((pane: string) => void) | null
}

export type SessionMove = 'clear' | 'resume'

// What a pane's start asks of the agent's own server before its CLI runs.
export interface PrepareInput {
  readonly pane: string
  readonly cli: string
  // The pane's folder; null for the home folder.
  readonly cwd: string | null
  readonly start: Start
  // The session's team block, already written; none when the pane starts without one.
  readonly teamFile?: string
  // The project is in the orchestration mode, so the session is given Menkar's MCP.
  readonly team: boolean
  // Menkar's MCP server: Electron's binary and the program it runs.
  readonly execPath: string
  readonly mcpServer: string
  // A file holding the session's first prompt.
  readonly promptFile?: string
}

export interface Prepared {
  // The address the pane's CLI attaches to.
  readonly server: string
  // What the pane's environment gains.
  readonly env: Readonly<Record<string, string>>
  // Whether the first prompt was handed to the session already, so the CLI is not given it.
  readonly prompted: boolean
}

// An agent whose sessions live in a server Menkar runs: the session made there before the CLI
// attaches, and the server held while the pane lives.
export interface Preparer {
  // Null when the server could not be reached: the pane says so and runs no command.
  prepare(input: PrepareInput): Promise<Prepared | null>
  // The pane ended.
  release(pane: string): void
  // A pane's CLI moved from `previous` to another session: one it made, which takes the old one's
  // place as a clear's does ('clear'), or one its own picker opened ('resume').
  onSession(
    follow: (pane: string, sessionId: string, previous: string, kind: SessionMove) => void,
  ): void
  // Something the human should know about a pane's session, shown as one line in its terminal:
  // the session has a turn running in another server than Menkar's too, found at its start
  // ('start') or before a wake ('wake').
  onNotice(listener: (pane: string, notice: PaneNotice) => void): void
  // On quit.
  quit(): Promise<void>
}

export interface PaneNotice {
  readonly kind: 'other-server'
  readonly when: 'start' | 'wake'
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

// The pane that shows the session a wake is for, for a waker that must look at it or restart it.
export interface WakePane {
  readonly id: string
  // Its screen as its agent's state is read; '' while the agent does not own the terminal.
  screen(): string
  // Calls `changed` on each change of its screen, until the returned function is called.
  onScreen(changed: () => void): () => void
  // Ends the agent and resumes its session in the same tab with `prompt` as its first message: the
  // new pane's id, or null when it was not restarted (a renew or a stop is pending, the tab went).
  resume(prompt: string): Promise<string | null>
}

// How a session is woken with a line of Menkar's while it runs.
export interface Waker {
  wake(
    sessionId: string,
    text: string,
    counts: WorkCounts | undefined,
    // Absent where no pane shows the session: a waker that must look at it then only holds.
    pane?: WakePane,
  ): Promise<PostOutcome>
  // The pane ended: what was held for it goes. Null for a waker that holds nothing.
  readonly release: ((pane: string) => void) | null
}

// The orchestrator's inbox as its agent is given it: a file its prompt hook reads, and the
// transcript's own record of what the model was given.
export interface PromptInbox {
  // Writes the pane's inbox file whole, or removes it when nothing is pending, the human is not
  // away and no standing line holds.
  publish(
    pane: string,
    sessionId: string,
    dropped: number,
    entries: readonly InboxLine[],
    awaySince: number | null,
    standing: readonly string[],
  ): Promise<void>
  // The highest entry the transcript's records after `from` show the model got, 0 if none, the
  // names it sent a message to there with its own messaging, and the offset read to.
  delivered(
    transcript: string,
    from: number,
  ): Promise<{
    readonly through: number
    readonly offset: number
    // Absent when it sent none.
    readonly sentTo?: readonly string[]
  }>
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

// What an agent's server says of a pane's session beyond its screen: whether a turn of it, or of a
// subagent under it, runs now.
export interface ServerRuns {
  running(pane: string): boolean
  // Calls `changed` with each pane whose answer may have changed, until the returned function is
  // called.
  onChange(changed: (pane: string) => void): () => void
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
  readonly prepare: Preparer | null
  readonly runs: ServerRuns | null
}
