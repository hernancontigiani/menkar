// `menkar usage` and how categories show in its reports (docs/spec/usage.md, USG-33, USG-39 to
// USG-43, USG-55 to USG-60).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { openDb } from '../../../src/core/db'
import { runUsageCli } from '../../../src/core/usage/cli'
import { UsageHistory } from '../../../src/core/usage/history'
import { type NodeJson, reportJson } from '../../../src/core/usage/report'
import { prompt, response, usageDirs } from '../../factories/usage'

type Dirs = ReturnType<typeof usageDirs>

function cli(dirs: Dirs, args: string[]) {
  const out: string[] = []
  const err: string[] = []
  const code = runUsageCli(
    args,
    { out: (t) => out.push(t), err: (t) => err.push(t) },
    {
      passPaths: { claudeProjects: dirs.claudeProjects, cache: dirs.cache, history: dirs.history },
      configDir: join(dirs.root, 'config'),
      statuslineLogs: [dirs.statuslineLog],
    },
  )
  return { code, out: out.join('\n'), err: err.join('\n') }
}

function config(dirs: Dirs, projects: unknown, classifying = false) {
  const dir = join(dirs.root, 'config')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'projects.json'), JSON.stringify(projects))
  writeFileSync(
    join(dir, 'state.json'),
    JSON.stringify({ settings: classifying ? { classify_since: 1 } : {} }),
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 8, 18, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('menkar usage', () => {
  test('USG-55 with no arguments it prints the 7-day text report and exits 0', () => {
    const dirs = usageDirs('usg55')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:30:00', { tokens: { output: 2000 } })])
    config(dirs, { projects: [{ id: 'p', name: 'Client work', members: ['s1'] }] })
    const result = cli(dirs, [])
    expect(result.code).toBe(0)
    expect(result.out.split('\n')).toEqual([
      `${' '.repeat(44)}    exec  blocked   tokens      cost`,
      `${'Client work'.padEnd(44)}     30m       0m       2k    ~$0.04`,
      `${'  s1'.padEnd(44)}     30m       0m       2k    ~$0.04`,
      '~ = list-price estimate; + = a model without a price',
    ])
  })

  test('--json gives each node its tokens and list-price cost by model, in snake_case', () => {
    const dirs = usageDirs('models-json')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:10', { model: 'claude-opus-4-5', tokens: { input: 100, cacheWrite: 40 } }),
      response('10:00:20', { id: 'msg_h', model: 'claude-haiku-4-5', tokens: { output: 7 } }),
    ])
    config(dirs, { projects: [{ id: 'p', name: 'Client work', members: ['s1'] }] })
    const json = JSON.parse(cli(dirs, ['--period', 'today', '--json']).out)
    const project = json.nodes[0] as NodeJson
    expect(Object.keys(project.models).sort()).toEqual(['claude-haiku-4-5', 'claude-opus-4-5'])
    expect(project.models['claude-opus-4-5']).toMatchObject({
      input: 100,
      output: 0,
      cache_write: 40,
      cache_write_1h: 0,
      cache_read: 0,
      priced: true,
    })
    expect(project.models['claude-haiku-4-5']?.output).toBe(7)
    expect(project.children[0]?.models).toEqual(project.models)
    const costs = Object.values(project.models).map((m) => m.cost_usd)
    expect(costs.reduce((a, b) => a + b, 0)).toBeCloseTo(project.cost_usd, 12)
  })

  test('USG-56 --from and --to cover both days whole', () => {
    const dirs = usageDirs('usg56')
    const result = cli(dirs, ['--from', '2026-11-01', '--to', '2026-11-03', '--json'])
    const json = JSON.parse(result.out)
    expect([json.start, json.end]).toEqual([
      '2026-11-01T00:00:00-03:00',
      '2026-11-04T00:00:00-03:00',
    ])
  })

  test.each([
    [['--from', '2026-11-01'], '--from and --to go together'],
    [['--to', '2026-11-01', '--month', '2026-10'], '--from and --to go together'],
    [['--period', 'today', '--month', '2026-10'], 'cannot be used together'],
    [['--month', '2026-13'], 'is not a month'],
    [['--period', 'week'], 'is not one of'],
    [['--by', 'year'], 'is not one of'],
    [['--from', '2026-02-30', '--to', '2026-03-01'], 'is not a date'],
  ])('USG-57 a usage error exits 2: %j', (args, message) => {
    const result = cli(usageDirs('usg57'), args)
    expect(result.code).toBe(2)
    expect(result.err).toContain(message)
  })

  test('USG-58 --by hour --json gives every hour of today, empty ones included', () => {
    const dirs = usageDirs('usg58')
    dirs.transcript('s1', [prompt('09:00:00'), response('09:20:00')])
    const json = JSON.parse(cli(dirs, ['--period', 'today', '--by', 'hour', '--json']).out)
    expect(json).toHaveLength(24)
    expect(json.filter((r: { nodes: unknown[] }) => r.nodes.length > 0)).toHaveLength(1)
    const text = cli(dirs, ['--period', 'today', '--by', 'hour']).out
    expect(text.match(/^== /gm)).toHaveLength(1)
    expect(text).toContain('== 2026-11-08 09:00 – 2026-11-08 10:00')
  })

  test('USG-59 a long label is cut to 44 characters; a child is indented two spaces per level', () => {
    const dirs = usageDirs('usg59')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      { type: 'custom-title', customTitle: 'x'.repeat(60) },
      response('10:00:30'),
    ])
    config(dirs, { projects: [{ id: 'p', name: 'P', members: ['s1'] }] })
    const line = cli(dirs, ['--period', 'today']).out.split('\n')[2] ?? ''
    expect(line.slice(0, 45)).toBe(`  ${'x'.repeat(42)} `)
  })

  test('USG-60 with no history and nowhere to write one, both messages and exit 1', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const dirs = usageDirs('usg60')
    const data = join(dirs.root, 'data')
    mkdirSync(data, { recursive: true })
    chmodSync(data, 0o500)
    try {
      const result = cli(dirs, [])
      expect(result.code).toBe(1)
      expect(result.err.split('\n')).toEqual([
        'Could not read the latest transcripts into the usage history; showing it as it was.',
        'Could not open the usage history.',
      ])
    } finally {
      chmodSync(data, 0o700)
    }
  })

  test('USG-33 a history from a newer Menkar prints one line; --json says so with no nodes', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const dirs = usageDirs('usg33-cli')
    const db = openDb(dirs.history)
    db.setUserVersion(99)
    db.close()
    expect(cli(dirs, []).out).toBe('Usage history is from a newer version of Menkar')
    const json = JSON.parse(cli(dirs, ['--json']).out)
    expect(json).toMatchObject({ nodes: [], history_too_new: true })
  })
})

describe('categories in usage', () => {
  function classified(dirs: Dirs, categories: Record<string, string>) {
    const history = new UsageHistory(dirs.history)
    const update = history.handle?.raw.prepare('UPDATE turns SET category = ? WHERE uuid = ?')
    for (const [uuid, category] of Object.entries(categories)) update?.run(category, uuid)
    history.close()
  }

  test('USG-39 off: project → session, with no category nodes even in JSON', () => {
    const dirs = usageDirs('usg39')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:30')])
    config(dirs, { projects: [{ id: 'p', name: 'P', members: ['s1'] }] }, false)
    const json = JSON.parse(cli(dirs, ['--json']).out)
    expect(json.nodes[0].children.map((n: NodeJson) => n.kind)).toEqual(['session'])
  })

  test("USG-40 a turn the human did not start takes the human's previous category", () => {
    const dirs = usageDirs('usg40')
    dirs.transcript('s1', [
      prompt('10:00:00'),
      response('10:00:10'),
      prompt('10:30:00', { turnOrigin: 'peer' }),
      response('10:30:20'),
      prompt('11:00:00'),
      response('11:00:40'),
      prompt('11:20:00', { turnOrigin: 'task_notification' }),
      response('11:20:59'),
    ])
    config(dirs, { projects: [{ id: 'p', name: 'P', members: ['s1'] }] }, true)
    cli(dirs, [])
    classified(dirs, { 'u-10:00:00': 'build' })
    const json = JSON.parse(cli(dirs, ['--json', '--period', 'today']).out)
    const byCategory = Object.fromEntries(
      json.nodes[0].children.map((c: NodeJson) => [c.label, c.execution_seconds]),
    )
    expect(byCategory).toEqual({
      build: { human: 10, peer: 20 },
      '(unclassified)': { human: 40, task_notification: 59 },
    })
  })

  test('USG-41 an unknown turn shows its own category (decision 1.10)', () => {
    const dirs = usageDirs('usg41')
    dirs.transcript('s1', [
      {
        type: 'user',
        uuid: 'old-1',
        timestamp: new Date(2026, 10, 8, 10).toISOString(),
        message: { content: 'hi' },
      },
      response('10:00:30'),
    ])
    config(dirs, { projects: [{ id: 'p', name: 'P', members: ['s1'] }] }, true)
    cli(dirs, [])
    classified(dirs, { 'old-1': 'plan' })
    const json = JSON.parse(cli(dirs, ['--json', '--period', 'today']).out)
    expect(json.nodes[0].children.map((c: NodeJson) => c.category)).toEqual(['plan'])
  })

  test('USG-42 categories in their fixed order, unclassified last', () => {
    const dirs = usageDirs('usg42')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:10')])
    dirs.transcript('s2', [
      { ...prompt('10:00:00'), uuid: 'b' },
      response('10:00:20', { id: 'm2' }),
    ])
    dirs.transcript('s3', [
      { ...prompt('10:00:00'), uuid: 'c' },
      response('10:00:30', { id: 'm3' }),
    ])
    config(dirs, { projects: [{ id: 'p', name: 'P', members: ['s1', 's2', 's3'] }] }, true)
    cli(dirs, [])
    classified(dirs, { 'u-10:00:00': 'test', b: 'build' })
    const json = JSON.parse(cli(dirs, ['--json', '--period', 'today']).out)
    expect(json.nodes[0].children.map((c: NodeJson) => c.label)).toEqual([
      'build',
      'test',
      '(unclassified)',
    ])
  })

  test('USG-43 the text report stays project → session; JSON carries the unclassified node', () => {
    const dirs = usageDirs('usg43')
    dirs.transcript('s1', [prompt('10:00:00'), response('10:00:10')])
    config(dirs, { projects: [{ id: 'p', name: 'P', members: ['s1'] }] }, true)
    const text = cli(dirs, ['--period', 'today']).out
    expect(text).not.toContain('nclassified')
    const json = JSON.parse(cli(dirs, ['--json', '--period', 'today']).out)
    expect(json.nodes[0].children[0]).toMatchObject({
      kind: 'category',
      category: null,
      label: '(unclassified)',
    })
  })
})

test('a report is JSON with local offsets, five token counts and limits', () => {
  const json = reportJson({
    bounds: {
      start: new Date(2026, 10, 2).getTime() / 1000,
      end: new Date(2026, 10, 9).getTime() / 1000,
    },
    nodes: [],
    limits: [41, 12],
    tooNew: false,
  })
  expect(json).toEqual({
    start: '2026-11-02T00:00:00-03:00',
    end: '2026-11-09T00:00:00-03:00',
    nodes: [],
    limits: [41, 12],
    history_too_new: false,
  })
})
