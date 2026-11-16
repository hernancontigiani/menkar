import type { Start } from '../command'
import type { Key } from '../i18n'
import type { Badge, Details, Head } from '../sessions/details'
import type { DiscoveredSession } from '../sessions/scanner'
import type { TeamAgent } from '../team/block'
import type { TeamText } from '../team/posts'
import type { AgentId } from './ids'
import type { Names, ReadRange } from './shared/jsonl'

export type AgentCap = 'remote' | 'fork' | 'trash' | 'chat' | 'context'

export interface AgentDescriptor {
  readonly id: AgentId
  // The CLI's name on the PATH.
  readonly command: string
  readonly label: Key
  readonly glyph: string
  readonly caps: Readonly<Record<AgentCap, boolean>>
}

// Everything main can offer a start; each agent's Launcher takes what its CLI understands.
export interface LaunchContext {
  // The executable's absolute path, found on the PATH.
  readonly cli: string
  // The pane's base environment.
  readonly env: Readonly<Record<string, string>>
  readonly settings?: string
  readonly remoteControl?: string
  // Folders the agent may read and write besides its own.
  readonly addDirs?: readonly string[]
  // A file holding the session's first prompt, read by the shell.
  readonly promptFile?: string
  // Menkar's MCP server, as `--mcp-config` JSON.
  readonly mcpConfig?: string
  // Menkar's skills plugin folder.
  readonly pluginDir?: string
  // The session's team block, written before the command is built.
  readonly teamFile?: string
}

export interface LaunchPlan {
  // Shell words, each already quoted for the user's shell.
  readonly words: readonly string[]
  readonly env: Readonly<Record<string, string>>
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
}

export interface AgentKit {
  readonly launch: Launcher
  readonly mcp: McpMount | null
  readonly namer: Namer
  readonly team: TeamDelivery | null
  readonly env: EnvRules | null
  readonly catalog: SessionCatalog
}
