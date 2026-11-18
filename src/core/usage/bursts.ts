import type { ActivityBurst, ActivityDay, ActivityWeek } from './nodes'
import { addDays, type Bounds, buckets, type Day, midnight } from './periods'

// The human's activity, read as bursts: never stored, so changing the gap rewrites no data.
export const BURST_GAP_SECONDS = 600

export type ActionKind =
  | 'message'
  | 'prompt_answered'
  | 'topic_discussed'
  | 'topic_closed'
  | 'present'
export type PresenceKind = 'away' | 'back' | 'app_start'

export interface HumanAction {
  readonly at: number
  readonly kind: ActionKind
}

// What the history holds for one reading, as `UsageHistory.humanActions` returns it.
export interface ActivityRows {
  // turns of origin human
  readonly messages: readonly {
    readonly uuid: string
    readonly sessionId: string
    readonly at: number
  }[]
  readonly actions: readonly {
    readonly at: number
    readonly kind: Exclude<ActionKind, 'message'>
  }[]
  // every project's, and the last one before the range, which says whether the range opens away
  readonly presence: readonly { readonly at: number; readonly kind: PresenceKind }[]
  readonly promptedStarts: readonly {
    readonly at: number
    readonly sessionId: string
    // the session's first turn opened at or after the start
    readonly firstTurn: { readonly uuid: string; readonly origin: string } | null
  }[]
}

export interface Burst {
  readonly start: number
  readonly end: number
  readonly messages: number
  readonly prompts: number
}

const byTime = <T extends { at: number }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => a.at - b.at)

// [start, end) of each away: away is not kept across a quit, so a start ends it like a back. One
// still open runs to `end`, the reading's now.
export function awayPeriods(
  presence: readonly { readonly at: number; readonly kind: PresenceKind }[],
  end: number,
): Bounds[] {
  const periods: Bounds[] = []
  let from: number | null = null
  for (const event of byTime(presence)) {
    if (event.kind === 'away') from ??= event.at
    else if (from !== null) {
      periods.push({ start: from, end: event.at })
      from = null
    }
  }
  if (from !== null) periods.push({ start: from, end: Math.max(from, end) })
  return periods
}

// The human's actions, oldest first. A command-line prompt reaches the transcript exactly as a
// typed message, so the first turn after a prompted start is Menkar's text, not the human's.
export function humanActionsOf(rows: ActivityRows): HumanAction[] {
  const prompted = new Set<string>()
  for (const start of rows.promptedStarts) {
    if (start.firstTurn?.origin === 'human') prompted.add(start.firstTurn.uuid)
  }
  const actions: HumanAction[] = [...rows.actions]
  for (const m of rows.messages)
    if (!prompted.has(m.uuid)) actions.push({ at: m.at, kind: 'message' })
  return byTime(actions)
}

const inside = (at: number, away: readonly Bounds[]) =>
  away.some((p) => p.start <= at && at < p.end)

// Each maximal run of actions at most `gap` apart. Whatever happens while away counts nothing, and
// an away ends the burst before it whatever the gap.
export function bursts(
  actions: readonly HumanAction[],
  away: readonly Bounds[],
  gap: number = BURST_GAP_SECONDS,
): Burst[] {
  const found: Burst[] = []
  let current: { start: number; end: number; messages: number; prompts: number } | null = null
  for (const action of byTime(actions)) {
    if (inside(action.at, away)) continue
    const last = current
    if (
      last !== null &&
      action.at - last.end <= gap &&
      !away.some((p) => p.start > last.end && p.start < action.at)
    ) {
      last.end = action.at
    } else {
      if (last !== null) found.push(last)
      current = { start: action.at, end: action.at, messages: 0, prompts: 0 }
    }
    if (current === null) continue
    if (action.kind === 'message') current.messages += 1
    if (action.kind === 'prompt_answered') current.prompts += 1
  }
  if (current !== null) found.push(current)
  return found
}

// The part of a burst inside a day, or null. A burst of one action at the day's first instant is
// that day's; one that only ends there is not.
export function clipToDay(burst: Bounds, day: Bounds): Bounds | null {
  if (burst.start >= day.end) return null
  if (burst.end <= day.start && !(burst.start >= day.start)) return null
  return { start: Math.max(burst.start, day.start), end: Math.min(burst.end, day.end) }
}

const dayBounds = (day: Day): Bounds => ({ start: midnight(day), end: midnight(addDays(day, 1)) })

function counted(rows: ActivityRows, now: number) {
  const away = awayPeriods(rows.presence, now)
  const actions = humanActionsOf(rows).filter((a) => !inside(a.at, away))
  return { actions, all: bursts(actions, away) }
}

function readDay(
  actions: readonly HumanAction[],
  all: readonly Burst[],
  bounds: Bounds,
): Omit<ActivityDay, 'hours'> {
  const shown: ActivityBurst[] = []
  for (const b of all) {
    const part = clipToDay(b, bounds)
    if (part === null) continue
    shown.push({
      ...part,
      fullStart: b.start,
      fullEnd: b.end,
      messages: b.messages,
      prompts: b.prompts,
    })
  }
  const within = actions.filter((a) => bounds.start <= a.at && a.at < bounds.end)
  return {
    bounds,
    bursts: shown,
    burstSeconds: shown.reduce((s, b) => s + (b.end - b.start), 0),
    messages: within.filter((a) => a.kind === 'message').length,
    prompts: within.filter((a) => a.kind === 'prompt_answered').length,
  }
}

// A local day by the hour. `rows` must reach past the day's ends far enough to hold its bursts
// whole: `readActivity` reads them so.
export function activityDay(rows: ActivityRows, day: Day, now: number): ActivityDay {
  const { actions, all } = counted(rows, now)
  const bounds = dayBounds(day)
  const hours = buckets(bounds, 'hour').map((hour) => {
    const inHour = actions.filter((a) => hour.start <= a.at && a.at < hour.end)
    return {
      bounds: hour,
      messages: inHour.filter((a) => a.kind === 'message').length,
      prompts: inHour.filter((a) => a.kind === 'prompt_answered').length,
    }
  })
  return { ...readDay(actions, all, bounds), hours }
}

// Seven local days from `first`; each counts its own part of a burst that crosses midnight.
export function activityWeek(rows: ActivityRows, first: Day, now: number): ActivityWeek {
  const { actions, all } = counted(rows, now)
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => {
    const { bounds, burstSeconds, messages, prompts } = readDay(
      actions,
      all,
      dayBounds(addDays(first, n)),
    )
    return { bounds, burstSeconds, messages, prompts }
  })
  return { bounds: { start: midnight(first), end: midnight(addDays(first, 7)) }, days }
}

export interface ActivitySource {
  humanActions(low: number, high: number, project?: string): ActivityRows
}

const DAY_SECONDS = 86_400

// The rows a reading of `bounds` needs: a day on each side to start with, widened a day at a time
// while a burst still reaches the edge read, so one begun the evening before is read whole.
export function readActivity(
  source: ActivitySource,
  bounds: Bounds,
  now: number,
  project?: string,
): ActivityRows {
  let low = bounds.start - DAY_SECONDS
  let high = bounds.end + DAY_SECONDS
  for (;;) {
    const rows = source.humanActions(low, high, project)
    const all = counted(rows, now).all
    const first = all[0]
    const last = all.at(-1)
    const short = first !== undefined && first.start - low <= BURST_GAP_SECONDS
    const long = last !== undefined && high - last.end <= BURST_GAP_SECONDS
    if (!short && !long) return rows
    if (short) low -= DAY_SECONDS
    if (long) high += DAY_SECONDS
  }
}
