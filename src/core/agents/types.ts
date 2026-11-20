import type { RawState } from '../agentstate/raw'
import type { Chat } from '../chat/session'
import type { Start } from '../command'
import type { PaneStartSource } from '../context/statusline'
import type { Key } from '../i18n'
import type { Badge, Details, Head } from '../sessions/details'
import type { DiscoveredSession } from '../sessions/scanner'
import type { TeamAgent } from '../team/block'
import type { TeamText } from '../team/posts'
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
  heldAtStart(start: Start, block: TeamText | null): TeamText | null
  // The words that hand the block's file to the CLI.
  atStart(start: Start, file: string): readonly string[]
  readonly floor: VersionFloor | null
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
}

// A session's last turn, read when it ends: whether it only took team updates, and whether it
// closed by sending its report to the parent itself.
export interface TurnEndReading {
  onlyTeamUpdates(locator: string): Promise<boolean>
  reportedTo(locator: string, parentName: string): Promise<boolean>
}

// The ids of a new session's start.
export interface SessionIds {
  // The id a new session is started with; null when the agent picks its own.
  newId(): string | null
}

// How a pane's session changing id is followed; null when the agent tells Menkar of no such change.
export interface PaneFollow {
  // A clear gives the pane a new session in the old one's place; a resume, another session.
  classify(source: PaneStartSource): 'clear' | 'resume' | null
}

export interface Fork {
  plan(source: string, id: string): Start
}

// What the agent is doing, read from the title it set and the text on its screen.
export interface StateRules {
  detect(title: string, screen: string): RawState
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

export interface AgentKit {
  readonly launch: Launcher
  readonly mcp: McpMount | null
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
}
