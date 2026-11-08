// The first start's import of agent-tablet's usage history and statusline log, read only
// (docs/spec/usage.md, USG-61 to USG-69; decisions 1.8 and 1.10).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { openDb } from '../../../src/core/db'
import { addSink } from '../../../src/core/log'
import type { UsageHistory } from '../../../src/core/usage/history'
import { type ImportSources, openHistory } from '../../../src/core/usage/importer'
import { runPass } from '../../../src/core/usage/pass'
import { memberships, prompt, response, usageDirs } from '../../factories/usage'

const OPENED = new Date(2026, 9, 15, 10).getTime() / 1000

function agentTablet(
  root: string,
  version: 1 | 2 | 3,
  counts = { turns: 3, spans: 4, tokens: 5, names: 2 },
) {
  const sources: ImportSources = {
    history: join(root, 'agent-tablet', 'data', 'history.sqlite'),
    statuslineLog: join(root, 'agent-tablet', 'cache', 'usage.jsonl'),
  }
  mkdirSync(dirname(sources.statuslineLog), { recursive: true })
  const db = openDb(sources.history)
  const category = version === 1 ? '' : ', category TEXT, category_tries INTEGER NOT NULL DEFAULT 0'
  db.raw.exec(`
    CREATE TABLE turns (uuid TEXT PRIMARY KEY, session_id TEXT NOT NULL, origin TEXT NOT NULL,
      opened REAL NOT NULL, project_id TEXT, project_name TEXT${category});
    CREATE TABLE spans (uuid TEXT NOT NULL, kind TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL);
    CREATE TABLE tokens (uuid TEXT NOT NULL, model TEXT NOT NULL, hour REAL NOT NULL,
      input INTEGER NOT NULL, output INTEGER NOT NULL, cache_write INTEGER NOT NULL,
      cache_write_1h INTEGER NOT NULL, cache_read INTEGER NOT NULL, PRIMARY KEY (uuid, model, hour));
    CREATE TABLE names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL, claude INTEGER NOT NULL);
  `)
  db.raw.exec('BEGIN')
  for (let i = 0; i < counts.turns; i += 1) {
    const values = [`t${i}`, `s${i % 2}`, 'human', OPENED + i * 60, 'proj-x', 'Client work']
    if (version === 1) db.raw.prepare('INSERT INTO turns VALUES (?, ?, ?, ?, ?, ?)').run(...values)
    else
      db.raw
        .prepare('INSERT INTO turns VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(...values, i === 0 ? 'build' : null, i)
  }
  for (let i = 0; i < counts.spans; i += 1) {
    db.raw
      .prepare("INSERT INTO spans VALUES (?, 'execution', ?, ?)")
      .run(`t${i % counts.turns}`, OPENED + i, OPENED + i + 30)
  }
  for (let i = 0; i < counts.tokens; i += 1) {
    db.raw
      .prepare('INSERT INTO tokens VALUES (?, ?, ?, 1, 2, 3, 1, 4)')
      .run(`t${i % counts.turns}`, `model-${i}`, Math.floor(OPENED / 3600) * 3600)
  }
  for (let i = 0; i < counts.names; i += 1) {
    db.raw.prepare('INSERT INTO names VALUES (?, ?, 1)').run(`s${i}`, `name ${i}`)
  }
  db.raw.exec('COMMIT')
  db.setUserVersion(version)
  db.close()
  writeFileSync(
    sources.statuslineLog,
    `${JSON.stringify({ at: '2026-10-15T13:00:00Z', session_id: 's0', cost_usd: 1.5 })}\n`,
  )
  return sources
}

const fingerprint = (path: string) => ({
  sha: createHash('sha256').update(readFileSync(path)).digest('hex'),
  mtime: statSync(path).mtimeMs,
  beside: readdirSync(dirname(path)).sort(),
})

function rows(path: string, table: string) {
  const db = openDb(path)
  try {
    return db.raw.prepare(`SELECT * FROM ${table} ORDER BY 1, 2, 3`).all()
  } finally {
    db.close()
  }
}

let records: string[] = []
let removeSink = () => {}

beforeEach(() => {
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  records = []
  const remove = addSink((line) => records.push(line))
  removeSink = () => void remove()
})

afterEach(() => {
  removeSink()
  vi.restoreAllMocks()
})

test("USG-61 agent-tablet's history is copied row for row, its file read only", () => {
  const dirs = usageDirs('usg61')
  const sources = agentTablet(dirs.root, 2, { turns: 1200, spans: 5000, tokens: 3100, names: 80 })
  const before = fingerprint(sources.history)
  const imported = join(dirs.root, 'data', 'agent-tablet-usage.jsonl')
  openHistory(dirs.history, sources, imported).close()
  for (const table of ['turns', 'spans', 'tokens', 'names']) {
    expect(rows(dirs.history, table)).toEqual(rows(sources.history, table))
  }
  expect(rows(dirs.history, 'turns')).toHaveLength(1200)
  expect(fingerprint(sources.history)).toEqual(before)
  expect(before.beside).toEqual(['history.sqlite'])
  expect(readFileSync(imported, 'utf8')).toBe(readFileSync(sources.statuslineLog, 'utf8'))
})

test('USG-62 a version-1 history comes in with no categories and no tries', () => {
  const dirs = usageDirs('usg62')
  const sources = agentTablet(dirs.root, 1)
  openHistory(dirs.history, sources, join(dirs.root, 'imported.jsonl')).close()
  const turns = rows(dirs.history, 'turns')
  expect(turns).toHaveLength(3)
  expect(turns.every((t) => t.category === null && t.category_tries === 0)).toBe(true)
  expect(rows(dirs.history, 'spans')).toHaveLength(4)
  expect(rows(dirs.history, 'tokens')).toHaveLength(5)
  expect(rows(dirs.history, 'names')).toHaveLength(2)
})

test('USG-63 a second start imports nothing, however much agent-tablet has gained', () => {
  const dirs = usageDirs('usg63')
  const sources = agentTablet(dirs.root, 2)
  openHistory(dirs.history, sources, join(dirs.root, 'imported.jsonl')).close()
  const db = openDb(sources.history)
  db.raw.prepare("INSERT INTO turns VALUES ('late', 's9', 'human', 1, NULL, NULL, NULL, 0)").run()
  db.close()
  openHistory(dirs.history, sources, join(dirs.root, 'imported.jsonl')).close()
  expect(rows(dirs.history, 'turns')).toHaveLength(3)
})

test("USG-64 with no agent-tablet history Menkar starts empty and creates nothing of agent-tablet's", () => {
  const dirs = usageDirs('usg64')
  const sources = {
    history: join(dirs.root, 'at', 'history.sqlite'),
    statuslineLog: join(dirs.root, 'at', 'usage.jsonl'),
  }
  openHistory(dirs.history, sources, join(dirs.root, 'imported.jsonl')).close()
  expect(rows(dirs.history, 'turns')).toEqual([])
  expect(existsSync(join(dirs.root, 'at'))).toBe(false)
})

test('USG-65 an unreadable agent-tablet history is not imported, not moved, and logged', () => {
  const dirs = usageDirs('usg65')
  const history = join(dirs.root, 'at', 'history.sqlite')
  mkdirSync(dirname(history), { recursive: true })
  writeFileSync(history, Buffer.from('random bytes, not sqlite '.repeat(100)))
  const before = fingerprint(history)
  openHistory(
    dirs.history,
    { history, statuslineLog: join(dirs.root, 'none') },
    join(dirs.root, 'i.jsonl'),
  ).close()
  expect(fingerprint(history)).toEqual(before)
  expect(rows(dirs.history, 'turns')).toEqual([])
  expect(records.some((r) => r.includes('not imported') && r.includes(history))).toBe(true)
})

test('USG-66 a history from a newer agent-tablet is not imported and the version is logged', () => {
  const dirs = usageDirs('usg66')
  const sources = agentTablet(dirs.root, 3)
  const before = fingerprint(sources.history)
  openHistory(dirs.history, sources, join(dirs.root, 'i.jsonl')).close()
  expect(rows(dirs.history, 'turns')).toEqual([])
  expect(fingerprint(sources.history)).toEqual(before)
  expect(records.some((r) => r.includes('newer version') && r.includes('version=3'))).toBe(true)
})

test('USG-67 an import that fails midway leaves no history, and the next start imports', () => {
  const dirs = usageDirs('usg67')
  const sources = agentTablet(dirs.root, 2)
  const imported = join(dirs.root, 'i.jsonl')
  const failing = {
    rename: (from: string, to: string) => {
      if (to === dirs.history) throw new Error('disk full')
      renameSync(from, to)
    },
  }
  expect(() => openHistory(dirs.history, sources, imported, failing)).toThrow()
  expect(existsSync(dirs.history)).toBe(false)
  expect(readdirSync(dirname(dirs.history)).filter((n) => n.startsWith('history.sqlite'))).toEqual(
    [],
  )
  openHistory(dirs.history, sources, imported).close()
  expect(rows(dirs.history, 'turns')).toHaveLength(3)
})

test('USG-68 a turn imported with a project keeps it and its category when a pass rewrites it', () => {
  const dirs = usageDirs('usg68')
  const sources = agentTablet(dirs.root, 2, { turns: 0, spans: 0, tokens: 0, names: 0 })
  const db = openDb(sources.history)
  db.raw
    .prepare("INSERT INTO turns VALUES ('u-10:00:00', 's1', 'human', ?, 'x', 'X', 'design', 0)")
    .run(OPENED)
  db.close()
  openHistory(dirs.history, sources, join(dirs.root, 'i.jsonl')).close()
  dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30')])
  runPass(memberships(), {
    claudeProjects: dirs.claudeProjects,
    cache: dirs.cache,
    history: dirs.history,
  })
  const turns = rows(dirs.history, 'turns')
  expect(turns).toHaveLength(1)
  expect(turns[0]).toMatchObject({ project_id: 'x', project_name: 'X', category: 'design' })
  // the pass rewrote it from the transcript: its time is the transcript's now
  expect(turns[0]?.opened).not.toBe(OPENED)
})

test('USG-69 an unreadable Menkar history on a later start is moved aside, never re-imported', () => {
  const dirs = usageDirs('usg69')
  const sources = agentTablet(dirs.root, 2)
  openHistory(dirs.history, sources, join(dirs.root, 'i.jsonl')).close()
  writeFileSync(dirs.history, Buffer.from('broken '.repeat(500)))
  const history: UsageHistory = openHistory(dirs.history, sources, join(dirs.root, 'i.jsonl'))
  history.close()
  expect(rows(dirs.history, 'turns')).toEqual([])
  expect(readdirSync(dirname(dirs.history)).some((n) => n.includes('.broken-'))).toBe(true)
})
