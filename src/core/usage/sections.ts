// The Usage window's sections and the period each one shows, and how a period follows the human
// from one section to another. No Node import: the page calls it, Vitest tests it.
import { addDays, type Day } from './periods'
import type { StepperState } from './stepper'

export type UsageSection = 'spend' | 'time' | 'tasks'
export type SpendPeriod =
  | { readonly kind: 'today' | '7d' | '30d' }
  | { readonly kind: 'month'; readonly stepper: StepperState }
export type TimePeriod =
  | { readonly kind: 'day'; readonly day: Day }
  | { readonly kind: 'week'; readonly first: Day } // seven days from `first`
export type TasksPeriod = '7d' | '30d'

export interface Sections {
  readonly shown: UsageSection
  readonly spend: SpendPeriod
  readonly time: TimePeriod
  readonly tasks: TasksPeriod
  // the shown section's period was picked there on this visit, or carried into it on entering:
  // a period merely shown is not carried, so a section's own choice is never overwritten by one
  // the human did not make
  readonly chosen: boolean
}

type Span = 'today' | '7d' | '30d'

const serial = (d: Day) => Date.UTC(d.year, d.month - 1, d.day) / 86_400_000
const sameDay = (a: Day, b: Day) => serial(a) === serial(b)

export function currentWeek(today: Day): Day {
  return addDays(today, -6)
}

// Weeks lie on a grid of seven days ending today, so the current week is 7 days' days.
export function weekOf(day: Day, today: Day): Day {
  const back = Math.max(0, serial(today) - serial(day))
  return addDays(today, -6 - 7 * Math.floor(back / 7))
}

export function initialSections(today: Day): Sections {
  return {
    shown: 'spend',
    spend: { kind: '7d' },
    time: { kind: 'week', first: currentWeek(today) },
    tasks: '7d',
    chosen: false,
  }
}

function isSpend(p: SpendPeriod | TimePeriod | TasksPeriod): p is SpendPeriod {
  return typeof p === 'object' && p.kind !== 'day' && p.kind !== 'week'
}

// A step of the month, the day or the week is a choice too.
export function choose(s: Sections, period: SpendPeriod | TimePeriod | TasksPeriod): Sections {
  if (typeof period === 'string') return { ...s, shown: 'tasks', tasks: period, chosen: true }
  if (isSpend(period)) return { ...s, shown: 'spend', spend: period, chosen: true }
  return { ...s, shown: 'time', time: period, chosen: true }
}

// A day is *today* only when it is today, a week *7 days* only when it is the current one: a day
// or week stepped back to has no span another section shows.
function spanOf(s: Sections, today: Day): Span | null {
  if (s.shown === 'tasks') return s.tasks
  if (s.shown === 'spend') return s.spend.kind === 'month' ? null : s.spend.kind
  const t = s.time
  if (t.kind === 'day') return sameDay(t.day, today) ? 'today' : null
  return sameDay(t.first, currentWeek(today)) ? '7d' : null
}

// The target takes a chosen period when it has that span, and the carry counts as a choice there;
// otherwise it keeps its own, and nothing is carried out of it until the human picks one.
export function switchTo(s: Sections, to: UsageSection, today: Day): Sections {
  if (to === s.shown) return s
  const span = s.chosen ? spanOf(s, today) : null
  const kept: Sections = { ...s, shown: to, chosen: false }
  if (span === null) return kept
  if (to === 'spend') return { ...kept, spend: { kind: span }, chosen: true }
  if (to === 'tasks') return span === 'today' ? kept : { ...kept, tasks: span, chosen: true }
  if (span === 'today') return { ...kept, time: { kind: 'day', day: today }, chosen: true }
  if (span === '7d')
    return { ...kept, time: { kind: 'week', first: currentWeek(today) }, chosen: true }
  return kept
}

// Day ↔ Week inside Your time: a day opens its week of the grid; a week opens its last day, which
// for the current week is today.
export function timeToggle(p: TimePeriod, kind: TimePeriod['kind'], today: Day): TimePeriod {
  if (p.kind === kind) return p
  if (p.kind === 'day') return { kind: 'week', first: weekOf(p.day, today) }
  return { kind: 'day', day: addDays(p.first, 6) }
}

export function stepTime(p: TimePeriod, by: -1 | 1): TimePeriod {
  return p.kind === 'day'
    ? { kind: 'day', day: addDays(p.day, by) }
    : { kind: 'week', first: addDays(p.first, 7 * by) }
}

// › stops at today (the current week); ‹ at the history's first day, or at today when the history
// is empty.
export function timeArrows(
  p: TimePeriod,
  firstDay: Day | null,
  today: Day,
): { readonly previous: boolean; readonly next: boolean } {
  const first = serial(firstDay ?? today)
  if (p.kind === 'day') {
    return { previous: serial(p.day) > first, next: serial(p.day) < serial(today) }
  }
  return {
    previous: serial(p.first) > first,
    next: serial(p.first) < serial(currentWeek(today)),
  }
}
