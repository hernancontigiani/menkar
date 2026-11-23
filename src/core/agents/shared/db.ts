import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  type Stats,
  statSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { threadId } from 'node:worker_threads'
import { log } from '../../log'
import { appDirs } from '../../paths'

export const UNREADABLE = 'unreadable for now'

const reported = new Set<string>()

// How many times a copy is taken again when the writer moved the files while it was taken.
const COPY_TRIES = 3

const copiesDir = () => join(appDirs().cache, 'agent-db')

// One folder per source database, so two agents' files of one name never meet; a reader that may
// run beside another (in another thread or process) names its own, so no copy is rewritten while
// someone reads it.
const copyFolder = (path: string, copies: string | null) => {
  const hash = createHash('sha256').update(path).digest('hex').slice(0, 16)
  return join(copiesDir(), copies === null ? hash : `${hash}-${copies}`)
}

const mark = (stats: Stats | undefined) =>
  stats ? `${stats.ino}:${stats.size}:${stats.mtimeMs}` : 'none'

const statOf = (path: string): Stats | undefined => statSync(path, { throwIfNoEntry: false })

// What each copy was taken from, by copy folder: the database file and its -wal.
const taken = new Map<string, { db: string; wal: string }>()

// The database and its -wal, copied where Menkar owns the files; never the -shm: the copy's first
// reader finds no other one and rebuilds its index from the copied -wal. The database file only changes at a checkpoint, so between two
// checkpoints only the -wal is copied again. A writer moving either file during the copy makes it
// start over: a database copied in the middle of a checkpoint does not match its -wal.
function freshCopy(path: string, copies: string | null): string | null {
  const folder = copyFolder(path, copies)
  const copy = join(folder, basename(path))
  for (let n = 0; n < COPY_TRIES; n += 1) {
    const db = mark(statOf(path))
    const wal = mark(statOf(`${path}-wal`))
    const was = taken.get(folder)
    mkdirSync(folder, { recursive: true })
    if (was?.db !== db || !existsSync(copy)) copyFileSync(path, copy)
    if (was?.wal !== wal || was?.db !== db || !existsSync(`${copy}-wal`))
      copyFileSync(`${path}-wal`, `${copy}-wal`)
    if (mark(statOf(path)) === db && mark(statOf(`${path}-wal`)) === wal) {
      taken.set(folder, { db, wal })
      return copy
    }
    taken.delete(folder)
  }
  return null
}

function forgetCopy(path: string, copies: string | null): void {
  const folder = copyFolder(path, copies)
  if (!taken.delete(folder) && !existsSync(folder)) return
  rmSync(folder, { recursive: true, force: true })
}

// The copies of a reader that lives only as long as this thread: `<kind>-<pid>-<thread>`.
export const ownCopies = (kind: string): string => `${kind}-${process.pid}-${threadId}`

// Removes the copies `ownCopies(kind)` named, of every database.
export function dropCopies(copies: string): void {
  for (const name of copyFolders())
    if (name.endsWith(`-${copies}`)) {
      taken.delete(join(copiesDir(), name))
      rmSync(join(copiesDir(), name), { recursive: true, force: true })
    }
}

// Removes the copies of `kind` whose process has ended: one that died never dropped its own.
export function sweepCopies(kind: string): void {
  const own = new RegExp(`^[0-9a-f]{16}-${kind}-(\\d+)-\\d+$`)
  for (const name of copyFolders()) {
    const pid = Number(own.exec(name)?.[1])
    if (pid > 0 && !alive(pid)) rmSync(join(copiesDir(), name), { recursive: true, force: true })
  }
}

function copyFolders(): string[] {
  try {
    return readdirSync(copiesDir())
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // EPERM: another user's process has that pid now; the copy's maker, the user's own, is gone.
    if (code === 'ESRCH' || code === 'EPERM') return false
    throw error
  }
}

// Reads an agent's SQLite database without writing beside it. With no sidecars (no writer) it
// opens the file immutable: a read-only open would create the `-wal` and `-shm` of a WAL database.
// With both, a writer is live or was killed and left them: a read-only open there rebuilds a
// stale `-shm`'s index, and an immutable one misses the `-wal`'s frames, so it reads a copy of the
// database and its `-wal` kept in Menkar's cache. A `-wal` without its `-shm` is a writer that
// crashed (an agent that removes its `-shm` alone): it reads nothing until the agent runs again.
// The database is closed before this returns: never held open across passes.
// node:sqlite and the copy are synchronous: called off the UI path only.
export function openAgentDb<T>(
  path: string,
  read: (db: DatabaseSync) => T,
  copies: string | null = null,
): T | typeof UNREADABLE {
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
    forgetCopy(path, copies)
    return withDb(
      new DatabaseSync(`${pathToFileURL(path).href}?immutable=1`, { readOnly: true }),
      read,
    )
  }
  const copy = freshCopy(path, copies)
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
