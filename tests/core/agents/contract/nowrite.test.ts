// R9 of the multi-agent design (§2.10 of its architecture): Menkar reads an agent's data and
// writes nothing there but what the agent's kit declares (DeclaredWrites). Every registered
// agent's catalog reads its fixture home here; every file keeps its bytes and mtime and the tree
// its listing, except a declared path.
import { cpSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AGENT_IDS, type AgentId } from '../../../../src/core/agents/ids'
import { kitOf } from '../../../../src/core/agents/registry'
import { readRange } from '../../../../src/core/agents/shared/jsonl'
import type { DeclaredWrites } from '../../../../src/core/agents/types'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents')

interface Entry {
  readonly bytes: Buffer
  readonly mtime: number
}

// Every file under the home, by its path relative to the home.
function filesOf(home: string): Map<string, Entry> {
  const files = new Map<string, Entry>()
  const walk = (dir: string) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name)
      if (item.isDirectory()) walk(path)
      else
        files.set(relative(home, path).split(sep).join('/'), {
          bytes: readFileSync(path),
          mtime: statSync(path).mtimeMs,
        })
    }
  }
  walk(home)
  return files
}

// The paths that changed beyond what the agent declares: a file that appeared, vanished or whose
// bytes or mtime differ, unless a declared pattern allows it.
function undeclared(
  before: Map<string, Entry>,
  after: Map<string, Entry>,
  writes: DeclaredWrites,
): string[] {
  const matches = (patterns: readonly RegExp[], path: string) => patterns.some((p) => p.test(path))
  const out: string[] = []
  for (const [path, entry] of after) {
    const was = before.get(path)
    if (!was) {
      if (!matches([...writes.created, ...writes.changed], path)) out.push(`created ${path}`)
    } else if (!was.bytes.equals(entry.bytes) || was.mtime !== entry.mtime) {
      if (!matches(writes.changed, path)) out.push(`changed ${path}`)
    }
  }
  for (const path of before.keys()) if (!after.has(path)) out.push(`removed ${path}`)
  return out.sort()
}

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

describe.each(AGENT_IDS.map((id) => [id]))('%s', (id) => {
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
