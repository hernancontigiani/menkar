import './usage-time.css'
import { now } from '../core/clock'
import { orchestratorShare, switchesPerHour } from '../core/usage/bursts'
import { GRAY, SLOT_COLORS } from '../core/usage/chart'
import {
  type ActivityBurst,
  type ActivityDay,
  type ActivityView,
  type ActivityWeek,
  formatDuration,
  type WeekFocus,
} from '../core/usage/nodes'
import { addDays, type Bounds, type Day } from '../core/usage/periods'
import { stepTime, type TimePeriod, timeArrows } from '../core/usage/sections'
import { along, bandLabel, countAxis } from '../core/usage/timeline'
import { el } from './dom'
import { t } from './i18n'
import type { SectionBody, SectionContext } from './usage'
import { svg } from './usage-spend'

// Your time: a day by the hour, or a week as a strip per day.

// One pattern for every plot of the page: an id is the document's, not one SVG's.
const HATCH = 'usage-time-hatch'

interface Look {
  readonly messages: string
  readonly prompts: string
  readonly band: string
  readonly away: string
}

function look(scheme: 'dark' | 'light'): Look {
  const slots = SLOT_COLORS[scheme]
  return { messages: slots[0], prompts: slots[3], band: slots[6], away: GRAY[scheme] }
}

const sameDay = (a: Day, b: Day) => a.year === b.year && a.month === b.month && a.day === b.day

const dayKey = (d: Day) =>
  `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`

function hatchDefs(colors: Look): HTMLElement {
  const root = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true' })
  const pattern = svg('pattern', {
    id: HATCH,
    width: 6,
    height: 6,
    patternUnits: 'userSpaceOnUse',
    patternTransform: 'rotate(45)',
  })
  pattern.append(svg('rect', { width: 2, height: 6, fill: colors.away, 'fill-opacity': 0.6 }))
  const defs = svg('defs', {})
  defs.append(pattern)
  root.append(defs)
  return el('span', { class: 'usage-time-defs' }, root)
}

function text(attrs: Record<string, string | number>, content: string): SVGTextElement {
  const node = svg('text', attrs)
  node.textContent = content
  return node
}

function swatch(background: string, label: string): HTMLElement {
  return el(
    'span',
    { class: 'legend-item' },
    el('span', { class: 'swatch-square', style: `background: ${background}` }),
    label,
  )
}

function stepper(
  period: TimePeriod,
  view: ActivityView,
  ctx: SectionContext,
  name: string,
): HTMLElement {
  const day = period.kind === 'day'
  const enabled = timeArrows(period, view.firstDay, ctx.today)
  const previous = el(
    'button',
    {
      title: day ? t('usage.time.previousDay') : t('usage.time.previousWeek'),
      'data-key': 'previous',
    },
    '‹',
  )
  const next = el(
    'button',
    { title: day ? t('usage.time.nextDay') : t('usage.time.nextWeek'), 'data-key': 'next' },
    '›',
  )
  previous.toggleAttribute('disabled', !enabled.previous)
  next.toggleAttribute('disabled', !enabled.next)
  previous.addEventListener('click', () => ctx.choose(stepTime(period, -1)))
  next.addEventListener('click', () => ctx.choose(stepTime(period, 1)))
  return el(
    'div',
    { class: 'stepper' },
    previous,
    el('span', { class: 'month-name time-name', 'data-key': day ? 'day-name' : 'week-name' }, name),
    next,
  )
}

function footer(lines: readonly string[]): HTMLElement[] {
  return lines.map((line) => el('div', { class: 'footer dim' }, line))
}

// -- a day by the hour --------------------------------------------------------------------------

function dayName(day: Day, ctx: SectionContext): string {
  return new Intl.DateTimeFormat(ctx.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(day.year === ctx.today.year ? {} : { year: 'numeric' }),
  }).format(new Date(day.year, day.month - 1, day.day))
}

function clockText(seconds: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(seconds * 1000),
  )
}

function projectName(id: string | null, view: ActivityView): string {
  if (id === null) return t('usage.noProject')
  return view.projectNames.find(([key]) => key === id)?.[1] ?? id
}

function tipLines(burst: ActivityBurst, view: ActivityView, locale: string): string[] {
  const lines = [
    t('usage.time.tipSpan', {
      start: clockText(burst.fullStart, locale),
      end: clockText(burst.fullEnd, locale),
      length: formatDuration(burst.fullEnd - burst.fullStart),
    }),
  ]
  if (burst.fullStart < burst.start || burst.fullEnd > burst.end)
    lines.push(t('usage.time.tipOnDay', { length: formatDuration(burst.end - burst.start) }))
  lines.push(t('usage.time.tipCounts', { messages: burst.messages, prompts: burst.prompts }))
  if (!view.scoped && burst.byProject.length > 0) {
    lines.push(
      burst.byProject
        .map((p) =>
          t('usage.time.tipProject', { name: projectName(p.project, view), messages: p.messages }),
        )
        .join(' · '),
    )
  }
  return lines
}

const PLOT = { left: 34, right: 10, laneY: 6, laneHeight: 28, top: 60, bottom: 22 }
const MIN_PLOT_HEIGHT = 180

function dayPlot(
  reading: ActivityDay,
  view: ActivityView,
  ctx: SectionContext,
  colors: Look,
  plot: HTMLElement,
): void {
  const width = Math.max(240, Math.floor(plot.clientWidth))
  const height = Math.max(MIN_PLOT_HEIGHT, Math.floor(plot.clientHeight))
  const { left, right, laneY, laneHeight, top, bottom } = PLOT
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const bounds = reading.bounds
  const x = (at: number) => left + along(at, bounds, plotWidth)
  const root = svg('svg', { width, height, class: 'usage-chart', 'data-chart': 'day' })
  root.append(
    svg('rect', {
      x: left,
      y: laneY,
      width: plotWidth,
      height: laneHeight,
      rx: 6,
      fill: 'currentColor',
      'fill-opacity': 0.05,
    }),
  )
  const tallest = Math.max(0, ...reading.hours.map((h) => Math.max(h.messages, h.prompts)))
  const axis = countAxis(tallest)
  const y = (value: number) => top + plotHeight - (value / axis.top) * plotHeight
  for (let value = 0; value <= axis.top; value += axis.step) {
    root.append(
      svg('line', {
        x1: left,
        x2: width - right,
        y1: y(value),
        y2: y(value),
        stroke: 'currentColor',
        'stroke-opacity': value === 0 ? 0.35 : 0.12,
      }),
      text(
        {
          x: left - 6,
          y: y(value),
          'text-anchor': 'end',
          'dominant-baseline': 'middle',
          class: 'axis',
        },
        String(value),
      ),
    )
  }
  for (const hour of reading.hours) {
    if (new Date(hour.bounds.start * 1000).getHours() % 6 !== 0) continue
    const at = x(hour.bounds.start)
    root.append(
      svg('line', {
        x1: at,
        x2: at,
        y1: laneY,
        y2: top + plotHeight,
        stroke: 'currentColor',
        'stroke-opacity': 0.08,
      }),
    )
  }
  for (const hour of reading.hours) {
    const x0 = x(hour.bounds.start)
    const slot = x(hour.bounds.end) - x0
    const middle = x0 + slot / 2
    const barWidth = Math.min(11, slot * 0.36)
    const label = String(new Date(hour.bounds.start * 1000).getHours()).padStart(2, '0')
    const group = svg('g', {
      'data-hour': label,
      'data-messages': hour.messages,
      'data-prompts': hour.prompts,
    })
    if (hour.messages > 0) {
      group.append(
        svg('rect', {
          x: middle - barWidth - 1,
          y: y(hour.messages),
          width: barWidth,
          height: y(0) - y(hour.messages),
          rx: 2,
          fill: colors.messages,
        }),
      )
    }
    if (hour.prompts > 0) {
      group.append(
        svg('rect', {
          x: middle + 1,
          y: y(hour.prompts),
          width: barWidth,
          height: y(0) - y(hour.prompts),
          rx: 2,
          fill: colors.prompts,
        }),
      )
    }
    group.append(text({ x: middle, y: height - 6, 'text-anchor': 'middle', class: 'axis' }, label))
    root.append(group)
  }
  for (const away of reading.away) {
    root.append(
      svg('rect', {
        x: x(away.start),
        y: laneY,
        width: Math.max(1, x(away.end) - x(away.start)),
        height: laneHeight,
        fill: `url(#${HATCH})`,
        'data-away': '',
      }),
    )
  }
  const tip = el('div', { class: 'card burst-tip', 'data-key': 'burst-tip', hidden: '' })
  for (const burst of reading.bursts) root.append(band(burst))
  if (sameDay(ctx.today, localDayOf(bounds))) {
    const at = x(Math.min(bounds.end, Math.max(bounds.start, now() / 1000)))
    root.append(
      svg('line', {
        x1: at,
        x2: at,
        y1: laneY - 2,
        y2: top + plotHeight,
        stroke: 'currentColor',
        'stroke-opacity': 0.6,
        'stroke-dasharray': '3 3',
        'data-key': 'now',
      }),
      text({ x: at + 4, y: top + 8, class: 'axis' }, t('usage.time.now')),
    )
  }
  if (reading.bursts.length === 0) {
    root.append(
      text(
        {
          x: left + plotWidth / 2,
          y: top + plotHeight / 2,
          'text-anchor': 'middle',
          class: 'time-empty',
          'data-key': 'time-empty',
        },
        t('usage.time.empty'),
      ),
    )
  }
  plot.replaceChildren(root, tip)

  function band(burst: ActivityBurst): SVGGElement {
    const x0 = x(burst.start)
    const x1 = x(burst.end)
    const group = svg('g', { 'data-burst': '', class: 'burst' })
    if (burst.start === burst.end) {
      group.setAttribute('data-tick', '')
      group.append(
        svg('rect', {
          x: x0 - 1,
          y: laneY + 4,
          width: 2.5,
          height: laneHeight - 8,
          rx: 1,
          fill: colors.band,
        }),
        // a wider target than the tick, for the hover
        svg('rect', { x: x0 - 4, y: laneY, width: 8, height: laneHeight, fill: 'transparent' }),
      )
    } else {
      const cutStart = burst.fullStart < burst.start
      const cutEnd = burst.fullEnd > burst.end
      group.append(
        svg('rect', {
          x: x0,
          y: laneY + 2,
          width: Math.max(3, x1 - x0),
          height: laneHeight - 4,
          rx: cutStart || cutEnd ? 1 : 5,
          fill: colors.band,
          class: 'band',
        }),
      )
      const middle = laneY + laneHeight / 2 + 1
      if (cutStart)
        group.append(
          text({ x: x0 + 3, y: middle, 'dominant-baseline': 'middle', class: 'on-band' }, '‹'),
        )
      if (cutEnd)
        group.append(
          text(
            {
              x: x1 - 3,
              y: middle,
              'text-anchor': 'end',
              'dominant-baseline': 'middle',
              class: 'on-band',
            },
            '›',
          ),
        )
      const label = bandLabel(burst.end - burst.start, x1 - x0)
      group.append(
        label.inside
          ? text(
              {
                x: (x0 + x1) / 2,
                y: middle,
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                class: 'on-band band-length',
              },
              label.text,
            )
          : text(
              {
                x: Math.min(width - right, Math.max(left, (x0 + x1) / 2)),
                y: laneY + laneHeight + 11,
                'text-anchor': x1 > width - 40 ? 'end' : 'middle',
                class: 'axis',
              },
              label.text,
            ),
      )
    }
    group.addEventListener('mouseenter', () => {
      const [first, ...rest] = tipLines(burst, view, ctx.locale)
      tip.replaceChildren(
        el('div', { class: 'tip-span' }, first ?? ''),
        ...rest.map((line) => el('div', {}, line)),
      )
      tip.hidden = false
      group.classList.add('hovered')
      tip.style.left = `${Math.max(4, Math.min(width - tip.offsetWidth - 4, x0))}px`
      tip.style.top = `${laneY + laneHeight + 18}px`
    })
    group.addEventListener('mouseleave', () => {
      tip.hidden = true
      group.classList.remove('hovered')
    })
    return group
  }
}

function localDayOf(bounds: Bounds): Day {
  const d = new Date(bounds.start * 1000)
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

function dayBody(
  period: Extract<TimePeriod, { kind: 'day' }>,
  reading: ActivityDay,
  view: ActivityView,
  ctx: SectionContext,
): SectionBody {
  const colors = look(ctx.scheme)
  const summary = el(
    'div',
    { class: 'views dim', 'data-key': 'time-summary' },
    t('usage.time.summary', {
      active: formatDuration(reading.burstSeconds),
      n: reading.bursts.length,
      messages: reading.messages,
      prompts: reading.prompts,
    }),
  )
  const plot = el('div', { class: 'chart-plot time-plot' })
  const legend = el(
    'div',
    { class: 'legend' },
    swatch(colors.band, t('usage.time.legendBursts')),
    swatch(colors.messages, t('usage.time.legendMessages')),
    swatch(colors.prompts, t('usage.time.legendPrompts')),
    el(
      'span',
      { class: 'legend-item dim' },
      el('span', {
        class: 'swatch-square',
        style: `background: repeating-linear-gradient(135deg, ${colors.away} 0 2px, transparent 2px 5px)`,
      }),
      t('usage.time.legendAway'),
    ),
  )
  return {
    nodes: [
      hatchDefs(colors),
      stepper(period, view, ctx, dayName(period.day, ctx)),
      el('div', { class: 'chart-box' }, summary, plot, legend),
      ...footer([t('usage.time.burstsFooter'), t('usage.time.notCounted')]),
    ],
    draw: () => dayPlot(reading, view, ctx, colors, plot),
  }
}

// -- a week as a strip per day ------------------------------------------------------------------

const STRIP_HEIGHT = 22

function weekName(first: Day, ctx: SectionContext): string {
  const last = addDays(first, 6)
  const format = new Intl.DateTimeFormat(ctx.locale, {
    day: 'numeric',
    month: 'long',
    ...(first.year === ctx.today.year && last.year === ctx.today.year ? {} : { year: 'numeric' }),
  })
  return format.formatRange(
    new Date(first.year, first.month - 1, first.day),
    new Date(last.year, last.month - 1, last.day),
  )
}

function strip(
  day: ActivityWeek['days'][number],
  isToday: boolean,
  colors: Look,
  box: HTMLElement,
): void {
  const width = Math.max(60, Math.floor(box.clientWidth))
  const x = (at: number) => along(at, day.bounds, width)
  const root = svg('svg', { width, height: STRIP_HEIGHT, class: 'usage-chart strip' })
  root.append(
    svg('rect', {
      x: 0,
      y: 0,
      width,
      height: STRIP_HEIGHT,
      rx: 4,
      fill: 'currentColor',
      class: 'strip-ground',
    }),
  )
  for (let k = 6; k < 24; k += 6) {
    const d = localDayOf(day.bounds)
    const at = x(new Date(d.year, d.month - 1, d.day, k).getTime() / 1000)
    root.append(
      svg('line', {
        x1: at,
        x2: at,
        y1: 0,
        y2: STRIP_HEIGHT,
        stroke: 'currentColor',
        'stroke-opacity': 0.12,
      }),
    )
  }
  for (const away of day.away) {
    root.append(
      svg('rect', {
        x: x(away.start),
        y: 0,
        width: Math.max(1, x(away.end) - x(away.start)),
        height: STRIP_HEIGHT,
        fill: `url(#${HATCH})`,
        'data-away': '',
      }),
    )
  }
  for (const burst of day.bursts) {
    const tick = burst.start === burst.end
    const cut = burst.fullStart < burst.start || burst.fullEnd > burst.end
    root.append(
      svg(
        'rect',
        tick
          ? {
              x: x(burst.start) - 1,
              y: 4,
              width: 2,
              height: STRIP_HEIGHT - 8,
              fill: colors.band,
              'data-burst': '',
              'data-tick': '',
            }
          : {
              x: x(burst.start),
              y: 3,
              width: Math.max(2, x(burst.end) - x(burst.start)),
              height: STRIP_HEIGHT - 6,
              rx: cut ? 1 : 3,
              fill: colors.band,
              'data-burst': '',
            },
      ),
    )
  }
  if (isToday) {
    const at = x(Math.min(day.bounds.end, Math.max(day.bounds.start, now() / 1000)))
    root.append(
      svg('line', {
        x1: at,
        x2: at,
        y1: 0,
        y2: STRIP_HEIGHT,
        stroke: 'currentColor',
        'stroke-opacity': 0.6,
        'stroke-dasharray': '2 2',
        'data-key': 'now',
      }),
    )
  }
  box.replaceChildren(root)
}

function rateText(switches: number, activeSeconds: number, locale: string): string {
  const rate = switchesPerHour(switches, activeSeconds)
  if (rate === null) return '—'
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate)
}

// The figures of one week: its switches per hour and, with an orchestrator, its share.
function focusFigures(focus: WeekFocus, locale: string): { rate: string; share: string | null } {
  const share = orchestratorShare(focus)
  return {
    rate: rateText(focus.switches, focus.activeSeconds, locale),
    share:
      focus.toOrchestrator === null
        ? null
        : share === null
          ? '—'
          : new Intl.NumberFormat(locale, { style: 'percent' }).format(share),
  }
}

function focusLine(week: ActivityWeek, current: boolean, locale: string): HTMLElement {
  const shown = focusFigures(week.focus, locale)
  const parts = [t('usage.time.focusRate', { rate: shown.rate })]
  if (shown.share !== null) parts.push(t('usage.time.focusShare', { share: shown.share }))
  let before = t('usage.time.focusBeforeNone')
  if (week.before !== null) {
    const was = focusFigures(week.before, locale)
    before = t('usage.time.focusBefore', {
      figures: was.share === null ? was.rate : `${was.rate} · ${was.share}`,
    })
  }
  return el(
    'div',
    { class: 'week-focus', 'data-key': 'week-focus' },
    el(
      'span',
      { class: 'week-focus-lead' },
      current ? t('usage.time.focusThisWeek') : t('usage.time.focusThatWeek'),
    ),
    ` ${parts.join(' · ')}; `,
    el('span', { class: 'dim' }, before),
  )
}

function weekBody(
  period: Extract<TimePeriod, { kind: 'week' }>,
  week: ActivityWeek,
  view: ActivityView,
  ctx: SectionContext,
): SectionBody {
  const colors = look(ctx.scheme)
  const short = new Intl.DateTimeFormat(ctx.locale, { weekday: 'short', day: 'numeric' })
  const heading = el(
    'div',
    { class: 'usage-heading week-heading' },
    el('span', { class: 'week-day dim' }, t('usage.time.colDay')),
    el(
      'span',
      { class: 'strip-box week-axis dim' },
      ...['00', '06', '12', '18', '24'].map((hour) => el('span', {}, hour)),
    ),
    el('span', { class: 'num w7' }, t('usage.time.colActive')),
    el('span', { class: 'num w-messages' }, t('usage.time.colMessages')),
    el('span', { class: 'num w-prompts' }, t('usage.time.colPrompts')),
    el('span', { class: 'num w-switches' }, t('usage.time.colSwitches')),
    el('span', { class: 'week-open' }),
  )
  const strips: (() => void)[] = []
  const rows = week.days.map((reading, n) => {
    const day = addDays(period.first, n)
    const isToday = sameDay(day, ctx.today)
    const box = el('span', { class: 'strip-box' })
    strips.push(() => strip(reading, isToday, colors, box))
    const row = el(
      'div',
      {
        class: 'usage-row week-row',
        role: 'button',
        tabindex: '0',
        title: t('usage.time.openDay'),
        'data-day': dayKey(day),
      },
      el(
        'span',
        { class: `week-day${isToday ? ' today' : ''}` },
        short.format(new Date(day.year, day.month - 1, day.day)),
      ),
      box,
      el('span', { class: 'num w7' }, formatDuration(reading.burstSeconds)),
      el('span', { class: 'num w-messages' }, String(reading.messages)),
      el('span', { class: 'num w-prompts' }, String(reading.prompts)),
      el(
        'span',
        { class: 'num w-switches' },
        rateText(reading.switches, reading.burstSeconds, ctx.locale),
      ),
      el('span', { class: 'week-open dim' }, '›'),
    )
    const open = () => ctx.choose({ kind: 'day', day })
    row.addEventListener('click', open)
    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      open()
    })
    return row
  })
  const sum = (pick: (d: ActivityWeek['days'][number]) => number) =>
    week.days.reduce((n, d) => n + pick(d), 0)
  rows.push(
    el(
      'div',
      { class: 'usage-row project week-total', 'data-key': 'week-total' },
      el('span', { class: 'week-day name' }, t('usage.time.total')),
      el('span', { class: 'strip-box' }),
      el('span', { class: 'num w7' }, formatDuration(sum((d) => d.burstSeconds))),
      el('span', { class: 'num w-messages' }, String(sum((d) => d.messages))),
      el('span', { class: 'num w-prompts' }, String(sum((d) => d.prompts))),
      el(
        'span',
        { class: 'num w-switches' },
        rateText(week.focus.switches, week.focus.activeSeconds, ctx.locale),
      ),
      el('span', { class: 'week-open' }),
    ),
  )
  return {
    nodes: [
      hatchDefs(colors),
      stepper(period, view, ctx, weekName(period.first, ctx)),
      el(
        'div',
        { class: 'usage-table' },
        heading,
        el('div', { class: 'card usage-list' }, ...rows),
      ),
      focusLine(
        week,
        week.days.some((_, n) => sameDay(addDays(period.first, n), ctx.today)),
        ctx.locale,
      ),
      ...footer([
        t('usage.time.burstsFooter'),
        t('usage.time.weekFooter'),
        t('usage.time.notCounted'),
        view.scoped ? t('usage.time.switchesFooter') : t('usage.time.switchesFooterAll'),
      ]),
    ],
    draw: () => {
      for (const draw of strips) draw()
    },
  }
}

export function timeBody(view: ActivityView, ctx: SectionContext): SectionBody {
  const { which, reading } = view
  if (which.kind === 'day' && reading.kind === 'day') return dayBody(which, reading.day, view, ctx)
  if (which.kind === 'week' && reading.kind === 'week')
    return weekBody(which, reading.week, view, ctx)
  return { nodes: [] }
}
