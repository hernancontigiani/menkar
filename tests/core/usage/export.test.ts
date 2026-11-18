// `menkar usage export`: one row per turn for an LLM session or a spreadsheet to analyse (plan 17,
// decision 1.16).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { batchPath } from '../../../src/core/usage/activity'
import { runUsageCli } from '../../../src/core/usage/cli'
import { ACTIVITY_EXPORT_KEYS, EXPORT_KEYS, TASK_EXPORT_KEYS } from '../../../src/core/usage/export'
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
        'models,cost_usd,cost_exact',
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
    const section = doc.slice(doc.indexOf('### Task rows'))
    const documented = [...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1])
    expect(documented.length).toBeGreaterThan(0)
    expect(documented).toEqual([...TASK_EXPORT_KEYS])
  })
})
