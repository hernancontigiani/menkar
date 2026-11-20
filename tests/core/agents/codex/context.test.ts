// Codex's context ring (§2.3, ContextSource): the last token count of its rollout, as Codex's own
// footer counts it — the last request's tokens over the window, both less a 12,000-token baseline.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import {
  BASELINE_TOKENS,
  readContext,
  usedPercent,
} from '../../../../src/core/agents/codex/context'
import {
  codexHome,
  count,
  meta,
  rollout,
  rolloutName,
  THREAD,
  tokens,
} from '../../../factories/codex'

const T0 = Date.parse('2026-11-08T12:00:00.000Z') / 1000

describe("Codex's footer, as a used percentage", () => {
  test.each([
    [BASELINE_TOKENS, 258_400, 0],
    [0, 258_400, 0],
    [258_400, 258_400, 100],
    [300_000, 258_400, 100],
    // (258400 − 12000 − (135200 − 12000)) / (258400 − 12000) = 50% left
    [135_200, 258_400, 50],
    [50_000, 258_400, 15],
    [5000, BASELINE_TOKENS, 100],
  ])('%i tokens of a %i window are %i percent used', (used, window, percent) => {
    expect(usedPercent(used, window)).toBe(percent)
  })
})

describe("a Codex session's reading", () => {
  test("is the last token count's: a compaction's re-estimate after the request it follows", async () => {
    const { day } = codexHome('context')
    const path = join(day, rolloutName(THREAD))
    writeFileSync(
      path,
      rollout([
        meta(T0),
        count(T0 + 1, tokens(140_000, 0, 200), tokens(135_000, 0, 200)),
        count(T0 + 2, tokens(140_000, 0, 200), tokens(50_000, 0, 0)),
        // a rate-limits update with no info changes nothing
        `{"timestamp":"2026-11-08T12:00:03.000Z","type":"event_msg","payload":{"type":"token_count","info":null}}`,
      ]),
    )
    expect(await readContext(path)).toEqual({
      percentage: 15,
      window: 258_400,
      source: 'statusline',
    })
  })

  test('is found past the tail, and none for a rollout with no count, a compressed or a missing one', async () => {
    const { day } = codexHome('context-far')
    const path = join(day, rolloutName(THREAD))
    const filler = Array.from({ length: 2000 }, (_, i) =>
      JSON.stringify({
        timestamp: '2026-11-08T12:00:05.000Z',
        type: 'response_item',
        payload: { i, text: 'x'.repeat(80) },
      }),
    )
    writeFileSync(
      path,
      rollout([
        meta(T0),
        count(T0 + 1, tokens(140_000, 0, 200), tokens(135_000, 0, 200)),
        ...filler,
      ]),
    )
    expect((await readContext(path))?.percentage).toBe(50)
    const bare = join(day, rolloutName('019a6000-0000-7000-8000-0000000000cc'))
    writeFileSync(bare, rollout([meta(T0)]))
    expect(await readContext(bare)).toBeNull()
    const packed = join(day, rolloutName(THREAD, true))
    writeFileSync(packed, zstdCompressSync(Buffer.from(rollout([meta(T0)]))))
    expect(await readContext(packed)).toBeNull()
    expect(await readContext(join(day, 'missing.jsonl'))).toBeNull()
  })
})
