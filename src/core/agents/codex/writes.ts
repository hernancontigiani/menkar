import type { DeclaredWrites } from '../types'

// Codex writes these at Menkar's call, through its own commands, never Menkar into its files. A
// wake is one row `codex queue` puts in its queue database, deleted when the thread takes it; the
// command runs Codex's own server, which also logs and touches its other databases' sidecars, and
// creates the lock of their maintenance pass once.
export const writes: DeclaredWrites = {
  created: [/^\.codex\/\.sqlite-maintenance\.lock$/],
  changed: [
    /^\.codex\/(queue_1|logs_2)\.sqlite(-wal|-shm)?$/,
    /^\.codex\/(state_5|goals_1|memories_1)\.sqlite-shm$/,
  ],
}
