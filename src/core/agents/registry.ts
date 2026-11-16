import { kit as claude } from './claude'
import { kit as cursor } from './cursor'
import type { AgentId } from './ids'
import type { AgentKit } from './types'

const KITS: Readonly<Record<AgentId, AgentKit>> = { claude, cursor }

export function kitOf(id: AgentId): AgentKit {
  return KITS[id]
}
