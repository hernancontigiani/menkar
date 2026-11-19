import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { deliveredThrough } from '../../../core/agents/claude/inbox'
import { controlPaths, writeAtomic } from '../../../core/control/files'
import type { PromptInbox } from '../types'

// The file Claude Code's prompt hook reads, under the pane's id: main is its only writer.
const fileOf = (pane: string): string => join(controlPaths().inbox, `${pane}.json`)

export const inbox: PromptInbox = {
  publish: async (pane, sessionId, dropped, entries, awaySince) => {
    if (entries.length === 0 && awaySince === null) {
      await rm(fileOf(pane), { force: true })
      return
    }
    await writeAtomic(controlPaths().inbox, `${pane}.json`, {
      session_id: sessionId,
      dropped,
      entries: entries.map(({ seq, at, text }) => ({ seq, at, text })),
      ...(awaySince === null ? {} : { away_since: awaySince }),
    })
  },
  delivered: deliveredThrough,
  forget: (pane) => rm(fileOf(pane), { force: true }),
}
