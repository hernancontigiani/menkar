import { readingFor } from '../../context/reading'
import { UsageCache } from '../../usage/cache'
import type { ContextSource, TurnSource, UsageSource } from '../types'

// Claude's cache is the pass's own file, read and written exactly as before any other agent had
// one; its root may not exist yet, and the file is made all the same.
export const usage: UsageSource = {
  open(root: string, cache: string): TurnSource {
    const opened = new UsageCache(cache)
    return {
      ingest: () => opened.ingest(root),
      catchUp: null,
      pending: () => opened.pending(),
      turnUsage: (sessionId, uuid) => opened.turnUsage(sessionId, uuid),
      names: (sessions) => opened.names(sessions),
      written: (rows) => opened.written(rows),
      turnText: (uuid) => opened.turnText(uuid),
      textAt: (uuid) => opened.textAt(uuid),
      close: () => opened.close(),
    }
  },
}

// Menkar's statusline's report, or an estimate from the transcript's last assistant message.
export const context: ContextSource = {
  read: (sessionId, transcript) => readingFor(sessionId, transcript),
}
