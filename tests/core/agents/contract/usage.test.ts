// §2.3 and §2.5.5 of the multi-agent architecture: every agent with a usage source is read from
// its own fixture home, and the turns it gives (origin, opening, working time, tokens per model and
// hour) are its `usage.json`. Codex's fixture has records (0.169.0), counts only (an older Codex,
// a repeated count among them), a compaction's own task and a subagent counted for its parent.
// Cursor's turns come from its hook log, in its fixture's Menkar cache.
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AGENT_IDS } from '../../../../src/core/agents/ids'
import { kitOf } from '../../../../src/core/agents/registry'
import type { TurnSource } from '../../../../src/core/agents/types'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents')
const WITH_USAGE = AGENT_IDS.filter((id) => kitOf(id).usage !== null)

let n = 0

afterEach(() => {
  vi.unstubAllEnvs()
})

test('every agent with a usage source has its fixture, and Claude and Codex have one', () => {
  expect(WITH_USAGE).toEqual(expect.arrayContaining(['claude', 'codex']))
  for (const id of WITH_USAGE) expect(existsSync(join(DATA, id, 'home')), id).toBe(true)
})

describe.each(WITH_USAGE.map((id) => [id]))('%s', (id) => {
  test('the turns its usage source reads from its fixture home', async () => {
    n += 1
    const dir = join(process.env.MENKAR_TEST_ROOT ?? '', `usage-contract-${id}-${n}`)
    cpSync(join(DATA, id, 'home'), join(dir, 'home'), { recursive: true })
    // An agent whose turns come from what its hooks leave in Menkar's cache has that cache too.
    if (existsSync(join(DATA, id, 'cache')))
      cpSync(join(DATA, id, 'cache'), join(dir, 'cache'), { recursive: true })
    vi.stubEnv('HOME', join(dir, 'home'))
    vi.stubEnv('CODEX_HOME', '')
    vi.stubEnv('XDG_DATA_HOME', '')
    const usage = kitOf(id).usage
    const source: TurnSource | null =
      usage?.open(kitOf(id).catalog.root(), join(dir, 'cache', 'usage.sqlite')) ?? null
    expect(source).not.toBeNull()
    if (source === null) return
    try {
      await source.catchUp?.()
      source.ingest()
      const turns = source
        .pending()
        .filter((row) => row.turn !== '')
        .map((row) => {
          const found = source.turnUsage(row.sessionId, row.turn)
          return found === null
            ? { uuid: row.turn, session: row.sessionId, found: null }
            : {
                uuid: row.turn,
                session: row.sessionId,
                origin: found.turn.origin,
                opened: new Date(found.turn.opened * 1000).toISOString(),
                working: found.spans.reduce((sum, s) => sum + (s.end - s.start), 0),
                tokens: found.tokens.map((t) => ({
                  ...t,
                  hour: new Date(t.hour * 1000).toISOString(),
                })),
              }
        })
      expect(turns.length).toBeGreaterThan(1)
      await expect(`${JSON.stringify(turns, null, 2)}\n`).toMatchFileSnapshot(
        join(DATA, id, 'usage.json'),
      )
    } finally {
      source.close()
    }
  })
})
