import './usage-tasks.css'
import { GRAY, SLOT_COLORS } from '../core/usage/chart'
import { type FlowRow, flowTable } from '../core/usage/flow'
import {
  type FlowFigure,
  type FlowState,
  formatDuration,
  type TaskFlowView,
} from '../core/usage/nodes'
import { el } from './dom'
import { t } from './i18n'
import type { SectionBody, SectionContext } from './usage'

// Task times: the time tasks spent in each state, and whom they waited on.

// The states whose waiters are folded away, kept for the window's life: they start open.
const folded = new Set<FlowState>()

const STATE_NAMES: Readonly<Record<FlowState, () => string>> = {
  queued: () => t('usage.tasks.queued'),
  'in progress': () => t('usage.tasks.inProgress'),
  waiting: () => t('usage.tasks.waiting'),
  'to review': () => t('usage.tasks.toReview'),
}

const WAITER_NAMES: Readonly<Record<string, () => string>> = {
  topic: () => t('usage.tasks.onTopic'),
  session: () => t('usage.tasks.onSession'),
  other: () => t('usage.tasks.onOther'),
  orchestrator: () => t('usage.tasks.orchestrator'),
  human: () => t('usage.tasks.human'),
  'pr-approval': () => t('usage.tasks.prApproval'),
  'pr-merge': () => t('usage.tasks.prMerge'),
}

// A waiter this Menkar has no name for reads as something else, never as its stored key.
function waiterName(waiter: string | null): string {
  if (waiter === null) return t('usage.tasks.notSaid')
  return (WAITER_NAMES[waiter] ?? WAITER_NAMES.other ?? (() => ''))()
}

function stateColor(state: FlowState, scheme: 'dark' | 'light'): string {
  const slots = SLOT_COLORS[scheme]
  if (state === 'in progress') return slots[0]
  if (state === 'waiting') return slots[1]
  if (state === 'to review') return slots[2]
  return GRAY[scheme]
}

function figureCells(figure: FlowFigure): HTMLElement[] {
  const none = figure.tasks === 0
  const dim = none ? ' dim' : ''
  return [
    el('span', { class: `num w7${dim}`, 'data-key': 'tasks' }, String(figure.tasks)),
    el(
      'span',
      { class: `num w8${dim}`, 'data-key': 'median' },
      none ? '—' : formatDuration(figure.medianSeconds),
    ),
    el(
      'span',
      { class: `num w8${dim}`, 'data-key': 'total' },
      none ? '—' : formatDuration(figure.totalSeconds),
    ),
  ]
}

function shareCell(row: FlowRow, scheme: 'dark' | 'light'): HTMLElement {
  const bar = el('span', { class: 'flow-bar' })
  bar.style.width = row.figure.tasks === 0 ? '0' : `max(2px, ${(row.share * 100).toFixed(2)}%)`
  bar.style.background = stateColor(row.state, scheme)
  return el('span', { class: 'flow-share' }, bar)
}

function stateRow(row: FlowRow & { kind: 'state' }, ctx: SectionContext): HTMLElement {
  const folds = row.state === 'waiting' || row.state === 'to review'
  const closed = folded.has(row.state)
  const arrow = el(
    'button',
    folds
      ? { class: 'arrow', 'aria-expanded': String(!closed), 'aria-label': STATE_NAMES[row.state]() }
      : { class: 'arrow', 'aria-hidden': 'true', tabindex: '-1' },
    folds ? (closed ? '▸' : '▾') : '',
  )
  if (folds) {
    arrow.addEventListener('click', () => {
      if (closed) folded.delete(row.state)
      else folded.add(row.state)
      ctx.render()
    })
  }
  return el(
    'div',
    { class: 'usage-row flow-row flow-state', 'data-state': row.state },
    arrow,
    el('span', { class: `name${row.figure.tasks === 0 ? ' dim' : ''}` }, STATE_NAMES[row.state]()),
    ...figureCells(row.figure),
    shareCell(row, ctx.scheme),
  )
}

function waiterRow(row: FlowRow & { kind: 'waiter' }, ctx: SectionContext): HTMLElement {
  return el(
    'div',
    {
      class: 'usage-row flow-row flow-waiter',
      'data-state': row.state,
      'data-waiter': row.waiter ?? 'none',
    },
    el('span', { class: 'arrow', 'aria-hidden': 'true' }),
    el('span', { class: `name${row.figure.tasks === 0 ? ' dim' : ''}` }, waiterName(row.waiter)),
    ...figureCells(row.figure),
    shareCell(row, ctx.scheme),
  )
}

function heading(): HTMLElement {
  return el(
    'div',
    { class: 'usage-heading flow-heading' },
    el('span', { class: 'name dim' }, t('usage.tasks.colState')),
    el('span', { class: 'num w7' }, t('usage.tasks.colTasks')),
    el(
      'span',
      { class: 'num w8', title: t('usage.tasks.colMedianTitle') },
      t('usage.tasks.colMedian'),
    ),
    el('span', { class: 'num w8' }, t('usage.tasks.colTotal')),
    el('span', { class: 'flow-share' }, t('usage.tasks.colShare')),
  )
}

function summary(view: TaskFlowView): HTMLElement {
  const flow = view.flow
  const parts =
    flow.tasks === 0
      ? [t('usage.tasks.summaryTasks', { n: 0 })]
      : [
          t('usage.tasks.summaryTasks', { n: flow.tasks }),
          t('usage.tasks.summaryDone', { n: flow.done }),
          t('usage.tasks.summaryDropped', { n: flow.dropped }),
          t('usage.tasks.summaryOpen', { n: flow.open }),
          ...(flow.sinceBaseline > 0
            ? [t('usage.tasks.summaryBaseline', { n: flow.sinceBaseline })]
            : []),
        ]
  return el(
    'div',
    { class: 'flow-summary dim', 'data-key': 'flow-summary' },
    ...parts.map((part) => el('span', {}, part)),
  )
}

function emptyText(view: TaskFlowView): string {
  const seven = view.period === '7d'
  if (view.scoped) return seven ? t('usage.tasks.empty7') : t('usage.tasks.empty30')
  return seven ? t('usage.tasks.emptyAll7') : t('usage.tasks.emptyAll30')
}

function footer(view: TaskFlowView, locale: string): HTMLElement[] {
  const flow = view.flow
  const out = [el('div', { class: 'footer dim', 'data-key': 'footer' }, t('usage.tasks.footer'))]
  if (flow.sinceBaseline > 0 && flow.baselineAt !== null) {
    const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
      new Date(flow.baselineAt * 1000),
    )
    out.push(
      el(
        'div',
        { class: 'footer dim', 'data-key': 'baseline-footer' },
        t('usage.tasks.baselineFooter', { n: flow.sinceBaseline, date }),
      ),
    )
  }
  return out
}

export function tasksBody(view: TaskFlowView, ctx: SectionContext): SectionBody {
  if (view.flow.tasks === 0) {
    return {
      nodes: [
        summary(view),
        el(
          'div',
          { class: 'usage-table' },
          el('div', { class: 'card nothing', 'data-key': 'flow-empty' }, emptyText(view)),
        ),
        el('div', { class: 'footer dim', 'data-key': 'footer' }, t('usage.tasks.emptyFooter')),
      ],
    }
  }
  const rows: HTMLElement[] = []
  for (const row of flowTable(view.flow)) {
    if (row.kind === 'state') rows.push(stateRow(row, ctx))
    else if (!folded.has(row.state)) rows.push(waiterRow(row, ctx))
  }
  return {
    nodes: [
      summary(view),
      el(
        'div',
        { class: 'usage-table', 'data-key': 'flow-table' },
        heading(),
        el('div', { class: 'card usage-list' }, ...rows),
      ),
      ...footer(view, ctx.locale),
    ],
  }
}
