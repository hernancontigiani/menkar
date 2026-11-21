import { AGENT_IDS } from '../agents/ids'
import { kitOf } from '../agents/registry'
import type { TurnSource, TurnTexts } from '../agents/types'
import { log } from '../log'
import type { Roots } from '../sessions/scanner'
import { cachePath } from './cache'
import { historyPath, type Memberships, UsageHistory } from './history'

// Where each agent's sessions are, the pass's cache file (each agent's own cache lives beside it)
// and the history. An agent with no root here is not read.
export type PassPaths = Roots & {
  readonly cache: string
  readonly history: string
}

export function defaultPassPaths(): PassPaths {
  const roots: Record<string, string> = {}
  for (const id of AGENT_IDS) roots[`${id}Projects`] = kitOf(id).catalog.root()
  return { ...roots, cache: cachePath(), history: historyPath() }
}

// Every agent's usage cache whose sessions' root exists, in the registry's order.
export function openSources(paths: PassPaths): TurnSource[] {
  const sources: TurnSource[] = []
  try {
    for (const id of AGENT_IDS) {
      const root = paths[`${id}Projects`]
      const usage = kitOf(id).usage
      if (root === undefined || usage === null) continue
      const source = usage.open(root, paths.cache)
      if (source !== null) sources.push(source)
    }
  } catch (error) {
    closeSources(sources)
    throw error
  }
  return sources
}

export function closeSources(sources: readonly TurnSource[]): void {
  for (const source of sources) source.close()
}

// A turn's text from whichever source holds it.
export function textsOf(sources: readonly TurnSource[]): TurnTexts {
  return {
    turnText: (uuid) => {
      for (const source of sources) {
        const found = source.turnText(uuid)
        if (found !== null) return found
      }
      return null
    },
    textAt: (uuid) => {
      for (const source of sources) {
        const found = source.textAt(uuid)
        if (found !== null) return found
      }
      return null
    },
  }
}

// One pass: what the agents' files gained goes into their caches, and the turns it touched into
// the history. Synchronous SQLite and file reads: it runs off the UI path (a worker or the CLI).
// One agent's files failing to read does not keep the others' turns out; the first failure is
// raised once the rest are written.
export function runPass(memberships: Memberships, paths: PassPaths = defaultPassPaths()): void {
  const sources = openSources(paths)
  try {
    passOver(sources, memberships, paths)
  } finally {
    closeSources(sources)
  }
}

// The pass the app runs: what can only be read as a stream first, then the same pass.
export async function runStreamingPass(
  memberships: Memberships,
  paths: PassPaths = defaultPassPaths(),
): Promise<void> {
  const sources = openSources(paths)
  try {
    for (const source of sources) {
      try {
        await source.catchUp?.()
      } catch (error) {
        log.warn('a usage source could not catch up; the pass goes on without it', { error })
      }
    }
    passOver(sources, memberships, paths)
  } finally {
    closeSources(sources)
  }
}

function passOver(sources: readonly TurnSource[], memberships: Memberships, paths: PassPaths) {
  let failure: { error: unknown } | null = null
  const ingested: TurnSource[] = []
  for (const source of sources) {
    try {
      source.ingest()
      ingested.push(source)
    } catch (error) {
      if (failure !== null) log.warn('a usage source could not be read', { error })
      failure ??= { error }
    }
  }
  if (failure !== null && ingested.length === 0) throw failure.error
  const history = new UsageHistory(paths.history)
  try {
    for (const source of ingested) history.write(source, memberships)
    history.rederive({
      turnUsage: (sessionId, uuid) => {
        for (const source of sources) {
          const found = source.turnUsage(sessionId, uuid)
          if (found !== null) return found
        }
        return null
      },
    })
  } finally {
    history.close()
  }
  if (failure !== null) throw failure.error
}
