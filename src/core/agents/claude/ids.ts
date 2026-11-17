import { randomUUID } from 'node:crypto'
import type { PaneFollow, SessionIds } from '../types'

// Claude Code takes the new session's id with `--session-id`.
export const ids: SessionIds = { newId: () => randomUUID() }

// Read from Claude Code's SessionStart record: a compaction keeps the session it was in.
export const follow: PaneFollow = {
  classify: (source) => (source === 'compact' ? null : source),
}
