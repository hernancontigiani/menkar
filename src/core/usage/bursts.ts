import type { ActivityBurst, ActivityDay, ActivityWeek, WeekFocus } from './nodes'
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
  // a message's project; null when its turn has none
  readonly project?: string | null
  // a message's session
  readonly session?: string
}

// What the history holds for one reading, as `UsageHistory.humanActions` returns it.
export interface ActivityRows {
  // turns of origin human
  readonly messages: readonly {
    readonly uuid: string
    readonly sessionId: string
    readonly at: number
    readonly project: string | null
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
  readonly byProject: ActivityBurst['byProject']
  // When the human's next message in the burst went to a different session than the one before:
  // its first message, and one after a gap or an away, switches nothing.
  readonly switches: readonly number[]
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
    if (!prompted.has(m.uuid))
      actions.push({ at: m.at, kind: 'message', project: m.project, session: m.sessionId })
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
  interface Open {
    start: number
    end: number
    messages: number
    prompts: number
    projects: Map<string | null, number>
    session: string | undefined
    switches: number[]
  }
  let current: Open | null = null
  const close = (b: Open): Burst => ({
    start: b.start,
    end: b.end,
    messages: b.messages,
    prompts: b.prompts,
    byProject: [...b.projects]
      .map(([project, messages]) => ({ project, messages }))
      .sort((a, b) => b.messages - a.messages || byProjectId(a.project, b.project)),
    switches: b.switches,
  })
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
      if (last !== null) found.push(close(last))
      current = {
        start: action.at,
        end: action.at,
        messages: 0,
        prompts: 0,
        projects: new Map(),
        session: undefined,
        switches: [],
      }
    }
    if (current === null) continue
    if (action.kind === 'message') {
      current.messages += 1
      const project = action.project ?? null
      current.projects.set(project, (current.projects.get(project) ?? 0) + 1)
      if (current.messages > 1 && action.session !== current.session)
        current.switches.push(action.at)
      current.session = action.session
    }
    if (action.kind === 'prompt_answered') current.prompts += 1
  }
  if (current !== null) found.push(close(current))
  return found
}

// A turn with no project sorts after every project.
function byProjectId(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
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
  return { actions, away, all: bursts(actions, away) }
}

function readDay(
  { actions, away, all }: ReturnType<typeof counted>,
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
      byProject: b.byProject,
    })
  }
  const awayShown: Bounds[] = []
  for (const p of away) {
    const start = Math.max(p.start, bounds.start)
    const end = Math.min(p.end, bounds.end)
    if (end > start) awayShown.push({ start, end })
  }
  const within = actions.filter((a) => bounds.start <= a.at && a.at < bounds.end)
  const inDay = (at: number) => bounds.start <= at && at < bounds.end
  return {
    bounds,
    bursts: shown,
    away: awayShown,
    burstSeconds: shown.reduce((s, b) => s + (b.end - b.start), 0),
    messages: within.filter((a) => a.kind === 'message').length,
    prompts: within.filter((a) => a.kind === 'prompt_answered').length,
    switches: all.reduce((n, b) => n + b.switches.filter(inDay).length, 0),
  }
}

// A local day by the hour. `rows` must reach past the day's ends far enough to hold its bursts
// whole: `readActivity` reads them so.
export function activityDay(rows: ActivityRows, day: Day, now: number): ActivityDay {
  const read = counted(rows, now)
  const { actions } = read
  const bounds = dayBounds(day)
  const hours = buckets(bounds, 'hour').map((hour) => {
    const inHour = actions.filter((a) => hour.start <= a.at && a.at < hour.end)
    return {
      bounds: hour,
      messages: inHour.filter((a) => a.kind === 'message').length,
      prompts: inHour.filter((a) => a.kind === 'prompt_answered').length,
    }
  })
  return { ...readDay(read, bounds), hours }
}

// Seven local days from `first`; each counts its own part of a burst that crosses midnight, and a
// switch on the day of the message that made it. `rows` must also hold the week before, for its
// focus. `orchestrator`: the project's orchestrator's ids, its earlier conversations included; null
// when it has none.
export function activityWeek(
  rows: ActivityRows,
  first: Day,
  now: number,
  orchestrator: readonly string[] | null = null,
): ActivityWeek {
  const read = counted(rows, now)
  const days = [0, 1, 2, 3, 4, 5, 6].map((n) => readDay(read, dayBounds(addDays(first, n))))
  const bounds = { start: midnight(first), end: midnight(addDays(first, 7)) }
  const before = { start: midnight(addDays(first, -7)), end: bounds.start }
  const previous = weekFocus(read, before, orchestrator)
  return {
    bounds,
    days,
    focus: weekFocus(read, bounds, orchestrator),
    before: previous.messages === 0 ? null : previous,
  }
}

function weekFocus(
  { actions, all }: ReturnType<typeof counted>,
  bounds: Bounds,
  orchestrator: readonly string[] | null,
): WeekFocus {
  const inWeek = (at: number) => bounds.start <= at && at < bounds.end
  const messages = actions.filter((a) => a.kind === 'message' && inWeek(a.at))
  let activeSeconds = 0
  let switches = 0
  for (const b of all) {
    const part = clipToDay(b, bounds)
    if (part !== null) activeSeconds += part.end - part.start
    switches += b.switches.filter(inWeek).length
  }
  const ids = orchestrator === null ? null : new Set(orchestrator)
  return {
    messages: messages.length,
    activeSeconds,
    switches,
    toOrchestrator:
      ids === null
        ? null
        : messages.filter((m) => m.session !== undefined && ids.has(m.session)).length,
  }
}

// Switches per hour of Active: null with no Active time to divide by.
export const switchesPerHour = (switches: number, activeSeconds: number): number | null =>
  activeSeconds > 0 ? (switches * 3600) / activeSeconds : null

// The share of the week's messages that went to the orchestrator: null with none, or no message.
export const orchestratorShare = (focus: WeekFocus): number | null =>
  focus.toOrchestrator === null || focus.messages === 0
    ? null
    : focus.toOrchestrator / focus.messages

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
