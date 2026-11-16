import type { AgentId } from '../../core/agents/ids'
import { mainKit as claude } from './claude'
import { mainKit as cursor } from './cursor'

const MAIN_KITS: Readonly<Record<AgentId, object>> = { claude, cursor }

export function mainKitOf(id: AgentId): object {
  return MAIN_KITS[id]
}
