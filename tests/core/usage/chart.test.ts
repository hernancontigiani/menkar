// The By-day chart as data (docs/spec/usage.md, USG-47 to USG-49; look.md's Usage window).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { describe, expect, test } from 'vitest'
import {
  axisLabels,
  axisScale,
  barHeading,
  barLabel,
  buildChart,
  labelEvery,
  seriesColor,
} from '../../../src/core/usage/chart'
import { ZERO_TOKENS } from '../../../src/core/usage/history'
import type { Node, Report } from '../../../src/core/usage/report'

const node = (label: string, seconds: number, kind: Node['kind'] = 'project'): Node => ({
  label,
  kind,
  execution: { human: seconds },
  blocked: 0,
  tokens: { ...ZERO_TOKENS, output: seconds * 10 },
  cost: seconds / 100,
  costExact: false,
  allPriced: true,
  children: [],
})

const report = (...nodes: Node[]): Report => ({
  bounds: { start: 0, end: 1 },
  nodes,
  limits: null,
  tooNew: false,
})

describe('series', () => {
  test('USG-48 the five largest projects keep a color, ordered by name; the rest sum into Other, last', () => {
    const sizes = {
      Zeta: 700,
      alpha: 600,
      Beta: 500,
      gamma: 400,
      Delta: 300,
      eps: 200,
      '(no project)': 650,
    }
    const bars = [report(...Object.entries(sizes).map(([label, s]) => node(label, s)))]
    const chart = buildChart(bars, 'exec', 'project')
    expect(chart.series.map((s) => [s.key, s.slot])).toEqual([
      ['alpha', 0],
      ['Beta', 1],
      ['gamma', 2],
      ['Zeta', 3],
      ['(no project)', 4],
      ['Other', null],
    ])
    expect(chart.bars[0]).toEqual([600, 500, 400, 700, 650, 300 + 200])
  })

  test('a project with nothing in the period gets no series, and no Other is drawn for nothing', () => {
    const chart = buildChart([report(node('A', 10), node('B', 0))], 'exec', 'project')
    expect(chart.series).toEqual([{ key: 'A', slot: 0 }])
  })

  test('categories keep their fixed order and slot, unclassified gray and last, only those present', () => {
    const bars = [
      report(
        node('test', 5, 'category'),
        node('(unclassified)', 2, 'category'),
        node('build', 3, 'category'),
      ),
      report(node('plan', 0, 'category')),
    ]
    const chart = buildChart(bars, 'exec', 'category')
    expect(chart.series).toEqual([
      { key: 'build', slot: 2 },
      { key: 'test', slot: 3 },
      { key: '(unclassified)', slot: null },
    ])
    expect(chart.bars).toEqual([
      [3, 5, 2],
      [0, 0, 0],
    ])
  })

  test('the metric picks execution, total tokens or cost', () => {
    const bars = [report(node('A', 60))]
    expect(buildChart(bars, 'exec', 'project').bars[0]).toEqual([60])
    expect(buildChart(bars, 'tokens', 'project').bars[0]).toEqual([600])
    expect(buildChart(bars, 'cost', 'project').bars[0]).toEqual([0.6])
  })

  test('colors follow the slot and the scheme', () => {
    expect(seriesColor({ key: 'plan', slot: 0 }, false)).toBe('#2a78d6')
    expect(seriesColor({ key: 'plan', slot: 0 }, true)).toBe('#3987e5')
    expect(seriesColor({ key: 'Other', slot: null }, true)).toBe('#8f8e8a')
    expect(seriesColor({ key: 'other', slot: 6 }, false)).toBe('#6250d6')
  })
})

describe('axis and labels', () => {
  // Decision 1.14: the top is the first multiple of a 1, 2, 2.5 or 5 × 10^n step at or above the
  // tallest bar, the step the smallest that leaves at most 5 intervals; time is stepped in the unit
  // the axis shows (hours from one hour up, minutes below).
  test.each([
    ['exec', 0, 60, 60],
    ['exec', 10_440, 3 * 3600, 3600],
    ['exec', 42 * 60, 50 * 60, 10 * 60],
    ['exec', 5.6 * 3600, 6 * 3600, 2 * 3600],
    ['exec', 1.2 * 3600, 1.25 * 3600, 0.25 * 3600],
    ['tokens', 5040, 6000, 2000],
    ['tokens', 1_000_000, 1_000_000, 200_000],
    ['cost', 0.7, 0.8, 0.2],
    ['cost', 12.5, 12.5, 2.5],
  ] as const)(
    'the %s axis for a tallest bar of %d: top %d, a line every %d',
    (metric, tallest, top, step) => {
      const scale = axisScale(tallest, metric)
      expect(scale.top).toBeCloseTo(top, 9)
      expect(scale.step).toBeCloseTo(step, 9)
      expect(Math.round(scale.top / scale.step)).toBeLessThanOrEqual(5)
    },
  )

  test('USG-47 hours, days of the month and short month names under the bars', () => {
    const nine = new Date(2026, 10, 8, 9).getTime() / 1000
    expect(barLabel(nine, 'hour', 'en')).toBe('09')
    expect(barLabel(new Date(2026, 10, 2).getTime() / 1000, 'day', 'en')).toBe('2')
    expect(barLabel(new Date(2026, 9, 1).getTime() / 1000, 'month', 'en')).toBe('Oct')
    expect(barLabel(new Date(2026, 9, 1).getTime() / 1000, 'month', 'es')).toBe('oct')
  })

  test('USG-49 the tooltip heading: an hour, a day, a month', () => {
    expect(barHeading(new Date(2026, 10, 8, 9).getTime() / 1000, 'hour', 'en')).toBe('09:00')
    expect(barHeading(new Date(2026, 10, 4).getTime() / 1000, 'day', 'en')).toBe('2026-11-04')
    expect(barHeading(new Date(2026, 9, 1).getTime() / 1000, 'month', 'en')).toBe('October 2026')
  })

  test('labels thin out so they stay at least 28 px apart', () => {
    expect(labelEvery(24, 688)).toBe(1)
    expect(labelEvery(30, 688)).toBe(2)
    expect(labelEvery(31, 280)).toBe(4)
  })
})

// Decision 1.13: the By-day axis. Seven days: every bar, weekday and day. Longer spans: the first
// bar and every Monday, day and month, a label dropped where it would run into the previous one.
describe('the By-day axis labels', () => {
  const days = (year: number, month: number, day: number, count: number) =>
    Array.from({ length: count }, (_, i) => new Date(year, month, day + i).getTime() / 1000)
  const kept = (labels: readonly (string | null)[]) =>
    labels.flatMap((label, i) => (label === null ? [] : [[i, label] as const]))

  test("7 days: every bar has its weekday and day, in the app's language", () => {
    const week = days(2026, 10, 2, 7)
    expect(axisLabels(week, 'day', 'week', 'en', 700)).toEqual([
      'Mon 2',
      'Tue 3',
      'Wed 4',
      'Thu 5',
      'Fri 6',
      'Sat 7',
      'Sun 8',
    ])
    expect(axisLabels(week, 'day', 'week', 'es', 700)).toEqual([
      'lun 2',
      'mar 3',
      'mié 4',
      'jue 5',
      'vie 6',
      'sáb 7',
      'dom 8',
    ])
  })

  test('30 days on a wide plot: a label on every bar, across the month boundary', () => {
    const span = days(2026, 9, 15, 30)
    const labels = axisLabels(span, 'day', 'long', 'en', 1300)
    expect(labels.every((l) => l !== null)).toBe(true)
    expect(labels[0]).toBe('Oct 15')
    expect(labels[17]).toBe('Nov 1')
    expect(axisLabels(span, 'day', 'long', 'es', 1300)[17]).toBe('1 nov')
  })

  test('30 days on a middling plot: every second bar from the first', () => {
    const span = days(2026, 9, 15, 30)
    expect(kept(axisLabels(span, 'day', 'long', 'en', 700)).map(([i]) => i)).toEqual(
      Array.from({ length: 15 }, (_, k) => k * 2),
    )
  })

  test('30 days on a narrow plot: a week apart, from the first bar', () => {
    const span = days(2026, 9, 15, 30)
    expect(kept(axisLabels(span, 'day', 'long', 'en', 300))).toEqual([
      [0, 'Oct 15'],
      [7, 'Oct 22'],
      [14, 'Oct 29'],
      [21, 'Nov 5'],
      [28, 'Nov 12'],
    ])
  })

  test('the stride is 1, 2, 3, 7 or 14 days, the smallest whose labels do not collide', () => {
    const june = days(2026, 5, 1, 30)
    for (const width of [150, 250, 400, 550, 800, 1300]) {
      const at = kept(axisLabels(june, 'day', 'long', 'en', width)).map(([i]) => i)
      const stride = at[1] ?? 0
      expect([1, 2, 3, 7, 14]).toContain(stride)
      expect(at[0]).toBe(0)
      expect(at.every((x, k) => x === k * stride)).toBe(true)
    }
    expect(kept(axisLabels(june, 'day', 'long', 'en', 150)).map(([i]) => i)).toEqual([0, 14, 28])
  })

  test('hours and months keep one label every few bars, as before', () => {
    const hours = Array.from({ length: 24 }, (_, h) => new Date(2026, 10, 8, h).getTime() / 1000)
    const labels = axisLabels(hours, 'hour', 'long', 'en', 300)
    expect(labels[0]).toBe('00')
    expect(labels.filter((l) => l !== null)).toHaveLength(Math.ceil(24 / labelEvery(24, 300)))
  })
})
