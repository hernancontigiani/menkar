// `menkar usage export`: one row per turn for an LLM session or a spreadsheet to analyse (plan 17,
// decision 1.16).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { batchPath } from '../../../src/core/usage/activity'
import { runUsageCli } from '../../../src/core/usage/cli'
import {
  ACTIVITY_EXPORT_KEYS,
  EXPORT_KEYS,
  exportPaneRows,
  PANE_EXPORT_KEYS,
  PANE_EXPORT_SCHEMA,
  TASK_EXPORT_KEYS,
} from '../../../src/core/usage/export'
import { UsageHistory } from '../../../src/core/usage/history'
import { midnight } from '../../../src/core/usage/periods'
import { buildReport } from '../../../src/core/usage/report'
import { at, prompt, response, usageDirs } from '../../factories/usage'

type Dirs = ReturnType<typeof usageDirs>

function cli(dirs: Dirs, args: string[]) {
  const out: string[] = []
  const err: string[] = []
  const code = runUsageCli(
    ['export', ...args],
    { out: (t) => out.push(t), err: (t) => err.push(t) },
    {
      passPaths: { claudeProjects: dirs.claudeProjects, cache: dirs.cache, history: dirs.history },
      configDir: join(dirs.root, 'config'),
      statuslineLogs: [dirs.statuslineLog],
      activityDir: join(dirs.root, 'activity'),
    },
  )
  return { code, out: out.join('\n'), err: err.join('\n') }
}

const rows = (text: string) =>
  text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)

function projects(dirs: Dirs, list: { id: string; name: string; members: string[] }[]) {
  const dir = join(dirs.root, 'config')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'projects.json'), JSON.stringify({ projects: list }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 8, 18, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('menkar usage export', () => {
  test('one JSON line per turn with exactly the documented keys; a turn on two models lists both', () => {
    const dirs = usageDirs('export-keys')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:10', { model: 'claude-opus-4-5', tokens: { input: 1000, output: 200 } }),
      response('10:00:20', { id: 'msg_h', model: 'claude-haiku-4-5', tokens: { cacheRead: 700 } }),
      { type: 'custom-title', customTitle: 'auth' },
    ])
    dirs.transcript('s2', [{ ...prompt('09:00:00'), uuid: 'u-early' }, response('09:00:05')])
    projects(dirs, [{ id: 'p', name: 'Client work', members: ['s1'] }])
    const result = cli(dirs, ['--period', 'today'])
    expect(result.code).toBe(0)
    const found = rows(result.out)
    expect(found.map((r) => r.turn)).toEqual(['u-early', 'u-10:00:00'])
    for (const row of found) expect(Object.keys(row).sort()).toEqual([...EXPORT_KEYS].sort())
    const turn = found[1] ?? {}
    expect(turn).toMatchObject({
      schema: 1,
      session_id: 's1',
      session_name: 'auth',
      project: 'Client work',
      category: null,
      origin: 'human',
      opened: '2026-11-08T10:00:00-03:00',
      opened_epoch: new Date(at('10:00:00')).getTime() / 1000,
      execution_seconds: { human: 20 },
      blocked_seconds: 0,
      cost_exact: false,
    })
    const models = turn.models as Record<string, Record<string, unknown>>
    expect(Object.keys(models).sort()).toEqual(['claude-haiku-4-5', 'claude-opus-4-5'])
    expect(models['claude-opus-4-5']).toMatchObject({ input: 1000, output: 200, priced: true })
    expect(models['claude-haiku-4-5']).toMatchObject({ cache_read: 700, priced: true })
    const sum = Object.values(models).reduce((c, m) => c + Number(m.cost_usd), 0)
    expect(turn.cost_usd).toBeCloseTo(sum, 12)
    expect(found[0]).toMatchObject({ project: null, session_name: null })
  })

  // Decision 1.26: the export is for analysis, so it keeps Haiku 5.5's long-prompt tokens under
  // their own key, each priced at its own row.
  test("Haiku 5.5's long-prompt requests keep their own '@long' key, apart from the short ones", () => {
    const dirs = usageDirs('export-long')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:10', { id: 'msg_l', model: 'claude-haiku-5-5', tokens: { input: 120_000 } }),
      response('10:00:20', { id: 'msg_s', model: 'claude-haiku-5-5', tokens: { input: 10_000 } }),
    ])
    const turn = rows(cli(dirs, ['--period', 'today']).out)[0] ?? {}
    const models = turn.models as Record<string, Record<string, unknown>>
    expect(Object.keys(models).sort()).toEqual(['claude-haiku-5-5', 'claude-haiku-5-5@long'])
    expect(models['claude-haiku-5-5@long']).toMatchObject({ input: 120_000, priced: true })
    expect(models['claude-haiku-5-5@long']?.cost_usd).toBeCloseTo((120_000 * 0.5) / 1_000_000, 12)
    expect(models['claude-haiku-5-5']?.cost_usd).toBeCloseTo((10_000 * 0.1) / 1_000_000, 12)
  })

  test('a turn is in the range by the moment it opened, at both edges, and is never clipped', () => {
    const dirs = usageDirs('export-edges')
    dirs.transcript('s1', [
      { ...prompt('23:59:30', { uuid: 'before' }), timestamp: at('23:59:30', '2026-11-07') },
      { ...response('00:00:30'), timestamp: at('00:00:30', '2026-11-08') },
      { ...prompt('00:00:00', { uuid: 'first' }), timestamp: at('00:00:00', '2026-11-08') },
      { ...response('00:00:10', { id: 'msg_f' }), timestamp: at('00:00:10', '2026-11-08') },
    ])
    dirs.transcript('s2', [
      { ...prompt('23:59:50', { uuid: 'last' }), timestamp: at('23:59:50', '2026-11-08') },
      { ...response('00:00:40', { id: 'msg_l' }), timestamp: at('00:00:40', '2026-11-09') },
    ])
    dirs.transcript('s3', [
      { ...prompt('00:00:00', { uuid: 'after' }), timestamp: at('00:00:00', '2026-11-09') },
      { ...response('00:00:05', { id: 'msg_a' }), timestamp: at('00:00:05', '2026-11-09') },
    ])
    vi.setSystemTime(new Date(2026, 10, 9, 12, 0, 0))
    const found = rows(cli(dirs, ['--from', '2026-11-08', '--to', '2026-11-08']).out)
    expect(found.map((r) => r.turn)).toEqual(['first', 'last'])
    expect(found[1]?.execution_seconds).toEqual({ human: 50 })
  })

  test('--project keeps one project by its exact name; an unknown name lists the known ones', () => {
    const dirs = usageDirs('export-project')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:10')])
    dirs.transcript('s2', [
      { ...prompt('11:00:00'), uuid: 'u2' },
      response('11:00:05', { id: 'm2' }),
    ])
    projects(dirs, [
      { id: 'a', name: 'Client work', members: ['s1'] },
      { id: 'b', name: 'Blog', members: ['s2'] },
    ])
    expect(
      rows(cli(dirs, ['--period', 'today', '--project', 'Blog']).out).map((r) => r.turn),
    ).toEqual(['u2'])
    const unknown = cli(dirs, ['--period', 'today', '--project', 'blog'])
    expect(unknown.code).toBe(2)
    expect(unknown.err).toContain("'blog'")
    expect(unknown.err).toContain("'Blog', 'Client work'")
  })

  test('CSV: one row per turn, the totals, the models joined by ";", a name quoted as CSV quotes it', () => {
    const dirs = usageDirs('export-csv')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:10', { model: 'claude-opus-4-5', tokens: { input: 5, output: 7 } }),
      response('10:00:20', { id: 'msg_h', model: 'claude-haiku-4-5', tokens: { output: 3 } }),
      { type: 'custom-title', customTitle: 'fix "auth", again' },
    ])
    const lines = cli(dirs, ['--period', 'today', '--format', 'csv']).out.split('\n')
    expect(lines[0]).toBe(
      'schema,turn,session_id,session_name,project,category,origin,opened,opened_epoch,' +
        'execution_seconds,blocked_seconds,input,output,cache_write,cache_write_1h,cache_read,' +
        'models,cost_usd,cost_exact,agent,response_seconds',
    )
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain(',"fix ""auth"", again",,,human,2026-11-08T10:00:00-03:00,')
    expect(lines[1]).toContain(',20,0,5,10,0,0,0,claude-haiku-4-5;claude-opus-4-5,')
  })

  test('--output writes the file whole and prints nothing', () => {
    const dirs = usageDirs('export-output')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:10')])
    const file = join(dirs.root, 'out', 'turns.jsonl')
    mkdirSync(join(dirs.root, 'out'))
    const result = cli(dirs, ['--period', 'today', '--output', file])
    expect(result).toMatchObject({ code: 0, out: '' })
    expect(rows(readFileSync(file, 'utf8')).map((r) => r.turn)).toEqual(['u-10:00:00'])
  })

  test("the turns' costs add up to the report's, for an exact session and an estimated one", () => {
    const dirs = usageDirs('export-cost')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:10', { tokens: { output: 9000 } }),
      { ...prompt('11:00:00'), uuid: 'u-s1-2' },
      response('11:00:10', { id: 'msg_s1_2', tokens: { output: 100 } }),
    ])
    dirs.transcript('s2', [
      { ...prompt('12:00:00'), uuid: 'u-s2' },
      response('12:00:05', { id: 'm2' }),
    ])
    mkdirSync(join(dirs.root, 'cache'), { recursive: true })
    writeFileSync(
      dirs.statuslineLog,
      [
        { at: at('10:00:05'), session_id: 's1', cost_usd: 0.4 },
        { at: at('11:00:05'), session_id: 's1', cost_usd: 0.55 },
      ]
        .map((l) => JSON.stringify(l))
        .join('\n'),
    )
    const found = rows(cli(dirs, ['--period', 'today']).out)
    expect(found.map((r) => [r.turn, r.cost_exact])).toEqual([
      ['u-10:00:00', true],
      ['u-s1-2', true],
      ['u-s2', false],
    ])
    expect(found[0]?.cost_usd).toBeCloseTo(0.4, 12)
    expect(found[1]?.cost_usd).toBeCloseTo(0.15, 12)
    const history = new UsageHistory(dirs.history)
    try {
      const day = {
        start: midnight({ year: 2026, month: 11, day: 8 }),
        end: midnight({ year: 2026, month: 11, day: 9 }),
      }
      const report = buildReport(history, day, { statuslineLogs: [dirs.statuslineLog] })
      const reported = report.nodes.reduce((c, n) => c + n.cost, 0)
      const exported = found.reduce((c, r) => c + Number(r.cost_usd), 0)
      expect(exported).toBeCloseTo(reported, 12)
    } finally {
      history.close()
    }
  })

  // A resumed session's first statusline line carries its whole lifetime (Claude Code keeps the
  // total across a resume), and a resume recomputes it a little lower. Counted whole, either one
  // put the session's lifetime cost into the day, as on the human's "fabric".
  test('a resumed session costs only what its total grew by: its first line and a dip at a resume add nothing, in the report and the export alike', () => {
    const dirs = usageDirs('export-resumed')
    dirs.transcript('s1', [
      prompt('09:00:00'),
      response('09:00:10', { tokens: { output: 100 } }),
      { ...prompt('10:00:00'), uuid: 'u-s1-2' },
      response('10:00:10', { id: 'msg_s1_2', tokens: { output: 100 } }),
      { ...prompt('11:00:00'), uuid: 'u-s1-3' },
      response('11:00:10', { id: 'msg_s1_3', tokens: { output: 100 } }),
    ])
    mkdirSync(join(dirs.root, 'cache'), { recursive: true })
    writeFileSync(
      dirs.statuslineLog,
      [
        { at: at('10:00:05'), session_id: 's1', cost_usd: 729.55 },
        { at: at('10:00:30'), session_id: 's1', cost_usd: 734.67 },
        { at: at('11:00:05'), session_id: 's1', cost_usd: 733.4 },
        { at: at('11:00:30'), session_id: 's1', cost_usd: 734 },
      ]
        .map((l) => JSON.stringify(l))
        .join('\n'),
    )
    const found = rows(cli(dirs, ['--period', 'today']).out)
    expect(found.map((r) => r.cost_exact)).toEqual([true, true, true])
    const exported = found.reduce((c, r) => c + Number(r.cost_usd), 0)
    expect(exported).toBeCloseTo(5.12 + 0.6, 10)
    const history = new UsageHistory(dirs.history)
    try {
      const day = {
        start: midnight({ year: 2026, month: 11, day: 8 }),
        end: midnight({ year: 2026, month: 11, day: 9 }),
      }
      const report = buildReport(history, day, { statuslineLogs: [dirs.statuslineLog] })
      expect(report.nodes.reduce((c, n) => c + n.cost, 0)).toBeCloseTo(exported, 10)
    } finally {
      history.close()
    }
  })

  test("a new session's first report is all its cost", () => {
    const dirs = usageDirs('export-new')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:10', { tokens: { output: 100 } })])
    mkdirSync(join(dirs.root, 'cache'), { recursive: true })
    writeFileSync(
      dirs.statuslineLog,
      JSON.stringify({ at: at('10:00:20'), session_id: 's1', cost_usd: 0.42 }),
    )
    const found = rows(cli(dirs, ['--period', 'today']).out)
    expect(found[0]?.cost_usd).toBeCloseTo(0.42, 12)
  })

  // Decision 1.204 (a): the agent each turn was read from, and the human's response latency.
  test("each row names its agent and the human's response: from the turn's end to their next message in its session", () => {
    const dirs = usageDirs('export-response')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:10'),
      prompt('10:05:00'),
      response('10:05:10'),
      // the agent went on without the human: the turn before was not waiting on them
      prompt('10:10:00', { turnOrigin: 'task-notification' }),
      response('10:10:10'),
      prompt('10:20:00'),
      response('10:20:10'),
    ])
    dirs.transcript('s2', [prompt('11:00:00'), response('11:00:10'), prompt('11:30:00')])
    dirs.transcript('s3', [prompt('13:00:00'), response('13:00:10'), prompt('13:30:01')])
    // a message in another session does not end s1's wait
    dirs.transcript('s4', [prompt('10:02:00'), response('10:02:05')])
    const dir = join(dirs.root, 'activity')
    mkdirSync(dir, { recursive: true })
    const epoch = (time: string) => new Date(at(time)).getTime() / 1000
    const events = [
      { id: 'a1', at: epoch('11:05:00'), kind: 'away' },
      { id: 'a2', at: epoch('11:20:00'), kind: 'back' },
      { id: 'a3', at: epoch('13:30:00'), kind: 'prompted_start', sessionId: 's3' },
    ]
    writeFileSync(batchPath(dir, 0), events.map((e) => JSON.stringify({ v: 1, ...e })).join('\n'))
    const found = rows(cli(dirs, ['--period', 'today']).out)
    expect(found.map((r) => [r.turn, r.session_id, r.agent, r.response_seconds])).toEqual([
      ['u-10:00:00', 's1', 'claude', 290],
      ['u-10:02:00', 's4', 'claude', null],
      ['u-10:05:00', 's1', 'claude', null],
      ['u-10:10:00', 's1', 'claude', 590],
      ['u-10:20:00', 's1', 'claude', null],
      ['u-11:00:00', 's2', 'claude', null],
      ['u-11:30:00', 's2', 'claude', null],
      ['u-13:00:00', 's3', 'claude', null],
      ['u-13:30:01', 's3', 'claude', null],
    ])
    const csv = cli(dirs, ['--period', 'today', '--format', 'csv']).out.split('\n')
    expect(csv[1]).toMatch(/,claude,290$/)
    expect(csv[2]).toMatch(/,claude,$/)
  })

  test("the documentation's table names exactly the row's keys, in order", () => {
    const doc = readFileSync('docs/usage.md', 'utf8')
    const section = doc.slice(
      doc.indexOf('## Exporting for analysis'),
      doc.indexOf('### Activity rows'),
    )
    const documented = [...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1])
    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual([...EXPORT_KEYS])
  })

  // Q4 (a): the activity is its own kind of row, so the turns' stream stays one object per turn.
  test('--rows activity writes one row per event with exactly the documented keys', () => {
    const dirs = usageDirs('export-activity')
    const dir = join(dirs.root, 'activity')
    mkdirSync(dir, { recursive: true })
    const epoch = (time: string) => new Date(at(time)).getTime() / 1000
    const events = [
      { id: 'e1', at: epoch('10:00:00'), kind: 'away' },
      { id: 'e2', at: epoch('10:30:00'), kind: 'back' },
      { id: 'e3', at: epoch('10:31:00'), kind: 'present', projectId: 'p' },
      {
        id: 'e4',
        at: epoch('10:32:00'),
        kind: 'prompt_answered',
        projectId: 'p',
        sessionId: 's1',
        next: 'working',
        blockedSeconds: 12.5,
      },
      { id: 'e5', at: epoch('10:33:00'), kind: 'topic_closed', projectId: 'q', topic: 4, task: 7 },
      {
        id: 'e6',
        at: epoch('10:34:00'),
        kind: 'task_state',
        projectId: 'p',
        task: 3,
        state: 'queued',
      },
      { id: 'e7', at: epoch('23:59:59') - 86_400, kind: 'present', projectId: 'p' },
    ]
    writeFileSync(batchPath(dir, 0), events.map((e) => JSON.stringify({ v: 1, ...e })).join('\n'))
    projects(dirs, [
      { id: 'p', name: 'Client work', members: [] },
      { id: 'q', name: 'Side', members: [] },
    ])
    const all = cli(dirs, ['--period', 'today', '--rows', 'activity'])
    expect(all.code).toBe(0)
    const found = rows(all.out)
    expect(found.map((r) => r.event)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5'])
    for (const row of found) expect(Object.keys(row)).toEqual([...ACTIVITY_EXPORT_KEYS])
    expect(found[3]).toEqual({
      schema: 1,
      event: 'e4',
      kind: 'prompt_answered',
      at: '2026-11-08T10:32:00-03:00',
      at_epoch: epoch('10:32:00'),
      project: 'Client work',
      session_id: 's1',
      topic: null,
      task: null,
      next: 'working',
      blocked_seconds: 12.5,
    })
    expect(found[4]).toMatchObject({ project: 'Side', topic: 4, task: 7 })
    const scoped = rows(
      cli(dirs, ['--period', 'today', '--rows', 'activity', '--project', 'Client work']).out,
    )
    expect(scoped.map((r) => r.event)).toEqual(['e1', 'e2', 'e3', 'e4'])
    const csv = cli(dirs, ['--period', 'today', '--rows', 'activity', '--format', 'csv']).out.split(
      '\n',
    )
    expect(csv[0]).toBe(ACTIVITY_EXPORT_KEYS.join(','))
    expect(csv[1]).toBe(`1,e1,away,2026-11-08T10:00:00-03:00,${epoch('10:00:00')},,,,,,`)
    expect(csv).toHaveLength(6)
    const bad = cli(dirs, ['--rows', 'bogus'])
    expect(bad.code).toBe(2)
    expect(bad.out).toBe('')
  })

  test("the documentation's activity table names exactly the activity row's keys, in order", () => {
    const doc = readFileSync('docs/usage.md', 'utf8')
    const section = doc.slice(doc.indexOf('### Activity rows'), doc.indexOf('### Task rows'))
    const documented = [...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1])
    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual([...ACTIVITY_EXPORT_KEYS])
  })

  // Q4 (a): a task's states are their own kind of row; whom it waits on is a kind and an id or a
  // number, never the text typed.
  test('--rows tasks writes one row per task state in the range, with exactly the documented keys', () => {
    const dirs = usageDirs('export-tasks')
    const dir = join(dirs.root, 'activity')
    mkdirSync(dir, { recursive: true })
    const epoch = (time: string) => new Date(at(time)).getTime() / 1000
    const events = [
      {
        id: 'k0',
        at: epoch('09:00:00') - 86_400,
        kind: 'task_state',
        projectId: 'p',
        task: 1,
        state: 'queued',
      },
      {
        id: 'k1',
        at: epoch('10:00:00'),
        kind: 'task_state',
        projectId: 'p',
        task: 1,
        state: 'waiting',
        waitKind: 'session',
        waitRef: 's1',
        assignee: 's2',
        baseline: true,
      },
      {
        id: 'k2',
        at: epoch('10:05:00'),
        kind: 'task_state',
        projectId: 'q',
        task: 4,
        state: 'to review',
        waitKind: 'pr-merge',
      },
      { id: 'k3', at: epoch('10:06:00'), kind: 'present', projectId: 'p' },
    ]
    writeFileSync(batchPath(dir, 0), events.map((e) => JSON.stringify({ v: 1, ...e })).join('\n'))
    projects(dirs, [
      { id: 'p', name: 'Client work', members: [] },
      { id: 'q', name: 'Side', members: [] },
    ])
    const all = cli(dirs, ['--period', 'today', '--rows', 'tasks'])
    expect(all.code).toBe(0)
    const found = rows(all.out)
    expect(found.map((r) => r.event)).toEqual(['k1', 'k2'])
    for (const row of found) expect(Object.keys(row)).toEqual([...TASK_EXPORT_KEYS])
    expect(found[0]).toEqual({
      schema: 1,
      event: 'k1',
      at: '2026-11-08T10:00:00-03:00',
      at_epoch: epoch('10:00:00'),
      project: 'Client work',
      task: 1,
      state: 'waiting',
      wait_kind: 'session',
      wait_ref: 's1',
      assignee: 's2',
      baseline: true,
    })
    expect(found[1]).toMatchObject({
      project: 'Side',
      wait_ref: null,
      assignee: null,
      baseline: false,
    })
    const scoped = rows(
      cli(dirs, ['--period', 'today', '--rows', 'tasks', '--project', 'Side']).out,
    )
    expect(scoped.map((r) => r.event)).toEqual(['k2'])
    const csv = cli(dirs, ['--period', 'today', '--rows', 'tasks', '--format', 'csv']).out.split(
      '\n',
    )
    expect(csv[0]).toBe(TASK_EXPORT_KEYS.join(','))
    expect(csv[2]).toBe(
      `1,k2,2026-11-08T10:05:00-03:00,${epoch('10:05:00')},Side,4,to review,pr-merge,,,false`,
    )
    expect(csv).toHaveLength(3)
  })

  test("the documentation's task table names exactly the task row's keys, in order", () => {
    const doc = readFileSync('docs/usage.md', 'utf8')
    const section = doc.slice(doc.indexOf('### Task rows'), doc.indexOf('### Pane rows'))
    const documented = [...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1])
    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual([...TASK_EXPORT_KEYS])
  })
})

// Decision 1.204 (b): how many sessions were blocked and working, per 15-minute window, global.
describe('menkar usage export --rows panes', () => {
  const nov8 = (h: number, m: number) => new Date(2026, 10, 8, h, m, 0).getTime() / 1000
  const journal = (dirs: Dirs, lines: readonly object[]) => {
    const dir = join(dirs.root, 'activity')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'journal.jsonl'),
      lines.map((l, i) => JSON.stringify({ v: 2, id: `j${i}`, ...l })).join('\n'),
    )
  }
  const pane = (paneId: string, state: string, at: number, seq: number) => ({
    kind: 'pane_state',
    paneId,
    state,
    at,
    seq,
  })
  const sign = (s: string, at: number) => ({ kind: 'watch', sign: s, at })

  // USG-84: the counts are global (1.204), so a project scope is refused, not silently ignored.
  test('USG-84 pane rows are global: --project is refused, and the keys are exactly the schema’s', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const dirs = usageDirs('export-panes-project')
    projects(dirs, [{ id: 'p', name: 'Client work', members: [] }])
    const refused = cli(dirs, ['--rows', 'panes', '--project', 'Client work'])
    expect(refused.code).toBe(2)
    expect(refused.out).toBe('')
    expect(refused.err).toContain(
      'Pane rows are counted over every project; --project does not apply to them.',
    )
    vi.setSystemTime(new Date(2026, 10, 8, 10, 20, 0))
    journal(dirs, [sign('start', nov8(10, 0))])
    const found = rows(cli(dirs, ['--period', 'today', '--rows', 'panes']).out)
    expect(found).toHaveLength(2)
    expect(PANE_EXPORT_SCHEMA).toBe(1)
    for (const row of found) expect(Object.keys(row)).toEqual([...PANE_EXPORT_KEYS])
  })

  // USG-85: a sign already in the history covers into time whose pane rows are still in the live
  // journal, so the export reads the journal too.
  test('USG-85 the export reads the live journal', () => {
    const dirs = usageDirs('export-panes-live')
    const history = new UsageHistory(dirs.history)
    const raw = history.handle?.raw
    raw?.prepare("INSERT INTO watch_signs VALUES ('s1', ?, 'start')").run(nov8(10, 0))
    raw?.prepare("INSERT INTO watch_signs VALUES ('s2', ?, 'tick')").run(nov8(10, 0))
    history.close()
    journal(dirs, [pane('A', 'idle', nov8(10, 0), 1), pane('A', 'blocked', nov8(10, 7), 2)])
    vi.setSystemTime(new Date(2026, 10, 8, 10, 14, 0))
    const found = rows(cli(dirs, ['--period', 'today', '--rows', 'panes']).out)
    expect(found).toEqual([
      expect.objectContaining({
        window_start: '2026-11-08T10:00:00-03:00',
        covered_seconds: 840,
        blocked_max: 1,
        blocked_seconds: 420,
        idle_seconds: 420,
      }),
    ])
  })

  test('USG-76’s case as JSON lines and as CSV, whole', () => {
    const dirs = usageDirs('export-panes-whole')
    journal(dirs, [
      sign('start', nov8(9, 0)),
      ...[15, 30, 45, 60].map((m) => sign('tick', nov8(9, m))),
      pane('A', 'idle', nov8(9, 0), 1),
      pane('B', 'idle', nov8(9, 0), 2),
      pane('B', 'working', nov8(9, 50), 3),
      pane('A', 'working', nov8(10, 3), 4),
      pane('A', 'blocked', nov8(10, 5), 5),
      pane('B', 'done', nov8(10, 6), 6),
      pane('A', 'working', nov8(10, 8), 7),
      pane('A', 'done', nov8(10, 12), 8),
    ])
    vi.setSystemTime(new Date(2026, 10, 8, 10, 20, 0))
    const window = (minute: number, rest: number[]) => [
      1,
      `2026-11-08T${minute < 60 ? '09' : '10'}:${String(minute % 60).padStart(2, '0')}:00-03:00`,
      nov8(9, minute),
      ...rest,
    ]
    const expected = [
      window(0, [900, 0, 0, 0, 0, 2, 1800, 0, 0]),
      window(15, [900, 0, 0, 0, 0, 2, 1800, 0, 0]),
      window(30, [900, 0, 0, 0, 0, 2, 1800, 0, 0]),
      window(45, [900, 0, 0, 1, 600, 2, 1200, 0, 0]),
      window(60, [900, 1, 180, 2, 720, 1, 180, 2, 720]),
      window(75, [60, 0, 0, 0, 0, 0, 0, 2, 120]),
    ]
    const jsonl = cli(dirs, ['--period', 'today', '--rows', 'panes'])
    expect(jsonl.code).toBe(0)
    expect(jsonl.out).toBe(
      expected
        .map((values) =>
          JSON.stringify(Object.fromEntries(PANE_EXPORT_KEYS.map((k, i) => [k, values[i]]))),
        )
        .join('\n'),
    )
    const csv = cli(dirs, ['--period', 'today', '--rows', 'panes', '--format', 'csv'])
    expect(csv.out).toBe(
      [PANE_EXPORT_KEYS.join(','), ...expected.map((v) => v.join(','))].join('\n'),
    )
  })

  test("the documentation's pane table names exactly the pane row's keys, in order", () => {
    const doc = readFileSync('docs/usage.md', 'utf8')
    const section = doc.slice(doc.indexOf('### Pane rows'))
    const documented = [...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1])
    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual([...PANE_EXPORT_KEYS])
  })

  // Times are sums of seconds with milliseconds: the float noise of the sums stops there.
  test('seconds are rounded to the millisecond', () => {
    const [row] = exportPaneRows([
      {
        start: 900,
        covered: 0.1 + 0.2,
        counts: {
          blocked: { max: 1, seconds: 0.1 + 0.2 },
          working: { max: 0, seconds: 0 },
          idle: { max: 1, seconds: 1.0004 },
          done: { max: 0, seconds: 0 },
        },
      },
    ])
    expect(row).toMatchObject({ covered_seconds: 0.3, blocked_seconds: 0.3, idle_seconds: 1 })
  })

  test('a window not covered has its counts null, an empty field in CSV', () => {
    const dirs = usageDirs('export-panes-null')
    journal(dirs, [sign('start', nov8(9, 0)), sign('quit', nov8(9, 10))])
    vi.setSystemTime(new Date(2026, 10, 8, 9, 20, 0))
    const found = rows(cli(dirs, ['--period', 'today', '--rows', 'panes']).out)
    expect(found[1]).toEqual({
      schema: 1,
      window_start: '2026-11-08T09:15:00-03:00',
      window_start_epoch: nov8(9, 15),
      covered_seconds: 0,
      blocked_max: null,
      blocked_seconds: null,
      working_max: null,
      working_seconds: null,
      idle_max: null,
      idle_seconds: null,
      done_max: null,
      done_seconds: null,
    })
    const csv = cli(dirs, ['--period', 'today', '--rows', 'panes', '--format', 'csv']).out
    expect(csv.split('\n')[2]).toBe(`1,2026-11-08T09:15:00-03:00,${nov8(9, 15)},0,,,,,,,,`)
  })
})
