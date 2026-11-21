import { kit as claude } from './claude'
import { kit as codex } from './codex'
import { kit as cursor } from './cursor'
import { type AgentId, DEFAULT_AGENT } from './ids'
import type { AgentKit } from './types'

const KITS: Readonly<Record<AgentId, AgentKit>> = { claude, cursor, codex }

export function kitOf(id: AgentId): AgentKit {
  return KITS[id]
}

// The agent a session is taken for when nothing records another.
export function isDefault(id: AgentId): boolean {
  return id === DEFAULT_AGENT
}
