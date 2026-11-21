// The Usage window's periods across its sections (decision 1.184; its example read by `set`,
// 2026-11-18). Santiago moves its clocks at midnight, so a calendar step there is checked too.
process.env.TZ = 'America/Santiago'

import { describe, expect, test } from 'vitest'
import type { Day } from '../../../src/core/usage/periods'
import {
  choose,
  currentWeek,
  dayToggleIsToday,
  initialSections,
  type Sections,
  stepTime,
  switchTo,
  type TimePeriod,
  timeArrows,
  timeToggle,
  weekOf,
} from '../../../src/core/usage/sections'

const nov = (day: number): Day => ({ year: 2026, month: 11, day })
const oct = (day: number): Day => ({ year: 2026, month: 10, day })
// Wednesday, Nov 18, 2026
const TODAY = nov(18)
const day = (d: Day): TimePeriod => ({ kind: 'day', day: d })
const week = (first: Day): TimePeriod => ({ kind: 'week', first })

const start = initialSections(TODAY)
// each section with its own period, none chosen on this visit
const own: Sections = {
  ...start,
  spend: { kind: '7d' },
  time: day(nov(15)),
  tasks: '30d',
}
const go = (s: Sections, ...path: Sections['shown'][]) =>
  path.reduce((at, to) => switchTo(at, to, TODAY), s)

describe('initialSections', () => {
  // decision 1.200
  test('the window opens on Spend, Today; Your time on today; Task times on Today', () => {
    expect(start).toEqual({
      shown: 'spend',
      spend: { kind: 'today' },
      time: day(TODAY),
      tasks: 'today',
      chosen: false,
    })
  })
})

describe('switchTo', () => {
  // The carry: a chosen period is carried where the other section has it.
  test('Spend 7 days chosen carries to Task times 7 days and to Your time the week 12–18 Nov', () => {
    const s = choose(own, { kind: '7d' })
    expect(go(s, 'tasks')).toMatchObject({ shown: 'tasks', tasks: '7d', chosen: true })
    expect(go(s, 'time')).toMatchObject({ shown: 'time', time: week(nov(12)), chosen: true })
    // carried into Task times, it is a choice there and carries on
    expect(go(s, 'tasks', 'time').time).toEqual(week(nov(12)))
  })

  test('Spend 30 days carries to Task times; Your time has no 30 days and keeps its own', () => {
    const s = choose({ ...own, tasks: '7d' }, { kind: '30d' })
    expect(go(s, 'tasks').tasks).toBe('30d')
    expect(go(s, 'time')).toMatchObject({ time: day(nov(15)), chosen: false })
  })

  test('Spend Today carries to Your time as the day of today and to Task times Today', () => {
    const s = choose(own, { kind: 'today' })
    expect(go(s, 'time')).toMatchObject({ time: day(TODAY), chosen: true })
    expect(go(s, 'tasks')).toMatchObject({ tasks: 'today', chosen: true })
  })

  test("Your time on today's day carries to Task times Today; a day stepped back to does not", () => {
    expect(go(choose(own, day(TODAY)), 'tasks')).toMatchObject({ tasks: 'today', chosen: true })
    expect(go(choose(own, day(nov(17))), 'tasks')).toMatchObject({ tasks: '30d', chosen: false })
  })

  test("Task times Today carries to Spend Today and to Your time's today", () => {
    const s = choose(go(own, 'tasks'), 'today')
    expect(go(s, 'spend')).toMatchObject({ spend: { kind: 'today' }, chosen: true })
    expect(go(s, 'time')).toMatchObject({ time: day(TODAY), chosen: true })
  })

  test('Task times 30 days carries to Spend 30 days', () => {
    const s = choose(go(own, 'tasks'), '30d')
    expect(go(s, 'spend')).toMatchObject({ spend: { kind: '30d' }, chosen: true })
  })

  // A period merely shown is not carried (1.184's example): Spend on All, to Task times on its own
  // 7 days, back to Spend still on All.
  test('Spend Month+All → Task times on its own 7 days → Spend is still Month+All', () => {
    const all = { kind: 'month' as const, stepper: { month: { year: 2026, month: 11 }, all: true } }
    const s = choose({ ...own, tasks: '7d' }, all)
    const there = go(s, 'tasks')
    expect(there).toMatchObject({ tasks: '7d', chosen: false })
    expect(go(there, 'spend')).toMatchObject({ spend: all, chosen: false })
    expect(go(there, 'time').time).toEqual(day(nov(15)))
  })

  test('Spend Month keeps Your time on its own', () => {
    const month = {
      kind: 'month' as const,
      stepper: { month: { year: 2026, month: 10 }, all: false },
    }
    expect(go(choose(own, month), 'time')).toMatchObject({ time: day(nov(15)), chosen: false })
  })

  test('a period the window opened on is not chosen: Your time keeps its own', () => {
    expect(go(own, 'time')).toMatchObject({ time: day(nov(15)), chosen: false })
    expect(go(own, 'tasks')).toMatchObject({ tasks: '30d', chosen: false })
  })

  // A stepped-back day or week is not *Today* or *7 days*.
  test('a day stepped back to or a week before the current one leaves the other section on its own', () => {
    expect(go(choose(own, day(nov(17))), 'spend')).toMatchObject({
      spend: { kind: '7d' },
      chosen: false,
    })
    expect(go(choose(own, week(nov(5))), 'tasks')).toMatchObject({ tasks: '30d', chosen: false })
    expect(go(choose(own, week(nov(12))), 'tasks')).toMatchObject({ tasks: '7d', chosen: true })
    expect(go(choose(own, week(nov(12))), 'spend').spend).toEqual({ kind: '7d' })
    expect(go(choose({ ...own, spend: { kind: '30d' } }, day(TODAY)), 'spend').spend).toEqual({
      kind: 'today',
    })
  })

  test("past midnight, yesterday's day and week are stepped back to, and carry nothing", () => {
    const s = choose(own, day(TODAY))
    const tomorrow = nov(19)
    expect(switchTo(s, 'spend', tomorrow)).toMatchObject({ spend: { kind: '7d' }, chosen: false })
    const w = choose(own, week(currentWeek(TODAY)))
    expect(switchTo(w, 'tasks', tomorrow)).toMatchObject({ tasks: '30d', chosen: false })
    expect(switchTo(w, 'tasks', TODAY)).toMatchObject({ tasks: '7d', chosen: true })
  })

  test('switching to the section shown changes nothing', () => {
    const s = choose(own, { kind: '30d' })
    expect(switchTo(s, 'spend', TODAY)).toBe(s)
  })
})

describe('the Day toggle (decision 1.200)', () => {
  test('says Today while the day shown, or the one a week opens, is today', () => {
    expect(dayToggleIsToday(day(TODAY), TODAY)).toBe(true)
    expect(dayToggleIsToday(day(nov(17)), TODAY)).toBe(false)
    expect(dayToggleIsToday(week(nov(12)), TODAY)).toBe(true)
    expect(dayToggleIsToday(week(nov(5)), TODAY)).toBe(false)
  })
})

describe('inside Your time', () => {
  test('Day → Week shows the week of the grid ending today that holds the day', () => {
    expect(timeToggle(day(nov(15)), 'week', TODAY)).toEqual(week(nov(12)))
    expect(timeToggle(day(nov(4)), 'week', TODAY)).toEqual(week(oct(29)))
    expect(timeToggle(day(nov(12)), 'week', TODAY)).toEqual(week(nov(12)))
    expect(timeToggle(day(nov(11)), 'week', TODAY)).toEqual(week(nov(5)))
    expect(timeToggle(day(TODAY), 'week', TODAY)).toEqual(week(nov(12)))
  })

  test("Week → Day shows the week's last day: today for the current week", () => {
    expect(timeToggle(week(nov(5)), 'day', TODAY)).toEqual(day(nov(11)))
    expect(timeToggle(week(nov(12)), 'day', TODAY)).toEqual(day(TODAY))
    expect(timeToggle(week(nov(5)), 'week', TODAY)).toEqual(week(nov(5)))
  })

  test('a day steps by one, a week by seven, across a month and a year', () => {
    expect(stepTime(day({ year: 2026, month: 12, day: 31 }), 1)).toEqual(
      day({ year: 2027, month: 1, day: 1 }),
    )
    expect(stepTime(week(nov(5)), -1)).toEqual(week(oct(29)))
    expect(stepTime(week(nov(5)), 1)).toEqual(week(nov(12)))
    expect(weekOf({ year: 2026, month: 12, day: 30 }, { year: 2027, month: 1, day: 2 })).toEqual({
      year: 2026,
      month: 12,
      day: 27,
    })
  })

  // Santiago's clocks go forward at midnight on Sep 6, 2026: that day has no 00:00
  test('across a daylight-saving change at midnight a step is still one calendar day', () => {
    const sep = (d: number): Day => ({ year: 2026, month: 9, day: d })
    expect(stepTime(day(sep(5)), 1)).toEqual(day(sep(6)))
    expect(stepTime(day(sep(6)), 1)).toEqual(day(sep(7)))
    expect(weekOf(sep(6), sep(9))).toEqual(sep(3))
    expect(stepTime(week(sep(3)), 1)).toEqual(week(sep(10)))
  })

  test('next is off on today and on the current week; previous off on the first day, or on today with no history', () => {
    const first = nov(2)
    expect(timeArrows(day(TODAY), first, TODAY)).toEqual({ previous: true, next: false })
    expect(timeArrows(day(nov(17)), first, TODAY)).toEqual({ previous: true, next: true })
    expect(timeArrows(day(first), first, TODAY)).toEqual({ previous: false, next: true })
    expect(timeArrows(week(nov(12)), first, TODAY)).toEqual({ previous: true, next: false })
    // the week of Oct 29–Nov 4 holds the first day
    expect(timeArrows(week(oct(29)), first, TODAY)).toEqual({ previous: false, next: true })
    expect(timeArrows(week(nov(5)), first, TODAY)).toEqual({ previous: true, next: true })
    expect(timeArrows(day(TODAY), null, TODAY)).toEqual({ previous: false, next: false })
    expect(timeArrows(week(nov(12)), null, TODAY)).toEqual({ previous: false, next: false })
  })
})
