import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { log } from '../../log'

export const UNREADABLE = 'unreadable for now'

const reported = new Set<string>()

// Reads an agent's SQLite database without writing beside it: a read-only open with no sidecars
// creates the `-wal` and `-shm` of a WAL database, so with no writer it opens the file immutable.
// A `-wal` without its `-shm` is a writer that crashed: opening would create the `-shm`, and an
// immutable open would miss the `-wal`'s frames, so it reads nothing until the agent runs again.
// The database is closed before this returns: never held open across passes.
// node:sqlite is synchronous: called off the UI path only.
export function openAgentDb<T>(path: string, read: (db: DatabaseSync) => T): T | typeof UNREADABLE {
  const wal = existsSync(`${path}-wal`)
  const shm = existsSync(`${path}-shm`)
  if (wal !== shm) {
    if (!reported.has(path)) {
      reported.add(path)
      log.warn('agent database left unread: a sidecar is missing', { path, wal, shm })
    }
    return UNREADABLE
  }
  reported.delete(path)
  const db = wal
    ? new DatabaseSync(path, { readOnly: true })
    : new DatabaseSync(`${pathToFileURL(path).href}?immutable=1`, { readOnly: true })
  try {
    return read(db)
  } finally {
    db.close()
  }
}
