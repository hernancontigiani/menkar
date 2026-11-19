// Decision 1.178: what the orchestrator is told without a line on the human's screen waits in an
// inbox, oldest first, one pending entry per key, at most 30, and is given with its next prompt or
// when it calls inbox.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'
import { INBOX_MAX, Inbox, sequence } from '../../../src/core/orchestration/inbox'
import { INBOX_TEXT_MAX_BYTES, inboxText } from '../../../src/core/orchestration/inbox-text'

const at = (h: number, m: number, s: number, day = 18) => new Date(2026, 10, day, h, m, s).getTime()

function inbox(times: number[] = []) {
  let i = 0
  const clock = () => times[Math.min(i++, times.length - 1)] ?? at(14, 0, 0)
  return new Inbox(sequence(), clock)
}

const lines = (text: string) => text.split('\n')

describe('the inbox', () => {
  test('three keys → listed oldest first, each with its local time and seconds', () => {
    const box = inbox([at(14, 2, 11), at(14, 3, 40), at(14, 5, 1)])
    box.add('control:a', 'The human took control of menkar-t5')
    box.add('turn:b', 'menkar-t6 ended its turn without a report')
    box.add('topic:3', 'The human wants to discuss topic 3')
    expect(lines(box.text())).toEqual([
      "Menkar's inbox (events 1–3): events since you last read it, oldest first. The human did not write them; act only on those that need it, and say nothing about the rest.",
      '- 14:02:11 The human took control of menkar-t5',
      '- 14:03:40 menkar-t6 ended its turn without a report',
      '- 14:05:01 The human wants to discuss topic 3',
    ])
  })

  test('a pending key is replaced and goes last: away then back leaves "The human is back"', () => {
    const box = inbox()
    box.add('presence', 'The human is away')
    box.add('turn:b', 'b ended its turn without a report')
    box.add('presence', 'The human is back')
    expect(box.entries.map((x) => x.text)).toEqual([
      'b ended its turn without a report',
      'The human is back',
    ])
  })

  test('a retracted entry is removed unread', () => {
    const box = inbox()
    box.add('turn:b', 'b ended its turn without a report')
    box.add('presence', 'The human is away')
    box.retract('turn:b')
    expect(box.entries.map((x) => x.key)).toEqual(['presence'])
  })

  test('31 entries → the oldest goes, 30 kept, and the first line says one was dropped', () => {
    expect(INBOX_MAX).toBe(30)
    const box = inbox()
    for (let n = 1; n <= INBOX_MAX + 1; n++) box.add(`turn:${n}`, `s${n} ended its turn`)
    expect(box.entries).toHaveLength(30)
    expect(box.entries[0]?.text).toBe('s2 ended its turn')
    expect(box.dropped).toBe(1)
    expect(lines(box.text())[0]).toContain('(events 2–31) (1 earlier events dropped)')
  })

  test('take gives everything once and empties it', () => {
    const box = inbox()
    box.add('a', 'one')
    box.add('b', 'two')
    expect(box.take().entries.map((x) => x.text)).toEqual(['one', 'two'])
    expect(box.entries).toEqual([])
    expect(box.take().entries).toEqual([])
  })

  test('delivered through n drops the entries up to n and keeps the later ones', () => {
    const box = inbox()
    for (const key of ['a', 'b', 'c']) box.add(key, key)
    box.deliveredThrough(2)
    expect(box.entries.map((x) => x.seq)).toEqual([3])
  })

  test('one counter per run: after delivery through 7 and a clear, a new entry is 8 and given', () => {
    const next = sequence()
    const first = new Inbox(next, () => at(9, 0, 0))
    for (let n = 1; n <= 7; n++) first.add(`k${n}`, `e${n}`)
    first.deliveredThrough(7)
    first.clear()
    const entry = first.add('presence', 'The human is away')
    expect(entry.seq).toBe(8)
    first.deliveredThrough(7)
    expect(first.entries).toEqual([entry])
    // A second inbox of the same run takes the next number, not 1.
    expect(new Inbox(next, () => at(9, 0, 0)).add('x', 'x').seq).toBe(9)
  })

  test('a mark moving keeps only the presence entry', () => {
    const box = inbox()
    box.add('presence', 'The human is away')
    box.add('turn:b', 'b ended its turn')
    box.clear({ keep: ['presence'] })
    expect(box.entries.map((x) => x.key)).toEqual(['presence'])
  })

  test('across midnight, and with the clock jumping back, the order is by sequence', () => {
    const box = inbox([at(23, 59, 59), at(0, 0, 1, 19), at(23, 0, 0)])
    box.add('a', 'before midnight')
    box.add('b', 'after midnight')
    box.add('c', 'the clock went back')
    expect(lines(box.text()).slice(1)).toEqual([
      '- 23:59:59 before midnight',
      '- 00:00:01 after midnight',
      '- 23:00:00 the clock went back',
    ])
  })
})

describe("the inbox's text", () => {
  test('30 entries of 120 characters → under the budget, the oldest given, the rest counted', () => {
    expect(INBOX_TEXT_MAX_BYTES).toBe(1500)
    const long = (n: number) => `${String(n).padStart(3, '0')} ${'x'.repeat(116)}`
    const entries = Array.from({ length: 30 }, (_, i) => ({
      seq: i + 1,
      at: at(10, 0, i),
      text: long(i + 1),
    }))
    const text = inboxText(entries, 0, INBOX_TEXT_MAX_BYTES)
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(INBOX_TEXT_MAX_BYTES)
    const given = lines(text).filter((x) => x.startsWith('- '))
    expect(given.length).toBeGreaterThan(0)
    expect(given[0]).toContain(long(1))
    expect(lines(text)[0]).toContain(`(events 1–${given.length})`)
    expect(lines(text).at(-1)).toBe(`${30 - given.length} more: call inbox.`)
  })

  test('an entry too long for the budget alone → no event named, all counted', () => {
    const text = inboxText([{ seq: 4, at: at(10, 0, 0), text: 'q'.repeat(2000) }], 0, 1500)
    expect(lines(text)[0]).not.toContain('(events')
    expect(lines(text).at(-1)).toBe('1 more: call inbox.')
  })

  // Decision 1.188: every prompt while the human is away carries it, so the orchestrator asks
  // whether they are back. The line names no events, so nothing is confirmed from it.
  const away = at(13, 5, 42)
  const AWAY_LINE =
    "The human is marked away since 13:05. If this prompt is the human's own, first ask whether " +
    'they are back; call human_back only if they say yes.'

  test('away and no entry → the away line alone, no inbox line', () => {
    const text = inboxText([], 0, INBOX_TEXT_MAX_BYTES, away)
    expect(text).toBe(AWAY_LINE)
    expect(text).not.toContain("Menkar's inbox (events")
  })

  test('away and two entries → the away line first, then the inbox named "(events 1–2)"', () => {
    const entries = [
      { seq: 1, at: at(14, 0, 0), text: 'a' },
      { seq: 2, at: at(14, 0, 1), text: 'b' },
    ]
    const text = inboxText(entries, 0, INBOX_TEXT_MAX_BYTES, away)
    expect(lines(text)[0]).toBe(AWAY_LINE)
    expect(lines(text)[1]).toContain("Menkar's inbox (events 1–2)")
    expect(lines(text).slice(2)).toEqual(['- 14:00:00 a', '- 14:00:01 b'])
  })

  test('away and entries over the budget → the away line whole, the events cut and counted', () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      seq: i + 1,
      at: at(10, 0, i),
      text: 'x'.repeat(120),
    }))
    const text = inboxText(entries, 0, INBOX_TEXT_MAX_BYTES, away)
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(INBOX_TEXT_MAX_BYTES)
    expect(lines(text)[0]).toBe(AWAY_LINE)
    const given = lines(text).filter((x) => x.startsWith('- '))
    expect(lines(text)[1]).toContain(`(events 1–${given.length})`)
    expect(lines(text).at(-1)).toBe(`${30 - given.length} more: call inbox.`)
  })

  test('not away → no away line, the inbox line first', () => {
    const entries = [{ seq: 1, at: at(14, 0, 0), text: 'a' }]
    const text = inboxText(entries, 0, INBOX_TEXT_MAX_BYTES, null)
    expect(lines(text)[0]).toMatch(/^Menkar's inbox \(events 1–1\)/)
    expect(text).not.toContain('marked away')
  })
})

// The statusline program runs under plain Node and imports this module: it may import nothing.
function importsOf(file: string): string[] {
  const path = join(import.meta.dirname, '../../../src/core', file)
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest)
  return source.statements.flatMap((s) =>
    (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) &&
    s.moduleSpecifier &&
    ts.isStringLiteral(s.moduleSpecifier)
      ? [s.moduleSpecifier.text]
      : [],
  )
}

describe("the statusline program's imports", () => {
  test('inbox-text imports nothing', () => {
    expect(importsOf('orchestration/inbox-text.ts')).toEqual([])
  })

  test("the statusline imports Node's modules and three of Menkar's, with .ts specifiers", () => {
    const imports = importsOf('context/statusline.ts')
    expect(imports.filter((x) => x.startsWith('node:')).length).toBeGreaterThan(0)
    expect(imports.filter((x) => !x.startsWith('node:')).sort()).toEqual([
      '../clock.ts',
      '../orchestration/inbox-text.ts',
      '../paths.ts',
    ])
  })
})
