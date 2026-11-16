import type { Head } from './details'
import type { Agent } from './lines'
import { transcriptOf } from './transcript'

export { HEAD_BYTES, HEAD_LINES } from '../agents/shared/jsonl'
export type { Head }

// `head` is the start of the file, at most HEAD_BYTES; only its first HEAD_LINES lines count.
export function readHead(head: string, agent: Agent): Head {
  return transcriptOf(agent).head(head)
}
