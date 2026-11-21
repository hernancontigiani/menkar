import { randomUUID } from 'node:crypto'
import type { PaneFollow, SessionIds } from '../types'

// Claude Code takes the new session's id with `--session-id`.
export const ids: SessionIds = { newId: () => randomUUID() }

// Read from Claude Code's SessionStart record: a compaction keeps the session it was in. A turn's
// end alone says nothing: the record of the start that changed the id comes first.
export const follow: PaneFollow = {
  classify: (source) => (source === null || source === 'compact' ? null : source),
}
