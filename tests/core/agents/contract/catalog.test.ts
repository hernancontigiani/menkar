// §2.3 and §2.10 of the multi-agent architecture: every registered agent's session catalog is
// asserted against its own fixture home and expected.json, and P0.4 moved Claude's and Cursor's
// readers behind their catalogs with no change in what they read (expected.json was written by
// the readers as they were before the move).
import { cpSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AGENT_IDS, type AgentId } from '../../../../src/core/agents/ids'
import { kitOf } from '../../../../src/core/agents/registry'
import { readRange } from '../../../../src/core/agents/shared/jsonl'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents')

interface Expected {
  readonly root: string
  readonly watched: readonly string[]
  readonly sessions: ReadonlyArray<{
    readonly id: string
    readonly agent: string
    readonly folder: string
    readonly cwd: string | null
    readonly preview: string
    readonly badge: string | null
    readonly customTitle: string | null
    readonly aiTitle: string | null
    readonly size: number
    readonly lastReply: string | null
    readonly details: unknown
    readonly export: string
    readonly location: string | null
    readonly trash: string | null
  }>
}

let n = 0

// A fresh copy of the agent's fixture home, as HOME.
function homeOf(id: AgentId): { home: string; expected: Expected } {
  n += 1
  const home = join(process.env.MENKAR_TEST_ROOT ?? '', `contract-${id}-${n}`)
  cpSync(join(DATA, id, 'home'), home, { recursive: true })
  vi.stubEnv('HOME', home)
  const expected = JSON.parse(readFileSync(join(DATA, id, 'expected.json'), 'utf8')) as Expected
  return { home, expected }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

// An agent registered before its catalog reads its sessions: its fixture home has no expected.json until then, and the block that builds it.
const LANDS_IN: Partial<Record<AgentId, string>> = { codex: 'P1a.3' }
const BUILT = AGENT_IDS.filter((id) => LANDS_IN[id] === undefined)

test('only an agent still to be built is left out', () => {
  for (const id of Object.keys(LANDS_IN)) expect(AGENT_IDS).toContain(id)
})

describe.each(BUILT.map((id) => [id]))('%s', (id) => {
  const catalog = kitOf(id).catalog

  test('its root, and the folders it watches', async () => {
    const { home, expected } = homeOf(id)
    expect(relative(home, catalog.root())).toBe(expected.root)
    const watched = (await catalog.watchTargets(catalog.root())).map((dir) => relative(home, dir))
    expect(watched).toEqual(expected.watched)
  })

  test('the sessions it finds and reads', async () => {
    const { home, expected } = homeOf(id)
    const reader = catalog.reader(readRange)
    const found = await catalog.find(catalog.root())
    const read = []
    for (const item of found) {
      const session = await reader.read(item)
      if (session) read.push(session)
    }
    const shown = read
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((s) => ({
        id: s.id,
        agent: s.agent,
        folder: relative(home, s.folder),
        cwd: s.cwd,
        preview: s.preview,
        badge: s.badge,
        customTitle: s.customTitle,
        aiTitle: s.aiTitle,
        size: s.size,
      }))
    expect(shown).toEqual(
      expected.sessions.map(({ lastReply, details, export: _, location, trash, ...s }) => s),
    )
  })

  test("each session's last reply, details, export, place and trash", async () => {
    const { home, expected } = homeOf(id)
    const found = await catalog.find(catalog.root())
    const where = (path: string | null) => (path === null ? null : relative(home, path))
    for (const want of expected.sessions) {
      const item = found.find((f) => f.id === want.id)
      expect(item, want.id).toBeDefined()
      if (!item) continue
      const reply = catalog.lastReply ? await catalog.lastReply(item.locator) : null
      expect(reply).toBe(want.lastReply)
      expect(await catalog.details(item.locator)).toEqual(want.details)
      expect(await catalog.exportMarkdown('A session', item.id, item.locator)).toBe(want.export)
      expect(where(catalog.location(item.locator))).toBe(want.location)
      expect(where(catalog.trash ? catalog.trash.target(item.locator) : null)).toBe(want.trash)
    }
  })
})
