import type { Reading } from '../../context/types'
import { log } from '../../log'
import { UNREADABLE } from '../shared/db'
import type { ContextSource } from '../types'
import { parse } from './catalog'
import { dbReads } from './reads'
import type { ContextUse } from './store'

// In whole percent, as OpenCode's footer shows it; with no limit known it shows none, nor does
// Menkar.
export function readingOf(use: ContextUse | null): Reading | null {
  if (use === null || use.limit === null) return null
  return {
    percentage: Math.round((use.tokens / use.limit) * 100),
    window: use.limit,
    source: 'statusline',
  }
}

// Read on the catalog's thread, as every read of OpenCode's database is.
export const context: ContextSource = {
  read: async (_sessionId, locator) => {
    try {
      const answer = await dbReads().ask({ op: 'context', ...parse(locator) })
      return answer === UNREADABLE ? null : readingOf(answer)
    } catch (error) {
      log.warn("an OpenCode session's context could not be read", { error })
      return null
    }
  },
}
