// The human's activity and the task flow: the journal's batches imported into the usage history.
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { openDb } from '../../../src/core/db'
import { addSink } from '../../../src/core/log'
import { appDirs } from '../../../src/core/paths'
import {
  activityDir,
  batchPath,
  JOURNAL_VERSION,
  type JournalEvent,
  parseJournalLine,
  quitLine,
  readJournal,
} from '../../../src/core/usage/activity'
import { HISTORY_VERSION, UsageHistory } from '../../../src/core/usage/history'
import { usageDirs } from '../../factories/usage'

const AT = new Date(2026, 10, 18, 10, 0, 0).getTime() / 1000

const answered: JournalEvent = {
  v: 1,
  id: 'a1',
  at: AT,
  kind: 'prompt_answered',
  projectId: 'p1',
  sessionId: 's1',
  next: 'working',
  blockedSeconds: 12.5,
}
const discussed: JournalEvent = { v: 1, id: 'a2', at: AT + 1, kind: 'topic_discussed', topic: 4 }
const waiting: JournalEvent = {
  v: 1,
  id: 'a3',
  at: AT + 2,
  kind: 'task_state',
  projectId: 'p1',
  task: 3,
  state: 'waiting',
  waitKind: 'topic',
  waitRef: '4',
  assignee: 's2',
}

const paneIdle: JournalEvent = {
  v: 2,
  id: 'p1',
  at: AT + 3,
  kind: 'pane_state',
  paneId: 'A',
  seq: 1,
  state: 'idle',
}
const tick: JournalEvent = { v: 2, id: 'w1', at: AT + 4, kind: 'watch', sign: 'tick' }

const jsonl = (lines: readonly (JournalEvent | string | object)[]) =>
  `${lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n')}\n`

function setup(name: string) {
  const dirs = usageDirs(name)
  const dir = join(dirs.root, 'activity')
  mkdirSync(dir, { recursive: true })
  const history = new UsageHistory(dirs.history)
  const batch = (lines: readonly (JournalEvent | string | object)[], ms = AT * 1000) => {
    const path = batchPath(dir, ms)
    writeFileSync(path, jsonl(lines))
    return path
  }
  const rows = (table: 'activity' | 'task_states') =>
    history.handle?.raw.prepare(`SELECT * FROM ${table} ORDER BY at`).all()
  return { dirs, dir, history, batch, rows }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('importing the activity journal', () => {
  test('each event lands in its table, with no field it did not carry', () => {
    const { history, batch, rows } = setup('act-rows')
    history.importActivity(batch([answered, discussed, waiting]))
    expect(rows('activity')).toEqual([
      {
        id: 'a1',
        at: AT,
        kind: 'prompt_answered',
        project_id: 'p1',
        session_id: 's1',
        topic: null,
        task: null,
        next: 'working',
        blocked_seconds: 12.5,
      },
      {
        id: 'a2',
        at: AT + 1,
        kind: 'topic_discussed',
        project_id: null,
        session_id: null,
        topic: 4,
        task: null,
        next: null,
        blocked_seconds: null,
      },
    ])
    expect(rows('task_states')).toEqual([
      {
        id: 'a3',
        at: AT + 2,
        project_id: 'p1',
        task: 3,
        state: 'waiting',
        wait_kind: 'topic',
        wait_ref: '4',
        assignee: 's2',
        baseline: 0,
      },
    ])
    history.close()
  })

  // An import twice is an import once: a batch retried, or read by two importers, adds no row.
  test('a batch imported twice gives its rows once, and the file is gone', () => {
    const { history, batch, rows } = setup('act-twice')
    const path = batch([answered, discussed, waiting])
    expect(history.importActivity(path)).toEqual({ imported: 3, skipped: 0, newer: 0 })
    expect(existsSync(path)).toBe(false)
    const again = batch([answered, discussed, waiting])
    expect(history.importActivity(again)).toEqual({ imported: 0, skipped: 0, newer: 0 })
    expect([...(rows('activity') ?? []), ...(rows('task_states') ?? [])]).toHaveLength(3)
    history.close()
  })

  // A line that does not parse is dropped; a line a newer Menkar wrote is never destroyed: its
  // file is kept, out of the importer's way, for the Menkar that knows it.
  test('a broken line is skipped, and a batch holding a newer line is kept as newer-*', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const records: string[] = []
    const remove = addSink((line) => records.push(line))
    try {
      const { dir, history, batch, rows } = setup('act-bad')
      const newerLine = { ...discussed, id: 'n1', v: 3 }
      const path = batch([answered, '{"v":1,"id":"x', newerLine, '', waiting])
      expect(history.importActivity(path)).toEqual({ imported: 2, skipped: 1, newer: 1 })
      expect(rows('activity')).toHaveLength(1)
      expect(rows('task_states')).toHaveLength(1)
      expect(existsSync(path)).toBe(false)
      const kept = readdirSync(dir).filter((f) => f.startsWith('newer-'))
      expect(kept).toHaveLength(1)
      expect(readFileSync(join(dir, kept[0] ?? ''), 'utf8')).toContain('"v":3')
      expect(history.importActivityDir(dir)).toEqual({ imported: 0, skipped: 1, newer: 1 })
      expect(readdirSync(dir).filter((f) => f.startsWith('newer-'))).toHaveLength(1)
      expect(records.join('\n')).toContain('skipped')

      const onlyBroken = batch(['not json'], AT * 1000 + 1)
      history.importActivity(onlyBroken)
      expect(existsSync(onlyBroken)).toBe(false)
      history.close()
    } finally {
      remove()
    }
  })

  test.each([
    ['an unknown kind', { ...discussed, kind: 'typed_text' }],
    ['no id', { ...discussed, id: '' }],
    ['no time', { ...discussed, at: 'soon' }],
    ['no version', { ...discussed, v: undefined }],
    ['a task row with no task', { ...waiting, task: undefined }],
    ['a task row with no project', { ...waiting, projectId: undefined }],
    ['version 0', { ...discussed, v: 0 }],
    ['a pane row with no pane', { ...paneIdle, paneId: undefined }],
    ['a pane row with no sequence', { ...paneIdle, seq: undefined }],
    ['a pane row with a fractional sequence', { ...paneIdle, seq: 1.5 }],
    ['a pane row with an unknown state', { ...paneIdle, state: 'thinking' }],
    ['a watch row with an unknown sign', { ...tick, sign: 'heartbeat' }],
  ])('a line with %s does not parse', (_, line) => {
    expect(parseJournalLine(JSON.stringify(line))).toBe('bad')
  })

  test.each([
    ['an old kind at version 1', discussed],
    ['an old kind at version 2', { ...discussed, v: 2 }],
    ['a task row at version 2', { ...waiting, v: 2 }],
    ['a pane row', paneIdle],
    ['a pane row closing', { ...paneIdle, state: 'closed' }],
    ['a watch row', tick],
  ])('%s parses as itself', (_, line) => {
    expect(parseJournalLine(JSON.stringify(line))).toEqual(line)
  })

  test('a line of a later journal version is newer, whatever its kind', () => {
    expect(parseJournalLine(JSON.stringify({ ...discussed, v: JOURNAL_VERSION + 1 }))).toBe('newer')
    expect(parseJournalLine(JSON.stringify({ ...paneIdle, v: JOURNAL_VERSION + 1 }))).toBe('newer')
  })

  test('pane rows and watch signs land in their own tables', () => {
    const { history, batch } = setup('act-panes')
    history.importActivity(batch([paneIdle, tick, answered]))
    const raw = history.handle?.raw
    expect(raw?.prepare('SELECT * FROM pane_states').all()).toEqual([
      { id: 'p1', at: AT + 3, seq: 1, pane_id: 'A', state: 'idle' },
    ])
    expect(raw?.prepare('SELECT * FROM watch_signs').all()).toEqual([
      { id: 'w1', at: AT + 4, sign: 'tick' },
    ])
    expect(raw?.prepare('SELECT count(*) AS n FROM activity').get()?.n).toBe(1)
    history.close()
  })

  // USG-75: a batch an older Menkar kept as newer-* because it held this one's lines is imported
  // by this one, and deleted once nothing in it is newer than the reader; a line newer still keeps
  // it, under the same name.
  test('USG-75 the journal reads versions 1 and 2, and a newer-* batch is read again', () => {
    const { dir, history, rows } = setup('act-usg75')
    const present = { v: 1, id: 'o1', at: AT, kind: 'present' }
    const pane = { ...paneIdle, v: 2 }
    const kept = join(dir, 'newer-20261118-100000-01020304.jsonl')
    writeFileSync(kept, jsonl([present, pane]))
    expect(history.importActivityDir(dir)).toEqual({ imported: 2, skipped: 0, newer: 0 })
    expect(rows('activity')).toHaveLength(1)
    expect(history.handle?.raw.prepare('SELECT count(*) AS n FROM pane_states').get()?.n).toBe(1)
    expect(existsSync(kept)).toBe(false)
    writeFileSync(kept, jsonl([present, pane]))
    expect(history.importActivityDir(dir)).toEqual({ imported: 0, skipped: 0, newer: 0 })
    expect(existsSync(kept)).toBe(false)
    const future = { ...tick, id: 'w9', v: 3 }
    writeFileSync(kept, jsonl([present, future]))
    expect(history.importActivityDir(dir)).toEqual({ imported: 0, skipped: 0, newer: 1 })
    expect(readdirSync(dir)).toEqual(['newer-20261118-100000-01020304.jsonl'])
    history.close()
  })

  test('the live journal and every batch, newer-* too, are read in place by kind', () => {
    const { dir, batch } = setup('act-read')
    writeFileSync(join(dir, 'journal.jsonl'), jsonl([discussed, paneIdle]))
    batch([tick, waiting])
    writeFileSync(join(dir, 'newer-20261118-100000-01020304.jsonl'), jsonl([answered]))
    const read = readJournal(dir)
    expect([...read.events.keys()].sort()).toEqual(['a1', 'a2'])
    expect([...read.panes.values()]).toEqual([paneIdle])
    expect([...read.signs.values()]).toEqual([tick])
  })

  // USG-87: the quit's line is written synchronously at the last moment; it must be a whole line
  // any reader takes as the quit sign at its time.
  test('USG-87 the quit line is whole and reads as the quit sign at its time', () => {
    const line = quitLine(AT + 7)
    expect(line.endsWith('\n')).toBe(true)
    expect(line.indexOf('\n')).toBe(line.length - 1)
    const parsed = parseJournalLine(line)
    expect(parsed).toMatchObject({ v: JOURNAL_VERSION, kind: 'watch', sign: 'quit', at: AT + 7 })
    expect(parsed === 'bad' || parsed === 'newer' ? '' : parsed.id).not.toBe('')
  })

  // The history's own rule: a file from a newer Menkar is not written, and nothing is lost.
  test('a newer history is left untouched and the batch kept', () => {
    const dirs = usageDirs('act-too-new')
    const db = openDb(dirs.history)
    db.setUserVersion(HISTORY_VERSION + 1)
    db.close()
    const before = statSync(dirs.history).mtimeMs
    const historyBytes = readFileSync(dirs.history)
    mkdirSync(join(dirs.root, 'activity'))
    const path = batchPath(join(dirs.root, 'activity'), AT * 1000)
    writeFileSync(path, jsonl([answered, waiting]))
    const history = new UsageHistory(dirs.history)
    expect(history.tooNew).toBe(true)
    expect(history.importActivity(path)).toBeNull()
    expect(history.importActivityDir(join(dirs.root, 'activity'))).toBeNull()
    history.close()
    expect(readFileSync(path, 'utf8')).toBe(jsonl([answered, waiting]))
    expect(readFileSync(dirs.history)).toEqual(historyBytes)
    expect(statSync(dirs.history).mtimeMs).toBe(before)
  })

  // Two importers on one batch: the second finds it gone, which is not an error.
  test('a batch another importer already took is no error', () => {
    const { dir, history } = setup('act-gone')
    expect(history.importActivity(join(dir, 'batch-gone.jsonl'))).toEqual({
      imported: 0,
      skipped: 0,
      newer: 0,
    })
    history.close()
  })

  // A rename replaces its target silently: two batches made in the same second (the clock set
  // back, a repeated daylight-saving hour) must not share a name.
  test('two batches of the same second get two names, and both are imported', () => {
    const { dir, history, batch, rows } = setup('act-names')
    const first = batch([answered])
    const second = batch([discussed])
    expect(first).not.toBe(second)
    expect(
      readdirSync(dir).filter((f) => /^batch-20261118-100000-.+\.jsonl$/.test(f)),
    ).toHaveLength(2)
    expect(history.importActivityDir(dir)).toEqual({ imported: 2, skipped: 0, newer: 0 })
    expect(rows('activity')).toHaveLength(2)
    expect(readdirSync(dir)).toEqual([])
    history.close()
  })

  test('the journal lives in the data directory', () => {
    expect(activityDir()).toBe(join(appDirs().data, 'activity'))
  })
})
