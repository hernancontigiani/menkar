import { kit as claude } from './claude'
import { kit as cursor } from './cursor'
import type { AgentId } from './ids'

const KITS: Readonly<Record<AgentId, object>> = { claude, cursor }

export function kitOf(id: AgentId): object {
  return KITS[id]
}
