// §2.6 of the multi-agent architecture (R9, S6): an agent's SQLite database is read without a
// file appearing or changing beside it, with no writer, with a live writer, after a writer was
// killed and left both sidecars, and after a writer crashed and left its `-wal` without the `-shm`.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  dropCopies,
  openAgentDb,
  ownCopies,
  sweepCopies,
  UNREADABLE,
} from '../../../../src/core/agents/shared/db'
import { addSink } from '../../../../src/core/log'
import { appDirs } from '../../../../src/core/paths'

const folder = () => mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'agent-db-'))

// A WAL database, as the agents keep theirs, whose writer closed: only the file is left.
function closedDatabase(dir: string): string {
  const path = join(dir, 'state_5.sqlite')
  const db = new DatabaseSync(path)
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE threads (id TEXT PRIMARY KEY, name TEXT); INSERT INTO threads VALUES ('t1', 'first')",
  )
  db.close()
  return path
}

const names = (db: DatabaseSync) =>
  db
    .prepare('SELECT name FROM threads ORDER BY id')
    .all()
    .map((row) => row.name)

// What a reader can see change beside the database: the listing, and each file's bytes and mtime.
function snapshot(dir: string): unknown {
  return readdirSync(dir)
    .sort()
    .map((name) => {
      const stats = statSync(join(dir, name))
      return {
        name,
        mtime: stats.mtimeMs,
        bytes: name.endsWith('-shm') ? null : readFileSync(join(dir, name)),
      }
    })
}

// Every byte too, the -shm's included: a reader that never opens the agent's files leaves even
// the shared memory alone.
function exact(dir: string): unknown {
  return readdirSync(dir)
    .sort()
    .map((name) => ({
      name,
      mtime: statSync(join(dir, name)).mtimeMs,
      bytes: readFileSync(join(dir, name)),
    }))
}

// The three files as a writer killed with SIGKILL leaves them: its last write only in the -wal.
function killedDatabase(dir: string): string {
  const source = closedDatabase(folder())
  const writer = new DatabaseSync(source)
  const path = join(dir, 'state_5.sqlite')
  try {
    writer.exec("PRAGMA wal_autocheckpoint=0; INSERT INTO threads VALUES ('t2', 'second')")
    for (const end of ['', '-wal', '-shm']) copyFileSync(`${source}${end}`, `${path}${end}`)
  } finally {
    writer.close()
  }
  return path
}

const copies = () => join(appDirs().cache, 'agent-db')
// The copy folders of one database: its shared one, and those readers named.
const copiesOf = (path: string) => {
  const hash = createHash('sha256').update(path).digest('hex').slice(0, 16)
  return readdirSync(copies()).filter((name) => name.startsWith(hash))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('openAgentDb', () => {
  test('with no writer it reads the file and creates no -wal or -shm beside it', () => {
    const dir = folder()
    const path = closedDatabase(dir)
    expect(readdirSync(dir)).toEqual(['state_5.sqlite'])
    const before = snapshot(dir)
    expect(openAgentDb(path, names)).toEqual(['first'])
    expect(readdirSync(dir)).toEqual(['state_5.sqlite'])
    expect(snapshot(dir)).toEqual(before)
  })

  test("with a live writer it reads the writer's frames still in the -wal, and leaves the files as they were", () => {
    const dir = folder()
    const path = closedDatabase(dir)
    const writer = new DatabaseSync(path)
    try {
      writer.exec("PRAGMA wal_autocheckpoint=0; INSERT INTO threads VALUES ('t2', 'second')")
      expect(readdirSync(dir).sort()).toEqual([
        'state_5.sqlite',
        'state_5.sqlite-shm',
        'state_5.sqlite-wal',
      ])
      // The -shm is shared memory every reader writes into; its bytes are not the agent's data.
      const before = snapshot(dir)
      expect(openAgentDb(path, names)).toEqual(['first', 'second'])
      expect(snapshot(dir)).toEqual(before)
    } finally {
      writer.close()
    }
  })

  test('after a writer crashed, leaving its -wal and no -shm, it opens nothing and says so once', () => {
    const live = folder()
    const source = closedDatabase(live)
    const writer = new DatabaseSync(source)
    const dir = folder()
    const path = join(dir, 'state_5.sqlite')
    try {
      writer.exec("PRAGMA wal_autocheckpoint=0; INSERT INTO threads VALUES ('t2', 'second')")
      copyFileSync(source, path)
      copyFileSync(`${source}-wal`, `${path}-wal`)
    } finally {
      writer.close()
    }
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const lines: string[] = []
    const remove = addSink((line) => lines.push(line))
    try {
      const before = snapshot(dir)
      const read = vi.fn(names)
      expect(openAgentDb(path, read)).toBe(UNREADABLE)
      expect(openAgentDb(path, read)).toBe(UNREADABLE)
      expect(read).not.toHaveBeenCalled()
      expect(readdirSync(dir).sort()).toEqual(['state_5.sqlite', 'state_5.sqlite-wal'])
      expect(snapshot(dir)).toEqual(before)
      expect(lines.filter((line) => line.includes('agent database left unread'))).toHaveLength(1)
    } finally {
      remove()
    }
  })

  test("Codex's state_5.sqlite, as its writer leaves it, gives its threads and gains no sidecar", () => {
    const dir = folder()
    const path = join(dir, 'state_5.sqlite')
    copyFileSync(
      join(
        import.meta.dirname,
        '..',
        '..',
        '..',
        'data',
        'agents',
        'codex',
        'home',
        '.codex',
        'state_5.sqlite',
      ),
      path,
    )
    const before = snapshot(dir)
    const threads = openAgentDb(path, (db) =>
      db
        .prepare("SELECT name FROM threads WHERE thread_source = 'user' ORDER BY created_at")
        .all()
        .map((row) => row.name),
    )
    expect(threads).toEqual(['release-notes', 'api-routes', null])
    expect(snapshot(dir)).toEqual(before)
  })

  test('the database is closed when the read returns', () => {
    const path = closedDatabase(folder())
    let opened: DatabaseSync | null = null
    openAgentDb(path, (db) => {
      opened = db
      return names(db)
    })
    expect(opened).not.toBeNull()
    expect(() => (opened as unknown as DatabaseSync).prepare('SELECT 1')).toThrow()
  })

  test('after a writer was killed, leaving both sidecars, it reads the -wal and touches no file', () => {
    const dir = folder()
    const path = killedDatabase(dir)
    expect(readdirSync(dir).sort()).toEqual([
      'state_5.sqlite',
      'state_5.sqlite-shm',
      'state_5.sqlite-wal',
    ])
    const before = exact(dir)
    expect(openAgentDb(path, names)).toEqual(['first', 'second'])
    expect(openAgentDb(path, names)).toEqual(['first', 'second'])
    expect(exact(dir)).toEqual(before)
  })

  test("with a live writer it touches not even the -shm, and follows the writer's next frames and checkpoint", () => {
    const dir = folder()
    const path = closedDatabase(dir)
    const writer = new DatabaseSync(path)
    try {
      writer.exec("PRAGMA wal_autocheckpoint=0; INSERT INTO threads VALUES ('t2', 'second')")
      const before = exact(dir)
      expect(openAgentDb(path, names)).toEqual(['first', 'second'])
      expect(exact(dir)).toEqual(before)
      writer.exec("INSERT INTO threads VALUES ('t3', 'third')")
      expect(openAgentDb(path, names)).toEqual(['first', 'second', 'third'])
      writer.exec("PRAGMA wal_checkpoint(TRUNCATE); INSERT INTO threads VALUES ('t4', 'fourth')")
      expect(openAgentDb(path, names)).toEqual(['first', 'second', 'third', 'fourth'])
    } finally {
      writer.close()
    }
  })

  test('the copy is kept in the cache only while the sidecars are there', () => {
    const dir = folder()
    const path = closedDatabase(dir)
    const writer = new DatabaseSync(path)
    writer.exec("INSERT INTO threads VALUES ('t2', 'second')")
    expect(openAgentDb(path, names)).toEqual(['first', 'second'])
    const kept = readdirSync(copies()).filter((name) =>
      existsSync(join(copies(), name, 'state_5.sqlite')),
    )
    expect(kept.length).toBeGreaterThan(0)
    // A clean stop checkpoints and removes both sidecars.
    writer.close()
    expect(readdirSync(dir)).toEqual(['state_5.sqlite'])
    const after = readdirSync(copies()).length
    expect(openAgentDb(path, names)).toEqual(['first', 'second'])
    expect(readdirSync(copies())).toHaveLength(after - 1)
  })

  test("a reader that names its own copies never rewrites another reader's copy, and drops only its own", () => {
    const dir = folder()
    const path = closedDatabase(dir)
    const writer = new DatabaseSync(path)
    try {
      writer.exec("PRAGMA wal_autocheckpoint=0; INSERT INTO threads VALUES ('t2', 'second')")
      expect(openAgentDb(path, names)).toEqual(['first', 'second'])
      const shared = copiesOf(path).filter((name) => /^[0-9a-f]{16}$/.test(name))
      expect(shared).toHaveLength(1)
      const sharedCopy = join(copies(), shared[0] ?? '')
      const before = exact(sharedCopy)
      writer.exec("INSERT INTO threads VALUES ('t3', 'third')")
      const own = ownCopies('usage')
      expect(openAgentDb(path, names, own)).toEqual(['first', 'second', 'third'])
      expect(exact(sharedCopy)).toEqual(before)
      expect(copiesOf(path).filter((name) => name.endsWith(`-${own}`))).toHaveLength(1)
      dropCopies(own)
      expect(copiesOf(path).filter((name) => name.endsWith(`-${own}`))).toEqual([])
      expect(existsSync(sharedCopy)).toBe(true)
    } finally {
      writer.close()
    }
  })

  test("the copies of a process that ended are swept, a live one's and the shared ones kept", () => {
    const dir = folder()
    const path = closedDatabase(dir)
    const writer = new DatabaseSync(path)
    try {
      writer.exec("INSERT INTO threads VALUES ('t2', 'second')")
      const ended = spawnSync(process.execPath, ['-e', '']).pid
      expect(ended).toBeGreaterThan(0)
      const dead = `usage-${ended}-1`
      const live = ownCopies('usage')
      for (const name of [null, dead, live]) expect(openAgentDb(path, names, name)).toHaveLength(2)
      const mine = (name: string) => copiesOf(path).some((n) => n.endsWith(`-${name}`))
      expect(mine(dead)).toBe(true)
      sweepCopies('usage')
      expect(mine(dead)).toBe(false)
      expect(mine(live)).toBe(true)
      expect(copiesOf(path).some((n) => /^[0-9a-f]{16}$/.test(n))).toBe(true)
      dropCopies(live)
    } finally {
      writer.close()
    }
  })
})
