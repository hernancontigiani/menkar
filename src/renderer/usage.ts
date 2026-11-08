import './windows.css'
import './usage.css'
import { now } from '../core/clock'
import { resolveLook } from '../core/theme'
import {
  barHeading,
  barLabel,
  buildChart,
  labelEvery,
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
import { arrows, type Month, type StepperState, step } from '../core/usage/stepper'
import { el } from './dom'
import { loadCatalog, t } from './i18n'
import { applyLook } from './look'

// The Usage window: a period, its Totals as a table or By day as a stacked chart, and a footer.

type Period = 'today' | '7d' | '30d' | 'month'
type View = 'totals' | 'chart'

const state = {
  period: '7d' as Period,
  view: 'totals' as View,
  metric: 'exec' as Metric,
  stack: 'project' as Stack,
  stepper: { month: thisMonth(), all: false } as StepperState,
  collapsed: new Set<string>(),
  data: null as UsageView | null,
  asked: 0,
  dark: true,
  locale: 'en',
}

function thisMonth(): Month {
  const d = new Date(now())
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function which(): UsageWhich {
  if (state.period !== 'month') return { kind: 'period', period: state.period }
  return state.stepper.all ? { kind: 'all' } : { kind: 'month', ...state.stepper.month }
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
  if (key === OTHER_PROJECTS && kind === 'series' && state.stack === 'project')
    return t('usage.otherProjects')
  if (kind === 'category' || (kind === 'series' && state.stack === 'category')) {
    return CATEGORY_NAMES[key]?.() ?? key
  }
  return key
}

function metricText(value: number): string {
  if (state.metric === 'exec') return formatDuration(value)
  if (state.metric === 'tokens') return formatTokens(value)
  return `$${value.toFixed(2)}`
}

function toggles<T extends string>(
  name: string,
  options: readonly (readonly [T, string])[],
  current: T,
  choose: (value: T) => void,
): HTMLElement {
  const group = el('div', { class: 'linked', 'data-toggles': name })
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

function tableRow(node: Node, depth: number, path: string, rows: HTMLElement[]): void {
  const hasChildren = node.children.length > 0
  const collapsed = state.collapsed.has(path)
  const arrow = el(
    'button',
    { class: 'arrow', 'aria-label': node.label, ...(hasChildren ? {} : { 'aria-hidden': 'true' }) },
    hasChildren ? (collapsed ? '▸' : '▾') : '',
  )
  if (hasChildren) {
    arrow.addEventListener('click', () => {
      if (collapsed) state.collapsed.delete(path)
      else state.collapsed.add(path)
      render()
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
      el('span', { class: 'num w8' }, formatTokens(totalTokens(node.tokens))),
      el('span', { class: 'num w9' }, formatCost(node)),
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
    return el('div', {}, heading, el('div', { class: 'card nothing' }, t('usage.nothing')))
  }
  const rows: HTMLElement[] = []
  for (const project of view.totals.nodes) tableRow(project, 0, project.label, rows)
  return el('div', {}, heading, el('div', { class: 'card usage-list' }, ...rows))
}

// -- the chart ----------------------------------------------------------------------------------

const SVG = 'http://www.w3.org/2000/svg'

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  return node
}

function chart(view: UsageView, width: number): HTMLElement {
  const reports = view.bars.map((bar) =>
    state.stack === 'category' && bar.category ? bar.category : bar.project,
  )
  const data = buildChart(reports, state.metric, state.stack)
  const height = 260
  const plot = { left: 64, right: 8, top: 10, bottom: 22 }
  const plotWidth = Math.max(10, width - plot.left - plot.right)
  const plotHeight = height - plot.top - plot.bottom
  const root = svg('svg', { width, height, class: 'usage-chart', 'data-chart': '' })
  const y = (value: number) => plot.top + plotHeight - (value / data.axisTop) * plotHeight
  for (const [fraction, opacity] of [
    [0, 0.35],
    [0.5, 0.12],
    [1, 0.12],
  ] as const) {
    const at = y(data.axisTop * fraction)
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
    text.textContent = metricText(data.axisTop * fraction)
    root.append(text)
  }
  const slot = plotWidth / Math.max(1, reports.length)
  const barWidth = Math.min(28, Math.max(2, slot * 0.7))
  const every = labelEvery(reports.length, plotWidth)
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
    if (i % every === 0) {
      const text = svg('text', {
        x: plot.left + slot * i + slot / 2,
        y: height - 6,
        'text-anchor': 'middle',
        class: 'axis',
      })
      text.textContent = barLabel(report.bounds.start, view.bucket, state.locale)
      group.append(text)
    }
    root.append(group)
  })
  const legend = el('div', { class: 'legend' })
  for (const series of data.series) {
    legend.append(
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
  const box = el('div', { class: 'chart-box' })
  box.append(root as unknown as HTMLElement, legend)
  return box
}

// -- the window ---------------------------------------------------------------------------------

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

function render(): void {
  const app = document.getElementById('app')
  if (!app) return
  const header = toggles(
    'period',
    [
      ['today', t('usage.today')],
      ['7d', t('usage.days7')],
      ['30d', t('usage.days30')],
      ['month', t('usage.month')],
    ] as const,
    state.period,
    (value) => {
      state.period = value
      void refresh()
    },
  )
  const view = state.data
  if (view === null) {
    app.replaceChildren(
      el('header', {}, header),
      el('div', { class: 'status-page', 'data-key': 'reading' }, t('usage.reading')),
    )
    return
  }
  if (view.tooNew) {
    app.replaceChildren(
      el(
        'div',
        { class: 'status-page', 'data-key': 'too-new' },
        el('h2', {}, t('usage.tooNew')),
        el('p', { class: 'dim' }, t('usage.tooNewDescription')),
      ),
    )
    return
  }
  const body = el('main', { class: 'usage-body' })
  if (state.period === 'month') {
    const enabled = arrows(state.stepper, view.firstMonth, thisMonth())
    const previous = el('button', { title: t('usage.previousMonth'), 'data-key': 'previous' }, '‹')
    const next = el('button', { title: t('usage.nextMonth'), 'data-key': 'next' }, '›')
    previous.toggleAttribute('disabled', !enabled.previous)
    next.toggleAttribute('disabled', !enabled.next)
    previous.addEventListener('click', () => {
      state.stepper = step(state.stepper, -1)
      void refresh()
    })
    next.addEventListener('click', () => {
      state.stepper = step(state.stepper, 1)
      void refresh()
    })
    const all = el(
      'button',
      { 'data-key': 'all', 'aria-pressed': String(state.stepper.all) },
      t('usage.all'),
    )
    all.addEventListener('click', () => {
      state.stepper = { ...state.stepper, all: !state.stepper.all }
      void refresh()
    })
    const name = state.stepper.all
      ? t('usage.all')
      : new Intl.DateTimeFormat(state.locale, { month: 'long', year: 'numeric' }).format(
          new Date(state.stepper.month.year, state.stepper.month.month - 1, 1),
        )
    body.append(
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
          render()
        },
      ),
    )
    if (view.categories) {
      views.append(
        toggles(
          'stack',
          [
            ['project', t('usage.project')],
            ['category', t('usage.category')],
          ] as const,
          state.stack,
          (value) => {
            state.stack = value
            render()
          },
        ),
      )
    }
  }
  body.append(
    views,
    state.view === 'totals' ? table(view) : chart(view, Math.max(200, window.innerWidth - 24)),
    ...footer(view),
  )
  app.replaceChildren(el('header', {}, header), body)
}

// A pass, then the report; a report that arrives after another period was chosen is dropped.
async function refresh(): Promise<void> {
  const mine = ++state.asked
  render()
  const view = await window.menkar.usage.view(which())
  if (mine !== state.asked) return
  state.data = view
  if (!view.categories) state.stack = 'project'
  render()
}

async function main(): Promise<void> {
  await loadCatalog()
  const prefs = window.menkar.preferences
  const info = await prefs.get()
  state.locale = info.settings.language || navigator.language || 'en'
  const relook = (settings: typeof info.settings) => {
    const look = applyLook(settings, () => {
      state.dark = resolveLook(
        settings,
        window.matchMedia('(prefers-color-scheme: dark)').matches,
      ).dark
      render()
    })
    state.dark = look.dark
  }
  relook(info.settings)
  prefs.onSettings((settings) => {
    relook(settings)
    render()
  })
  document.title = t('usage.title')
  window.addEventListener('resize', () => {
    if (state.view === 'chart') render()
  })
  await refresh()
}

void main()
