import './windows.css'
import './usage.css'
import './segmented.css'
import './turning.css'
import { now } from '../core/clock'
import { latestOnly } from '../core/latest'
import { resolveLook } from '../core/theme'
import type { ActivityView, TaskFlowView, UsageView } from '../core/usage/nodes'
import { type Day, localDay } from '../core/usage/periods'
import {
  choose,
  initialSections,
  type SpendPeriod,
  switchTo,
  type TasksPeriod,
  type TimePeriod,
  timeToggle,
  type UsageSection,
} from '../core/usage/sections'
import { el } from './dom'
import { loadCatalog, t } from './i18n'
import { applyLook } from './look'
import { STAR_SVG } from './star'
import { spendAnswered, spendBody, spendWhich, startStepper, toggles } from './usage-spend'
import { tasksBody } from './usage-tasks'
import { timeBody } from './usage-time'

// The Usage window: a left bar with Spend, Your time and Task times and the project scope at its
// foot; the shown section's period in the header over its body.

// What a section's body is drawn with.
export interface SectionContext {
  readonly locale: string
  readonly scheme: 'dark' | 'light'
  // every project instead of the opener window's
  readonly allProjects: boolean
  readonly today: Day
  // an answer is on its way: Spend keeps its toggles over the turning star
  readonly loading: boolean
  // a period picked in the body (a step, a day of the week): asked at once
  choose(period: SpendPeriod | TimePeriod | TasksPeriod): void
  // the body's own state changed (a fold, a view): drawn again with the same answer
  render(): void
  star(): HTMLElement
}

// What a section's body puts in the pane; `draw` runs once the nodes are laid out, for a plot
// that takes the room left.
export interface SectionBody {
  readonly nodes: readonly HTMLElement[]
  draw?(): void
}

const today = (): Day => localDay(now() / 1000)

// Kept in the page's memory for the window's life, never across openings: a stepped-back day
// would reopen stale, and the scope depends on the opener.
const state = {
  sections: initialSections(today()),
  // Month's stepper, kept while another period is shown
  stepper: startStepper(),
  spend: null as UsageView | null,
  time: null as ActivityView | null,
  tasks: null as TaskFlowView | null,
  // the opener window's project, as the last answer gave it: no project, no foot
  project: null as { readonly id: string; readonly name: string } | null,
  // the last ask was refused: our sentence in the body
  failed: false,
  // an answer is on its way: the body gives way to the turning star, the bars stay usable
  loading: false,
  dark: true,
  locale: 'en',
  allProjects: false,
}
// One for the three sections' asks: any newer one (a period, a step, a section, the scope) drops
// an older answer, whatever section it was for.
const ask = latestOnly()

const SECTIONS: readonly UsageSection[] = ['spend', 'time', 'tasks']

const SECTION_NAMES: Readonly<Record<UsageSection, () => string>> = {
  spend: () => t('usage.section.spend'),
  time: () => t('usage.section.time'),
  tasks: () => t('usage.section.tasks'),
}

const ICONS: Readonly<Record<UsageSection, string>> = {
  spend:
    '<line x1="2.5" y1="13.5" x2="13.5" y2="13.5"/><rect x="3.5" y="8" width="2.4" height="5"/><rect x="6.8" y="4" width="2.4" height="9"/><rect x="10.1" y="6.5" width="2.4" height="6.5"/>',
  time: '<polyline points="1.5,8.5 4.5,8.5 6.3,3.5 9.2,12.5 11,8.5 14.5,8.5"/>',
  tasks:
    '<rect x="1.5" y="5.8" width="3.4" height="4.4" rx="0.8"/><rect x="6.3" y="5.8" width="3.4" height="4.4" rx="0.8"/><rect x="11.1" y="5.8" width="3.4" height="4.4" rx="0.8"/><path d="M3.2 5.8V3.5h9.6v2.3M11.3 4.9l1.5 0.9 1.4-0.9"/>',
}

function sectionIcon(name: UsageSection): SVGSVGElement {
  const wrapper = document.createElement('span')
  wrapper.innerHTML = `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg>`
  return wrapper.firstElementChild as SVGSVGElement
}

function chooseHere(period: SpendPeriod | TimePeriod | TasksPeriod): void {
  if (typeof period === 'object' && period.kind === 'month') state.stepper = period.stepper
  state.sections = choose(state.sections, period)
  void refresh()
}

function show(section: UsageSection): void {
  state.sections = switchTo(state.sections, section, today())
  void refresh()
}

function setScope(allProjects: boolean): void {
  state.allProjects = allProjects
  void refresh()
}

function context(): SectionContext {
  return {
    locale: state.locale,
    scheme: state.dark ? 'dark' : 'light',
    allProjects: state.allProjects,
    today: today(),
    loading: state.loading,
    choose: chooseHere,
    render,
    star: loadingStar,
  }
}

// -- the left bar -------------------------------------------------------------------------------

function sectionList(): HTMLElement {
  const list = el('nav', {
    class: 'section-list',
    role: 'tablist',
    'aria-orientation': 'vertical',
    'aria-label': t('usage.section.list'),
  })
  const shown = state.sections.shown
  for (const name of SECTIONS) {
    const item = el(
      'button',
      {
        role: 'tab',
        class: 'section-item',
        'data-section': name,
        'aria-selected': String(name === shown),
      },
      sectionIcon(name),
      el('span', {}, SECTION_NAMES[name]()),
    )
    item.tabIndex = name === shown ? 0 : -1
    item.addEventListener('click', () => show(name))
    list.append(item)
  }
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const at = SECTIONS.indexOf(state.sections.shown)
    const next =
      SECTIONS[
        Math.min(Math.max(at + (event.key === 'ArrowDown' ? 1 : -1), 0), SECTIONS.length - 1)
      ]
    if (next === undefined || next === state.sections.shown) return
    show(next)
  })
  return list
}

// The scope, for every section: this project or every one. "All projects" turns back to this
// project when pressed again, as it did in the header.
function scopeFoot(project: { readonly name: string }): HTMLElement {
  const mine = el(
    'button',
    { 'data-key': 'this-project', 'aria-pressed': String(!state.allProjects) },
    project.name,
  )
  mine.addEventListener('click', () => setScope(false))
  const all = el(
    'button',
    { 'data-key': 'all-projects', 'aria-pressed': String(state.allProjects) },
    t('usage.allProjects'),
  )
  all.addEventListener('click', () => setScope(!state.allProjects))
  return el(
    'div',
    { class: 'usage-scope', 'data-key': 'scope' },
    el('div', { class: 'usage-scope-label dim' }, t('usage.scope.projects')),
    el('div', { class: 'usage-scope-buttons' }, mine, all),
  )
}

function side(): HTMLElement {
  const aside = el(
    'aside',
    { class: 'settings-side' },
    el('div', { class: 'settings-header', 'data-key': 'usage-title' }, t('usage.title')),
    sectionList(),
  )
  if (state.project) aside.append(scopeFoot(state.project))
  return aside
}

// -- the header: the shown section's period -----------------------------------------------------

function periodToggles(): HTMLElement {
  const s = state.sections
  if (s.shown === 'time') {
    return toggles(
      'period',
      [
        ['day', t('usage.time.day')],
        ['week', t('usage.time.week')],
      ] as const,
      s.time.kind,
      (kind) => chooseHere(timeToggle(s.time, kind, today())),
    )
  }
  if (s.shown === 'tasks') {
    return toggles(
      'period',
      [
        ['today', t('usage.today')],
        ['7d', t('usage.days7')],
        ['30d', t('usage.days30')],
      ] as const,
      s.tasks,
      (period) => chooseHere(period),
    )
  }
  return toggles(
    'period',
    [
      ['today', t('usage.today')],
      ['7d', t('usage.days7')],
      ['30d', t('usage.days30')],
      ['month', t('usage.month')],
    ] as const,
    s.spend.kind,
    (kind) => chooseHere(kind === 'month' ? { kind, stepper: state.stepper } : { kind }),
  )
}

// -- the body -----------------------------------------------------------------------------------

function statusPage(key: string, ...children: HTMLElement[]): HTMLElement {
  return el('div', { class: 'status-page', 'data-key': key }, ...children)
}

function tooNewPage(): HTMLElement {
  return statusPage(
    'too-new',
    el('h2', {}, t('usage.tooNew')),
    el('p', { class: 'dim' }, t('usage.tooNewDescription')),
  )
}

function sectionBody(): SectionBody | HTMLElement {
  const s = state.sections
  const ctx = context()
  if (state.failed && !state.loading)
    return statusPage('failed', el('p', {}, t('usage.readFailed')))
  if (s.shown === 'spend') {
    const view = state.spend
    if (view === null) return statusPage('reading', el('span', {}, t('usage.reading')))
    if (view.tooNew) return tooNewPage()
    return spendBody(view, s.spend, ctx)
  }
  if (state.loading) return { nodes: [loadingStar()] }
  const view = s.shown === 'time' ? state.time : state.tasks
  if (view === null) return { nodes: [loadingStar()] }
  if (view.tooNew) return tooNewPage()
  if (s.shown === 'time' && state.time) return timeBody(state.time, ctx)
  if (s.shown === 'tasks' && state.tasks) return tasksBody(state.tasks, ctx)
  return { nodes: [] }
}

let redrawOnResize = false

function render(): void {
  const app = document.getElementById('app')
  if (!app) return
  // the bar is drawn again with every answer: a tab that had the focus keeps it, for Up and Down
  const tabFocused = document.activeElement?.getAttribute('role') === 'tab'
  const pane = el('div', { class: 'usage-pane' })
  const body = sectionBody()
  if (body instanceof HTMLElement) {
    // the too-new page stands alone, as no period's figures can be read
    if (body.dataset.key === 'too-new') pane.append(body)
    else pane.append(el('header', {}, periodToggles()), body)
  } else {
    pane.append(
      el('header', {}, periodToggles()),
      el('main', { class: 'usage-body', 'data-section': state.sections.shown }, ...body.nodes),
    )
  }
  app.replaceChildren(el('div', { class: 'settings usage-shell' }, side(), pane))
  if (tabFocused)
    document.querySelector<HTMLElement>(`[data-section="${state.sections.shown}"]`)?.focus()
  const draw = body instanceof HTMLElement ? undefined : body.draw
  redrawOnResize = draw !== undefined
  draw?.()
}

function loadingStar(): HTMLElement {
  const star = el('span', { class: 'turning-star' })
  star.innerHTML = STAR_SVG
  return el('div', { class: 'usage-loading turning dim', 'data-key': 'loading' }, star)
}

// A pass and, for Your time and Task times, the activity's import, then the shown section's
// figures.
async function refresh(): Promise<void> {
  const current = ask()
  const s = state.sections
  state.loading = true
  render()
  const usage = window.menkar.usage
  try {
    if (s.shown === 'spend') {
      const view = await usage.view(spendWhich(s.spend), state.allProjects)
      if (!current()) return
      state.spend = view
      state.project = view.project
      spendAnswered(view)
    } else if (s.shown === 'time') {
      const view = await usage.activity(s.time, state.allProjects)
      if (!current()) return
      state.time = view
      state.project = view.project
    } else {
      const view = await usage.flow(s.tasks, state.allProjects)
      if (!current()) return
      state.tasks = view
      state.project = view.project
    }
    state.failed = false
  } catch {
    // main's handler reported the refusal; the page says it in its own words
    if (!current()) return
    state.failed = true
  }
  state.loading = false
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
    if (redrawOnResize) render()
  })
  await refresh()
}

void main()
