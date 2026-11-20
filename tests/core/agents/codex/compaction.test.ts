// A compaction shows in Codex only as a `compacted` line of its rollout: its catalog counts those
// in what a rollout grew by, and main takes a new one as the session's compaction.
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { compactionsIn } from '../../../../src/core/agents/codex/compaction'
import { readRange } from '../../../../src/core/agents/shared/jsonl'

const line = (type: string, payload: object = {}) =>
  `${JSON.stringify({ timestamp: '2026-11-20T23:59:58.000Z', type, payload })}\n`
const file = (text: string) => {
  const path = join(mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'compaction-')), 'r.jsonl')
  writeFileSync(path, text)
  return path
}

describe('compactions in what a rollout grew by', () => {
  test('counts compacted lines, and none that only mention one', async () => {
    const text =
      line('session_meta') +
      line('compacted', { message: 'x' }) +
      line('response_item', { text: '{"timestamp":"x","type":"compacted"}' }) +
      line('event_msg', { type: 'context_compacted' }) +
      line('compacted', { message: 'y' })
    const path = file(text)
    expect(await compactionsIn(readRange, path, 0, text.length)).toEqual({
      count: 2,
      next: text.length,
    })
  })

  test('a line not yet whole is left for the next read, and counted once it is', async () => {
    const whole = line('compacted', { message: 'x' })
    const path = file(line('event_msg') + whole.slice(0, 50))
    const size = Buffer.byteLength(line('event_msg')) + 50
    const first = await compactionsIn(readRange, path, 0, size)
    expect(first).toEqual({ count: 0, next: Buffer.byteLength(line('event_msg')) })
    appendFileSync(path, whole.slice(50))
    const end = size + whole.length - 50
    expect(await compactionsIn(readRange, path, first.next, end)).toEqual({ count: 1, next: end })
  })

  test('a compaction carrying more than a read holds is one line', async () => {
    const big = line('compacted', { replacement_history: ['z'.repeat(3 * 1024 * 1024)] })
    const text = big + line('compacted') + line('turn_context')
    const path = file(text)
    expect((await compactionsIn(readRange, path, 0, Buffer.byteLength(text))).count).toBe(2)
  })
})
