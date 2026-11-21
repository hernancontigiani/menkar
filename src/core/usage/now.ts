import type { ActivityEvent } from './activity'
import {
  type ActivityRows,
  type ActivitySource,
  activityDay,
  awayPeriods,
  BURST_GAP_SECONDS,
  bursts,
  humanActionsOf,
  type PresenceKind,
  readActivity,
} from './bursts'
import { localDay, periodBounds } from './periods'
import { isoLocal } from './report'

// What the overlay needs from the history beyond its rows.
export interface JournalHistory extends ActivitySource {
  knownActivityIds(ids: readonly string[]): Set<string>
  firstTurnAt(sessionId: string, at: number): { uuid: string; origin: string } | null
}

type Action = ActivityRows['actions'][number]
type Presence = ActivityRows['presence'][number]

const ACTION_KINDS: ReadonlySet<string> = new Set<Action['kind']>([
  'prompt_answered',
  'topic_discussed',
  'topic_closed',
  'present',
])
const PRESENCE_KINDS: ReadonlySet<string> = new Set<PresenceKind>(['away', 'back', 'app_start'])

const latest = (a: Presence | undefined, b: Presence | undefined) =>
  a === undefined || (b !== undefined && b.at > a.at) ? b : a

// The history's rows with the events read from the journal and the batches that it does not hold
// yet, as `humanActions` would return them once imported. `events` must be read before this is
// called: the history is asked which it holds only after the files were read.
export function withJournal(
  history: JournalHistory,
  events: ReadonlyMap<string, ActivityEvent>,
): ActivitySource {
  const known = history.knownActivityIds([...events.keys()])
  const fresh = [...events.values()].filter((e) => !known.has(e.id))
  return {
    humanActions(low, high, project) {
      const rows = history.humanActions(low, high, project)
      const within = (e: ActivityEvent) => low <= e.at && e.at < high
      const actions: Action[] = [...rows.actions]
      const presence: Presence[] = rows.presence.filter((p) => p.at >= low)
      let before = rows.presence.find((p) => p.at < low)
      const promptedStarts = [...rows.promptedStarts]
      for (const e of fresh) {
        if (ACTION_KINDS.has(e.kind)) {
          if (within(e) && (project === undefined || e.projectId === project))
            actions.push({ at: e.at, kind: e.kind as Action['kind'] })
        } else if (PRESENCE_KINDS.has(e.kind)) {
          const row = { at: e.at, kind: e.kind as PresenceKind }
          if (within(e)) presence.push(row)
          else if (e.at < low) before = latest(before, row)
        } else if (e.kind === 'prompted_start' && e.sessionId !== undefined && within(e)) {
          promptedStarts.push({
            at: e.at,
            sessionId: e.sessionId,
            firstTurn: history.firstTurnAt(e.sessionId, e.at),
          })
        }
      }
      const byTime = <T extends { at: number }>(list: T[]) => list.sort((a, b) => a.at - b.at)
      return {
        messages: rows.messages,
        actions: byTime(actions),
        presence: before === undefined ? byTime(presence) : [before, ...byTime(presence)],
        promptedStarts: byTime(promptedStarts),
      }
    },
  }
}

export const NOW_SCHEMA = 1

export type NowStatus = 'ok' | 'history_too_new' | 'history_unavailable'

interface Moment {
  readonly at: string
  readonly at_epoch: number
}

// `menkar usage now --json`'s object, read by a service of the human's own: a field changes
// meaning or goes away only with a new `schema`, and one may be added without it.
export interface NowReading {
  readonly schema: typeof NOW_SCHEMA
  readonly status: NowStatus
  readonly now: string
  readonly now_epoch: number
  readonly menkar_running?: boolean
  readonly away?: { readonly since: string; readonly since_epoch: number } | null
  readonly last_action?: Moment | null
  readonly burst?: {
    readonly start: string
    readonly start_epoch: number
    readonly last_action: string
    readonly last_action_epoch: number
    readonly length_seconds: number
    readonly messages: number
    readonly prompts: number
    readonly switches: number
  } | null
  readonly today?: {
    readonly active_seconds: number
    readonly messages: number
    readonly prompts: number
  }
  readonly sessions_last_30_minutes?: number
}

export const FOCUS_WINDOW_SECONDS = 1800

const whole = Math.floor
const moment = (seconds: number) => ({ iso: isoLocal(whole(seconds)), epoch: whole(seconds) })

// Nothing read: the history is from a newer Menkar or cannot be opened.
export function nowUnavailable(status: Exclude<NowStatus, 'ok'>, nowSeconds: number): NowReading {
  const t = moment(nowSeconds)
  return { schema: NOW_SCHEMA, status, now: t.iso, now_epoch: t.epoch }
}

// The burst in progress, by the one definition of a burst: the last one, while the gap that would
// end it has not passed and no away has started since its last action.
export function readNow(source: ActivitySource, nowSeconds: number, running: boolean): NowReading {
  const rows = readActivity(source, periodBounds('today', nowSeconds), nowSeconds)
  const away = awayPeriods(rows.presence, nowSeconds)
  // Read to an endless now, the one away still open is the only one with no end.
  const open = awayPeriods(rows.presence, Number.POSITIVE_INFINITY).find(
    (p) => p.end === Number.POSITIVE_INFINITY,
  )
  const actions = humanActionsOf(rows)
  const last = bursts(actions, away).at(-1)
  const messages = actions.filter(
    (a) => a.kind === 'message' && !away.some((p) => p.start <= a.at && a.at < p.end),
  )
  const going =
    open === undefined &&
    last !== undefined &&
    nowSeconds - last.end <= BURST_GAP_SECONDS &&
    !away.some((p) => p.start > last.end && p.start <= nowSeconds)
  const day = activityDay(rows, localDay(nowSeconds), nowSeconds)
  const t = moment(nowSeconds)
  const since = open === undefined ? null : moment(open.start)
  const lastAction = last === undefined ? null : moment(last.end)
  const start = last === undefined ? null : moment(last.start)
  return {
    schema: NOW_SCHEMA,
    status: 'ok',
    now: t.iso,
    now_epoch: t.epoch,
    menkar_running: running,
    away: since === null ? null : { since: since.iso, since_epoch: since.epoch },
    last_action: lastAction === null ? null : { at: lastAction.iso, at_epoch: lastAction.epoch },
    burst:
      going && last !== undefined && start !== null && lastAction !== null
        ? {
            start: start.iso,
            start_epoch: start.epoch,
            last_action: lastAction.iso,
            last_action_epoch: lastAction.epoch,
            length_seconds: lastAction.epoch - start.epoch,
            messages: last.messages,
            prompts: last.prompts,
            switches: last.switches.length,
          }
        : null,
    today: {
      active_seconds: whole(day.burstSeconds),
      messages: day.messages,
      prompts: day.prompts,
    },
    sessions_last_30_minutes: new Set(
      messages
        .filter((m) => nowSeconds - FOCUS_WINDOW_SECONDS <= m.at && m.at <= nowSeconds)
        .map((m) => m.session),
    ).size,
  }
}
