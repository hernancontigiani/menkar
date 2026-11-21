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
  type JournalEvent,
  parseJournalLine,
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
      const newerLine = { ...discussed, id: 'n1', v: 2 }
      const path = batch([answered, '{"v":1,"id":"x', newerLine, '', waiting])
      expect(history.importActivity(path)).toEqual({ imported: 2, skipped: 1, newer: 1 })
      expect(rows('activity')).toHaveLength(1)
      expect(rows('task_states')).toHaveLength(1)
      expect(existsSync(path)).toBe(false)
      const kept = readdirSync(dir).filter((f) => f.startsWith('newer-'))
      expect(kept).toHaveLength(1)
      expect(readFileSync(join(dir, kept[0] ?? ''), 'utf8')).toContain('"v":2')
      expect(history.importActivityDir(dir)).toEqual({ imported: 0, skipped: 0, newer: 0 })
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
  ])('a line with %s does not parse', (_, line) => {
    expect(parseJournalLine(JSON.stringify(line))).toBe('bad')
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
