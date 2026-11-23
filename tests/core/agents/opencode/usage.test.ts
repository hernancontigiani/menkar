// OpenCode's usage (§2.5.5 and §2.6 of the multi-agent architecture, D9): a turn per user message
// of a root session, its tokens and exact cost from every model step of the session and of its
// subagents, its time cut so that no second counts twice; the cost as running totals in Menkar's
// own log; read from a copy of OpenCode's database, whose files keep their bytes.
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, test } from 'vitest'
import { CACHE_FILE, deriveTree, usage } from '../../../../src/core/agents/opencode/usage'
import { openAgentDb, UNREADABLE } from '../../../../src/core/agents/shared/db'
import type { TurnSource } from '../../../../src/core/agents/types'
import { exportRows } from '../../../../src/core/usage/export'
import { UsageHistory } from '../../../../src/core/usage/history'
import { runPass } from '../../../../src/core/usage/pass'
import { costLogName } from '../../../../src/core/usage/statusline'
import { memberships, usageDirs } from '../../../factories/usage'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'opencode')
const DB = join('.local', 'share', 'opencode', 'opencode.db')
const S1 = 'ses_fx01aaaaaaaaaaCheckoutFix'
const S2 = 'ses_fx02bbbbbbbbbbQueueSteer0'
const S3 = 'ses_fx03ccccccccccSubagent000'
const S5 = 'ses_fx05eeeeeeeeeeInterrupted'
// The fixture's clock: 2026-11-18 14:00 UTC, and `at(minutes, ms)` after it, in seconds.
const T = Date.UTC(2026, 10, 18, 14, 0, 0) / 1000
const at = (minutes: number, ms = 0) => T + minutes * 60 + ms / 1000

let n = 0
// A copy of one of the fixture's states, with a cache beside it.
function fixture(state: 'home' | 'killed') {
  n += 1
  const dirs = usageDirs(`opencode-${state}-${n}`)
  const home = join(dirs.root, 'opencode-home')
  cpSync(join(DATA, state), home, { recursive: true, preserveTimestamps: true })
  const db = join(home, DB)
  const open = (): TurnSource => {
    const source = usage.open(db, dirs.cache)
    if (source === null) throw new Error('no OpenCode source')
    return source
  }
  return { dirs, db, open, log: join(dirs.root, 'cache', costLogName('opencode')) }
}

// Each message id of a session, in order, as the fixture wrote them; read as the source reads, so
// the test itself writes nothing beside the database.
function messageIds(db: string, session: string): string[] {
  const ids = openAgentDb(db, (raw) =>
    raw
      .prepare('SELECT id FROM session_message WHERE session_id = ? ORDER BY seq')
      .all(session)
      .map((row) => String(row.id)),
  )
  if (ids === UNREADABLE) throw new Error('the fixture is unreadable')
  return ids
}

function turnsOf(source: TurnSource) {
  return source
    .pending()
    .filter((row) => row.turn !== '')
    .map((row) => {
      const found = source.turnUsage(row.sessionId, row.turn)
      const sum = (key: 'input' | 'output' | 'cacheRead') =>
        found?.tokens.reduce((total, t) => total + t[key], 0)
      return {
        uuid: row.turn,
        session: row.sessionId,
        origin: found?.turn.origin,
        input: sum('input'),
        output: sum('output'),
        cacheRead: sum('cacheRead'),
        models: [...new Set(found?.tokens.map((t) => t.model))],
      }
    })
}

// Every file under a folder, with its bytes and mtime.
function exact(dir: string): unknown {
  return readdirSync(dir)
    .sort()
    .map((name) => ({
      name,
      mtime: statSync(join(dir, name)).mtimeMs,
      bytes: readFileSync(join(dir, name)),
    }))
}

describe("OpenCode's turns", () => {
  test('are one per user message of a root session, a subagent counting under its root and a Menkar post as a peer', () => {
    const { db, open } = fixture('home')
    const source = open()
    try {
      source.ingest()
      const s1 = messageIds(db, S1)
      const s2 = messageIds(db, S2)
      const s5 = messageIds(db, S5)
      const turns = turnsOf(source)
      const of = (session: string) => turns.filter((t) => t.session === session)
      expect(of(S1)).toEqual([
        // its two steps and the subagent's, which ran while this turn was the one in effect
        {
          uuid: `opencode:${s1[0]}`,
          session: S1,
          origin: 'human',
          input: 4200 + 4400 + 1800,
          output: 60 + 40 + 20,
          cacheRead: 3000 + 4200,
          models: ['sonnet-demo'],
        },
        {
          uuid: `opencode:${s1[4]}`,
          session: S1,
          origin: 'human',
          input: 4600 + 4700,
          output: 80 + 30,
          cacheRead: 4400 + 4600,
          models: ['sonnet-demo'],
        },
      ])
      // a step belongs to the turn in effect when it started
      expect(of(S2).map((t) => [t.uuid, t.origin, t.input])).toEqual([
        [`opencode:${s2[0]}`, 'human', 4800],
        [`opencode:${s2[2]}`, 'human', 5000],
        [`opencode:${s2[4]}`, 'peer', 5200],
      ])
      expect(of(S5).map((t) => [t.uuid, t.input])).toEqual([[`opencode:${s5[0]}`, 0]])
      expect(of(S3)).toEqual([])
    } finally {
      source.close()
    }
  })

  test('take their time from the steps and the gaps between them, each second once', () => {
    // A steered message arrives while the first turn's step runs; a queued one while the second's
    // does. In the last turn the root goes idle while its subagent works, and the subagent's report
    // starts it again.
    const { turns, spans } = deriveTree({
      opens: [
        { at: 0, message: 'a', origin: 'human' },
        { at: 2, message: 'b', origin: 'human' },
        { at: 6, message: 'c', origin: 'peer' },
        { at: 100, message: 'd', origin: 'human' },
      ],
      ends: [10.9, 104, 113],
      resumes: [110.5],
      steps: [
        { at: 0.3, done: 3.8 },
        { at: 3.9, done: 8.9 },
        { at: 9.6, done: 10.8 },
        { at: 101, done: 102 },
        // the subagent's step, after its root's idle, then the root's own after its report
        { at: 104.5, done: 110 },
        { at: 111, done: 112 },
      ],
    })
    expect(turns.map((t) => t.uuid)).toEqual([
      'opencode:a',
      'opencode:b',
      'opencode:c',
      'opencode:d',
    ])
    expect(spans).toEqual([
      { turn: 'opencode:a', start: 0, end: 3.8 },
      { turn: 'opencode:b', start: 3.8, end: 8.9 },
      { turn: 'opencode:c', start: 8.9, end: 10.9 },
      { turn: 'opencode:d', start: 100, end: 113 },
    ])
  })

  test('an idle no subagent report follows ends the turn: the wait for the human is no work', () => {
    const { spans } = deriveTree({
      opens: [
        { at: 0, message: 'a', origin: 'human' },
        { at: 60, message: 'b', origin: 'human' },
      ],
      ends: [5, 70],
      resumes: [],
      steps: [
        { at: 1, done: 4 },
        { at: 61, done: 69 },
      ],
    })
    expect(spans).toEqual([
      { turn: 'opencode:a', start: 0, end: 5 },
      { turn: 'opencode:b', start: 60, end: 70 },
    ])
  })

  test('a gap over two hours is no work', () => {
    const { spans } = deriveTree({
      opens: [{ at: 0, message: 'a', origin: 'human' }],
      ends: [3 * 3600 + 20],
      resumes: [],
      steps: [
        { at: 1, done: 10 },
        { at: 3 * 3600, done: 3 * 3600 + 10 },
      ],
    })
    expect(spans).toEqual([
      { turn: 'opencode:a', start: 0, end: 10 },
      { turn: 'opencode:a', start: 3 * 3600, end: 3 * 3600 + 20 },
    ])
  })

  test("the killed writer's last turn, only in the -wal, is read from a copy, and OpenCode's files keep every byte", () => {
    const { db, open } = fixture('killed')
    const folder = join(db, '..')
    const before = exact(folder)
    const source = open()
    try {
      source.ingest()
      const s1 = messageIds(db, S1)
      expect(
        turnsOf(source)
          .filter((t) => t.session === S1)
          .map((t) => t.uuid),
      ).toEqual([s1[0], s1[4], s1[8]].map((id) => `opencode:${id}`))
    } finally {
      source.close()
    }
    expect(exact(folder)).toEqual(before)
  })

  test('a pass reads only what changed, and a turn already written is pending again only when it changed', () => {
    const { db, open } = fixture('home')
    const source = open()
    try {
      source.ingest()
      source.written(source.pending())
      source.ingest()
      expect(source.pending()).toEqual([])
      const s2 = messageIds(db, S2)
      // OpenCode's server writes a new turn in S2
      const writer = new DatabaseSync(db)
      try {
        const later = Date.UTC(2026, 10, 18, 15, 0, 0)
        writer
          .prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(
            'msg_fx9999Zz9Yy8Xx7Ww6Vv5',
            S2,
            'user',
            999,
            later,
            later,
            JSON.stringify({ time: { created: later }, text: 'One more thing' }),
          )
      } finally {
        writer.close()
      }
      source.ingest()
      expect(source.pending()).toEqual([
        { sessionId: S2, turn: `opencode:${s2[4]}` },
        { sessionId: S2, turn: 'opencode:msg_fx9999Zz9Yy8Xx7Ww6Vv5' },
      ])
    } finally {
      source.close()
    }
  })

  test("a compaction's summary is a request: its tokens count in the turn it ran in, an interrupted step's none", () => {
    const { db, open } = fixture('home')
    const writer = new DatabaseSync(db)
    try {
      const row = writer.prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, ?, ?, ?)')
      const when = Date.UTC(2026, 10, 18, 14, 4, 0)
      row.run(
        'msg_fx9001Zz9Yy8Xx7Ww6Vv5',
        S1,
        'compaction',
        500,
        when,
        when,
        JSON.stringify({
          time: { created: when },
          status: 'completed',
          model: { id: 'sonnet-demo', providerID: 'demo' },
          cost: 0.01,
          tokens: { input: 9000, output: 400, reasoning: 0, cache: { read: 0, write: 0 } },
        }),
      )
      row.run(
        'msg_fx9002Zz9Yy8Xx7Ww6Vv5',
        S1,
        'assistant',
        501,
        when + 1000,
        when + 2000,
        JSON.stringify({
          time: { created: when + 1000, completed: when + 2000 },
          content: [],
          finish: 'error',
          error: { type: 'aborted', message: 'Step interrupted' },
        }),
      )
    } finally {
      writer.close()
    }
    const source = open()
    try {
      source.ingest()
      const second = turnsOf(source).filter((t) => t.session === S1)[1]
      expect([second?.input, second?.output]).toEqual([4600 + 4700 + 9000, 80 + 30 + 400])
    } finally {
      source.close()
    }
  })

  test("names are the root sessions' titles", () => {
    const { open } = fixture('home')
    const source = open()
    try {
      source.ingest()
      expect([...source.names([S1, S3, 'ses_unknown'])]).toEqual([
        [S1, { name: 'checkout-fix', given: 1 }],
      ])
    } finally {
      source.close()
    }
  })

  test("a turn's text for the classifier is its prompt, the human prompt before it and the tools", () => {
    const { db, open } = fixture('home')
    const source = open()
    try {
      source.ingest()
      const s1 = messageIds(db, S1)
      expect(source.turnText(`opencode:${s1[4]}`)).toEqual({
        prompt: 'Add a test for it',
        previous: 'Why does checkout fail on an empty cart?',
        tools: [{ name: 'shell', input: { command: 'npm test', description: 'Run the tests' } }],
      })
      expect(source.textAt(`opencode:${s1[4]}`)).toEqual({ file: db, start: 0 })
      expect(source.turnText('codex:x')).toBeNull()
    } finally {
      source.close()
    }
  })

  test('no database opens no source and creates no file', () => {
    const dirs = usageDirs('opencode-none')
    expect(usage.open(join(dirs.root, 'nowhere', 'opencode.db'), dirs.cache)).toBeNull()
    expect(existsSync(join(dirs.root, 'cache', CACHE_FILE))).toBe(false)
  })
})

describe('a pass with OpenCode', () => {
  test("its turns are exported as opencode's, with their exact cost and the human's response latency", () => {
    const { dirs, db, log } = fixture('home')
    runPass(memberships(), {
      claudeProjects: dirs.claudeProjects,
      opencodeProjects: db,
      cache: dirs.cache,
      history: dirs.history,
    })
    // every root's running total, from a zero at its first message
    const lines = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { session_id: string; cost_usd: number; at: string })
    const s1Lines = lines.filter((l) => l.session_id === S1)
    expect(s1Lines.map((l) => [Date.parse(l.at) / 1000, l.cost_usd])).toEqual([
      [at(0), 0],
      [at(0, 500), 0.0141],
      [at(0, 2600), 0.0141 + 0.0039],
      [at(1, 300), 0.0141 + 0.0039 + 0.0012],
      [at(3, 400), 0.0141 + 0.0039 + 0.0012 + 0.0028],
      [at(3, 2000), 0.0141 + 0.0039 + 0.0012 + 0.0028 + 0.0021],
    ])
    expect(lines.some((l) => l.session_id === S3)).toBe(false)
    const history = new UsageHistory(dirs.history)
    try {
      const rows = exportRows(
        history,
        { start: at(0) - 60, end: at(30) },
        { statuslineLogs: [log] },
      )
      const s1 = messageIds(db, S1)
      const s2 = messageIds(db, S2)
      const shown = rows
        .filter((r) => r.session_id === S1 || r.session_id === S2)
        .map((r) => [
          r.turn,
          r.agent,
          r.cost_exact,
          Math.round(r.cost_usd * 10_000),
          r.response_seconds === null ? null : Math.round(r.response_seconds * 10) / 10,
        ])
      expect(shown).toEqual([
        // the subagent's step ended at 1 min 1.8 s; the human answered at 3 min
        [`opencode:${s1[0]}`, 'opencode', true, 141 + 39 + 12, 180 - 61.8],
        [`opencode:${s1[4]}`, 'opencode', true, 28 + 21, null],
        // steered in while the step ran: the agent was not waiting on the human
        [`opencode:${s2[0]}`, 'opencode', true, 49, null],
        [`opencode:${s2[2]}`, 'opencode', true, 27, null],
        [`opencode:${s2[4]}`, 'opencode', true, 11, null],
      ])
    } finally {
      history.close()
    }
  })

  test('a second pass writes the cost log with the same lines, never twice', () => {
    const { dirs, db, log } = fixture('home')
    const paths = {
      claudeProjects: dirs.claudeProjects,
      opencodeProjects: db,
      cache: dirs.cache,
      history: dirs.history,
    }
    runPass(memberships(), paths)
    const first = readFileSync(log, 'utf8')
    runPass(memberships(), paths)
    expect(readFileSync(log, 'utf8')).toBe(first)
    // a cache dropped and rebuilt gives the same log
    for (const end of ['', '-wal', '-shm'])
      if (existsSync(join(dirs.root, 'cache', `${CACHE_FILE}${end}`)))
        cpSync(join(dirs.root, 'cache', `${CACHE_FILE}${end}`), join(dirs.root, `x${end}`))
    runPass(memberships(), { ...paths, cache: join(dirs.root, 'other', 'usage.sqlite') })
    expect(readFileSync(join(dirs.root, 'other', costLogName('opencode')), 'utf8')).toBe(first)
  })
})
