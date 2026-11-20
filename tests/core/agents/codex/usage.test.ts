// Codex's usage beyond its contract fixture (§2.5.5 and §2.6 of the multi-agent architecture):
// tokens from each response's record, counted once; a count read only when it is a request; a
// turn per user message, counted on the day it opened; a compressed rollout read once; Claude's
// rows untouched by Codex's.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { zstdCompressSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { CACHE_FILE, usage } from '../../../../src/core/agents/codex/usage'
import { UsageHistory } from '../../../../src/core/usage/history'
import { runPass, runStreamingPass, textsOf } from '../../../../src/core/usage/pass'
import { midnight } from '../../../../src/core/usage/periods'
import {
  codexHome,
  completed,
  context,
  count,
  meta,
  record,
  rollout,
  rolloutName,
  shell,
  started,
  THREAD,
  tokens,
  typed,
} from '../../../factories/codex'
import { memberships, prompt, response, usageDirs } from '../../../factories/usage'

const T0 = Date.parse('2026-11-08T12:00:00.000Z') / 1000
const TURN = '019a6000-0010-7000-8000-0000000000t1'
const TURN2 = '019a6000-0020-7000-8000-0000000000t2'

// A cache over a fresh Codex home, and the turns it gives once read.
function opened(name: string) {
  const home = codexHome(name)
  const cache = join(home.root, 'cache', 'usage.sqlite')
  const source = () => {
    const found = usage.open(home.sessions, cache)
    if (found === null) throw new Error('no Codex source')
    return found
  }
  return { home, cache, source }
}

function turnsOf(source: ReturnType<ReturnType<typeof opened>['source']>) {
  return source
    .pending()
    .filter((row) => row.turn !== '')
    .map((row) => {
      const found = source.turnUsage(row.sessionId, row.turn)
      return {
        uuid: row.turn,
        session: row.sessionId,
        origin: found?.turn.origin,
        input: found?.tokens.reduce((sum, t) => sum + t.input, 0),
        output: found?.tokens.reduce((sum, t) => sum + t.output, 0),
        cacheRead: found?.tokens.reduce((sum, t) => sum + t.cacheRead, 0),
      }
    })
}

const oneTurn = (thread = THREAD, turn = TURN, at = T0, response = 'resp_1') => [
  context(at, turn),
  started(at, turn),
  typed(at, turn, 'List the routes', thread),
  record(at + 2, turn, response, tokens(1000, 600, 40), thread),
  count(at + 2, tokens(1000, 600, 40), tokens(1000, 600, 40)),
  completed(at + 3, turn),
]

describe("Codex's tokens", () => {
  test('come from the records, each response once: a fork that copies its parent counts nothing twice', () => {
    const { home, source } = opened('fork')
    const FORK = '019a6000-0000-7000-8000-0000000000bb'
    writeFileSync(join(home.day, rolloutName(THREAD)), rollout([meta(T0), ...oneTurn()]))
    writeFileSync(
      join(home.day, rolloutName(FORK)),
      rollout([
        meta(T0 + 100, FORK, { forked_from_id: THREAD }),
        ...oneTurn(),
        ...oneTurn(FORK, TURN2, T0 + 200, 'resp_2'),
      ]),
    )
    const cache = source()
    try {
      cache.ingest()
      expect(turnsOf(cache)).toEqual([
        {
          uuid: `codex:${TURN}`,
          session: THREAD,
          origin: 'human',
          input: 400,
          output: 40,
          cacheRead: 600,
        },
        {
          uuid: `codex:${TURN2}`,
          session: FORK,
          origin: 'human',
          input: 400,
          output: 40,
          cacheRead: 600,
        },
      ])
    } finally {
      cache.close()
    }
  })

  test("with no records (an older Codex), a count is a request only when the thread's total moved, and never the overflow fill", () => {
    const { home, source } = opened('counts')
    const first = tokens(1000, 0, 10)
    const total = tokens(3000, 0, 30)
    writeFileSync(
      join(home.day, rolloutName(THREAD)),
      rollout([
        meta(T0),
        context(T0, TURN),
        started(T0, TURN),
        typed(T0, TURN, 'Fix the build'),
        count(T0 + 1, first, first),
        // a rate-limits update: the same total again
        count(T0 + 2, first, first),
        count(T0 + 3, total, tokens(2000, 0, 20)),
        completed(T0 + 4, TURN),
        // `/compact`'s task starts by repeating the last count
        started(T0 + 5, TURN2),
        count(T0 + 5, total, tokens(2000, 0, 20)),
        // the window overflowed, an hour later: a fill with no request behind it
        count(T0 + 3700, tokens(258400, 0, 0), { ...tokens(0, 0, 0), total_tokens: 200000 }),
        completed(T0 + 3701, TURN2),
      ]),
    )
    const cache = source()
    try {
      cache.ingest()
      expect(turnsOf(cache)).toEqual([
        expect.objectContaining({ uuid: `codex:${TURN}`, input: 3000, output: 30 }),
      ])
      expect(cache.turnUsage(THREAD, `codex:${TURN}`)?.tokens).toHaveLength(1)
    } finally {
      cache.close()
    }
  })

  test("a message steered into a running task is a turn of its own, and Menkar's post is not the human's", () => {
    const { home, source } = opened('steered')
    writeFileSync(
      join(home.day, rolloutName(THREAD)),
      rollout([
        meta(T0),
        context(T0, TURN),
        started(T0, TURN),
        typed(T0, TURN, '[Menkar] task 4 is yours'),
        record(T0 + 1, TURN, 'resp_1', tokens(100, 0, 1)),
        typed(T0 + 10, TURN, 'and run the tests too'),
        record(T0 + 11, TURN, 'resp_2', tokens(200, 0, 2)),
        completed(T0 + 12, TURN),
      ]),
    )
    const cache = source()
    try {
      cache.ingest()
      expect(turnsOf(cache).map(({ uuid, origin, input }) => ({ uuid, origin, input }))).toEqual([
        { uuid: `codex:${TURN}`, origin: 'peer', input: 100 },
        { uuid: `codex:${TURN}:2`, origin: 'human', input: 200 },
      ])
    } finally {
      cache.close()
    }
  })

  test('a model over 272K input tokens in one request is priced at its long-context row', () => {
    const { home, source } = opened('long')
    writeFileSync(
      join(home.day, rolloutName(THREAD)),
      rollout([
        meta(T0),
        context(T0, TURN),
        started(T0, TURN),
        typed(T0, TURN, 'Read the whole repository'),
        record(T0 + 1, TURN, 'resp_1', tokens(272_000, 200_000, 1)),
        record(T0 + 2, TURN, 'resp_2', tokens(272_001, 200_000, 1)),
        completed(T0 + 3, TURN),
      ]),
    )
    const cache = source()
    try {
      cache.ingest()
      const found = cache.turnUsage(THREAD, `codex:${TURN}`)
      expect(found?.tokens.map((t) => [t.model, t.input])).toEqual([
        ['gpt-6.1-sol', 72_000],
        ['gpt-6.1-sol@long', 72_001],
      ])
    } finally {
      cache.close()
    }
  })
})

describe('a pass with Codex', () => {
  test('a turn spanning midnight is one turn, counted on the day it opened', () => {
    const dirs = usageDirs('codex-midnight')
    const { home } = opened('midnight')
    const day2 = midnight({ year: 2026, month: 11, day: 9 })
    writeFileSync(
      join(home.day, rolloutName(THREAD)),
      rollout([
        meta(day2 - 60),
        context(day2 - 30, TURN),
        started(day2 - 30, TURN),
        typed(day2 - 30, TURN, 'Migrate the database'),
        record(day2 + 30, TURN, 'resp_1', tokens(500, 0, 5)),
        completed(day2 + 31, TURN),
      ]),
    )
    runPass(memberships(), {
      claudeProjects: dirs.claudeProjects,
      codexProjects: home.sessions,
      cache: dirs.cache,
      history: dirs.history,
    })
    const history = new UsageHistory(dirs.history)
    try {
      const day1 = midnight({ year: 2026, month: 11, day: 8 })
      expect(history.turnsOpened(day1, day2).map((t) => t.uuid)).toEqual([`codex:${TURN}`])
      expect(history.turnsOpened(day2, day2 + 86_400)).toEqual([])
    } finally {
      history.close()
    }
  })

  test('a compressed rollout replacing one already read is not counted again, and its unread end is', async () => {
    const dirs = usageDirs('codex-zst')
    const { home } = opened('zst')
    const plain = join(home.day, rolloutName(THREAD))
    const head = rollout([meta(T0), ...oneTurn()])
    writeFileSync(plain, head)
    const paths = {
      claudeProjects: dirs.claudeProjects,
      codexProjects: home.sessions,
      cache: dirs.cache,
      history: dirs.history,
    }
    runPass(memberships(), paths)
    // A second turn the pass never saw before Codex compressed the file a week later.
    const whole = head + rollout(oneTurn(THREAD, TURN2, T0 + 600, 'resp_2'))
    writeFileSync(join(home.day, rolloutName(THREAD, true)), zstdCompressSync(Buffer.from(whole)))
    rmSync(plain)
    await runStreamingPass(memberships(), paths)
    await runStreamingPass(memberships(), paths)
    const history = new UsageHistory(dirs.history)
    try {
      expect(history.sessionTokens(THREAD)).toEqual({
        input: 800,
        output: 80,
        cacheWrite: 0,
        cacheWrite1h: 0,
        cacheRead: 1200,
      })
    } finally {
      history.close()
    }
  })

  test('a compressed rollout never seen is read by the streaming pass only', async () => {
    const dirs = usageDirs('codex-zst-new')
    const { home } = opened('zst-new')
    writeFileSync(
      join(home.day, rolloutName(THREAD, true)),
      zstdCompressSync(Buffer.from(rollout([meta(T0), ...oneTurn()]))),
    )
    const paths = {
      claudeProjects: dirs.claudeProjects,
      codexProjects: home.sessions,
      cache: dirs.cache,
      history: dirs.history,
    }
    runPass(memberships(), paths)
    const tokensNow = () => {
      const history = new UsageHistory(dirs.history)
      try {
        return history.sessionTokens(THREAD)?.input ?? 0
      } finally {
        history.close()
      }
    }
    expect(tokensNow()).toBe(0)
    await runStreamingPass(memberships(), paths)
    expect(tokensNow()).toBe(400)
  })

  test("Claude's cache and history rows are the same whether Codex's sessions are read beside them or not", () => {
    const write = (name: string) => {
      const dirs = usageDirs(name)
      dirs.transcript('s-claude', [
        prompt('10:00:00'),
        response('10:00:05', { tokens: { input: 10, output: 20, cacheRead: 30 } }),
      ])
      return dirs
    }
    const alone = write('claude-alone')
    const beside = write('claude-beside')
    const { home } = opened('beside')
    writeFileSync(join(home.day, rolloutName(THREAD)), rollout([meta(T0), ...oneTurn()]))
    runPass(memberships(), alone)
    runPass(memberships(), { ...beside, codexProjects: home.sessions })
    // Every row but Codex's; the cache's file paths differ between the two homes, nothing else.
    const historyRows = (path: string) => {
      const history = new UsageHistory(path)
      try {
        const raw = history.handle?.raw
        return ['turns', 'spans', 'tokens'].map((table) =>
          raw?.prepare(`SELECT * FROM ${table} WHERE uuid NOT LIKE 'codex:%'`).all(),
        )
      } finally {
        history.close()
      }
    }
    const cacheRows = (path: string) => {
      const db = new DatabaseSync(path, { readOnly: true })
      try {
        return [
          'SELECT * FROM entries',
          'SELECT * FROM names',
          'SELECT uuid, session_id, origin, opened, offset FROM turns',
          'SELECT session_id, turn, kind, start, end FROM spans',
          'SELECT * FROM pending',
        ].map((sql) => db.prepare(sql).all())
      } finally {
        db.close()
      }
    }
    expect(historyRows(alone.history)[0]).toHaveLength(1)
    expect(historyRows(beside.history)).toEqual(historyRows(alone.history))
    expect(cacheRows(beside.cache)).toEqual(cacheRows(alone.cache))
    expect(existsSync(join(dirname(beside.cache), CACHE_FILE))).toBe(true)
    expect(existsSync(join(dirname(alone.cache), CACHE_FILE))).toBe(false)
  })
})

describe("Codex's turn text for the classifier", () => {
  test('is the prompt, the human prompt before it and the tools, from the plain rollout only', () => {
    const { home, source } = opened('text')
    const plain = join(home.day, rolloutName(THREAD))
    writeFileSync(
      plain,
      rollout([
        meta(T0),
        ...oneTurn(),
        context(T0 + 60, TURN2),
        started(T0 + 60, TURN2),
        typed(T0 + 60, TURN2, 'yes'),
        shell(T0 + 61, TURN2, ['npm', 'test']),
        completed(T0 + 62, TURN2),
      ]),
    )
    const cache = source()
    try {
      cache.ingest()
      const texts = textsOf([cache])
      expect(texts.turnText(`codex:${TURN2}`)).toEqual({
        prompt: 'yes',
        previous: 'List the routes',
        tools: [{ name: 'shell', input: { command: 'npm test' } }],
      })
      expect(texts.textAt('u-10:00:00')).toBeNull()
      writeFileSync(
        join(home.day, rolloutName(THREAD, true)),
        zstdCompressSync(readFileSync(plain)),
      )
      rmSync(plain)
      expect(texts.turnText(`codex:${TURN2}`)).toBeNull()
    } finally {
      cache.close()
    }
  })

  test('a Codex home that does not exist opens no source and creates no file', () => {
    const { home } = opened('none')
    expect(usage.open(join(home.root, 'missing'), join(home.root, 'cache', 'x.sqlite'))).toBeNull()
  })
})
