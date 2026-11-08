import { parentPort, workerData } from 'node:worker_threads'
import { now } from '../core/clock'
import { historyPath, UsageHistory } from '../core/usage/history'
import type { UsageView, UsageWhich } from '../core/usage/nodes'
import {
  allBounds,
  type Bucket,
  localDay,
  monthBounds,
  type Period,
  periodBounds,
} from '../core/usage/periods'
import { buildReport, buildSeries, foldByCategory } from '../core/usage/report'
import { importedStatuslineLogPath, statuslineLogPath } from '../core/usage/statusline'

// Reads of the usage history, on a thread of their own: SQLite is synchronous.
export type Which = UsageWhich

export type Query =
  | { readonly kind: 'sessionTokens'; readonly sessionId: string }
  | {
      readonly kind: 'report'
      readonly which: Which
      readonly categories: boolean
      readonly projectNames: readonly (readonly [string, string])[]
      readonly names: readonly (readonly [string, string])[]
    }

const BUCKET: Readonly<Record<Which['kind'] | Exclude<Period, 'all'>, Bucket>> = {
  period: 'day',
  today: 'hour',
  '7d': 'day',
  '30d': 'day',
  month: 'day',
  all: 'month',
}

function answer(query: Query): UsageView | ReturnType<UsageHistory['sessionTokens']> {
  const history = new UsageHistory(historyPath())
  try {
    if (query.kind === 'sessionTokens') return history.sessionTokens(query.sessionId)
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
    }
    const first = history.firstOpened()
    return {
      totals: buildReport(history, bounds, options),
      // the chart's bars: by project, and folded by category when classification is on
      bars: buildSeries(history, bounds, bucket, options).map((r) =>
        query.categories
          ? { project: r, category: foldByCategory(r) }
          : { project: r, category: null },
      ),
      bucket,
      firstMonth:
        first === null ? null : { year: localDay(first).year, month: localDay(first).month },
      tooNew: history.tooNew,
      categories: query.categories,
    }
  } finally {
    history.close()
  }
}

parentPort?.postMessage(answer(workerData as Query))
