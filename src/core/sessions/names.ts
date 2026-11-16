import { kitOf } from '../agents/registry'
import type { Names } from '../agents/shared/jsonl'
import type { Agent } from './lines'

export { applyNameLines, emptyNames, type Names } from '../agents/shared/jsonl'

export interface Nameable extends Names {
  readonly agent: Agent
  readonly id: string
  readonly preview: string
}

// The titles count only for an agent that writes them in its transcripts.
export const titled = (agent: Agent) => (kitOf(agent).catalog.transcript?.titles ?? null) !== null

export function sessionName(session: Nameable, appName: string | undefined): string {
  const own = titled(session.agent)
  return (
    (own ? session.customTitle : null) ||
    appName?.trim() ||
    (own ? session.aiTitle : null) ||
    session.preview ||
    session.id.slice(0, 8)
  )
}
