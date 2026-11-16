import type { Start } from '../command'
import type { Key } from '../i18n'
import type { TeamAgent } from '../team/block'
import type { TeamText } from '../team/posts'
import type { AgentId } from './ids'

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

export interface AgentKit {
  readonly launch: Launcher
  readonly mcp: McpMount | null
  readonly namer: Namer
  readonly team: TeamDelivery | null
  readonly env: EnvRules | null
}
