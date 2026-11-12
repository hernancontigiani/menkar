import { agentPaths } from '../paths'
import { cachePath, UsageCache } from './cache'
import { historyPath, type Memberships, UsageHistory } from './history'

export interface PassPaths {
  readonly claudeProjects: string
  readonly cache: string
  readonly history: string
}

export function defaultPassPaths(): PassPaths {
  return { claudeProjects: agentPaths().claudeProjects, cache: cachePath(), history: historyPath() }
}

// One pass: what the transcripts gained goes into the cache, and the turns it touched into the
// history. Synchronous SQLite and file reads: it runs off the UI path (a worker or the CLI).
export function runPass(memberships: Memberships, paths: PassPaths = defaultPassPaths()): void {
  const cache = new UsageCache(paths.cache)
  try {
    cache.ingest(paths.claudeProjects)
    const history: UsageHistory = new UsageHistory(paths.history)
    try {
      history.write(cache, memberships)
      history.rederive(cache)
    } finally {
      history.close()
    }
  } finally {
    cache.close()
  }
}
