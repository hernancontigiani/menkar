import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileStamp } from '../clock'
import type { Db } from '../db'
import { log } from '../log'
import { appDirs } from '../paths'
import { isObject } from './transcript'

// The human's activity and each task's state changes, journaled by main as they happen with no
// text, and imported into the usage history in batches off the UI path.
export const JOURNAL_VERSION = 1

export const ACTIVITY_KINDS = [
  'prompt_answered',
  'topic_discussed',
  'topic_closed',
  'present',
  'away',
  'back',
  'app_start',
  'prompted_start',
] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

interface Line {
  readonly v: typeof JOURNAL_VERSION
  readonly id: string
  // Unix seconds
  readonly at: number
}

export interface ActivityEvent extends Line {
  readonly kind: ActivityKind
  readonly projectId?: string
  readonly sessionId?: string
  readonly topic?: number
  readonly task?: number
  readonly next?: string
  readonly blockedSeconds?: number
}

export interface TaskStateEvent extends Line {
  readonly kind: 'task_state'
  readonly projectId: string
  readonly task: number
  readonly state: string
  readonly waitKind?: string
  // a topic's number or a session's id, never a name typed
  readonly waitRef?: string
  readonly assignee?: string
  readonly baseline?: boolean
}

export type JournalEvent = ActivityEvent | TaskStateEvent

export interface ActivityImport {
  imported: number
  skipped: number
  newer: number
}

export function activityDir(): string {
  return join(appDirs().data, 'activity')
}

// A rename replaces its target silently, and the stamp repeats when the clock is set back or an
// hour repeats at a daylight-saving change: the random part keeps a batch from replacing another.
export function batchPath(dir: string, ms: number): string {
  return join(dir, `batch-${fileStamp(ms)}-${randomBytes(4).toString('hex')}.jsonl`)
}

// Rows carry their own time, so the order of import does not matter.
export function batchFiles(dir: string): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch (error) {
    if (missing(error)) return []
    throw error
  }
  return names
    .filter((n) => n.startsWith('batch-') && n.endsWith('.jsonl'))
    .sort()
    .map((n) => join(dir, n))
}

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

const optionalString = (value: unknown) =>
  value === undefined || (typeof value === 'string' && value !== '')
const optionalNumber = (value: unknown) =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value))
const optionalInteger = (value: unknown) => value === undefined || Number.isSafeInteger(value)

// 'newer' is a line from a later journal version, which this Menkar cannot read but must not lose.
export function parseJournalLine(line: string): JournalEvent | 'newer' | 'bad' {
  let data: unknown
  try {
    data = JSON.parse(line)
  } catch {
    return 'bad' // a line torn by a crash or a power loss
  }
  if (!isObject(data) || typeof data.v !== 'number' || !Number.isInteger(data.v)) return 'bad'
  if (data.v > JOURNAL_VERSION) return 'newer'
  if (data.v !== JOURNAL_VERSION) return 'bad'
  if (typeof data.id !== 'string' || data.id === '') return 'bad'
  if (typeof data.at !== 'number' || !Number.isFinite(data.at)) return 'bad'
  if (data.kind === 'task_state') {
    const ok =
      typeof data.projectId === 'string' &&
      data.projectId !== '' &&
      Number.isSafeInteger(data.task) &&
      typeof data.state === 'string' &&
      data.state !== '' &&
      optionalString(data.waitKind) &&
      optionalString(data.waitRef) &&
      optionalString(data.assignee) &&
      (data.baseline === undefined || typeof data.baseline === 'boolean')
    return ok ? (data as unknown as TaskStateEvent) : 'bad'
  }
  const ok =
    ACTIVITY_KINDS.includes(data.kind as ActivityKind) &&
    optionalString(data.projectId) &&
    optionalString(data.sessionId) &&
    optionalInteger(data.topic) &&
    optionalInteger(data.task) &&
    optionalString(data.next) &&
    optionalNumber(data.blockedSeconds)
  return ok ? (data as unknown as ActivityEvent) : 'bad'
}

// One batch file into the history, in one transaction; rows already there are kept as they are.
// The file is then deleted, or, when it holds a newer line, kept as newer-* where no importer of
// this version reads it again.
export function importBatch(db: Db, path: string): ActivityImport {
  const result: ActivityImport = { imported: 0, skipped: 0, newer: 0 }
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if (missing(error)) return result // another importer took it
    throw error
  }
  const events: JournalEvent[] = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    const parsed = parseJournalLine(line)
    if (parsed === 'bad') result.skipped += 1
    else if (parsed === 'newer') result.newer += 1
    else events.push(parsed)
  }
  db.transaction(() => {
    const activity = db.raw.prepare(
      'INSERT OR IGNORE INTO activity VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    const taskState = db.raw.prepare(
      'INSERT OR IGNORE INTO task_states VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    for (const e of events) {
      const run =
        e.kind === 'task_state'
          ? taskState.run(
              e.id,
              e.at,
              e.projectId,
              e.task,
              e.state,
              e.waitKind ?? null,
              e.waitRef ?? null,
              e.assignee ?? null,
              e.baseline ? 1 : 0,
            )
          : activity.run(
              e.id,
              e.at,
              e.kind,
              e.projectId ?? null,
              e.sessionId ?? null,
              e.topic ?? null,
              e.task ?? null,
              e.next ?? null,
              e.blockedSeconds ?? null,
            )
      result.imported += Number(run.changes)
    }
  })
  try {
    if (result.newer > 0) {
      renameSync(path, join(dirname(path), basename(path).replace(/^batch-/, 'newer-')))
    } else {
      unlinkSync(path)
    }
  } catch (error) {
    if (!missing(error)) throw error
  }
  if (result.skipped > 0 || result.newer > 0) {
    log.warn('activity batch held lines not imported', {
      path,
      skipped: result.skipped,
      newer: result.newer,
    })
  }
  return result
}
