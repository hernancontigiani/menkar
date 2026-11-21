import type { AgentId } from '../../core/agents/ids'
import { mainKit as claude } from './claude'
import { mainKit as codex } from './codex'
import { mainKit as cursor } from './cursor'
import { mainKit as opencode } from './opencode'
import type { MainAgentKit } from './types'

const MAIN_KITS: Readonly<Record<AgentId, MainAgentKit>> = { claude, cursor, codex, opencode }

export function mainKitOf(id: AgentId): MainAgentKit {
  return MAIN_KITS[id]
}
