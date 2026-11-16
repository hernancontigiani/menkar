import type { Badge } from './details'
import type { Agent } from './lines'
import { transcriptOf } from './transcript'

export { TAIL_BYTES } from '../agents/shared/jsonl'
export type { Badge }

// `tail` is the last TAIL_BYTES of the file; `fromStart` says whether that is the whole file.
export function badgeOf(tail: string, agent: Agent, fromStart: boolean): Badge {
  return transcriptOf(agent).badge(tail, fromStart)
}
