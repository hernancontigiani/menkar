// OpenCode's catalog (§2.6 of the multi-agent architecture): its database is read again only when
// the database file or its -wal moved, never while OpenCode is not installed (R10), and the worker
// thread that reads it ends when OpenCode is uninstalled and when the app quits.
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { sessionId } from '../../../../src/core/agents/opencode/ids'
import {
  type DbReads,
  inProcessReads,
  useReads,
  workerReads,
} from '../../../../src/core/agents/opencode/reads'
import { answer, type Request } from '../../../../src/core/agents/opencode/store'
import { kitOf } from '../../../../src/core/agents/registry'
import { SessionScanner } from '../../../../src/core/sessions/scanner'
import { SessionsService } from '../../../../src/core/sessions/service'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'opencode')
const DB = join('.local', 'share', 'opencode', 'opencode.db')
const catalog = kitOf('opencode').catalog

let n = 0

function fixtureHome(): string {
  n += 1
  const home = join(process.env.MENKAR_TEST_ROOT ?? '', `opencode-catalog-${n}`)
  cpSync(join(DATA, 'home'), home, { recursive: true, preserveTimestamps: true })
  vi.stubEnv('HOME', home)
  vi.stubEnv('XDG_DATA_HOME', join(home, '.local', 'share'))
  return home
}

// The reads made, by kind, on the test's thread.
function counted(): { reads: DbReads; asked: Request['op'][] } {
  const inner = inProcessReads()
  const asked: Request['op'][] = []
  return {
    asked,
    reads: {
      ask: (request) => {
        asked.push(request.op)
        return inner.ask(request)
      },
      close: () => {},
      running: false,
    },
  }
}

beforeEach(() => {
  catalog.close?.()
})

afterEach(() => {
  catalog.close?.()
  useReads(inProcessReads())
  vi.unstubAllEnvs()
})

describe('reading again', () => {
  test('nothing is read again while the database and its -wal stay as they were', async () => {
    fixtureHome()
    const { reads, asked } = counted()
    useReads(reads)
    expect(await catalog.find(catalog.root())).toHaveLength(3)
    expect(await catalog.find(catalog.root())).toHaveLength(3)
    expect(asked).toEqual(['list'])
  })

  test('a write OpenCode makes is seen at the next find, and only the session it changed is read again', async () => {
    const home = fixtureHome()
    const { reads, asked } = counted()
    useReads(reads)
    const reader = catalog.reader(async () => Buffer.alloc(0))
    for (const item of await catalog.find(catalog.root())) await reader.read(item)
    expect(asked.filter((op) => op === 'head')).toHaveLength(3)

    const writer = new DatabaseSync(join(home, DB))
    try {
      writer.exec(
        "PRAGMA wal_autocheckpoint=0; UPDATE session_v2 SET title = 'checkout, renamed', time_updated = time_updated + 1 WHERE id LIKE 'ses_fx01%'",
      )
      asked.length = 0
      const titles = []
      for (const item of await catalog.find(catalog.root()))
        titles.push((await reader.read(item))?.customTitle)
      expect(titles).toContain('checkout, renamed')
      expect(asked).toEqual(['list', 'head'])
    } finally {
      writer.close()
    }
  })
})

describe('installed or not (R10)', () => {
  test('while OpenCode is not installed its database is never read', async () => {
    fixtureHome()
    const { reads, asked } = counted()
    useReads(reads)
    const scanner = new SessionScanner()
    const found = await scanner.scan({}, { opencode: false })
    expect(found).toEqual([])
    expect(asked).toEqual([])
    expect(await scanner.scan({}, { opencode: true })).toHaveLength(3)
    expect(asked[0]).toBe('list')
  })

  test('with no database, nothing is read and nothing is watched', async () => {
    const home = join(process.env.MENKAR_TEST_ROOT ?? '', 'opencode-none')
    vi.stubEnv('HOME', home)
    vi.stubEnv('XDG_DATA_HOME', join(home, '.local', 'share'))
    const { reads, asked } = counted()
    useReads(reads)
    expect(await catalog.find(catalog.root())).toEqual([])
    expect(await catalog.watchTargets(catalog.root())).toEqual([])
    expect(asked).toEqual([])
  })
})

describe('the worker thread', () => {
  // A worker that answers every read with no session: the protocol, without a build.
  function stubWorker(): string {
    const file = join(process.env.MENKAR_TEST_ROOT ?? '', `opencode-worker-${n}.mjs`)
    writeFileSync(
      file,
      `import { parentPort } from 'node:worker_threads'
parentPort.on('message', ({ id }) => parentPort.postMessage({ id, value: [] }))
`,
    )
    return file
  }

  test('is started by the first read and ended when OpenCode is uninstalled', async () => {
    fixtureHome()
    const reads = workerReads(stubWorker())
    useReads(reads)
    expect(reads.running).toBe(false)
    const scanner = new SessionScanner()
    await scanner.scan({}, { opencode: true })
    expect(reads.running).toBe(true)
    await scanner.scan({}, { opencode: false })
    expect(reads.running).toBe(false)
  })

  test('is ended when the app quits', async () => {
    fixtureHome()
    const reads = workerReads(stubWorker())
    useReads(reads)
    const service = new SessionsService({ installed: async () => ({ opencode: true }) })
    await service.start()
    expect(reads.running).toBe(true)
    service.stop()
    expect(reads.running).toBe(false)
  })

  test('a worker that dies fails the reads it was making, and the next read starts another', async () => {
    const file = join(process.env.MENKAR_TEST_ROOT ?? '', 'opencode-worker-dies.mjs')
    writeFileSync(file, 'process.exit(3)\n')
    const reads = workerReads(file)
    await expect(reads.ask({ op: 'list', db: '/nowhere' })).rejects.toThrow(/code 3/)
    expect(reads.running).toBe(false)
  })
})

describe('a new session id', () => {
  test("is in OpenCode's own form, and a newer one sorts first", () => {
    const older = sessionId(1_763_650_000_000)
    const newer = sessionId(1_763_650_000_001)
    const sameMs = sessionId(1_763_650_000_001)
    for (const id of [older, newer, sameMs]) expect(id).toMatch(/^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
    expect([older, newer, sameMs].sort()).toEqual([sameMs, newer, older])
  })
})

describe('the last reply', () => {
  test('is the one the last execution closed with: none when that execution gave none', async () => {
    const db = join(process.env.MENKAR_TEST_ROOT ?? '', 'opencode-last-reply.db')
    const writer = new DatabaseSync(db)
    writer.exec(`PRAGMA foreign_keys = OFF; ${readFileSync(join(DATA, 'schema.sql'), 'utf8')}`)
    const rows: [string, object][] = [
      ['user', { text: 'First question' }],
      ['assistant', { content: [{ type: 'text', text: 'First answer.' }], finish: 'stop' }],
      ['idle', { outcome: 'succeeded' }],
      ['user', { text: 'Second question' }],
      ['idle', { outcome: 'interrupted' }],
    ]
    for (const [seq, [type, data]] of rows.entries())
      writer
        .prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, 0, 0, ?)')
        .run(`msg_${seq}`, 'ses_x', type, seq, JSON.stringify(data))
    writer.close()
    expect(answer({ op: 'lastReply', db, id: 'ses_x' })).toBeNull()
  })
})
