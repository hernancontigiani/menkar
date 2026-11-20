import type { DeclaredWrites } from '../types'

// Codex writes these at Menkar's call, through its own commands, never Menkar into its files
// (measured on 0.169.0 by snapshot diffs in a home that exists). A wake is one row `codex queue`
// puts in its queue database, deleted when the thread takes it. A name (decision 1.195) is one
// line `thread/name/set` appends to session_index.jsonl, and the thread's row in state_5.sqlite.
// Either runs Codex's own server, which also logs, touches its other databases' sidecars, and
// creates the lock of their maintenance pass once.
export const writes: DeclaredWrites = {
  created: [/^\.codex\/\.sqlite-maintenance\.lock$/],
  changed: [
    /^\.codex\/session_index\.jsonl$/,
    /^\.codex\/(queue_1|logs_2|state_5)\.sqlite(-wal|-shm)?$/,
    /^\.codex\/(goals_1|memories_1)\.sqlite-shm$/,
  ],
}
