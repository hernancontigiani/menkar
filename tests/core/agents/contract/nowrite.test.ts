// R9 of the multi-agent design (§2.10 of its architecture): Menkar reads an agent's data and
// writes nothing there but what the agent's kit declares (DeclaredWrites). Every registered
// agent's catalog reads its fixture home here; every file keeps its bytes and mtime and the tree
// its listing, except a declared path.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AGENT_IDS, type AgentId } from '../../../../src/core/agents/ids'
import { kitOf } from '../../../../src/core/agents/registry'
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
