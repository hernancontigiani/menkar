import type { AgentId } from '../../core/agents/ids'
import { mainKit as claude } from './claude'
import { mainKit as cursor } from './cursor'
import type { MainAgentKit } from './types'

const MAIN_KITS: Readonly<Record<AgentId, MainAgentKit>> = { claude, cursor }

export function mainKitOf(id: AgentId): MainAgentKit {
  return MAIN_KITS[id]
}
