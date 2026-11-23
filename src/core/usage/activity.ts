import { randomBytes, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { SHOWN_STATES } from '../agentstate/shown'
import { fileStamp } from '../clock'
import type { Db } from '../db'
import { log } from '../log'
import { appDirs } from '../paths'
import { isObject } from './transcript'

// The human's activity and each task's state changes, journaled by main as they happen with no
// text, and imported into the usage history in batches off the UI path.
export const JOURNAL_VERSION = 2

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
  // every version up to this one is read; a file the previous Menkar left holds version 1
  readonly v: 1 | typeof JOURNAL_VERSION
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

// A pane's shown state from when it is registered until it closes; no session, no content.
export const PANE_STATES = [...SHOWN_STATES, 'closed'] as const
export type PaneStateName = (typeof PANE_STATES)[number]

export interface PaneStateEvent extends Line {
  readonly kind: 'pane_state'
  readonly paneId: string
  // per process: orders two rows of one pane stamped the same second, ids being random
  readonly seq: number
  readonly state: PaneStateName
}

// What says Menkar was watching the panes: a run's start, a quarter-hour tick, a suspend, a quit.
export const WATCH_SIGNS = ['start', 'tick', 'suspend', 'quit'] as const
export type WatchSign = (typeof WATCH_SIGNS)[number]

export interface WatchEvent extends Line {
  readonly kind: 'watch'
  readonly sign: WatchSign
}

export type JournalEvent = ActivityEvent | TaskStateEvent | PaneStateEvent | WatchEvent

export interface ActivityImport {
  imported: number
  skipped: number
  newer: number
}

export function activityDir(): string {
  return join(appDirs().data, 'activity')
}

// The live journal, which only the running app appends to and renames.
export const JOURNAL_FILE = 'journal.jsonl'

// A rename replaces its target silently, and the stamp repeats when the clock is set back or an
// hour repeats at a daylight-saving change: the random part keeps a batch from replacing another.
export function batchPath(dir: string, ms: number): string {
  return join(dir, `batch-${fileStamp(ms)}-${randomBytes(4).toString('hex')}.jsonl`)
}

// Rows carry their own time, so the order of import does not matter. A newer-* file is one an
// older Menkar could not read whole: read again, by the Menkar that can.
export function batchFiles(dir: string): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch (error) {
    if (missing(error)) return []
    throw error
  }
  return names
    .filter((n) => (n.startsWith('batch-') || n.startsWith('newer-')) && n.endsWith('.jsonl'))
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
  if (data.v < 1) return 'bad'
  if (typeof data.id !== 'string' || data.id === '') return 'bad'
  if (typeof data.at !== 'number' || !Number.isFinite(data.at)) return 'bad'
  if (data.kind === 'pane_state') {
    const ok =
      typeof data.paneId === 'string' &&
      data.paneId !== '' &&
      Number.isSafeInteger(data.seq) &&
      PANE_STATES.includes(data.state as PaneStateName)
    return ok ? (data as unknown as PaneStateEvent) : 'bad'
  }
  if (data.kind === 'watch') {
    return WATCH_SIGNS.includes(data.sign as WatchSign) ? (data as unknown as WatchEvent) : 'bad'
  }
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
// The file is then deleted, or, when it holds a newer line, kept as newer-* for a Menkar that
// reads it whole.
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
    const paneState = db.raw.prepare('INSERT OR IGNORE INTO pane_states VALUES (?, ?, ?, ?, ?)')
    const watchSign = db.raw.prepare('INSERT OR IGNORE INTO watch_signs VALUES (?, ?, ?)')
    for (const e of events) {
      const run =
        e.kind === 'pane_state'
          ? paneState.run(e.id, e.at, e.seq, e.paneId, e.state)
          : e.kind === 'watch'
            ? watchSign.run(e.id, e.at, e.sign)
            : e.kind === 'task_state'
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
      if (basename(path).startsWith('batch-')) {
        renameSync(path, join(dirname(path), basename(path).replace(/^batch-/, 'newer-')))
      }
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

export interface JournalRead {
  // the activity events by id; a task's state changes are not the human's activity
  readonly events: Map<string, ActivityEvent>
  readonly panes: Map<string, PaneStateEvent>
  readonly signs: Map<string, WatchEvent>
  bad: number
  newer: number
}

// The events not yet in the history, read without moving or importing anything: the app may be
// appending and rotating meanwhile. An event only moves journal → batch → history, and a batch is
// deleted only after its rows committed; so the journal is read first, then the batches listed and
// read, and the history after them, and each event is seen at least once.
export function readJournal(dir: string): JournalRead {
  const read: JournalRead = {
    events: new Map(),
    panes: new Map(),
    signs: new Map(),
    bad: 0,
    newer: 0,
  }
  const take = (path: string) => {
    let text: string
    try {
      text = readFileSync(path, 'utf8')
    } catch (error) {
      if (missing(error)) return // no journal yet, or a batch imported since it was listed
      throw error
    }
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      const parsed = parseJournalLine(line)
      if (parsed === 'bad') read.bad += 1
      else if (parsed === 'newer') read.newer += 1
      else if (parsed.kind === 'pane_state') read.panes.set(parsed.id, parsed)
      else if (parsed.kind === 'watch') read.signs.set(parsed.id, parsed)
      else if (parsed.kind !== 'task_state') read.events.set(parsed.id, parsed)
    }
  }
  take(join(dir, JOURNAL_FILE))
  for (const path of batchFiles(dir)) take(path)
  return read
}

// The quit's sign, as one whole line, for the one write main makes synchronously.
export function quitLine(at: number): string {
  const line: WatchEvent = { v: JOURNAL_VERSION, id: randomUUID(), at, kind: 'watch', sign: 'quit' }
  return `${JSON.stringify(line)}\n`
}
