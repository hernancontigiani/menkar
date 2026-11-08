// Turns, execution and blocked time, tokens and cost, measured from transcripts through a pass
// into the history and read back as a report (docs/spec/usage.md, USG-1 to USG-30).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { rmSync, writeFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { BUSY_TIMEOUT_MS, historyPath, UsageHistory } from '../../../src/core/usage/history'
import { runPass } from '../../../src/core/usage/pass'
import { type Bounds, midnight, periodBounds } from '../../../src/core/usage/periods'
import { cost } from '../../../src/core/usage/prices'
import {
  buildReport,
  formatCost,
  formatDuration,
  type Node,
  totalExecution,
} from '../../../src/core/usage/report'
import { feed, freshTurn, parseSeconds } from '../../../src/core/usage/transcript'
import {
  at,
  type Line,
  memberships,
  plainPrompt,
  prompt,
  response,
  result,
  usageDirs,
} from '../../factories/usage'

const NOV_8 = {
  start: midnight({ year: 2026, month: 11, day: 8 }),
  end: midnight({ year: 2026, month: 11, day: 9 }),
}

type Dirs = ReturnType<typeof usageDirs>

function measure(dirs: Dirs, bounds: Bounds = NOV_8, member = memberships(), logs: string[] = []) {
  runPass(member, { claudeProjects: dirs.claudeProjects, cache: dirs.cache, history: dirs.history })
  const history = new UsageHistory(dirs.history)
  try {
    return buildReport(history, bounds, {
      statuslineLogs: logs,
      projectNames: member.projectNames,
    })
  } finally {
    history.close()
  }
}

function sessions(report: ReturnType<typeof measure>): Node[] {
  return report.nodes.flatMap((p) => p.children)
}

function only(report: ReturnType<typeof measure>): Node {
  const found = sessions(report)
  expect(found).toHaveLength(1)
  return found[0] as Node
}

function rowsOf(dirs: Dirs, sql: string): Record<string, unknown>[] {
  const history = new UsageHistory(dirs.history)
  try {
    return history.handle?.raw.prepare(sql).all() ?? []
  } finally {
    history.close()
  }
}

describe('turns and time', () => {
  test('USG-1 a turn runs from its prompt to the last activity: 30 s, nothing blocked', () => {
    const dirs = usageDirs('usg1')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:05', { tools: [{ id: 't1' }] }),
      result('10:00:20', 't1'),
      response('10:00:30'),
    ])
    const node = only(measure(dirs))
    expect(node.execution).toEqual({ human: 30 })
    expect(node.blocked).toBe(0)
  })

  test('USG-2 a gap over two hours is idle; exactly two hours counts', () => {
    const over = usageDirs('usg2a')
    over.transcript('s1', [prompt('10:00:00'), response('10:00:30'), response('12:00:31')])
    expect(only(measure(over)).execution).toEqual({ human: 30 })
    const exact = usageDirs('usg2b')
    exact.transcript('s1', [prompt('10:00:00'), response('10:00:30'), response('12:00:30')])
    expect(only(measure(exact)).execution).toEqual({ human: 30 + 7200 })
  })

  test('USG-3 a tool call the human decided is blocked, and the next gap starts at its result', () => {
    const dirs = usageDirs('usg3')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:01:00', { tools: [{ id: 't1' }] }),
      result('10:06:00', 't1', { permissionDecision: { source: 'userTemporary' } }),
      response('10:06:10'),
    ])
    const node = only(measure(dirs))
    expect(node.blocked).toBe(300)
    expect(node.execution).toEqual({ human: 60 + 10 })
  })

  test('USG-4 a question to the human is blocked however long, with no two-hour rule', () => {
    const dirs = usageDirs('usg4')
    dirs.transcript('s1', [
      prompt('09:59:00'),
      response('10:00:00', { tools: [{ id: 'q', name: 'AskUserQuestion' }] }),
      result('13:30:00', 'q'),
    ])
    expect(only(measure(dirs)).blocked).toBe(3.5 * 3600)
  })

  test('USG-5 a tool allowed by configuration is execution, not blocked', () => {
    const dirs = usageDirs('usg5')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:01:00', { tools: [{ id: 't1' }] }),
      result('10:06:00', 't1', { permissionDecision: { source: 'config' } }),
    ])
    const node = only(measure(dirs))
    expect(node.blocked).toBe(0)
    expect(node.execution).toEqual({ human: 360 })
  })

  test('USG-6 before turnOrigin existed a prompt opens an unknown turn; a meta entry opens none', () => {
    const dirs = usageDirs('usg6')
    dirs.transcript('s1', [
      plainPrompt('09:00:00'),
      response('09:00:10'),
      plainPrompt('09:30:00', { isMeta: true }),
      response('09:30:10'),
    ])
    measure(dirs)
    const turns = rowsOf(dirs, 'SELECT uuid, origin FROM turns ORDER BY opened')
    expect(turns).toEqual([{ uuid: 'p-09:00:00', origin: 'unknown' }])
  })

  test('USG-7 once a file shows turnOrigin, a plain user entry opens nothing and adds no time', () => {
    const dirs = usageDirs('usg7')
    dirs.transcript('s1', [
      plainPrompt('09:00:00'),
      response('09:00:10'),
      prompt('10:00:00'),
      response('10:00:10'),
      plainPrompt('10:30:00'),
      response('10:30:05'),
    ])
    measure(dirs)
    const turns = rowsOf(dirs, 'SELECT origin FROM turns ORDER BY opened')
    expect(turns.map((t) => t.origin)).toEqual(['unknown', 'human'])
    const spans = rowsOf(dirs, "SELECT start, end FROM spans WHERE uuid = 'u-10:00:00'")
    // the plain entry at 10:30 is no activity: the gap runs from 10:00:10 to 10:30:05
    expect(spans).toEqual([
      { start: parseSeconds(at('10:00:00')), end: parseSeconds(at('10:30:05')) },
    ])
  })

  test('USG-8 a turn across midnight splits there, by local days', () => {
    const dirs = usageDirs('usg8')
    dirs.transcript('s1', [
      { ...prompt('23:30:00'), timestamp: at('23:30:00', '2026-11-07') },
      { ...response('00:00:00'), timestamp: at('23:59:00', '2026-11-07') },
      { ...response('00:30:00'), timestamp: at('00:30:00', '2026-11-08') },
    ])
    const first = { start: midnight({ year: 2026, month: 11, day: 7 }), end: NOV_8.start }
    expect(totalExecution(only(measure(dirs, NOV_8)))).toBe(1800)
    expect(totalExecution(only(measure(dirs, first)))).toBe(1800)
    expect(totalExecution(only(measure(dirs, { start: first.start, end: NOV_8.end })))).toBe(3600)
  })

  test('USG-9 a day with a daylight-saving change ends at the next local midnight', () => {
    const previous = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      // 2026-11-01: clocks go back an hour, so the day has 25 hours.
      const day = periodBounds('today', new Date(2026, 10, 1, 12).getTime() / 1000)
      expect(day.end - day.start).toBe(25 * 3600)
      expect(new Date(day.end * 1000).getHours()).toBe(0)
    } finally {
      process.env.TZ = previous
    }
  })

  test('USG-10 a turn without uuid is named after its session and time', () => {
    const state = freshTurn()
    feed(state, {
      type: 'user',
      turnOrigin: 'peer',
      sessionId: 's1',
      timestamp: '2026-11-08T13:00:00Z',
    })
    expect(state.uuid).toBe('none:s1:2026-11-08T13:00:00Z')
    expect(state.origin).toBe('peer')
  })

  test('USG-11 an entry whose time does not parse opens no turn and adds no span', () => {
    const state = freshTurn()
    expect(
      feed(state, { type: 'user', turnOrigin: 'human', uuid: 'x', timestamp: 'yesterday' }),
    ).toEqual([])
    expect(state.uuid).toBeNull()
  })
})

describe('tokens', () => {
  test('USG-12 a response written once per content block counts once, the largest copy', () => {
    const dirs = usageDirs('usg12')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:01', { id: 'msg_1', request: 'req_1', tokens: { output: 10 } }),
      response('10:00:02', { id: 'msg_1', request: 'req_1', tokens: { output: 40 } }),
      response('10:00:03', { id: 'msg_1', request: 'req_1', tokens: { output: 40 } }),
    ])
    expect(only(measure(dirs)).tokens.output).toBe(40)
  })

  test('USG-13 a response copied into a resumed transcript counts once', () => {
    const dirs = usageDirs('usg13')
    const line = response('10:00:01', { id: 'msg_1', request: 'req_1', tokens: { output: 40 } })
    dirs.transcript('s1', [prompt('10:00:00'), line])
    dirs.transcript('s2', [{ ...prompt('10:00:00'), uuid: 'other' }, line])
    const report = measure(dirs)
    const total = sessions(report).reduce((sum, n) => sum + n.tokens.output, 0)
    expect(total).toBe(40)
  })

  test('USG-14 a sidechain copy of a main-thread response adds nothing, in either order', () => {
    const main = response('10:00:01', { id: 'msg_1', request: 'req_1', tokens: { output: 40 } })
    const side = response('10:00:02', {
      id: 'msg_1',
      request: 'req_9',
      tokens: { output: 40 },
      extra: { isSidechain: true },
    })
    for (const [name, lines] of [
      ['main-first', [prompt('10:00:00'), main, side]],
      ['side-first', [prompt('10:00:00'), side, main]],
    ] as const) {
      const dirs = usageDirs(`usg14-${name}`)
      dirs.transcript('s1', lines)
      expect(only(measure(dirs)).tokens.output).toBe(40)
    }
  })

  test('USG-15 synthetic and error responses count nothing; a cache-only response counts', () => {
    const dirs = usageDirs('usg15')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:01', { model: '<synthetic>', tokens: { output: 100 } }),
      response('10:00:02', { tokens: { output: 100 }, extra: { isApiErrorMessage: true } }),
      response('10:00:03', { tokens: { cacheRead: 5000 } }),
    ])
    const node = only(measure(dirs))
    expect(node.tokens).toEqual({
      input: 0,
      output: 0,
      cacheWrite: 0,
      cacheWrite1h: 0,
      cacheRead: 5000,
    })
  })

  test("USG-16 a subagent's tokens count for its parent session and add no time", () => {
    const dirs = usageDirs('usg16')
    dirs.transcript('abc', [prompt('10:00:00'), response('10:00:10')])
    dirs.subagent('abc', 'agent-x', [
      response('10:00:05', { id: 'msg_sub', tokens: { output: 70 } }) as Line,
      response('11:59:00', { id: 'msg_sub2', tokens: { output: 5 } }) as Line,
    ])
    const node = only(measure(dirs))
    expect(node.tokens.output).toBe(10 + 70 + 5)
    expect(node.execution).toEqual({ human: 10 })
  })

  test("USG-17 a response before the session's first turn goes to a pre: turn with no time", () => {
    const dirs = usageDirs('usg17')
    dirs.transcript('s1', [response('09:59:00', { tokens: { output: 3 } }), prompt('10:00:00')])
    measure(dirs)
    expect(rowsOf(dirs, "SELECT origin FROM turns WHERE uuid = 'pre:s1'")).toEqual([
      { origin: 'unknown' },
    ])
    expect(rowsOf(dirs, "SELECT output FROM tokens WHERE uuid = 'pre:s1'")).toEqual([{ output: 3 }])
    expect(rowsOf(dirs, "SELECT 1 FROM spans WHERE uuid = 'pre:s1'")).toEqual([])
  })

  test('USG-18 responses with no request id and local message ids count apart by their time', () => {
    const dirs = usageDirs('usg18')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:01', { id: 'local-1', request: null, tokens: { output: 5 } }),
      response('10:00:02', { id: 'local-1', request: null, tokens: { output: 7 } }),
    ])
    expect(only(measure(dirs)).tokens.output).toBe(12)
  })
})

describe('cost', () => {
  const noon = NOV_8.start + 12 * 3600
  const tokens = (t: Partial<Parameters<typeof cost>[2]>) => ({
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheWrite1h: 0,
    cacheRead: 0,
    ...t,
  })

  test('USG-19 Opus 5.5 at list price, shown as an estimate', () => {
    const dollars = cost('claude-opus-5-5', noon, tokens({ input: 1_000_000, output: 100_000 }))
    expect(dollars).toBeCloseTo(6, 10)
    expect(formatCost({ cost: dollars ?? 0, costExact: false, allPriced: true })).toBe('~$6.00')
  })

  test('USG-20 a dated id with the 1M window prices as its family', () => {
    const t = tokens({ input: 1_000_000 })
    expect(cost('claude-sonnet-4-5-20250929[1m]', noon, t)).toBe(cost('claude-sonnet-4-5', noon, t))
    expect(cost('claude-sonnet-4-5', noon, t)).toBeCloseTo(3, 10)
  })

  test('USG-21 the one-hour cache write is priced apart from the five-minute one', () => {
    const dollars = cost(
      'claude-opus-4-5',
      noon,
      tokens({ cacheWrite: 1_000_000, cacheWrite1h: 400_000 }),
    )
    expect(dollars).toBeCloseTo(7.75, 10)
  })

  test('USG-22 a model the table does not know adds nothing and marks the cost', () => {
    expect(cost('claude-unknown-9', noon, tokens({ input: 1000 }))).toBeNull()
    const dirs = usageDirs('usg22')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:01', { model: 'claude-unknown-9' })])
    const report = measure(dirs, NOV_8, memberships({ s1: ['p1', 'Client work'] }))
    expect(formatCost(only(report))).toBe('~$0.00+')
    expect(formatCost(report.nodes[0] as Node)).toBe('~$0.00+')
  })

  test("USG-23 Haiku 5.5's long-prompt row applies over 100,000 prompt tokens", () => {
    const dollars = cost('claude-haiku-5-5', noon, tokens({ input: 60_000, cacheRead: 50_000 }))
    expect(dollars).toBeCloseTo((60_000 * 0.5 + 50_000 * 0.05) / 1_000_000, 12)
  })

  test("USG-24 the statusline's running total is the exact cost, across a /clear", () => {
    const dirs = usageDirs('usg24')
    dirs.transcript('s1', [prompt('09:00:00'), response('09:00:01')])
    const log = `${dirs.root}/usage.jsonl`
    const line = (time: string, c: number) =>
      JSON.stringify({ at: at(time), session_id: 's1', cost_usd: c })
    writeFileSync(
      log,
      [
        line('10:00:00', 1),
        line('11:00:00', 1.5),
        line('12:00:00', 0.2),
        line('13:00:00', 0.7),
      ].join('\n'),
    )
    const all = only(measure(dirs, NOV_8, memberships(), [log]))
    expect(all.cost).toBeCloseTo(2.2, 10)
    expect(formatCost(all)).toBe('$2.20')
    const late = { start: NOV_8.start + 12 * 3600, end: NOV_8.start + 14 * 3600 }
    // the session has no history rows from 12:00 on, so only a period that has them is exact
    const lateDirs = usageDirs('usg24b')
    lateDirs.transcript('s1', [prompt('12:00:00'), response('12:30:00')])
    expect(only(measure(lateDirs, late, memberships(), [log])).cost).toBeCloseTo(0.7, 10)
  })

  test('USG-25 a project with one exact and one estimated session is an estimate', () => {
    const dirs = usageDirs('usg25')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:01')])
    dirs.transcript('s2', [
      { ...prompt('10:00:00'), uuid: 'u2' },
      response('10:00:02', { id: 'msg_2' }),
    ])
    const log = `${dirs.root}/usage.jsonl`
    writeFileSync(log, JSON.stringify({ at: at('10:00:05'), session_id: 's1', cost_usd: 1 }))
    const report = measure(dirs, NOV_8, memberships({ s1: ['p', 'P'], s2: ['p', 'P'] }), [log])
    expect(formatCost(report.nodes[0] as Node).startsWith('~$')).toBe(true)
  })
})

describe('projects and names', () => {
  test('USG-26 a session moved between projects shows under each with its own turns', () => {
    const dirs = usageDirs('usg26')
    const path = dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30')])
    measure(dirs, NOV_8, memberships({ s1: ['x', 'X'] }))
    dirs.append(path, [prompt('11:00:00'), response('11:00:10')])
    const report = measure(dirs, NOV_8, memberships({ s1: ['y', 'Y'] }))
    expect(report.nodes.map((p) => [p.label, totalExecution(p)])).toEqual([
      ['X', 30],
      ['Y', 10],
    ])
  })

  test('USG-27 turns written with no project take the one their session joins, transcript or not', () => {
    const dirs = usageDirs('usg27')
    const path = dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30')])
    measure(dirs)
    rmSync(path)
    const report = measure(dirs, NOV_8, memberships({ s1: ['x', 'X'] }))
    expect(report.nodes.map((p) => p.label)).toEqual(['X'])
  })

  test('USG-28 a renamed project shows its new name; a deleted one its last stored name', () => {
    const dirs = usageDirs('usg28')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30')])
    measure(dirs, NOV_8, memberships({ s1: ['x', 'Old'] }))
    const renamed = measure(dirs, NOV_8, memberships({ s1: ['x', 'Client work'] }))
    expect(renamed.nodes.map((p) => p.label)).toEqual(['Client work'])
    const deleted = measure(dirs, NOV_8, memberships())
    expect(deleted.nodes.map((p) => p.label)).toEqual(['Client work'])
  })

  test("USG-29 Claude's given name wins over a generated one, whatever their order", () => {
    const dirs = usageDirs('usg29')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      { type: 'ai-title', aiTitle: 'Fix login' },
      { type: 'custom-title', customTitle: 'auth' },
      { type: 'ai-title', aiTitle: 'Login fix' },
      response('10:00:30'),
    ])
    expect(only(measure(dirs)).label).toBe('auth')
  })

  test('USG-30 a session with no name is labelled by the first 8 characters of its id', () => {
    const dirs = usageDirs('usg30')
    dirs.transcript('0f3c9a12-1111-2222-3333-444455556666', [
      prompt('10:00:00'),
      response('10:00:30'),
    ])
    expect(only(measure(dirs)).label).toBe('0f3c9a12')
  })
})

test('the default history path is under the data directory', () => {
  expect(historyPath()).toBe(`${process.env.XDG_DATA_HOME}/menkar/history.sqlite`)
})

test('the app and `menkar usage` wait 30 s for each other on the history', () => {
  expect(BUSY_TIMEOUT_MS).toBe(30_000)
})

test.each([
  [150, '2m'],
  [210, '4m'],
  [3599, '60m'],
  [9720, '2.7h'],
])('a duration of %i s prints as %s, halves to even as agent-tablet did', (seconds, text) => {
  expect(formatDuration(seconds)).toBe(text)
})

test("a session's tokens over its history count copies once and its subagents for it", () => {
  const dirs = usageDirs('session-tokens')
  const line = response('10:00:01', {
    id: 'msg_1',
    request: 'req_1',
    tokens: { input: 5, output: 40, cacheRead: 100 },
  })
  dirs.transcript('s1', [prompt('10:00:00'), line, line])
  dirs.subagent('s1', 'agent-a', [response('10:00:05', { id: 'msg_sub', tokens: { output: 7 } })])
  runPass(memberships(), {
    claudeProjects: dirs.claudeProjects,
    cache: dirs.cache,
    history: dirs.history,
  })
  const history = new UsageHistory(dirs.history)
  try {
    expect(history.sessionTokens('s1')).toEqual({
      input: 5,
      output: 47,
      cacheWrite: 0,
      cacheWrite1h: 0,
      cacheRead: 100,
    })
    expect(history.sessionTokens('nobody')).toBeNull()
  } finally {
    history.close()
  }
})
