import { parentPort, workerData } from 'node:worker_threads'
import { now } from '../core/clock'
import { activityDay, activityWeek, readActivity } from '../core/usage/bursts'
import { taskFlow } from '../core/usage/flow'
import { historyPath, UsageHistory } from '../core/usage/history'
import type {
  ActivityView,
  ActivityWhich,
  TaskFlowView,
  UsageView,
  UsageWhich,
} from '../core/usage/nodes'
import {
  addDays,
  allBounds,
  type Bucket,
  localDay,
  midnight,
  monthBounds,
  type Period,
  periodBounds,
} from '../core/usage/periods'
import { buildUsage } from '../core/usage/report'
import type { TasksPeriod } from '../core/usage/sections'
import { importedStatuslineLogPath, statuslineLogPath } from '../core/usage/statusline'

// Reads of the usage history, on a thread of their own: SQLite is synchronous.
export type Which = UsageWhich

export type Query =
  | { readonly kind: 'sessionTokens'; readonly sessionId: string }
  | {
      readonly kind: 'report'
      readonly which: Which
      readonly categories: boolean
      // the opener window's project; `scoped`: its figures alone
      readonly project: { readonly id: string; readonly name: string } | null
      readonly scoped: boolean
      readonly projectNames: readonly (readonly [string, string])[]
      readonly names: readonly (readonly [string, string])[]
    }
  | {
      readonly kind: 'activity'
      readonly which: ActivityWhich
      readonly project: { readonly id: string; readonly name: string } | null
      readonly scoped: boolean
      readonly projectNames: readonly (readonly [string, string])[]
    }
  | {
      readonly kind: 'flow'
      readonly period: TasksPeriod
      readonly project: { readonly id: string; readonly name: string } | null
      readonly scoped: boolean
    }

const BUCKET: Readonly<Record<Which['kind'] | Exclude<Period, 'all'>, Bucket>> = {
  period: 'day',
  today: 'hour',
  '7d': 'day',
  '30d': 'day',
  month: 'day',
  all: 'month',
}

function activity(
  history: UsageHistory,
  query: Extract<Query, { kind: 'activity' }>,
  nowSeconds: number,
): ActivityView {
  const which = query.which
  const from = which.kind === 'day' ? which.day : which.first
  const bounds = {
    start: midnight(from),
    end: midnight(addDays(from, which.kind === 'day' ? 1 : 7)),
  }
  const scope = query.scoped && query.project ? query.project.id : undefined
  const rows = readActivity(history, bounds, nowSeconds, scope)
  const first = history.firstOpened()
  return {
    which,
    reading:
      which.kind === 'day'
        ? { kind: 'day', day: activityDay(rows, which.day, nowSeconds) }
        : { kind: 'week', week: activityWeek(rows, which.first, nowSeconds) },
    firstDay: first === null ? null : localDay(first),
    projectNames: query.projectNames,
    tooNew: history.tooNew,
    project: query.project,
    scoped: scope !== undefined,
  }
}

function flow(
  history: UsageHistory,
  query: Extract<Query, { kind: 'flow' }>,
  nowSeconds: number,
): TaskFlowView {
  const bounds = periodBounds(query.period, nowSeconds)
  const scope = query.scoped && query.project ? query.project.id : undefined
  return {
    period: query.period,
    flow: taskFlow(history.taskStateRows(bounds.start, bounds.end, scope), bounds, nowSeconds),
    tooNew: history.tooNew,
    project: query.project,
    scoped: scope !== undefined,
  }
}

function answer(
  query: Query,
): UsageView | ActivityView | TaskFlowView | ReturnType<UsageHistory['sessionTokens']> {
  const history = new UsageHistory(historyPath())
  try {
    if (query.kind === 'sessionTokens') return history.sessionTokens(query.sessionId)
    if (query.kind === 'activity') return activity(history, query, now() / 1000)
    if (query.kind === 'flow') return flow(history, query, now() / 1000)
    const nowSeconds = now() / 1000
    const which = query.which
    const bounds =
      which.kind === 'period'
        ? periodBounds(which.period, nowSeconds)
        : which.kind === 'month'
          ? monthBounds(which.year, which.month)
          : allBounds(history.firstOpened(), nowSeconds)
    const bucket = which.kind === 'period' ? BUCKET[which.period] : BUCKET[which.kind]
    const options = {
      statuslineLogs: [importedStatuslineLogPath(), statuslineLogPath()],
      projectNames: new Map(query.projectNames),
      names: new Map(query.names),
      categories: query.categories,
      ...(query.scoped && query.project ? { project: query.project.id } : {}),
    }
    const first = history.firstOpened()
    return {
      ...buildUsage(history, bounds, bucket, options),
      bucket,
      firstMonth:
        first === null ? null : { year: localDay(first).year, month: localDay(first).month },
      tooNew: history.tooNew,
      categories: query.categories,
      project: query.project,
      scoped: query.scoped && query.project !== null,
    }
  } finally {
    history.close()
  }
}

parentPort?.postMessage(answer(workerData as Query))
