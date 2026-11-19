// `menkar usage now`: the burst in progress, read with the live journal (decision 1.185).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { addSink } from '../../../src/core/log'
import { type ActivityEvent, JOURNAL_FILE, readJournal } from '../../../src/core/usage/activity'
import { awayPeriods, humanActionsOf, readActivity } from '../../../src/core/usage/bursts'
import { UsageHistory } from '../../../src/core/usage/history'
import { NOW_SCHEMA, readNow, withJournal } from '../../../src/core/usage/now'
import { midnight } from '../../../src/core/usage/periods'
import { historyRows, usageDirs } from '../../factories/usage'

// Local time on 2026-11-19 (UTC−3); a day before is `hm(h, m, s, -1)`.
const hm = (hour: number, minute: number, second = 0, day = 0) =>
  new Date(2026, 10, 19 + day, hour, minute, second).getTime() / 1000
const TODAY = {
  start: midnight({ year: 2026, month: 11, day: 19 }),
  end: midnight({ year: 2026, month: 11, day: 20 }),
}

type Unstamped = Omit<ActivityEvent, 'v' | 'id'> & { id?: string }

function setup(name: string) {
  const dirs = usageDirs(name)
  const dir = join(dirs.root, 'data', 'activity')
  mkdirSync(dir, { recursive: true })
  const history = new UsageHistory(dirs.history)
  let n = 0
  const line = (e: Unstamped) => JSON.stringify({ v: 1, id: e.id ?? `f${n++}`, ...e })
  const write = (file: string, events: readonly (Unstamped | string)[]) =>
    writeFileSync(
      join(dir, file),
      events.map((e) => `${typeof e === 'string' ? e : line(e)}\n`).join(''),
    )
  const source = () => withJournal(history, readJournal(dir).events)
  const read = (now: number) => readActivity(source(), TODAY, now)
  const reading = (now: number) => readNow(source(), now, false)
  return { dir, history, rows: historyRows(history), write, read, reading }
}

function snapshot(dir: string) {
  return readdirSync(dir)
    .sort()
    .map((name) => {
      const path = join(dir, name)
      return { name, bytes: readFileSync(path).toString('base64'), mtime: statSync(path).mtimeMs }
    })
}

describe('reading the journal beside the history', () => {
  // `now` is polled every minute while the app appends and rotates: it only ever reads.
  test('USG-69 a reading leaves every file of the activity directory as it was', () => {
    const { dir, history, write, read } = setup('now-nowrite')
    write(JOURNAL_FILE, [{ at: hm(15, 0), kind: 'present' }])
    write('batch-20261119-150000-0a0b0c0d.jsonl', [{ at: hm(14, 50), kind: 'present' }])
    writeFileSync(join(dir, 'newer-20261118-090000-01020304.jsonl'), '{"v":2,"id":"z","at":1}\n')
    const before = snapshot(dir)
    expect(before).toHaveLength(3)
    const actions = humanActionsOf(read(hm(15, 1)))
    expect(actions.map((a) => a.at)).toEqual([hm(14, 50), hm(15, 0)])
    expect(snapshot(dir)).toEqual(before)
    history.close()
  })

  test('an event both in a file and in the history counts once', () => {
    const { history, rows, write, read } = setup('now-dup')
    rows.activity('same', hm(10, 0), 'present')
    write(JOURNAL_FILE, [{ id: 'same', at: hm(10, 0), kind: 'present' }])
    write('batch-20261119-100000-0a0b0c0d.jsonl', [{ id: 'same', at: hm(10, 0), kind: 'present' }])
    expect(humanActionsOf(read(hm(10, 5)))).toEqual([{ at: hm(10, 0), kind: 'present' }])
    history.close()
  })

  // A journal a quit left days ago can hold the away still open: the files' latest presence before
  // the range wins over an older one in the history.
  test("the files' away before the range joins the history's presence", () => {
    const { history, rows, write, read } = setup('now-away')
    rows.activity('b', hm(10, 0, 0, -4), 'back')
    write(JOURNAL_FILE, [{ at: hm(10, 0, 0, -3), kind: 'away' }])
    const now = hm(15, 0)
    expect(awayPeriods(read(now).presence, now)).toEqual([{ start: hm(10, 0, 0, -3), end: now }])
    history.close()
  })

  test('a torn last line, from an append in progress, is skipped without a word', () => {
    const { history, write, read } = setup('now-torn')
    const records: string[] = []
    const remove = addSink((record) => records.push(record))
    try {
      write(JOURNAL_FILE, [{ at: hm(10, 0), kind: 'present' }, '{"v":1,"id":"x","at":'])
      expect(humanActionsOf(read(hm(10, 1))).map((a) => a.at)).toEqual([hm(10, 0)])
      expect(records).toEqual([])
    } finally {
      remove()
      history.close()
    }
  })

  // A command-line prompt reaches the transcript exactly as a typed message.
  test("a prompted start read from the journal still drops its session's first turn", () => {
    const { history, rows, write, read } = setup('now-prompted')
    rows.turn('t1', 's1', 'human', hm(10, 0, 5))
    write(JOURNAL_FILE, [{ at: hm(10, 0), kind: 'prompted_start', sessionId: 's1' }])
    expect(humanActionsOf(read(hm(10, 5)))).toEqual([])
    history.close()
  })
})

// Journal lines of one kind at each time.
const each = (kind: ActivityEvent['kind'], times: readonly number[]): Unstamped[] =>
  times.map((at) => ({ at, kind }))
const every9 = (from: number, to: number) => {
  const times: number[] = []
  for (let at = from; at <= to; at += 540) times.push(at)
  return times
}

describe('the reading', () => {
  test('USG-70 the seeded reading prints exactly', () => {
    const { history, rows, write, reading } = setup('now-usg70')
    rows.turn('m1', 's1', 'human', hm(9, 0))
    rows.turn('m2', 's1', 'human', hm(10, 0))
    every9(hm(9, 9), hm(9, 59)).forEach((at, i) => {
      rows.activity(`p${i}`, at, 'present')
    })
    rows.turn('m3', 's1', 'human', hm(14, 30))
    rows.turn('m4', 's1', 'human', hm(14, 55))
    write(JOURNAL_FILE, [
      ...each(
        'present',
        [31, 40, 50, 60, 70, 80, 90, 100].map((m) => hm(14, m)),
      ),
      { at: hm(15, 35), kind: 'prompt_answered' },
      { at: hm(15, 38), kind: 'topic_discussed' },
    ])
    expect(hm(15, 42)).toBe(1795113720)
    expect(JSON.stringify(reading(hm(15, 42)), null, 2)).toBe(`{
  "schema": 1,
  "status": "ok",
  "now": "2026-11-19T15:42:00-03:00",
  "now_epoch": 1795113720,
  "menkar_running": false,
  "away": null,
  "last_action": {
    "at": "2026-11-19T15:40:00-03:00",
    "at_epoch": 1795113600
  },
  "burst": {
    "start": "2026-11-19T14:30:00-03:00",
    "start_epoch": 1795109400,
    "last_action": "2026-11-19T15:40:00-03:00",
    "last_action_epoch": 1795113600,
    "length_seconds": 4200,
    "messages": 2,
    "prompts": 1
  },
  "today": {
    "active_seconds": 7800,
    "messages": 4,
    "prompts": 1
  }
}`)
    history.close()
  })

  // While away there is no burst: an away ends one.
  test('USG-71 away now: no burst, and away since its start', () => {
    const { history, write, reading } = setup('now-usg71')
    write(JOURNAL_FILE, [
      ...each('present', [hm(14, 50), hm(14, 58)]),
      { at: hm(15, 0), kind: 'away' },
    ])
    const r = reading(hm(15, 42))
    expect(r.burst).toBeNull()
    expect(r.away?.since_epoch).toBe(hm(15, 0))
    expect(r.last_action?.at_epoch).toBe(hm(14, 58))
    history.close()
  })

  test('an away recorded this very second already ends the burst', () => {
    const { history, write, reading } = setup('now-awaynow')
    write(JOURNAL_FILE, [
      { at: hm(15, 42), kind: 'present' },
      { at: hm(15, 42), kind: 'away' },
    ])
    const r = reading(hm(15, 42))
    expect(r.away?.since_epoch).toBe(hm(15, 42))
    expect(r.burst).toBeNull()
    history.close()
  })

  test('back after away starts a new burst', () => {
    const { history, write, reading } = setup('now-back')
    write(JOURNAL_FILE, [
      ...each('present', [hm(14, 50), hm(14, 58)]),
      { at: hm(15, 0), kind: 'away' },
      { at: hm(15, 41), kind: 'back' },
      { at: hm(15, 41), kind: 'present' },
    ])
    const r = reading(hm(15, 42))
    expect(r.away).toBeNull()
    expect(r.burst).toMatchObject({ start_epoch: hm(15, 41), length_seconds: 0 })
    history.close()
  })

  // My choice beyond the plan's table: an away that started and ended within the gap still ended
  // the burst before it, as it does in `bursts`.
  test('an away come and gone since the last action leaves no burst in progress', () => {
    const { history, write, reading } = setup('now-awaygone')
    write(JOURNAL_FILE, [
      { at: hm(14, 58), kind: 'present' },
      { at: hm(15, 0), kind: 'away' },
      { at: hm(15, 5), kind: 'back' },
    ])
    const r = reading(hm(15, 6))
    expect(r.away).toBeNull()
    expect(r.burst).toBeNull()
    expect(r.last_action?.at_epoch).toBe(hm(14, 58))
    history.close()
  })

  // Whole in `burst`, its start yesterday; only its part since midnight counts today.
  test('USG-72 a burst crossing midnight is whole, and today counts its part', () => {
    const { history, write, reading } = setup('now-usg72')
    const times = [
      hm(23, 30),
      hm(23, 39),
      hm(23, 48),
      hm(23, 57),
      hm(0, 6, 0, 1),
      hm(0, 15, 0, 1),
      hm(0, 20, 0, 1),
    ]
    write(JOURNAL_FILE, each('present', times))
    const r = reading(hm(0, 25, 0, 1))
    expect(r.burst).toMatchObject({
      start_epoch: 1795141800,
      last_action_epoch: 1795144800,
      length_seconds: 3000,
    })
    expect(r.today?.active_seconds).toBe(1200)
    history.close()
  })

  // A burst is in progress until the gap that would end it has passed: the same ten minutes.
  test('past the gap the burst is over; at the gap exactly it is in progress', () => {
    const over = setup('now-gap-over')
    over.write(JOURNAL_FILE, [{ at: hm(15, 31, 59), kind: 'present' }])
    expect(over.reading(hm(15, 42)).burst).toBeNull()
    over.history.close()
    const going = setup('now-gap-going')
    going.write(JOURNAL_FILE, [{ at: hm(15, 32), kind: 'present' }])
    expect(going.reading(hm(15, 42)).burst).toMatchObject({ start_epoch: hm(15, 32) })
    going.history.close()
  })

  // Away is not kept across a quit, so a start ends only an away; it does not end a burst.
  test('a restart does not end a burst', () => {
    const { history, write, reading } = setup('now-restart')
    write(JOURNAL_FILE, [
      ...each('present', [...every9(hm(14, 30), hm(15, 30)), hm(15, 30)]),
      { at: hm(15, 33), kind: 'app_start' },
      { at: hm(15, 36), kind: 'present' },
    ])
    expect(reading(hm(15, 40)).burst).toMatchObject({
      start_epoch: hm(14, 30),
      last_action_epoch: hm(15, 36),
    })
    history.close()
  })

  test('a clock set back gives no negative field', () => {
    const { history, write, reading } = setup('now-clockback')
    write(JOURNAL_FILE, each('present', [hm(15, 38), hm(15, 44)]))
    const r = reading(hm(15, 42))
    expect(r.burst).toMatchObject({ start_epoch: hm(15, 38), last_action_epoch: hm(15, 44) })
    expect(r.burst?.length_seconds).toBeGreaterThanOrEqual(0)
    expect(r.today?.active_seconds).toBeGreaterThanOrEqual(0)
    history.close()
  })

  test("the keys are exactly the schema's", () => {
    const { history, write, reading } = setup('now-keys')
    write(JOURNAL_FILE, [{ at: hm(15, 40), kind: 'present' }])
    const r = reading(hm(15, 42))
    expect(NOW_SCHEMA).toBe(1)
    expect(Object.keys(r)).toEqual([
      'schema',
      'status',
      'now',
      'now_epoch',
      'menkar_running',
      'away',
      'last_action',
      'burst',
      'today',
    ])
    expect(Object.keys(r.burst ?? {})).toEqual([
      'start',
      'start_epoch',
      'last_action',
      'last_action_epoch',
      'length_seconds',
      'messages',
      'prompts',
    ])
    expect(Object.keys(r.last_action ?? {})).toEqual(['at', 'at_epoch'])
    expect(Object.keys(r.today ?? {})).toEqual(['active_seconds', 'messages', 'prompts'])
    write(JOURNAL_FILE, [{ at: hm(15, 41), kind: 'away' }])
    expect(Object.keys(reading(hm(15, 42)).away ?? {})).toEqual(['since', 'since_epoch'])
    history.close()
  })
})
