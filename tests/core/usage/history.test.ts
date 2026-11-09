// The usage history file's rules and the passes (docs/spec/usage.md, USG-31 to USG-38).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { openDb } from '../../../src/core/db'
import { addSink } from '../../../src/core/log'
import { UsageCache } from '../../../src/core/usage/cache'
import { HISTORY_VERSION, UsageHistory } from '../../../src/core/usage/history'
import { runPass } from '../../../src/core/usage/pass'
import { midnight } from '../../../src/core/usage/periods'
import { buildReport, totalExecution } from '../../../src/core/usage/report'
import { PassRunner } from '../../../src/core/usage/runner'
import { memberships, prompt, response, usageDirs } from '../../factories/usage'

const NOV_8 = {
  start: midnight({ year: 2026, month: 11, day: 8 }),
  end: midnight({ year: 2026, month: 11, day: 9 }),
}

type Dirs = ReturnType<typeof usageDirs>

const pass = (dirs: Dirs) =>
  runPass(memberships(), {
    claudeProjects: dirs.claudeProjects,
    cache: dirs.cache,
    history: dirs.history,
  })

function totals(dirs: Dirs) {
  const history = new UsageHistory(dirs.history)
  try {
    const report = buildReport(history, NOV_8, { statuslineLogs: [] })
    return report.nodes.map((p) => ({
      label: p.label,
      execution: totalExecution(p),
      output: p.tokens.output,
      tooNew: report.tooNew,
    }))
  } finally {
    history.close()
  }
}

function dump(path: string): unknown {
  const db = openDb(path)
  try {
    return ['turns', 'spans', 'tokens', 'names'].map((table) =>
      db.raw.prepare(`SELECT * FROM ${table} ORDER BY 1, 2, 3`).all(),
    )
  } finally {
    db.close()
  }
}

const fingerprint = (path: string) => ({
  sha: createHash('sha256').update(readFileSync(path)).digest('hex'),
  mtime: statSync(path).mtimeMs,
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('the history file', () => {
  test('USG-31 a deleted transcript leaves its turns in the history, untouched by later passes', () => {
    const dirs = usageDirs('usg31')
    const path = dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:30', { tokens: { output: 9 } }),
    ])
    pass(dirs)
    const before = dump(dirs.history)
    rmSync(path)
    pass(dirs)
    expect(dump(dirs.history)).toEqual(before)
    expect(totals(dirs)).toEqual([
      { label: '(no project)', execution: 30, output: 9, tooNew: false },
    ])
  })

  test('USG-32 a history locked past the timeout loses nothing: the turns stay pending', () => {
    const dirs = usageDirs('usg32')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30', { tokens: { output: 9 } })])
    new UsageHistory(dirs.history).close()
    const holder = openDb(dirs.history)
    holder.raw.exec('BEGIN IMMEDIATE')
    const cache = new UsageCache(dirs.cache)
    try {
      cache.ingest(dirs.claudeProjects)
      const history = new UsageHistory(dirs.history, 50)
      try {
        expect(() => history.write(cache, memberships())).toThrow()
      } finally {
        history.close()
      }
      expect(cache.pending().length).toBeGreaterThan(0)
    } finally {
      holder.raw.exec('ROLLBACK')
      holder.close()
      cache.close()
    }
    pass(dirs)
    const unlocked = usageDirs('usg32-unlocked')
    unlocked.transcript('s1', [prompt('10:00:00'), response('10:00:30', { tokens: { output: 9 } })])
    pass(unlocked)
    expect(totals(dirs)).toEqual(totals(unlocked))
    expect(totals(dirs)[0]?.output).toBe(9)
  })

  test('USG-33 a history from a newer Menkar is left as it is, and passes keep their turns pending', () => {
    const dirs = usageDirs('usg33')
    const db = openDb(dirs.history)
    db.setUserVersion(99)
    db.close()
    const before = fingerprint(dirs.history)
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30')])
    pass(dirs)
    const history = new UsageHistory(dirs.history)
    expect(history.tooNew).toBe(true)
    const report = buildReport(history, NOV_8, { statuslineLogs: [] })
    expect(report).toMatchObject({ tooNew: true, nodes: [] })
    history.close()
    expect(fingerprint(dirs.history)).toEqual(before)
    const cache = new UsageCache(dirs.cache)
    expect(cache.pending().some((row) => row.turn === 'u-10:00:00')).toBe(true)
    cache.close()
  })

  test('USG-34 an unreadable history is moved aside with the time, never deleted', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 8, 14, 15, 0))
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const records: string[] = []
    const remove = addSink((line) => records.push(line))
    const dirs = usageDirs('usg34')
    try {
      const garbage = Buffer.from('this is not a database at all, just bytes '.repeat(200))
      mkdirSync(dirname(dirs.history), { recursive: true })
      writeFileSync(dirs.history, garbage)
      new UsageHistory(dirs.history).close()
      const aside = `${dirs.history}.broken-20261108-141500`
      expect(readFileSync(aside)).toEqual(garbage)
      expect(records.some((r) => r.includes('moved aside') && r.includes(aside))).toBe(true)
      writeFileSync(dirs.history, garbage)
      new UsageHistory(dirs.history).close()
      expect(existsSync(`${aside}-2`)).toBe(true)
      expect(dump(dirs.history)).toEqual([[], [], [], []])
    } finally {
      remove()
    }
  })

  test('USG-35 a history at an older version is migrated in place, every row kept', () => {
    const dirs = usageDirs('usg35')
    const db = openDb(dirs.history)
    db.raw.exec(`
      CREATE TABLE turns (uuid TEXT PRIMARY KEY, session_id TEXT NOT NULL, origin TEXT NOT NULL,
        opened REAL NOT NULL, project_id TEXT, project_name TEXT);
      CREATE TABLE spans (uuid TEXT NOT NULL, kind TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL);
      CREATE TABLE tokens (uuid TEXT NOT NULL, model TEXT NOT NULL, hour REAL NOT NULL,
        input INTEGER NOT NULL, output INTEGER NOT NULL, cache_write INTEGER NOT NULL,
        cache_write_1h INTEGER NOT NULL, cache_read INTEGER NOT NULL, PRIMARY KEY (uuid, model, hour));
      CREATE TABLE names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL, claude INTEGER NOT NULL);
    `)
    const opened = NOV_8.start + 36_000
    db.raw.prepare("INSERT INTO turns VALUES ('t1', 's1', 'human', ?, 'p', 'P')").run(opened)
    db.raw.prepare("INSERT INTO spans VALUES ('t1', 'execution', ?, ?)").run(opened, opened + 60)
    db.setUserVersion(1)
    db.close()
    const history = new UsageHistory(dirs.history)
    expect(history.handle?.userVersion()).toBe(HISTORY_VERSION)
    expect(history.handle?.raw.prepare('SELECT * FROM turns').all()).toEqual([
      {
        uuid: 't1',
        session_id: 's1',
        origin: 'human',
        opened,
        project_id: 'p',
        project_name: 'P',
        category: null,
        category_tries: 0,
      },
    ])
    expect(buildReport(history, NOV_8, { statuslineLogs: [] }).nodes[0]?.label).toBe('P')
    history.close()
  })

  test('USG-36 passes over unchanged transcripts change nothing; a rewritten file is read once', () => {
    const dirs = usageDirs('usg36')
    const lines = [prompt('10:00:00'), response('10:00:30', { tokens: { output: 9 } })]
    const path = dirs.transcript('s1', lines)
    pass(dirs)
    const once = totals(dirs)
    pass(dirs)
    expect(totals(dirs)).toEqual(once)
    const rewritten = join(dirs.root, 'rewritten.jsonl')
    writeFileSync(rewritten, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
    renameSync(rewritten, path)
    pass(dirs)
    expect(totals(dirs)).toEqual(once)
  })

  test('USG-36 a transcript rewritten under a new inode is read again from its start', () => {
    const dirs = usageDirs('usg36-inode')
    const path = dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30')])
    pass(dirs)
    const rewritten = join(dirs.root, 'rewritten.jsonl')
    const lines = [prompt('11:00:00'), response('11:00:10', { tokens: { output: 5 } })]
    writeFileSync(
      rewritten,
      `${lines.map((l) => JSON.stringify(l)).join('\n')}\n${' '.repeat(400)}\n`,
    )
    renameSync(rewritten, path)
    pass(dirs)
    const db = openDb(dirs.history)
    expect(db.raw.prepare("SELECT uuid FROM turns WHERE uuid = 'u-11:00:00'").all()).toHaveLength(1)
    db.close()
  })

  test('a pending turn the cache no longer has is never touched in the history', () => {
    const dirs = usageDirs('usg31-pending')
    const path = dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30')])
    pass(dirs)
    const before = dump(dirs.history)
    dirs.append(path, [response('10:01:00')])
    const holder = openDb(dirs.history)
    holder.raw.exec('BEGIN IMMEDIATE')
    const cache = new UsageCache(dirs.cache)
    try {
      cache.ingest(dirs.claudeProjects)
      const history = new UsageHistory(dirs.history, 50)
      expect(() => history.write(cache, memberships())).toThrow()
      history.close()
    } finally {
      holder.raw.exec('ROLLBACK')
      holder.close()
      cache.close()
    }
    const rewritten = join(dirs.root, 'rewritten.jsonl')
    writeFileSync(rewritten, `${JSON.stringify({ ...prompt('11:00:00'), sessionId: 's1' })}\n`)
    renameSync(rewritten, path)
    pass(dirs)
    const [turns] = dump(dirs.history) as unknown[][]
    expect(turns).toContainEqual((before as unknown[][])[0]?.[0])
  })

  test('USG-37 the cache reads up to the last complete line only', () => {
    const dirs = usageDirs('usg37-offset')
    const first = `${JSON.stringify(prompt('10:00:00'))}\n`
    const path = dirs.transcript('s1', [prompt('10:00:00')])
    writeFileSync(path, '{"type":"assistant"', { flag: 'a' })
    pass(dirs)
    const cache = new UsageCache(dirs.cache)
    const row = cache.db.raw.prepare('SELECT offset FROM files').get()
    cache.close()
    expect(row?.offset).toBe(Buffer.byteLength(first))
  })

  test('USG-37 a last line without its newline waits, then is read once', () => {
    const dirs = usageDirs('usg37')
    const path = dirs.transcript('s1', [prompt('10:00:00')])
    const half = JSON.stringify(response('10:00:30', { tokens: { output: 9 } }))
    writeFileSync(path, half.slice(0, 20), { flag: 'a' })
    pass(dirs)
    expect(totals(dirs)).toEqual([])
    writeFileSync(path, `${half.slice(20)}\n`, { flag: 'a' })
    pass(dirs)
    pass(dirs)
    expect(totals(dirs)).toEqual([
      { label: '(no project)', execution: 30, output: 9, tooNew: false },
    ])
  })
})

describe('the passes', () => {
  test('USG-38 a pass requested while one runs waits for it instead of starting another', async () => {
    let started = 0
    let finish = () => {}
    const runner = new PassRunner(() => {
      started += 1
      return new Promise<void>((resolve) => {
        finish = resolve
      })
    })
    const hourly = runner.request()
    const window = runner.request()
    expect(started).toBe(1)
    finish()
    await Promise.all([hourly, window])
    const next = runner.request()
    expect(started).toBe(2)
    finish()
    await next
  })

  test('a failed pass is logged and the next request runs a new one', async () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const records: string[] = []
    const remove = addSink((line) => records.push(line))
    try {
      let calls = 0
      const runner = new PassRunner(async () => {
        calls += 1
        if (calls === 1) throw new Error('disk full')
      })
      await runner.request()
      expect(records.some((r) => r.includes('usage pass failed'))).toBe(true)
      await runner.request()
      expect(calls).toBe(2)
    } finally {
      remove()
    }
  })
})

// Decision 1.26: Haiku 5.5's long-prompt row is decided per request. A history written before
// that kept one summed row per (turn, model, hour); this puts a fresh history back in that shape.
function asVersion2(path: string): void {
  const db = openDb(path)
  try {
    db.transaction(() => {
      db.raw.exec(`
        CREATE TABLE grouped AS SELECT uuid, replace(model, '@long', '') AS model, hour,
          SUM(input) AS input, SUM(output) AS output, SUM(cache_write) AS cache_write,
          SUM(cache_write_1h) AS cache_write_1h, SUM(cache_read) AS cache_read
          FROM tokens GROUP BY uuid, replace(model, '@long', ''), hour;
        DELETE FROM tokens;
        INSERT INTO tokens SELECT * FROM grouped;
        DROP TABLE grouped;
        DROP TABLE rederive;
      `)
      db.setUserVersion(2)
    })
  } finally {
    db.close()
  }
}

const tokenRows = (path: string, uuid: string) => {
  const db = openDb(path)
  try {
    return db.raw.prepare('SELECT model, input FROM tokens WHERE uuid = ? ORDER BY model').all(uuid)
  } finally {
    db.close()
  }
}

const haikuTurn = (time: string, long: number, short: number) => [
  prompt(time),
  response(time.replace(/:00$/, ':10'), {
    id: `msg_l_${time}`,
    model: 'claude-haiku-5-5',
    tokens: { input: long },
  }),
  response(time.replace(/:00$/, ':20'), {
    id: `msg_s_${time}`,
    model: 'claude-haiku-5-5',
    tokens: { input: short },
  }),
]

describe('re-deriving the history per request (decision 1.26)', () => {
  test('a turn with its transcript is re-derived, one without or changed since is left, and twice is once', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    vi.stubEnv('MENKAR_LOG', 'info')
    const records: string[] = []
    const remove = addSink((line) => records.push(line))
    try {
      const dirs = usageDirs('rederive')
      dirs.transcript('kept', haikuTurn('10:00:00', 120_000, 10_000))
      dirs.transcript('changed', haikuTurn('12:00:00', 140_000, 30_000))
      pass(dirs)
      const db = openDb(dirs.history)
      db.raw.prepare("UPDATE turns SET category = 'build' WHERE uuid = 'u-10:00:00'").run()
      db.close()
      asVersion2(dirs.history)
      const old = openDb(dirs.history)
      // as if one of its files had been deleted since: what the cache has no longer adds up
      old.raw.prepare("UPDATE tokens SET input = input + 1 WHERE uuid = 'u-12:00:00'").run()
      // a turn no transcript has, as agent-tablet's imported ones
      const hour = NOV_8.start + 11 * 3600
      old.raw
        .prepare("INSERT INTO turns VALUES ('u-11:00:00', 'gone', 'human', ?, NULL, NULL, NULL, 0)")
        .run(hour)
      old.raw
        .prepare(
          "INSERT INTO tokens VALUES ('u-11:00:00', 'claude-haiku-5-5', ?, 150000, 0, 0, 0, 0)",
        )
        .run(hour)
      old.close()
      pass(dirs)
      expect(tokenRows(dirs.history, 'u-10:00:00')).toEqual([
        { model: 'claude-haiku-5-5', input: 10_000 },
        { model: 'claude-haiku-5-5@long', input: 120_000 },
      ])
      expect(tokenRows(dirs.history, 'u-11:00:00')).toEqual([
        { model: 'claude-haiku-5-5', input: 150_000 },
      ])
      expect(tokenRows(dirs.history, 'u-12:00:00')).toEqual([
        { model: 'claude-haiku-5-5', input: 170_001 },
      ])
      const history = new UsageHistory(dirs.history)
      expect(history.handle?.userVersion()).toBe(HISTORY_VERSION)
      expect(
        history.handle?.raw.prepare("SELECT category FROM turns WHERE uuid = 'u-10:00:00'").get(),
      ).toEqual({ category: 'build' })
      history.close()
      const line = records.filter((r) => r.includes('re-derived'))
      expect(line).toHaveLength(1)
      expect(line[0]).toContain('rederived=1')
      expect(line[0]).toContain('groupPriced=2')
      const after = dump(dirs.history)
      pass(dirs)
      expect(dump(dirs.history)).toEqual(after)
      expect(records.filter((r) => r.includes('re-derived'))).toHaveLength(1)
    } finally {
      remove()
    }
  })

  test("a category written between a turn's read and its re-derivation survives, and so do its tokens", () => {
    const dirs = usageDirs('rederive-race')
    dirs.transcript('s1', haikuTurn('10:00:00', 120_000, 10_000))
    pass(dirs)
    asVersion2(dirs.history)
    const history = new UsageHistory(dirs.history)
    const classifier = new UsageHistory(dirs.history)
    const cache = new UsageCache(dirs.cache)
    try {
      history.rederive({
        turnUsage(sessionId: string, uuid: string) {
          classifier.setCategories(new Map([[uuid, 'debug']]))
          classifier.countTry([uuid])
          return cache.turnUsage(sessionId, uuid)
        },
      })
    } finally {
      cache.close()
      classifier.close()
      history.close()
    }
    expect(tokenRows(dirs.history, 'u-10:00:00')).toEqual([
      { model: 'claude-haiku-5-5', input: 10_000 },
      { model: 'claude-haiku-5-5@long', input: 120_000 },
    ])
    const db = openDb(dirs.history)
    expect(
      db.raw.prepare("SELECT category, category_tries FROM turns WHERE uuid = 'u-10:00:00'").get(),
    ).toEqual({ category: 'debug', category_tries: 1 })
    db.close()
  })
})
