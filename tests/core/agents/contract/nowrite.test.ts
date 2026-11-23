// R9 of the multi-agent design (§2.10 of its architecture): Menkar reads an agent's data and
// writes nothing there but what the agent's kit declares (DeclaredWrites). Every registered
// agent's catalog reads its fixture home here; every file keeps its bytes and mtime and the tree
// its listing, except a declared path.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AGENT_IDS, type AgentId } from '../../../../src/core/agents/ids'
import { inProcessReads, useReads } from '../../../../src/core/agents/opencode/reads'
import { kitOf } from '../../../../src/core/agents/registry'
import { readRange } from '../../../../src/core/agents/shared/jsonl'
import type { DeclaredWrites, SessionCatalog } from '../../../../src/core/agents/types'
import { DATA, type Entry, filesOf, undeclared } from './nowrite-harness'

let n = 0

function homeOf(id: AgentId): string {
  n += 1
  const home = join(process.env.MENKAR_TEST_ROOT ?? '', `nowrite-${id}-${n}`)
  cpSync(join(DATA, id, 'home'), home, { recursive: true, preserveTimestamps: true })
  vi.stubEnv('HOME', home)
  vi.stubEnv('XDG_DATA_HOME', join(home, '.local', 'share'))
  return home
}

// A catalog that reads on a worker thread reads here on the test's: no built worker file in a test.
useReads(inProcessReads())

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

// Everything a catalog reads its sessions with; it finds at least one.
async function readAll(catalog: SessionCatalog): Promise<void> {
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
}

describe.each(BUILT.map((id) => [id]))('%s', (id) => {
  const kit = kitOf(id)

  test('reading its sessions writes nothing it does not declare', async () => {
    const home = homeOf(id)
    const before = filesOf(home)
    expect(before.size).toBeGreaterThan(0)
    await readAll(kit.catalog)
    expect(undeclared(before, filesOf(home), kit.writes)).toEqual([])
  })
})

// OpenCode's database in the three states its server leaves it (measured on v2.3.0): alone after a
// clean stop, with both sidecars while a server lives, and with both left behind by a SIGKILL. Its
// catalog reads each one and writes nothing beside it, not even into the -shm's shared memory: with
// sidecars it reads a copy in Menkar's cache.
describe("OpenCode's database", () => {
  const kit = kitOf('opencode')
  // Its kit declares what Menkar's calls make its server write there; reading declares nothing.
  const NONE: DeclaredWrites = { created: [], changed: [] }
  const DB = join('.local', 'share', 'opencode', 'opencode.db')

  function stateHome(state: 'home' | 'killed'): string {
    n += 1
    const home = join(process.env.MENKAR_TEST_ROOT ?? '', `nowrite-opencode-${state}-${n}`)
    cpSync(join(DATA, 'opencode', state), home, { recursive: true, preserveTimestamps: true })
    vi.stubEnv('HOME', home)
    vi.stubEnv('XDG_DATA_HOME', join(home, '.local', 'share'))
    return home
  }

  async function titles(): Promise<(string | null)[]> {
    const catalog = kit.catalog
    const reader = catalog.reader(readRange)
    const names = []
    for (const item of await catalog.find(catalog.root()))
      names.push((await reader.read(item))?.customTitle ?? null)
    return names.sort()
  }

  test('with no writer, reading it leaves the database alone and creates no sidecar', async () => {
    const home = stateHome('home')
    const before = filesOf(home)
    expect([...before.keys()].filter((path) => !path.endsWith('/'))).toEqual([DB])
    expect(await titles()).toEqual(['Rename the cart module', 'checkout-fix', 'payment refactor'])
    await readAll(kit.catalog)
    expect(undeclared(before, filesOf(home), NONE)).toEqual([])
  })

  test("with a live writer, reading it sees the writer's last frames and writes nothing", async () => {
    const home = stateHome('home')
    const writer = new DatabaseSync(join(home, DB))
    try {
      writer.exec(
        "PRAGMA wal_autocheckpoint=0; UPDATE session_v2 SET title = 'payment, live', time_updated = time_updated + 1 WHERE title = 'payment refactor'",
      )
      const before = filesOf(home)
      expect([...before.keys()].filter((path) => path.startsWith(DB)).sort()).toEqual([
        DB,
        `${DB}-shm`,
        `${DB}-wal`,
      ])
      expect(await titles()).toContain('payment, live')
      await readAll(kit.catalog)
      expect(undeclared(before, filesOf(home), NONE)).toEqual([])
    } finally {
      writer.close()
    }
  })

  test('after its server was killed, reading it sees the -wal and writes nothing', async () => {
    const home = stateHome('killed')
    const before = filesOf(home)
    expect(await titles()).toContain('checkout-fix, with tests')
    await readAll(kit.catalog)
    expect(undeclared(before, filesOf(home), NONE)).toEqual([])
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
