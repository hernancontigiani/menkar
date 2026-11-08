// The context reading the ring draws, and how it is kept current (docs/spec/context.md, CTX-1 to
// CTX-16).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  fullest,
  level,
  type Reading,
  readingFor,
  tooltip,
} from '../../../src/core/context/reading'
import { ReadingTracker } from '../../../src/core/context/tracker'

function dirs() {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'reading-'))
  const sessions = join(root, 'sessions')
  mkdirSync(sessions)
  return {
    sessions,
    transcript: join(root, 's1.jsonl'),
    report(content: unknown) {
      writeFileSync(
        join(sessions, 's1.json'),
        typeof content === 'string' ? content : JSON.stringify(content),
      )
    },
  }
}

const assistant = (timestamp: string, usage: Record<string, number>) =>
  JSON.stringify({ type: 'assistant', timestamp, message: { usage } })

const read = (d: ReturnType<typeof dirs>) => readingFor('s1', d.transcript, d.sessions)

describe('the reading', () => {
  test('CTX-1 a report newer than the last message is the reading: exact, green', async () => {
    const d = dirs()
    d.report({ percentage: 47.2, window: 200000, updated_at: '2026-11-08T10:00:05+00:00' })
    writeFileSync(d.transcript, `${assistant('2026-11-08T10:00:00Z', { input_tokens: 5 })}\n`)
    const reading = await read(d)
    expect(reading).toEqual({ percentage: 47.2, window: 200000, source: 'statusline' })
    expect(level(47.2)).toBe('ok')
    expect(tooltip(reading as Reading)).toBe('47% of 200k')
  })

  test('CTX-2 a message newer than the report makes it an estimate', async () => {
    const d = dirs()
    d.report({ percentage: 47.2, window: 200000, updated_at: '2026-11-08T10:00:05+00:00' })
    writeFileSync(
      d.transcript,
      `${assistant('2026-11-08T10:00:09Z', { input_tokens: 1000, cache_creation_input_tokens: 20000, cache_read_input_tokens: 99000 })}\n`,
    )
    const reading = await read(d)
    expect(reading).toEqual({ percentage: 60, window: 200000, source: 'estimate' })
    expect(level(60)).toBe('warn')
    expect(tooltip(reading as Reading)).toBe('~60% of 200k (estimate)')
  })

  test('CTX-3 an estimate is rounded to one decimal', async () => {
    const d = dirs()
    writeFileSync(d.transcript, `${assistant('2026-11-08T10:00:00Z', { input_tokens: 159_999 })}\n`)
    expect((await read(d))?.percentage).toBe(80)
    writeFileSync(d.transcript, `${assistant('2026-11-08T10:00:00Z', { input_tokens: 159_000 })}\n`)
    expect((await read(d))?.percentage).toBe(79.5)
  })

  test.each([
    [59.9, 'ok'],
    [60, 'warn'],
    [79.99, 'warn'],
    [80, 'full'],
  ] as const)('CTX-4 %d%% is %s', (percentage, expected) => {
    expect(level(percentage)).toBe(expected)
  })

  test('CTX-5 a stale report still gives the window', async () => {
    const d = dirs()
    d.report({ percentage: 10, window: 1_000_000, updated_at: '2026-11-08T09:00:00+00:00' })
    writeFileSync(d.transcript, `${assistant('2026-11-08T10:00:00Z', { input_tokens: 300_000 })}\n`)
    const reading = await read(d)
    expect(reading).toEqual({ percentage: 30, window: 1_000_000, source: 'estimate' })
    expect(tooltip(reading as Reading)).toBe('~30% of 1M (estimate)')
  })

  test.each([[0], ['200000'], [1.5]])(
    'CTX-6 a window of %j falls back to 200,000',
    async (window) => {
      const d = dirs()
      d.report({ percentage: null, window, updated_at: '2026-11-08T11:00:00+00:00' })
      writeFileSync(
        d.transcript,
        `${assistant('2026-11-08T10:00:00Z', { input_tokens: 100_000 })}\n`,
      )
      expect((await read(d))?.window).toBe(200_000)
    },
  )

  test('CTX-7 a fresh report with no percentage leaves the estimate', async () => {
    const d = dirs()
    d.report({ percentage: null, window: 200000, updated_at: '2026-11-08T11:00:00+00:00' })
    writeFileSync(d.transcript, `${assistant('2026-11-08T10:00:00Z', { input_tokens: 20_000 })}\n`)
    expect(await read(d)).toEqual({ percentage: 10, window: 200000, source: 'estimate' })
  })

  test('CTX-8 no report and no assistant message: no reading', async () => {
    const d = dirs()
    writeFileSync(d.transcript, `${JSON.stringify({ type: 'user', message: { content: 'hi' } })}\n`)
    expect(await read(d)).toBeNull()
  })

  test.each([['[1, 2]'], ['{not json']])(
    'CTX-9 a session file %s is no report',
    async (content) => {
      const d = dirs()
      d.report(content)
      writeFileSync(
        d.transcript,
        `${assistant('2026-11-08T10:00:00Z', { input_tokens: 20_000 })}\n`,
      )
      expect((await read(d))?.source).toBe('estimate')
    },
  )

  test('CTX-10 a last assistant message beyond the tail is found by reading the whole file', async () => {
    const d = dirs()
    const filler = `${JSON.stringify({ type: 'user', message: { content: 'x'.repeat(1000) } })}\n`
    writeFileSync(
      d.transcript,
      `${assistant('2026-11-08T10:00:00Z', { input_tokens: 40_000 })}\n${filler.repeat(1100)}`,
    )
    expect(await read(d)).toEqual({ percentage: 20, window: 200000, source: 'estimate' })
  })

  test('CTX-11 the cut first line of the tail is not parsed', async () => {
    const d = dirs()
    const early = assistant('2026-11-08T09:00:00Z', { input_tokens: 20_000 })
    // a long assistant line whose start falls before the last 256 KiB
    const cut = JSON.stringify({
      type: 'assistant',
      timestamp: '2026-11-08T10:00:00Z',
      message: { usage: { input_tokens: 180_000 }, pad: 'p'.repeat(300 * 1024) },
    })
    writeFileSync(d.transcript, `${early}\n${cut}`)
    // the only complete assistant line in the tail is none: the whole file is read, and its last
    // assistant line is the long one, complete there
    expect((await read(d))?.percentage).toBe(90)
    writeFileSync(d.transcript, `${early}\n${cut.slice(0, -1)}`)
    expect((await read(d))?.percentage).toBe(10)
  })

  test('CTX-12 a reading above 100 keeps its real figure in the tooltip', () => {
    expect(tooltip({ percentage: 130, window: 200000, source: 'statusline' })).toBe('130% of 200k')
    expect(level(130)).toBe('full')
  })

  test("CTX-13 a tab's ring is its fullest pane's", () => {
    const a: Reading = { percentage: 35, window: 200000, source: 'statusline' }
    const b: Reading = { percentage: 82, window: 200000, source: 'estimate' }
    expect(fullest([a, b])).toBe(b)
    expect(fullest([null, a])).toBe(a)
    expect(fullest([null, null])).toBeNull()
  })
})

describe('keeping it current', () => {
  test('CTX-14 a statusline write re-reads its session; a temporary file does not', async () => {
    const reads: string[] = []
    const tracker = new ReadingTracker(async (sessionId) => {
      reads.push(sessionId)
      return { percentage: reads.length, window: 200000, source: 'statusline' }
    })
    await tracker.track('abc', '/t/abc.jsonl')
    await tracker.track('.tmp-x1', '/t/odd.jsonl')
    reads.length = 1
    await tracker.fileChanged('abc.json')
    await tracker.fileChanged('.tmp-x1.json')
    await tracker.fileChanged('notes.txt')
    expect(reads).toEqual(['abc', 'abc'])
    expect(tracker.get('abc')?.percentage).toBe(2)
  })

  test('CTX-15 ten events during a read cost exactly one more read', async () => {
    let reads = 0
    let release = () => {}
    const tracker = new ReadingTracker(() => {
      reads += 1
      return new Promise((resolve) => {
        release = () => resolve({ percentage: reads, window: 200000, source: 'statusline' })
      })
    })
    const first = tracker.track('s', '/t/s.jsonl')
    for (let i = 0; i < 10; i += 1) void tracker.fileChanged('s.json')
    release()
    await first
    await new Promise((resolve) => setTimeout(resolve, 0))
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(reads).toBe(2)
  })

  test('CTX-16 an unchanged reading signals nothing', async () => {
    const tracker = new ReadingTracker(async () => ({
      percentage: 40,
      window: 200000,
      source: 'statusline',
    }))
    const changes: string[] = []
    tracker.onChange((sessionId) => changes.push(sessionId))
    await tracker.track('s', '/t/s.jsonl')
    await tracker.fileChanged('s.json')
    expect(changes).toEqual(['s'])
  })
})
