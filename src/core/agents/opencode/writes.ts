import type { DeclaredWrites } from '../types'

// OpenCode writes these at Menkar's calls, through Menkar's own server, never Menkar into its
// files: a session's row when Menkar creates and titles it, its instruction entry, and a wake's
// row in its inbox. The server keeps its database's sidecars while it runs.
export const writes: DeclaredWrites = {
  created: [/^\.local\/share\/opencode\/opencode\.db(-wal|-shm)?$/],
  changed: [/^\.local\/share\/opencode\/opencode\.db(-wal|-shm)?$/],
}
