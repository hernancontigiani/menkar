import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { usageLogFile } from '../context/statusline'
import { appDirs } from '../paths'
import { isObject, parseSeconds } from './transcript'

// The statusline's log of what Claude Code reported for each session (cost, limits).
export function statuslineLogPath(): string {
  return usageLogFile()
}

// agent-tablet's log, copied at the first start: kept with the history, as it is not rebuildable.
export function importedStatuslineLogPath(): string {
  return join(appDirs().data, 'agent-tablet-usage.jsonl')
}

function* lines(paths: readonly string[]): Generator<Record<string, unknown>> {
  for (const path of paths) {
    let text: string
    try {
      text = readFileSync(path, 'utf8')
    } catch {
      continue // no log yet: nothing reported
    }
    for (const line of text.split('\n')) {
      let data: unknown
      try {
        data = JSON.parse(line)
      } catch {
        continue
      }
      if (isObject(data)) yield data
    }
  }
}

// The keys of a usage line this reader uses; the statusline writes them (a parity test holds the
// two sides together).
export const STATUSLINE_READ_KEYS = [
  'at',
  'session_id',
  'cost_usd',
  'five_hour_pct',
  'seven_day_pct',
] as const

export interface Increment {
  readonly sessionId: string
  readonly at: number
  readonly dollars: number
}

// What each session's running total grew by in [low, high). The running total is followed through
// every line. Claude Code keeps a session's total across a resume, so a session's first line can
// carry what it cost before the log saw it: it counts whole only when `newSession` says the line
// falls in the session's first turn, and is the base otherwise. A total that drops is a resumed
// session recomputing its total, a dip of a few dollars, never zero again (/clear starts another
// session): the new value is the base, and nothing counts. Counted whole, either one added the
// session's lifetime cost to the day.
export function statuslineIncrements(
  paths: readonly string[],
  low: number,
  high: number,
  newSession: (sessionId: string, at: number) => boolean,
): Increment[] {
  const previous = new Map<string, number>()
  const found: Increment[] = []
  for (const line of lines(paths)) {
    const sessionId = line.session_id
    const cost = line.cost_usd
    const at = parseSeconds(line.at)
    if (
      typeof sessionId !== 'string' ||
      typeof cost !== 'number' ||
      !Number.isFinite(cost) ||
      at === null
    ) {
      continue
    }
    const before = previous.get(sessionId)
    const dollars =
      before === undefined ? (newSession(sessionId, at) ? cost : 0) : Math.max(0, cost - before)
    previous.set(sessionId, cost)
    if (low <= at && at < high) found.push({ sessionId, at, dollars })
  }
  return found
}

// The subscription's 5-hour and 7-day use, in %, as the statusline last reported both.
export function latestLimits(paths: readonly string[]): [number, number] | null {
  let found: [number, number] | null = null
  for (const line of lines(paths)) {
    const five = line.five_hour_pct
    const seven = line.seven_day_pct
    if (typeof five === 'number' && typeof seven === 'number') found = [five, seven]
  }
  return found
}
