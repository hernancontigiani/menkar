// The Usage window's By-day chart as data: which series are stacked, their values per bar, the
// axis, the bar labels and the tooltips. The renderer only draws what this returns. No Node import:
// the renderer may use it.
import {
  CATEGORIES,
  NO_PROJECT,
  type Node,
  type Report,
  totalExecution,
  UNCLASSIFIED,
} from './nodes'

export type Metric = 'exec' | 'tokens' | 'cost'
export type Stack = 'project' | 'category'

// The series colors by slot; "Other" projects and "(unclassified)" are gray. The set follows the
// light / dark scheme, not the theme.
export const SLOT_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'],
} as const
export const GRAY = { light: '#8a8986', dark: '#8f8e8a' } as const

export const OTHER_PROJECTS = 'Other'
const TOP_PROJECTS = 5

export function metricValue(node: Node, metric: Metric): number {
  if (metric === 'exec') return totalExecution(node)
  if (metric === 'tokens') {
    return node.tokens.input + node.tokens.output + node.tokens.cacheWrite + node.tokens.cacheRead
  }
  return node.cost
}

export interface Series {
  // the series' key: a project's label, a category key, OTHER_PROJECTS or UNCLASSIFIED
  readonly key: string
  // null: gray
  readonly slot: number | null
}

export interface Chart {
  // bottom to top, in legend order
  readonly series: readonly Series[]
  // per bar, one value per series
  readonly bars: readonly (readonly number[])[]
  readonly axisTop: number
}

const fold = (text: string) => text.toLocaleLowerCase('en')

// The smallest 1, 2 or 5 × a power of ten at or above the tallest bar; 1 when all are 0.
export function axisTop(tallest: number): number {
  if (!(tallest > 0)) return 1
  let power = 10 ** Math.floor(Math.log10(tallest))
  for (;;) {
    for (const step of [1, 2, 5]) if (step * power >= tallest - 1e-12) return step * power
    power *= 10
  }
}

function projectSeries(reports: readonly Report[], metric: Metric): Chart {
  const totals = new Map<string, number>()
  for (const report of reports) {
    for (const project of report.nodes) {
      totals.set(project.label, (totals.get(project.label) ?? 0) + metricValue(project, metric))
    }
  }
  const top = [...totals]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1] || (fold(a[0]) < fold(b[0]) ? -1 : 1))
    .slice(0, TOP_PROJECTS)
    .map(([label]) => label)
    .sort(
      (a, b) => Number(a === NO_PROJECT) - Number(b === NO_PROJECT) || (fold(a) < fold(b) ? -1 : 1),
    )
  const others = [...totals.keys()].some(
    (label) => !top.includes(label) && (totals.get(label) ?? 0) > 0,
  )
  const series: Series[] = top.map((key, i) => ({ key, slot: i }))
  if (others) series.push({ key: OTHER_PROJECTS, slot: null })
  const bars = reports.map((report) => {
    const values = series.map(() => 0)
    for (const project of report.nodes) {
      const index = top.indexOf(project.label)
      const at = index >= 0 ? index : others ? series.length - 1 : -1
      if (at >= 0) values[at] = (values[at] ?? 0) + metricValue(project, metric)
    }
    return values
  })
  return { series, bars, axisTop: axisTop(Math.max(0, ...bars.map(sum))) }
}

// The reports must have been built with categories and folded across projects (foldByCategory).
function categorySeries(reports: readonly Report[], metric: Metric): Chart {
  const present = new Set<string>()
  for (const report of reports) {
    for (const node of report.nodes) if (metricValue(node, metric) > 0) present.add(node.label)
  }
  const keys = [...CATEGORIES.filter((c) => present.has(c))] as string[]
  if (present.has(UNCLASSIFIED)) keys.push(UNCLASSIFIED)
  const series = keys.map((key) => ({
    key,
    slot: key === UNCLASSIFIED ? null : (CATEGORIES as readonly string[]).indexOf(key),
  }))
  const bars = reports.map((report) =>
    keys.map((key) => {
      const node = report.nodes.find((n) => n.label === key)
      return node ? metricValue(node, metric) : 0
    }),
  )
  return { series, bars, axisTop: axisTop(Math.max(0, ...bars.map(sum))) }
}

function sum(values: readonly number[]): number {
  let total = 0
  for (const value of values) total += value
  return total
}

export function buildChart(reports: readonly Report[], metric: Metric, stack: Stack): Chart {
  return stack === 'project' ? projectSeries(reports, metric) : categorySeries(reports, metric)
}

export function seriesColor(series: Series, dark: boolean): string {
  const scheme = dark ? 'dark' : 'light'
  return series.slot === null ? GRAY[scheme] : (SLOT_COLORS[scheme][series.slot] ?? GRAY[scheme])
}

// Only every n-th bar is labelled when the labels would not fit 28 px apart.
export function labelEvery(bars: number, plotWidth: number): number {
  const fit = Math.max(1, Math.floor(plotWidth / 28))
  return Math.max(1, Math.ceil(bars / fit))
}

const pad = (n: number) => String(n).padStart(2, '0')

// Under each bar: the hour for hour buckets, the day of the month for days, the month's short name
// for months.
export function barLabel(start: number, bucket: 'hour' | 'day' | 'month', locale: string): string {
  const d = new Date(start * 1000)
  if (bucket === 'hour') return pad(d.getHours())
  if (bucket === 'day') return String(d.getDate())
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d)
}

// The tooltip's heading for a bar.
export function barHeading(
  start: number,
  bucket: 'hour' | 'day' | 'month',
  locale: string,
): string {
  const d = new Date(start * 1000)
  if (bucket === 'hour') return `${pad(d.getHours())}:00`
  if (bucket === 'month')
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
