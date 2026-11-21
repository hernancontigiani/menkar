// R9 of the multi-agent design (§2.10 of its architecture): Menkar reads an agent's data and
// writes nothing there but what the agent's kit declares (DeclaredWrites). Every registered
// agent's catalog reads its fixture home here; every file keeps its bytes and mtime and the tree
// its listing, except a declared path.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AGENT_IDS, type AgentId } from '../../../../src/core/agents/ids'
import { kitOf } from '../../../../src/core/agents/registry'
import { openAgentDb } from '../../../../src/core/agents/shared/db'
import { readRange } from '../../../../src/core/agents/shared/jsonl'
import type { DeclaredWrites } from '../../../../src/core/agents/types'
import { DATA, type Entry, filesOf, undeclared } from './nowrite-harness'

let n = 0

function homeOf(id: AgentId): string {
  n += 1
  const home = join(process.env.MENKAR_TEST_ROOT ?? '', `nowrite-${id}-${n}`)
  cpSync(join(DATA, id, 'home'), home, { recursive: true, preserveTimestamps: true })
  vi.stubEnv('HOME', home)
  return home
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the harness', () => {
  const before = new Map([['.x/a.jsonl', { bytes: Buffer.from('a'), mtime: 1 }]])
  const none: DeclaredWrites = { created: [], changed: [] }

  test.each([
    [
      'a new file',
      new Map([...before, ['.x/b.jsonl', { bytes: Buffer.from('b'), mtime: 1 }]]),
      ['created .x/b.jsonl'],
    ],
    [
      'new bytes',
      new Map([['.x/a.jsonl', { bytes: Buffer.from('A'), mtime: 1 }]]),
      ['changed .x/a.jsonl'],
    ],
    [
      'a new mtime alone',
      new Map([['.x/a.jsonl', { bytes: Buffer.from('a'), mtime: 2 }]]),
      ['changed .x/a.jsonl'],
    ],
    ['a removed file', new Map<string, Entry>(), ['removed .x/a.jsonl']],
  ])('sees %s', (_, after, seen) => {
    expect(undeclared(before, after, none)).toEqual(seen)
  })

  test('sees a folder that appears empty, and not a folder whose mtime moved', () => {
    const home = join(process.env.MENKAR_TEST_ROOT ?? '', 'nowrite-folders')
    mkdirSync(join(home, '.x'), { recursive: true })
    const was = filesOf(home)
    writeFileSync(join(home, '.x', 'a.jsonl'), 'a')
    mkdirSync(join(home, '.x', '.tmp', 'git-1'), { recursive: true })
    const writes: DeclaredWrites = { created: [/^\.x\/a\.jsonl$/], changed: [] }
    expect(undeclared(was, filesOf(home), writes)).toEqual([
      'created .x/.tmp/',
      'created .x/.tmp/git-1/',
    ])
  })

  test('a declared creation allows a new file and not a change to an existing one', () => {
    const writes: DeclaredWrites = { created: [/\.jsonl$/], changed: [] }
    const after = new Map([
      ['.x/a.jsonl', { bytes: Buffer.from('A'), mtime: 2 }],
      ['.x/b.jsonl', { bytes: Buffer.from('b'), mtime: 1 }],
    ])
    expect(undeclared(before, after, writes)).toEqual(['changed .x/a.jsonl'])
  })

  test('a declared change allows a change, and the file to appear', () => {
    const writes: DeclaredWrites = { created: [], changed: [/^\.x\//] }
    const after = new Map([
      ['.x/a.jsonl', { bytes: Buffer.from('A'), mtime: 2 }],
      ['.x/b.jsonl', { bytes: Buffer.from('b'), mtime: 1 }],
    ])
    expect(undeclared(before, after, writes)).toEqual([])
  })
})

// An agent registered before its catalog reads its sessions: until then it reads nothing to check, and the block that builds it.
const LANDS_IN: Partial<Record<AgentId, string>> = {}
const BUILT = AGENT_IDS.filter((id) => LANDS_IN[id] === undefined)

test('only an agent still to be built is left out', () => {
  for (const id of Object.keys(LANDS_IN)) expect(AGENT_IDS).toContain(id)
})

describe.each(BUILT.map((id) => [id]))('%s', (id) => {
  const kit = kitOf(id)

  test('reading its sessions writes nothing it does not declare', async () => {
    const home = homeOf(id)
    const before = filesOf(home)
    expect(before.size).toBeGreaterThan(0)

    const catalog = kit.catalog
    const root = catalog.root()
    await catalog.watchTargets(root)
    const found = await catalog.find(root)
    expect(found.length).toBeGreaterThan(0)
    const reader = catalog.reader(readRange)
    for (const item of found) {
      await reader.read(item)
      await catalog.lastReply?.(item.locator)
      await catalog.details(item.locator)
      await catalog.exportMarkdown('A session', item.id, item.locator)
      catalog.location(item.locator)
      catalog.trash?.target(item.locator)
      await catalog.turnEnd?.onlyTeamUpdates(item.locator)
      await catalog.turnEnd?.reportedTo(item.locator, 'a-parent')
    }
    reader.retain(new Set())

    expect(undeclared(before, filesOf(home), kit.writes)).toEqual([])
  })
})

// OpenCode's database in the three states its server leaves it (measured on v2.3.0): alone after a
// clean stop, with both sidecars while a server lives, and with both left behind by a SIGKILL.
// Until its catalog is built (P2.4, which moves OPENCODE_WRITES into its kit), the shared reader
// is checked on the fixture directly.
describe("OpenCode's database", () => {
  const OPENCODE_WRITES: DeclaredWrites = { created: [], changed: [] }
  const DB = join('.local', 'share', 'opencode', 'opencode.db')

  function stateHome(state: 'home' | 'killed'): string {
    n += 1
    const home = join(process.env.MENKAR_TEST_ROOT ?? '', `nowrite-opencode-${state}-${n}`)
    cpSync(join(DATA, 'opencode', state), home, { recursive: true, preserveTimestamps: true })
    return home
  }

  // The -shm is shared memory every reader writes its read marks into, through a mapping that
  // leaves its mtime alone: its bytes are not OpenCode's data, its presence and mtime are.
  const files = (home: string) =>
    new Map(
      [...filesOf(home)].map(([path, entry]) => [
        path,
        path.endsWith('-shm') ? { ...entry, bytes: Buffer.alloc(0) } : entry,
      ]),
    )

  const titles = (home: string) =>
    openAgentDb(join(home, DB), (db) =>
      db
        .prepare('SELECT title FROM session_v2 WHERE parent_id IS NULL ORDER BY time_created')
        .all()
        .map((row) => row.title),
    )

  test('with no writer, reading it leaves the database alone and creates no sidecar', () => {
    const home = stateHome('home')
    const before = files(home)
    expect([...before.keys()].filter((path) => !path.endsWith('/'))).toEqual([DB])
    expect(titles(home)).toEqual([
      'project setup',
      'checkout-fix',
      'Rename the cart module',
      'payment refactor',
    ])
    expect(undeclared(before, files(home), OPENCODE_WRITES)).toEqual([])
  })

  test("with a live writer, reading it sees the writer's last frames and writes nothing", () => {
    const home = stateHome('home')
    const writer = new DatabaseSync(join(home, DB))
    try {
      writer.exec(
        "PRAGMA wal_autocheckpoint=0; UPDATE session_v2 SET title = 'payment, live' WHERE title = 'payment refactor'",
      )
      const before = files(home)
      expect([...before.keys()].filter((path) => path.startsWith(DB)).sort()).toEqual([
        DB,
        `${DB}-shm`,
        `${DB}-wal`,
      ])
      expect(titles(home)).toContain('payment, live')
      expect(undeclared(before, files(home), OPENCODE_WRITES)).toEqual([])
    } finally {
      writer.close()
    }
  })

  // A killed server leaves both sidecars, which the shared reader takes for a live writer: its
  // plain read-only open rebuilds the -shm's index, a write beside OpenCode's database. P2.4 reads
  // a copy or the server's API instead; until then this case fails, and starts passing with it.
  test.fails('after its server was killed, reading it writes nothing', () => {
    const home = stateHome('killed')
    const before = files(home)
    expect(titles(home)).toContain('checkout-fix, with tests')
    expect(undeclared(before, files(home), OPENCODE_WRITES)).toEqual([])
  })

  test('after its server was killed, the last writes are only in the -wal', () => {
    const home = stateHome('killed')
    const path = join(home, DB)
    const db = new DatabaseSync(`file:${path}?immutable=1`, { readOnly: true })
    try {
      const row = db.prepare("SELECT title FROM session_v2 WHERE id LIKE 'ses_fx01%'").get()
      expect(row?.title).toBe('checkout-fix')
    } finally {
      db.close()
    }
  })
})
