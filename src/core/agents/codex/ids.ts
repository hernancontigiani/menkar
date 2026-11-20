import type { SessionIds } from '../types'

// Codex takes no id at start: the thread's id is its rollout's, learnt once the session runs.
export const ids: SessionIds = { newId: () => null }
