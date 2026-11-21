import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, rmSync, type Stats, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { log } from '../../log'
import { appDirs } from '../../paths'

export const UNREADABLE = 'unreadable for now'

const reported = new Set<string>()

// How many times a copy is taken again when the writer moved the files while it was taken.
const COPY_TRIES = 3

const copiesDir = () => join(appDirs().cache, 'agent-db')

// One folder per source database, so two agents' files of one name never meet.
const copyFolder = (path: string) =>
  join(copiesDir(), createHash('sha256').update(path).digest('hex').slice(0, 16))

const mark = (stats: Stats | undefined) =>
  stats ? `${stats.ino}:${stats.size}:${stats.mtimeMs}` : 'none'

const statOf = (path: string): Stats | undefined => statSync(path, { throwIfNoEntry: false })

// What each copy was taken from, by source database: the database file and its -wal.
const taken = new Map<string, { db: string; wal: string }>()

// The database and its -wal, copied where Menkar owns the files; never the -shm: the copy's first
// reader finds no other one and rebuilds its index from the copied -wal. The database file only changes at a checkpoint, so between two
// checkpoints only the -wal is copied again. A writer moving either file during the copy makes it
// start over: a database copied in the middle of a checkpoint does not match its -wal.
function freshCopy(path: string): string | null {
  const folder = copyFolder(path)
  const copy = join(folder, basename(path))
  for (let n = 0; n < COPY_TRIES; n += 1) {
    const db = mark(statOf(path))
    const wal = mark(statOf(`${path}-wal`))
    const was = taken.get(path)
    mkdirSync(folder, { recursive: true })
    if (was?.db !== db || !existsSync(copy)) copyFileSync(path, copy)
    if (was?.wal !== wal || was?.db !== db || !existsSync(`${copy}-wal`))
      copyFileSync(`${path}-wal`, `${copy}-wal`)
    if (mark(statOf(path)) === db && mark(statOf(`${path}-wal`)) === wal) {
      taken.set(path, { db, wal })
      return copy
    }
    taken.delete(path)
  }
  return null
}

function forgetCopy(path: string): void {
  if (!taken.delete(path) && !existsSync(copyFolder(path))) return
  rmSync(copyFolder(path), { recursive: true, force: true })
}

// Reads an agent's SQLite database without writing beside it. With no sidecars (no writer) it
// opens the file immutable: a read-only open would create the `-wal` and `-shm` of a WAL database.
// With both, a writer is live or was killed and left them: a read-only open there rebuilds a
// stale `-shm`'s index, and an immutable one misses the `-wal`'s frames, so it reads a copy of the
// database and its `-wal` kept in Menkar's cache. A `-wal` without its `-shm` is a writer that
// crashed (an agent that removes its `-shm` alone): it reads nothing until the agent runs again.
// The database is closed before this returns: never held open across passes.
// node:sqlite and the copy are synchronous: called off the UI path only.
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
  if (!wal) {
    reported.delete(path)
    forgetCopy(path)
    return withDb(
      new DatabaseSync(`${pathToFileURL(path).href}?immutable=1`, { readOnly: true }),
      read,
    )
  }
  const copy = freshCopy(path)
  if (copy === null) {
    if (!reported.has(path)) {
      reported.add(path)
      log.warn('agent database left unread: its writer kept moving it', { path })
    }
    return UNREADABLE
  }
  reported.delete(path)
  return withDb(new DatabaseSync(copy, { readOnly: true }), read)
}

function withDb<T>(db: DatabaseSync, read: (db: DatabaseSync) => T): T {
  try {
    return read(db)
  } finally {
    db.close()
  }
}
