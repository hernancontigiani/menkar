// The Usage report's figures across sessions, projects, categories, a resumed session, midnight and
// a month boundary, held to what the report gave before it read the statusline logs once per
// request; and the logs read once per request.
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { UsageHistory } from '../../../src/core/usage/history'
import { runPass } from '../../../src/core/usage/pass'
import {
  allBounds,
  type Bounds,
  type Bucket,
  midnight,
  monthBounds,
  periodBounds,
  rangeBounds,
} from '../../../src/core/usage/periods'
import { buildReport, buildSeries, buildUsage } from '../../../src/core/usage/report'
import { at, type Line, memberships, response, usageDirs } from '../../factories/usage'

const reads = new Map<string, number>()

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>()
  const readFileSync = ((path: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
    if (typeof path === 'string') reads.set(path, (reads.get(path) ?? 0) + 1)
    return (actual.readFileSync as (...args: unknown[]) => unknown)(path, ...rest)
  }) as typeof actual.readFileSync
  return { ...actual, readFileSync, default: { ...actual, readFileSync } }
})

const NOW = midnight({ year: 2026, month: 11, day: 8 }) + 15 * 3600

function turn(
  session: string,
  day: string,
  time: string,
  end: string,
  origin: string,
  model = 'claude-opus-5-5',
): Line[] {
  const id = `${session}-${day}-${time}`
  return [
    { type: 'user', uuid: id, timestamp: at(time, day), turnOrigin: origin },
    response(time, { id: `m-${id}`, model, tokens: { input: 40, output: 300, cacheRead: 9000 } }),
    response(end, { id: `m2-${id}`, model, tokens: { output: 120, cacheWrite: 700 } }),
  ].map((l, i) => (i === 0 ? l : { ...l, timestamp: at(i === 1 ? time : end, day) }))
}

function status(day: string, time: string, session: string, cost: number, limits?: number[]) {
  return JSON.stringify({
    at: at(time, day),
    session_id: session,
    cost_usd: cost,
    ...(limits ? { five_hour_pct: limits[0], seven_day_pct: limits[1] } : {}),
  })
}

// Four sessions in two projects and none; turns across midnight and from October into November;
// a session resumed before the log saw it; a total that drops; a session the history never saw.
function fixture() {
  const dirs = usageDirs('parity')
  dirs.transcript('s1', [
    ...turn('s1', '2026-10-31', '23:30:00', '23:59:30', 'human'),
    ...turn('s1', '2026-11-01', '00:10:00', '00:40:00', 'task_notification'),
    ...turn('s1', '2026-11-02', '09:00:00', '09:20:00', 'human', 'claude-haiku-5-5'),
    ...turn('s1', '2026-11-08', '08:00:00', '08:30:00', 'peer'),
  ])
  dirs.transcript('s2', [
    ...turn('s2', '2026-11-07', '23:50:00', '23:59:50', 'human'),
    ...turn('s2', '2026-11-08', '00:05:00', '00:30:00', 'peer'),
    ...turn('s2', '2026-11-08', '14:00:00', '14:10:00', 'human', 'claude-sonnet-5-5'),
  ])
  dirs.transcript('s3', [
    ...turn('s3', '2026-11-05', '10:00:00', '10:30:00', 'unknown'),
    ...turn('s3', '2026-11-08', '10:00:00', '10:45:00', 'human'),
  ])
  dirs.transcript('s4', [
    ...turn('s4', '2026-10-20', '12:00:00', '12:30:00', 'human'),
    ...turn('s4', '2026-11-05', '12:00:00', '12:30:00', 'human'),
    ...turn('s4', '2026-11-06', '13:00:00', '13:40:00', 'task_notification'),
  ])
  const member = memberships(
    { s1: ['a', 'Alpha'], s2: ['b', 'Beta'], s4: ['a', 'Alpha'] },
    { a: 'Alpha', b: 'Beta' },
  )
  runPass(member, { claudeProjects: dirs.claudeProjects, cache: dirs.cache, history: dirs.history })
  const history = new UsageHistory(dirs.history)
  history.setCategories(
    new Map([
      ['s1-2026-10-31-23:30:00', 'build'],
      ['s1-2026-11-02-09:00:00', 'plan'],
      ['s2-2026-11-08-14:00:00', 'test'],
      ['s3-2026-11-05-10:00:00', 'design'],
      ['s4-2026-10-20-12:00:00', 'build'],
    ]),
  )
  history.close()
  const imported = join(dirs.root, 'imported.jsonl')
  fs.writeFileSync(
    imported,
    [
      status('2026-10-31', '23:40:00', 's1', 0.5),
      status('2026-10-31', '23:59:00', 's1', 0.9, [10, 20]),
      'not json',
      status('2026-11-01', '00:00:00', 's1', 1.1),
      status('2026-11-01', '00:20:00', 's1', 1.25),
      status('2026-11-01', '00:30:00', 's1', 1.375),
    ].join('\n'),
  )
  fs.mkdirSync(join(dirs.root, 'cache'), { recursive: true })
  fs.writeFileSync(
    dirs.statuslineLog,
    [
      status('2026-11-02', '09:10:00', 's1', 1.6),
      status('2026-11-05', '10:10:00', 's3', 0.3),
      status('2026-11-05', '12:10:00', 's4', 7.5),
      status('2026-11-05', '12:20:00', 's4', 7.75, [30, 40]),
      status('2026-11-06', '13:10:00', 's4', 7.7),
      status('2026-11-06', '13:30:00', 's4', 8.1),
      status('2026-11-07', '23:55:00', 's2', 0.1),
      status('2026-11-08', '00:00:00', 's2', 0.2),
      status('2026-11-08', '00:10:00', 's2', 0.35),
      status('2026-11-08', '00:20:00', 's2', 0.35),
      status('2026-11-08', '08:10:00', 's1', 1.9),
      status('2026-11-08', '10:20:00', 's3', 0.65),
      status('2026-11-08', '10:40:00', 'ghost', 2),
      status('2026-11-08', '14:05:00', 's2', 0.8, [55, 61]),
      JSON.stringify({ at: at('14:06:00'), session_id: 's2' }),
    ].join('\n'),
  )
  return { history: dirs.history, logs: [imported, dirs.statuslineLog], member }
}

const data = fixture()

function cases(history: UsageHistory): [string, Bounds, Bucket][] {
  return [
    ['today by hour', periodBounds('today', NOW), 'hour'],
    ['7 days by day', periodBounds('7d', NOW), 'day'],
    ['November by day', monthBounds(2026, 11), 'day'],
    [
      'October 25 to November 8 by day',
      rangeBounds({ year: 2026, month: 10, day: 25 }, { year: 2026, month: 11, day: 8 }),
      'day',
    ],
    ['all by month', allBounds(history.firstOpened(), NOW), 'month'],
  ]
}

function usage(categories: boolean, project: string | undefined) {
  const history = new UsageHistory(data.history)
  try {
    const options = {
      statuslineLogs: data.logs,
      projectNames: data.member.projectNames,
      categories,
      ...(project === undefined ? {} : { project }),
    }
    return cases(history).map(([name, bounds, unit]) => ({
      name,
      usage: buildUsage(history, bounds, unit, options),
      report: buildReport(history, bounds, options),
      series: buildSeries(history, bounds, unit, options),
    }))
  } finally {
    history.close()
  }
}

// What the report gave before the change, per case: a hash of its JSON, whose numbers JSON writes
// in their shortest exact form, so one changed figure or rounding changes the hash.
// Taken from the code that read the logs once per bar (2026-11-14).
const BEFORE: Record<string, string> = {
  'false/undefined/today by hour':
    '39e723e24906a95407f4f7194a3cee6704bf88e763c7fba45e53be64c449c1da',
  'false/undefined/7 days by day':
    'feb1945f359314880506b573cead8ce666361a6a36eb6d4bff6a16ae7989ad03',
  'false/undefined/November by day':
    'bae6e60089384e73c02018b86a798936febb959b4cf6cacf7beb8254b50e3f9a',
  'false/undefined/October 25 to November 8 by day':
    '4fbc750f51a2bbc26b2d82648889a21e05b416b9651351bebcd09263ba9dcc0b',
  'false/undefined/all by month':
    '211e0288f4fa0501c3d26e0597e4ef70d170f8929c9955d3419389b286e9f7b2',
  'true/undefined/today by hour':
    '6de66264fc8efdd3c7b4f41fee5204964424b208491e4b4a047b7cc5028aaa9b',
  'true/undefined/7 days by day':
    '1e25f54fbbc14498c67bc882d8c336258c25f0605f16c9aa6a379dae10af35b2',
  'true/undefined/November by day':
    'ea982eaa00cabb4ac00110ba13ca18a0f72b9382476863a128bfa83eabe904da',
  'true/undefined/October 25 to November 8 by day':
    'b957ca9db53a96e93aaf6fa9cd726473711f03fd8eb997c2ff34e8e3c9bd49b1',
  'true/undefined/all by month': '2c212894334f1369edd2e0438aaaf53a16ac4b65469728c63fc5c399489cd904',
  'false/a/today by hour': '34a379c975ffdfbb0e21f952959d8bde7eb4cb48add0277c1611713df33db7ed',
  'false/a/7 days by day': 'ad4a8029d8bd974afb5614ee9aa3e2c8fbf04779ef9556c717b1bde6a64272f3',
  'false/a/November by day': 'ec5da699f5d708e039d56f06b191ac2c4e67d00ac615fea7d8c027dbeb649b40',
  'false/a/October 25 to November 8 by day':
    '08857ea08984510cdccc62388b1ec1872a5910a8162bae7109db41854b12724f',
  'false/a/all by month': 'bfb84c143fdd8160d8692b5154899e383f31bdb728e574fd69c5a723ad24bde2',
  'true/a/today by hour': '50b33916db8d398413d0b47f3a06654cec0d0c19ac7bcbd6e82b3bce5a468c9c',
  'true/a/7 days by day': '3caaa66486f392b16025b19d189f50a1145891c2f48e99c08bdacc776a7824dc',
  'true/a/November by day': 'cb86b7cdede346674110c52de92c8f75bdb9c2354dd71ae4fca6e532ff08801a',
  'true/a/October 25 to November 8 by day':
    '00a7ee16fa2aee24f31521fe451efce5856042f81f7a10d9622e6e30126be370',
  'true/a/all by month': '01b5499814cab8e640b783ca28a9be20bbdc6c95c296aa2cfbf49f1fc244e149',
}

describe('the report is the same as before reading the logs once', () => {
  test.each([
    [false, undefined],
    [true, undefined],
    [false, 'a'],
    [true, 'a'],
  ])('categories %s, project %s', (categories, project) => {
    const found = usage(categories, project)
    expect(found).toHaveLength(5)
    const costs = found.flatMap((c) => c.usage.totals.nodes.map((n) => n.cost))
    expect(costs.some((c) => c > 0)).toBe(true)
    const hashes = Object.fromEntries(
      found.map((c) => [
        `${categories}/${project}/${c.name}`,
        createHash('sha256').update(JSON.stringify(c)).digest('hex'),
      ]),
    )
    for (const [key, hash] of Object.entries(hashes)) expect(hash).toBe(BEFORE[key])
  })
})

test('a request reads each statusline log once', () => {
  const history = new UsageHistory(data.history)
  try {
    reads.clear()
    const usage = buildUsage(history, monthBounds(2026, 11), 'day', {
      statuslineLogs: data.logs,
      categories: true,
    })
    expect(usage.bars).toHaveLength(30)
    expect(Object.fromEntries(reads)).toEqual(Object.fromEntries(data.logs.map((l) => [l, 1])))
  } finally {
    history.close()
  }
})

test('a request prepares each per-line lookup once, however many lines the logs hold', () => {
  const history = new UsageHistory(data.history)
  try {
    const raw = history.handle?.raw
    if (raw === undefined) throw new Error('the history did not open')
    const prepare = vi.spyOn(raw, 'prepare')
    buildUsage(history, monthBounds(2026, 11), 'day', {
      statuslineLogs: data.logs,
      categories: true,
    })
    const lookups = prepare.mock.calls.filter(([sql]) =>
      /session_id = \? AND .*opened <= \?|session_id = \? ORDER BY/.test(sql),
    )
    expect(lookups.length).toBeGreaterThan(0)
    expect(lookups.length).toBeLessThanOrEqual(4)
  } finally {
    history.close()
  }
})
