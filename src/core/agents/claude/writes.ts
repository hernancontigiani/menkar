import type { DeclaredWrites } from '../types'

// `-n` names a new session: Claude Code writes the name into the transcript it creates.
export const writes: DeclaredWrites = {
  created: [/^\.claude\/projects\/[^/]+\/[^/]+\.jsonl$/],
  changed: [],
}
