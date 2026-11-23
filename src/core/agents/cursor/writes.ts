import type { DeclaredWrites } from '../types'

// Only the two integrations items the user turns on write Cursor's configuration: its hook entries
// and its allow entries, each file edited in place or, for hooks.json, created.
export const writes: DeclaredWrites = {
  created: [/^\.cursor\/hooks\.json$/],
  changed: [/^\.cursor\/hooks\.json$/, /^\.cursor\/cli-config\.json$/],
}
