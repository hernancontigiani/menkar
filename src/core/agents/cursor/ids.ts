import type { SessionIds } from '../types'

// Cursor's CLI picks a new session's id itself; the pane learns it when its transcript appears.
export const ids: SessionIds = { newId: () => null }
