import type { RawState, ScreenReading } from '../agentstate/raw'
import type { Chat } from '../chat/session'
import type { TurnText } from '../classifier/input'
import type { Start } from '../command'
import type { PaneStartSource } from '../context/statusline'
import type { Reading } from '../context/types'
import type { Key } from '../i18n'
import type { Badge, Details, Head } from '../sessions/details'
import type { DiscoveredSession } from '../sessions/scanner'
import type { TeamAgent } from '../team/block'
import type { TeamText } from '../team/posts'
import type { CachedSpan, CachedTurn, HourTokens, PendingRow } from '../usage/cache'
import type { AgentId } from './ids'
import type { Names, ReadRange } from './shared/jsonl'

export type { AgentCap, AgentDescriptor, ChatVariant, VariantKey } from './descriptors'

// Everything main can offer a start; each agent's Launcher takes what its CLI understands.
export interface LaunchContext {
  // The executable's absolute path, found on the PATH.
  readonly cli: string
  // The pane's base environment.
  readonly env: Readonly<Record<string, string>>
  readonly settings?: string
  readonly remoteControl?: string
  // A file holding the session's first prompt, read by the shell.
  readonly promptFile?: string
  // Menkar's MCP server, as `--mcp-config` JSON.
  readonly mcpConfig?: string
  // Menkar's MCP server program, for an agent that mounts it by its path.
  readonly mcpServer?: string
  // Menkar's skills plugin folder.
  readonly pluginDir?: string
  // The session's team block, written before the command is built.
  readonly teamFile?: string
  // Electron's binary, which runs Menkar's programs as plain Node.
  readonly execPath?: string
  // The folder holding the programs Menkar ships for agents to run.
  readonly programs?: string
  // The pane's own folder, where its plan's files are written.
  readonly paneFiles?: string
  // The project's files folder, granted to the session.
  readonly filesFolder?: string
  // The address of the server the agent's CLI attaches to, for an agent whose sessions run there.
  readonly server?: string
}

// A file the command names, written whole before the command runs; its text is read then.
export interface LaunchFile {
  readonly path: string
  text(): Promise<string>
}

export interface LaunchPlan {
  // Shell words, each already quoted for the user's shell.
  readonly words: readonly string[]
  readonly env: Readonly<Record<string, string>>
  readonly files?: readonly LaunchFile[]
}

export interface Launcher {
  plan(start: Start, ctx: LaunchContext): LaunchPlan
}

// How Menkar's MCP server and skills reach a session the agent's CLI starts.
export interface McpMount {
  words(ctx: LaunchContext): readonly string[]
  // Whether the skills a session's team block names reach it as text through Menkar's MCP, for an
  // agent that cannot be given Menkar's skills folder without every session of its server seeing it.
  readonly servesSkills: boolean
}

// The agent's own way of messaging another session by name, where it has one.
export interface Messaging {
  // The tool's name, as the agent's model sees it.
  readonly tool: string
  reaches(other: AgentId): boolean
}

export interface Namer {
  // The words that give a new session its name; null when the CLI takes none at start.
  atStart(name: string): readonly string[] | null
}

// The variables that describe a running session of the agent, grouped by what they say: an agent
// started with them inherited takes itself for that session's child.
export type EnvRules = Readonly<Record<string, readonly string[]>>

// What names alone cannot say: variables known by their prefix, always dropped, and un-namespaced
// ones the agent injects, which may be the user's own and are dropped only when the agent's marker
// is inherited with them.
export interface EnvPatterns {
  readonly prefixes: readonly string[]
  readonly gated: { readonly marker: string; readonly names: readonly string[] } | null
}

// The oldest CLI that takes the team flags, and how its version is read.
export interface VersionFloor {
  readonly version: string
  read(output: string): string | null
  accepts(version: string): boolean
  // Shown once when a start is below the floor.
  readonly notice: Key
}

// The team block's delivery: how the agent names skills and which protocol part it reads
// (TeamAgent), what a start holds, and how a start delivers the block.
export interface TeamDelivery extends TeamAgent {
  // `recorded` is what the session held when it last ran, kept by main for an agent that records.
  heldAtStart(start: Start, block: TeamText | null, recorded?: TeamText | null): TeamText | null
  // What the start put where a compaction keeps it, when that is not the block it is started with:
  // a compaction leaves the session holding it.
  startedWith?(start: Start, block: TeamText): TeamText | null
  // A resume holds what the session recorded at its creation and was told since, not the block it
  // is started with: main keeps, per session, what it holds.
  readonly records: boolean
  // The words that hand the block's file to the CLI.
  atStart(start: Start, file: string): readonly string[]
  readonly floor: VersionFloor | null
  // The first prompt of an orchestrator the first-time card starts, given the project's name, the
  // guide's path and the orchestrator skill's SKILL.md.
  readonly orchestratorPrompt: Key
}

// A session an agent's catalog found. Only that agent's catalog interprets `locator`.
export interface Found {
  readonly agent: AgentId
  readonly id: string
  readonly locator: string
  // Where the session's files are, for a session that names no cwd.
  readonly folder: string
  readonly cwd?: string
}

// Reads found sessions, keeping what it needs to read each one again cheaply.
export interface SessionReader {
  read(found: Found): Promise<DiscoveredSession | null>
  // Forgets every session but these.
  retain(locators: ReadonlySet<string>): void
}

export interface Titles {
  readonly names: Names
  readonly laterCwd: string | null
}

// The titles a transcript writes, and a cwd past its head, read from each slice of whole lines.
export interface TitleReading {
  slice(chunk: Buffer, complete: number, prev: Titles): Titles
}

// How an agent whose sessions are JSONL transcripts reads their lines.
export interface TranscriptReading {
  head(text: string): Head
  // Whether reading more of the head could still change what it gave.
  headFinal(head: Head): boolean
  // `tail` is the file's last bytes; `fromStart` says whether that is the whole file.
  badge(tail: string, fromStart: boolean): Badge
  // Null when the agent writes no titles in its transcripts.
  readonly titles: TitleReading | null
  details(text: string): Details
  exportMarkdown(name: string, id: string, text: string): string
}

// Removing a session: the file a trash or a delete removes.
export interface SessionTrash {
  target(locator: string): string
}

export interface SessionCatalog {
  // Where the agent keeps its sessions.
  root(): string
  // Whether the agent names its sessions in its own data: a name read there is the session's.
  readonly names: boolean
  find(root: string): Promise<Found[]>
  reader(read: ReadRange): SessionReader
  // The directories whose changes can mean a session appeared or changed.
  watchTargets(root: string): Promise<string[]>
  readonly lastReply: ((locator: string) => Promise<string | null>) | null
  details(locator: string): Promise<Details>
  exportMarkdown(name: string, id: string, locator: string): Promise<string>
  // The file to show in its folder; null when the session is not a file.
  location(locator: string): string | null
  readonly trash: SessionTrash | null
  readonly transcript: TranscriptReading | null
  // What a worker's closed turn says to its parent; null when the agent's turns are not read.
  readonly turnEnd: TurnEndReading | null
  // Ends what the catalog keeps running to read (a thread), when its agent is no longer installed
  // and on quit; null when it keeps nothing running.
  readonly close: (() => void) | null
}

// A session's last turn, read when it ends: whether it only took team updates, and whether it
// closed by sending its report to the parent itself.
export interface TurnEndReading {
  onlyTeamUpdates(locator: string): Promise<boolean>
  reportedTo(locator: string, parentName: string): Promise<boolean>
}

// The ids of a new session's start.
export interface SessionIds {
  // The id a new session is started with; null when the agent picks its own. `installed` is the
  // CLI's version, for an agent that takes an id only from some version on.
  newId(installed?: string | null): string | null
  // What the CLI prints when it refuses the id it was given, for an agent that takes it through an
  // option a later version may drop.
  readonly refused?: RegExp
}

export type FollowKind = 'clear' | 'resume' | null

// The id a pane's agent now runs under, and when the pane started.
export interface PaneChange {
  readonly to: string
  readonly paneStartedAt: number
}

// How a pane's session changing id is followed; null when the agent tells Menkar of no such change.
export interface PaneFollow {
  // A clear gives the pane a new session in the old one's place; a resume, another session.
  // `source` is the session start record's, or null when a turn ended under another id.
  // An agent that must read its own data to tell answers later.
  classify(source: PaneStartSource | null, change?: PaneChange): FollowKind | Promise<FollowKind>
}

export interface Fork {
  plan(source: string, id: string): Start
}

// What the agent is doing, read from the title it set and the text on its screen.
export interface StateRules {
  detect(title: string, screen: string): RawState
  // 'toCursor' when absent.
  readonly reads?: ScreenReading
}

// A chat tab's process: what opening the tab starts, and how a message reaches the agent.
// `env` is what the process is started with: the app's, without what a session would inherit.
export interface ChatStrategy {
  open(chat: Chat, env: NodeJS.ProcessEnv): void
  send(chat: Chat, text: string, env: NodeJS.ProcessEnv): void
}

// What Menkar's calls make the agent write into its own data (a title at a session's start, a queued
// wake), and the items the user accepted in the integrations menu; every other file under the
// user's home is only read. Each pattern matches a path relative to the home, parts joined by '/'.
export interface DeclaredWrites {
  // Files that may appear.
  readonly created: readonly RegExp[]
  // Files that may change, or appear.
  readonly changed: readonly RegExp[]
}

// Where the programs an integration item's entries run are.
export interface IntegrationContext {
  // Electron's binary, which runs a program as Node.
  readonly execPath: string
  // The folder of the programs Menkar ships.
  readonly programs: string
}

// One piece Menkar may add to the agent's own configuration: off until the user turns it on,
// removable on its own, leaving the rest of the file as the user had it. A refused change throws an
// IntegrationError carrying our sentence.
export interface IntegrationItem {
  readonly key: string
  readonly title: Key
  readonly subtitle: Key
  on(): Promise<boolean>
  set(on: boolean, ctx: IntegrationContext): Promise<void>
}

// The agent's items, shown as one group under its title and description.
export interface IntegrationItems {
  readonly title: Key
  readonly description: Key
  readonly items: readonly IntegrationItem[]
}

// A turn as its agent's usage cache has it now: its spans, and its tokens per (model, UTC hour).
export interface TurnUsage {
  readonly turn: CachedTurn
  readonly spans: readonly CachedSpan[]
  readonly tokens: readonly HourTokens[]
}

// What the classifier reads of a turn: its text, and where that text starts, so an estimate can
// tell from a file's size alone whether the text is still there. Each answers null for a turn that
// is not its own.
export interface TurnTexts {
  turnText(uuid: string): TurnText | null
  textAt(uuid: string): { readonly file: string; readonly start: number } | null
}

// One agent's derived usage cache, open for a pass. Synchronous: a pass runs off the UI path.
export interface TurnSource extends TurnTexts {
  // Reads what the agent's files gained since the last pass and marks the turns it touched pending.
  ingest(): void
  // What can only be read as a stream (a compressed file never seen), read before the pass; null
  // when the agent has nothing of the kind. A pass without it reads that later.
  readonly catchUp: (() => Promise<void>) | null
  pending(): PendingRow[]
  turnUsage(sessionId: string, uuid: string): TurnUsage | null
  // The agent's name for each of these sessions it has one for, and whether it was given (1).
  names(sessions: Iterable<string>): Map<string, { name: string; given: number }>
  written(rows: readonly PendingRow[]): void
  close(): void
}

export interface UsageSource {
  // `root` is where the agent keeps its sessions; `cache` is the pass's cache file, beside which
  // an agent's own cache lives. Null when the root does not exist: nothing is read or created.
  open(root: string, cache: string): TurnSource | null
}

// How full a session's context window is, read from the agent's own data.
export interface ContextSource {
  read(sessionId: string, locator: string): Promise<Reading | null>
}

export interface AgentKit {
  readonly launch: Launcher
  readonly mcp: McpMount | null
  readonly messaging: Messaging | null
  readonly namer: Namer
  readonly team: TeamDelivery | null
  readonly env: EnvRules | null
  readonly envPatterns: EnvPatterns | null
  readonly catalog: SessionCatalog
  readonly state: StateRules
  readonly ids: SessionIds
  readonly follow: PaneFollow | null
  readonly fork: Fork | null
  readonly chat: ChatStrategy | null
  readonly writes: DeclaredWrites
  readonly usage: UsageSource | null
  readonly context: ContextSource | null
  readonly integrations: IntegrationItems | null
}
