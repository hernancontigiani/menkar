import { randomBytes } from 'node:crypto'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { now } from '../../clock'

// One file per pane, `<pane>.json`, overwritten at each turn's end: the session the turn ran under,
// and when. Main reads it to learn a pane's session id and that its turn ended.
export const TURN_END_KEYS = ['pane', 'session_id', 'at'] as const

export interface TurnEnd {
  readonly sessionId: string
  readonly at: string
}

// A pane id names the file, so it is a plain word.
const validPane = (pane: string): boolean => /^[A-Za-z0-9_-]{1,100}$/.test(pane)

// Whole or not at all: a temporary file renamed over the record, so main never reads half of one.
export function writeTurnEnd(dir: string, pane: string, sessionId: string): boolean {
  if (!validPane(pane) || sessionId === '' || sessionId.includes('/')) return false
  const record: Record<(typeof TURN_END_KEYS)[number], string> = {
    pane,
    session_id: sessionId,
    at: new Date(now()).toISOString(),
  }
  mkdirSync(dir, { recursive: true })
  const temporary = join(dir, `.tmp-${randomBytes(6).toString('hex')}`)
  try {
    writeFileSync(temporary, JSON.stringify(record))
    renameSync(temporary, join(dir, `${pane}.json`))
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
  return true
}

// What main needs of a record, from any agent's producer; null for one it cannot use.
export function parseTurnEnd(text: string): TurnEnd | null {
  let record: unknown
  try {
    record = JSON.parse(text)
  } catch {
    return null // cut short, or not a record: its rewrite comes next
  }
  if (typeof record !== 'object' || record === null) return null
  const { session_id: sessionId, at } = record as Record<string, unknown>
  return typeof sessionId === 'string' && typeof at === 'string' ? { sessionId, at } : null
}
