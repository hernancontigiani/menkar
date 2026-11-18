import { now } from '../core/clock'
import {
  axisLabels,
  barHeading,
  buildChart,
  type Metric,
  OTHER_PROJECTS,
  type Stack,
  seriesColor,
} from '../core/usage/chart'
import {
  formatCost,
  formatDuration,
  formatPercent,
  formatTokens,
  NO_PROJECT,
  type Node,
  totalExecution,
  totalTokens,
  UNCLASSIFIED,
  type UsageView,
  type UsageWhich,
} from '../core/usage/nodes'
import { modelName } from '../core/usage/prices'
import type { SpendPeriod } from '../core/usage/sections'
import { arrows, type Month, type StepperState, step } from '../core/usage/stepper'
import { el } from './dom'
import { t } from './i18n'
import type { SectionBody, SectionContext } from './usage'

// Spend: a period, its Totals as a table or By day as a stacked chart, and a footer.

type View = 'totals' | 'chart'

// What Spend keeps for the window's life besides its period.
const state = {
  view: 'totals' as View,
  metric: 'exec' as Metric,
  stack: 'project' as Stack,
  collapsed: new Set<string>(),
  // category rows start collapsed, so what is kept for them is which ones were opened
  expanded: new Set<string>(),
  data: null as UsageView | null,
  period: { kind: '7d' } as SpendPeriod,
  dark: true,
  locale: 'en',
  render: () => {},
}

// What By day stacks by. One project's figures stack by category when classification gives them,
// and are that project's plain bar otherwise; every project's follow the switch.
function stackShown(): Stack {
  const view = state.data
  if (state.stack === 'model' && state.metric !== 'exec') return 'model'
  if (view?.scoped) return view.categories ? 'category' : 'project'
  return state.stack === 'model' ? 'project' : state.stack
}

function thisMonth(): Month {
  const d = new Date(now())
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

// The month stepper, kept while another period is shown so Month comes back where it was.
export function startStepper(): StepperState {
  return { month: thisMonth(), all: false }
}

export function spendWhich(period: SpendPeriod): UsageWhich {
  if (period.kind !== 'month') return { kind: 'period', period: period.kind }
  return period.stepper.all ? { kind: 'all' } : { kind: 'month', ...period.stepper.month }
}

// An answer with no categories stacks by project from then on.
export function spendAnswered(view: UsageView): void {
  if (!view.categories) state.stack = 'project'
}

const CATEGORY_NAMES: Readonly<Record<string, () => string>> = {
  plan: () => t('usage.catPlan'),
  design: () => t('usage.catDesign'),
  build: () => t('usage.catBuild'),
  test: () => t('usage.catTest'),
  deploy: () => t('usage.catDeploy'),
  maintain: () => t('usage.catMaintain'),
  other: () => t('usage.catOther'),
}

function label(key: string, kind: Node['kind'] | 'series'): string {
  if (key === NO_PROJECT && kind !== 'category') return t('usage.noProject')
  if (key === UNCLASSIFIED) return t('usage.unclassified')
  if (key === OTHER_PROJECTS && kind === 'series' && stackShown() === 'project')
    return t('usage.otherProjects')
  if (kind === 'category' || (kind === 'series' && stackShown() === 'category')) {
    return CATEGORY_NAMES[key]?.() ?? key
  }
  if (kind === 'series' && stackShown() === 'model')
    return key === OTHER_PROJECTS ? t('usage.otherProjects') : modelName(key)
  return key
}

function metricText(value: number): string {
  if (state.metric === 'exec') return formatDuration(value)
  if (state.metric === 'tokens') return formatTokens(value)
  return `$${value.toFixed(2)}`
}

export function toggles<T extends string>(
  name: string,
  options: readonly (readonly [T, string])[],
  current: T,
  choose: (value: T) => void,
): HTMLElement {
  const group = el('div', { class: 'linked segmented', 'data-toggles': name })
  for (const [value, text] of options) {
    const button = el(
      'button',
      { 'data-value': value, 'aria-pressed': String(value === current) },
      text,
    )
    button.addEventListener('click', () => choose(value))
    group.append(button)
  }
  return group
}

// -- the table ----------------------------------------------------------------------------------

// A row's tokens and cost by model, largest first. The cost is always the list-price estimate: an
// exact cost comes per session, never per model.
function byModel(node: Node): string {
  return Object.entries(node.models)
    .sort(([a, x], [b, y]) => totalTokens(y.tokens) - totalTokens(x.tokens) || (a < b ? -1 : 1))
    .map(([model, m]) =>
      t('usage.byModel', {
        model: modelName(model),
        tokens: formatTokens(totalTokens(m.tokens)),
        cost: `~$${m.cost.toFixed(2)}${m.priced ? '' : '+'}`,
      }),
    )
    .join('\n')
}

function tableRow(node: Node, depth: number, path: string, rows: HTMLElement[]): void {
  const hasChildren = node.children.length > 0
  const opened = node.kind === 'category' ? state.expanded : null
  const collapsed = opened ? !opened.has(path) : state.collapsed.has(path)
  const arrow = el(
    'button',
    { class: 'arrow', 'aria-label': node.label, ...(hasChildren ? {} : { 'aria-hidden': 'true' }) },
    hasChildren ? (collapsed ? '▸' : '▾') : '',
  )
  if (hasChildren) {
    arrow.addEventListener('click', () => {
      if (opened) {
        if (collapsed) opened.add(path)
        else opened.delete(path)
      } else if (collapsed) state.collapsed.delete(path)
      else state.collapsed.add(path)
      state.render()
    })
  }
  const parts = Object.entries(node.execution)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([origin, seconds]) => `${origin} ${formatDuration(seconds)}`)
  const exec = el(
    'span',
    { class: 'num w7', title: t('usage.startedBy', { parts: parts.join(', ') }) },
    formatDuration(totalExecution(node)),
  )
  rows.push(
    el(
      'div',
      {
        class: `usage-row ${node.kind}`,
        style: `padding-left: ${12 + 18 * depth}px`,
        'data-kind': node.kind,
        'data-path': path,
      },
      arrow,
      el('span', { class: 'name' }, label(node.label, node.kind)),
      exec,
      el('span', { class: 'num w8' }, formatDuration(node.blocked)),
      el('span', { class: 'num w8', title: byModel(node) }, formatTokens(totalTokens(node.tokens))),
      el('span', { class: 'num w9', title: byModel(node) }, formatCost(node)),
    ),
  )
  if (!collapsed)
    for (const child of node.children) tableRow(child, depth + 1, `${path}/${child.label}`, rows)
}

function table(view: UsageView): HTMLElement {
  const heading = el(
    'div',
    { class: 'usage-heading' },
    el('span', { class: 'name dim' }, t('usage.projectSession')),
    el('span', { class: 'num w7' }, t('usage.exec')),
    el('span', { class: 'num w8' }, t('usage.blocked')),
    el('span', { class: 'num w8' }, t('usage.tokens')),
    el('span', { class: 'num w9' }, t('usage.cost')),
  )
  if (view.totals.nodes.length === 0) {
    return el(
      'div',
      { class: 'usage-table' },
      heading,
      el('div', { class: 'card nothing' }, t('usage.nothing')),
    )
  }
  const rows: HTMLElement[] = []
  for (const project of view.totals.nodes) tableRow(project, 0, project.label, rows)
  return el(
    'div',
    { class: 'usage-table' },
    heading,
    el('div', { class: 'card usage-list' }, ...rows),
  )
}

// -- the chart ----------------------------------------------------------------------------------

const SVG = 'http://www.w3.org/2000/svg'

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  return node
}

// The chart takes the height the window leaves it: the box is laid out first, with the legend, and
// the plot is drawn into the room left once the box has a size.
function chartBox(view: UsageView): { box: HTMLElement; draw(): void } {
  const plot = el('div', { class: 'chart-plot' })
  const legend = el('div', { class: 'legend' })
  const box = el('div', { class: 'chart-box' }, plot, legend)
  const draw = () => {
    legend.replaceChildren(...chart(view, 0, MIN_CHART_HEIGHT).legend)
    plot.replaceChildren()
    const width = Math.max(200, Math.floor(plot.clientWidth))
    const height = Math.max(MIN_CHART_HEIGHT, Math.floor(plot.clientHeight))
    plot.replaceChildren(chart(view, width, height).svg)
  }
  return { box, draw }
}

const MIN_CHART_HEIGHT = 160

function chart(
  view: UsageView,
  width: number,
  height: number,
): { svg: HTMLElement; legend: HTMLElement[] } {
  const reports = view.bars.map((bar) =>
    stackShown() === 'category' && bar.category ? bar.category : bar.project,
  )
  const data = buildChart(reports, state.metric, stackShown())
  const plot = { left: 64, right: 8, top: 10, bottom: 22 }
  const plotWidth = Math.max(10, width - plot.left - plot.right)
  const plotHeight = height - plot.top - plot.bottom
  const root = svg('svg', { width, height, class: 'usage-chart', 'data-chart': '' })
  const y = (value: number) => plot.top + plotHeight - (value / data.axisTop) * plotHeight
  const lines = Math.round(data.axisTop / data.axisStep)
  for (let k = 0; k <= lines; k += 1) {
    const value = k * data.axisStep
    const opacity = k === 0 ? 0.35 : 0.12
    const at = y(value)
    root.append(
      svg('line', {
        x1: plot.left,
        x2: width - plot.right,
        y1: at,
        y2: at,
        stroke: 'currentColor',
        'stroke-opacity': opacity,
      }),
    )
    const text = svg('text', {
      x: plot.left - 6,
      y: at,
      'text-anchor': 'end',
      'dominant-baseline': 'middle',
      class: 'axis',
    })
    text.textContent = metricText(value)
    root.append(text)
  }
  const slot = plotWidth / Math.max(1, reports.length)
  const barWidth = Math.min(28, Math.max(2, slot * 0.7))
  const labels = axisLabels(
    reports.map((report) => report.bounds.start),
    view.bucket,
    state.period.kind === '7d' ? 'week' : 'long',
    state.locale,
    plotWidth,
  )
  reports.forEach((report, i) => {
    const x = plot.left + slot * i + (slot - barWidth) / 2
    const group = svg('g', { 'data-bar': i })
    const lines = data.series
      .map((series, k) => [series, data.bars[i]?.[k] ?? 0] as const)
      .filter(([, value]) => value > 0)
      .map(([series, value]) => `${label(series.key, 'series')}: ${metricText(value)}`)
    const tip = svg('title', {})
    tip.textContent = [
      barHeading(report.bounds.start, view.bucket, state.locale),
      ...(lines.length ? lines : [t('usage.nothing')]),
    ].join('\n')
    group.append(
      svg('rect', {
        x: plot.left + slot * i,
        y: plot.top,
        width: slot,
        height: plotHeight,
        fill: 'transparent',
      }),
      tip,
    )
    let base = 0
    const values = data.bars[i] ?? []
    const top = values.reduce((n, v, k) => (v > 0 ? k : n), -1)
    data.series.forEach((series, k) => {
      const value = values[k] ?? 0
      if (value <= 0) return
      const y0 = y(base)
      const y1 = y(base + value)
      const segment = Math.max(1, y0 - y1 - (k === top ? 0 : 2))
      const radius = k === top ? Math.min(4, barWidth / 2, segment) : 0
      group.append(
        svg('rect', {
          x,
          y: y0 - segment,
          width: barWidth,
          height: segment,
          rx: radius,
          fill: seriesColor(series, state.dark),
        }),
      )
      base += value
    })
    const name = labels[i]
    if (name) {
      const text = svg('text', {
        x: plot.left + slot * i + slot / 2,
        y: height - 6,
        'text-anchor': 'middle',
        class: 'axis',
      })
      text.textContent = name
      group.append(text)
    }
    root.append(group)
  })
  const legend: HTMLElement[] = []
  for (const series of data.series) {
    legend.push(
      el(
        'span',
        { class: 'legend-item' },
        el('span', {
          class: 'swatch-square',
          style: `background: ${seriesColor(series, state.dark)}`,
        }),
        label(series.key, 'series'),
      ),
    )
  }
  return { svg: root as unknown as HTMLElement, legend }
}

function footer(view: UsageView): HTMLElement[] {
  let line = t('usage.blockedFooter', {
    time: formatDuration(view.totals.nodes.reduce((n, p) => n + p.blocked, 0)),
  })
  const limits = view.totals.limits
  if (limits)
    line += `   ${t('usage.limits', { five: formatPercent(limits[0]), seven: formatPercent(limits[1]) })}`
  const out = [
    el('div', { class: 'footer dim', 'data-key': 'footer' }, `${line}\n${t('usage.estimateNote')}`),
  ]
  if (!view.categories)
    out.push(el('div', { class: 'footer dim', 'data-key': 'hint' }, t('usage.hint')))
  return out
}

// Spend's body for its period: the month's stepper, the views' toggles, and the table or the
// chart with the footer, or the turning star while an answer is on its way.
export function spendBody(view: UsageView, period: SpendPeriod, ctx: SectionContext): SectionBody {
  state.data = view
  state.period = period
  state.dark = ctx.scheme === 'dark'
  state.locale = ctx.locale
  state.render = ctx.render
  const render = ctx.render
  const nodes: HTMLElement[] = []
  if (period.kind === 'month') {
    const stepper = period.stepper
    const enabled = arrows(stepper, view.firstMonth, thisMonth())
    const previous = el('button', { title: t('usage.previousMonth'), 'data-key': 'previous' }, '‹')
    const next = el('button', { title: t('usage.nextMonth'), 'data-key': 'next' }, '›')
    previous.toggleAttribute('disabled', !enabled.previous)
    next.toggleAttribute('disabled', !enabled.next)
    previous.addEventListener('click', () =>
      ctx.choose({ kind: 'month', stepper: step(stepper, -1) }),
    )
    next.addEventListener('click', () => ctx.choose({ kind: 'month', stepper: step(stepper, 1) }))
    const all = el(
      'button',
      { 'data-key': 'all', 'aria-pressed': String(stepper.all) },
      t('usage.all'),
    )
    all.addEventListener('click', () =>
      ctx.choose({ kind: 'month', stepper: { ...stepper, all: !stepper.all } }),
    )
    const name = stepper.all
      ? t('usage.all')
      : new Intl.DateTimeFormat(state.locale, { month: 'long', year: 'numeric' }).format(
          new Date(stepper.month.year, stepper.month.month - 1, 1),
        )
    nodes.push(
      el(
        'div',
        { class: 'stepper' },
        previous,
        el('span', { class: 'month-name', 'data-key': 'month-name' }, name),
        next,
        all,
      ),
    )
  }
  const views = el(
    'div',
    { class: 'views' },
    toggles(
      'view',
      [
        ['totals', t('usage.totals')],
        ['chart', t('usage.byDay')],
      ] as const,
      state.view,
      (value) => {
        state.view = value
        render()
      },
    ),
  )
  if (state.view === 'chart') {
    views.append(
      toggles(
        'metric',
        [
          ['exec', t('usage.exec')],
          ['tokens', t('usage.tokens')],
          ['cost', t('usage.cost')],
        ] as const,
        state.metric,
        (value) => {
          state.metric = value
          // Time is not split by model: Exec stacks by project again.
          if (value === 'exec' && state.stack === 'model') state.stack = 'project'
          render()
        },
      ),
    )
    // One project shows its categories (or its plain bar) where every project shows the switch.
    const stacks: (readonly [Stack, string])[] = view.scoped
      ? [view.categories ? ['category', t('usage.category')] : ['project', t('usage.project')]]
      : [
          ['project', t('usage.project')],
          ...(view.categories ? [['category', t('usage.category')] as const] : []),
        ]
    stacks.push(['model', t('usage.model')])
    const stack = toggles('stack', stacks, stackShown(), (value) => {
      state.stack = value
      render()
    })
    const model = stack.querySelector<HTMLButtonElement>('[data-value="model"]')
    if (model && state.metric === 'exec') {
      model.disabled = true
      model.title = t('usage.modelNoTime')
    }
    views.append(stack)
  }
  if (ctx.loading) return { nodes: [...nodes, views, ctx.star()] }
  const drawn = state.view === 'chart' ? chartBox(view) : null
  nodes.push(views, drawn ? drawn.box : table(view), ...footer(view))
  return drawn ? { nodes, draw: drawn.draw } : { nodes }
}
