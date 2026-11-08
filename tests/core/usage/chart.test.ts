// The By-day chart as data (docs/spec/usage.md, USG-47 to USG-49; look.md's Usage window).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { describe, expect, test } from 'vitest'
import {
  axisTop,
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
  test.each([
    [0, 1],
    [0.7, 1],
    [1, 1],
    [1.2, 2],
    [3, 5],
    [6, 10],
    [42, 50],
    [5040, 10000],
  ])('the axis top for a tallest bar of %d is %d', (tallest, top) => {
    expect(axisTop(tallest)).toBe(top)
  })

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
