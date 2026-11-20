import { AGENT_IDS, type AgentId } from '../agents/ids'
import { kitOf } from '../agents/registry'
import { type ReadRange, readRange } from '../agents/shared/jsonl'
import type { SessionCatalog, SessionReader } from '../agents/types'
import type { Badge } from './details'
import type { Agent } from './lines'
import type { Names } from './names'

export { firstCwd, nameLines, type ReadRange, readRange } from '../agents/shared/jsonl'

// Where each agent's sessions are, when not where its catalog keeps them.
export type Roots = Partial<Readonly<Record<`${AgentId}Projects`, string>>>

export type Installed = Partial<Readonly<Record<AgentId, boolean>>>

export interface DiscoveredSession extends Names {
  readonly agent: Agent
  readonly id: string
  readonly file: string
  // The directory holding the transcript, for a session whose transcript names no cwd.
  readonly folder: string
  readonly cwd: string | null
  readonly preview: string
  readonly badge: Badge
  readonly mtimeMs: number
  readonly size: number
  // The compactions its catalog saw since it began reading it, for an agent whose compactions
  // show only in its transcript.
  readonly compactions?: number
}

export const rootOf = (roots: Roots, id: AgentId, catalog: SessionCatalog): string =>
  roots[`${id}Projects`] ?? catalog.root()

export class SessionScanner {
  readonly #read: ReadRange
  readonly #readers = new Map<AgentId, SessionReader>()

  constructor(read: ReadRange = readRange) {
    this.#read = read
  }

  async scan(roots: Roots, installed: Installed): Promise<DiscoveredSession[]> {
    const sessions: DiscoveredSession[] = []
    for (const id of AGENT_IDS) {
      if (!installed[id]) {
        this.#readers.delete(id)
        continue
      }
      const catalog = kitOf(id).catalog
      const found = await catalog.find(rootOf(roots, id, catalog))
      let reader = this.#readers.get(id)
      if (!reader) {
        reader = catalog.reader(this.#read)
        this.#readers.set(id, reader)
      }
      const seen = new Set<string>()
      for (const item of found) {
        const session = await reader.read(item)
        if (session) {
          sessions.push(session)
          seen.add(item.locator)
        }
      }
      reader.retain(seen)
    }
    return sessions.sort((a, b) => b.mtimeMs - a.mtimeMs || a.id.localeCompare(b.id))
  }
}
