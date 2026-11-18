import type { Key } from '../i18n'
import { descriptor as claude } from './claude/descriptor'
import { descriptor as cursor } from './cursor/descriptor'
import type { AgentId } from './ids'
import type { AgentVersions } from './versions'

// What the renderer and the MCP server program may know of an agent: data, no Node.
export type AgentCap = 'remote' | 'fork' | 'trash' | 'chat' | 'context'

export type VariantKey = 'default' | 'ask' | 'trusted'

// A way to start a chat with an agent.
export interface ChatVariant {
  readonly agent: AgentId
  readonly key: VariantKey
  // one long-lived process fed over stdin, or one process per turn resuming the session
  readonly transport: 'stdin-stream' | 'spawn-resume'
  readonly writeable: boolean
  // each tool use is approved one by one
  readonly gated: boolean
  // the mode label for menus; null when it is the agent's only variant
  readonly mode: 'askReadOnly' | 'trustedAutoRun' | null
}

export interface AgentDescriptor {
  readonly id: AgentId
  // The CLI's name on the PATH.
  readonly command: string
  readonly label: Key
  readonly glyph: string
  readonly caps: Readonly<Record<AgentCap, boolean>>
  // Whether a new session is given its name when it starts, so Add session asks for one.
  readonly namedAtStart: boolean
  // In the order menus offer them; empty when the agent has no chat.
  readonly chat: readonly ChatVariant[]
  // The version Menkar was tested with before this release, null until one is; and the oldest it
  // can run, null when any runs.
  readonly versions: AgentVersions
}

export const DESCRIPTORS: Readonly<Record<AgentId, AgentDescriptor>> = { claude, cursor }

export function descriptorOf(id: AgentId): AgentDescriptor {
  return DESCRIPTORS[id]
}

// What a pane runs, as it is named to the human: a shell pane is a shell, whatever it runs.
export function paneAgentLabel(agent: AgentId | 'shell'): Key {
  return agent === 'shell' ? 'agent.shell' : descriptorOf(agent).label
}
