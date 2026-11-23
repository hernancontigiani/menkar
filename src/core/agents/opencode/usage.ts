import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { TurnText } from '../../classifier/input'
import { type Db, openDb } from '../../db'
import { log } from '../../log'
import type { CachedSpan, HourTokens, PendingRow } from '../../usage/cache'
import { requestModel } from '../../usage/prices'
import { costLogName } from '../../usage/statusline'
import { IDLE_AFTER_SECONDS } from '../../usage/transcript'
import { dropCopies, openAgentDb, ownCopies, sweepCopies, UNREADABLE } from '../shared/db'
import type { TurnSource, TurnUsage, UsageSource } from '../types'

// Derived from OpenCode's database and rebuilt whenever its layout changes: nothing here is lost
// when it is dropped.
const SCHEMA_VERSION = 1
export const CACHE_FILE = 'usage-cache-opencode.sqlite'
const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sessions (id TEXT PRIMARY KEY, parent TEXT, root TEXT NOT NULL, title TEXT);
CREATE TABLE messages (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, root TEXT NOT NULL, type TEXT NOT NULL,
  seq INTEGER NOT NULL, at REAL NOT NULL, done REAL, model TEXT, input INTEGER NOT NULL,
  output INTEGER NOT NULL, cache_write INTEGER NOT NULL, cache_read INTEGER NOT NULL,
  cost REAL NOT NULL, origin TEXT
);
CREATE INDEX messages_root ON messages (root, at, seq);
CREATE TABLE turns (
  uuid TEXT PRIMARY KEY, session_id TEXT NOT NULL, origin TEXT NOT NULL, opened REAL NOT NULL,
  message TEXT NOT NULL
);
CREATE INDEX turns_session ON turns (session_id, opened);
CREATE TABLE spans (
  turn TEXT NOT NULL, kind TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL,
  PRIMARY KEY (turn, kind, start, end)
);
CREATE TABLE pending (session_id TEXT NOT NULL, turn TEXT NOT NULL, PRIMARY KEY (session_id, turn));
`

const PREFIX = 'opencode:'
// The rows that carry a model request's tokens and cost: a step, and a compaction's summary.
const STEPS = ['assistant', 'compaction']
const STEP_TYPES = "('assistant', 'compaction')"
// A turn Menkar's own message opened, not the human.
const MENKAR_POST = '[Menkar]'
// How far up a subagent's parents are followed to its root session.
const MAX_DEPTH = 16

type Row = Record<string, unknown>
const num = (row: Row | undefined, key: string): number => Number(row?.[key])
const str = (row: Row | undefined, key: string): string => String(row?.[key])
const nullable = (row: Row | undefined, key: string): string | null =>
  row?.[key] === null || row?.[key] === undefined ? null : String(row[key])
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
const seconds = (ms: unknown): number | null =>
  typeof ms === 'number' && Number.isFinite(ms) ? ms / 1000 : null

// What one pass reads of OpenCode's database: every session's place in its tree, and the messages
// written or changed since the last pass, each reduced to what usage needs.
interface Read {
  readonly sessions: { id: string; parent: string | null; title: string | null }[]
  readonly messages: Row[]
  readonly watermark: number
}

function readSince(db: DatabaseSync, since: number): Read {
  const sessions = db
    .prepare('SELECT id, parent_id, title FROM session_v2')
    .all()
    .map((row) => ({
      id: String(row.id),
      parent: nullable(row, 'parent_id'),
      title: typeof row.title === 'string' && row.title.trim() ? row.title.trim() : null,
    }))
  // Only the fields usage needs leave the database: a message's text stays there.
  const messages = db
    .prepare(
      `SELECT id, session_id, type, seq, time_created, time_updated,
         json_extract(data, '$.time.created') AS created,
         json_extract(data, '$.time.completed') AS completed,
         json_extract(data, '$.model.id') AS model,
         json_extract(data, '$.tokens.input') AS input,
         json_extract(data, '$.tokens.output') AS output,
         json_extract(data, '$.tokens.reasoning') AS reasoning,
         json_extract(data, '$.tokens.cache.read') AS cache_read,
         json_extract(data, '$.tokens.cache.write') AS cache_write,
         json_extract(data, '$.cost') AS cost,
         substr(json_extract(data, '$.text'), 1, 64) AS head
       FROM session_message WHERE time_updated >= ? ORDER BY time_updated`,
    )
    .all(since)
  const watermark = messages.reduce((max, row) => Math.max(max, num(row, 'time_updated')), since)
  return { sessions, messages, watermark }
}

// A root session's tree as its turns' time is cut from it: the root's user messages, which open
// turns; its idles, which end them; the reports its subagents send back into it, which resume an
// execution an idle ended while they worked; every model step of the tree, root's or subagent's.
interface Tree {
  readonly opens: { at: number; message: string; origin: string }[]
  readonly ends: number[]
  readonly resumes: number[]
  readonly steps: { at: number; done: number | null }[]
}

interface Derived {
  readonly turns: { uuid: string; origin: string; opened: number; message: string }[]
  readonly spans: { turn: string; start: number; end: number }[]
}

// Each stretch of the tree's time belongs to one turn at most, so no second counts twice: a step
// running through it belongs to the turn it started in (the earliest such step, when several
// run), and otherwise the stretch belongs to the turn in effect at its start, unless the root's
// last word before it was an idle. A message steered in while a step runs therefore opens a turn
// whose time starts once that step is done, and the turn before it ends after the message came:
// the agent was not waiting on it. A stretch over two hours is idle.
export function deriveTree(tree: Tree): Derived {
  const turns = [...tree.opens]
    .sort((a, b) => a.at - b.at)
    .map((o) => ({
      uuid: `${PREFIX}${o.message}`,
      origin: o.origin,
      opened: o.at,
      message: o.message,
    }))
  const turnAt = (at: number): string | null => {
    let found: string | null = null
    for (const t of turns) if (t.opened <= at) found = t.uuid
    return found
  }
  const steps = [...tree.steps, ...tree.resumes.map((at) => ({ at, done: null }))].map((s) => ({
    ...s,
    turn: turnAt(s.at),
  }))
  // An idle followed by a subagent's report before the next message did not end the turn: the
  // root's execution ends while its subagent works, and the report starts it again.
  const nextOpen = (at: number) =>
    turns.find((t) => t.opened > at)?.opened ?? Number.POSITIVE_INFINITY
  const ends = [...tree.ends]
    .filter((e) => !tree.resumes.some((r) => r > e && r < nextOpen(e)))
    .sort((a, b) => a - b)
  // Whether the root was idle at `at`: its last open or idle at or before `at` was an idle.
  const idleAt = (at: number): boolean => {
    const end = ends.filter((e) => e <= at).at(-1)
    const open = turns.filter((t) => t.opened <= at).at(-1)
    return end !== undefined && (open === undefined || end >= open.opened)
  }
  const points = [
    ...new Set([
      ...turns.map((t) => t.opened),
      ...ends,
      ...steps.flatMap((s) => (s.done === null ? [s.at] : [s.at, s.done])),
    ]),
  ].sort((a, b) => a - b)
  const spans: Derived['spans'] = []
  for (let n = 1; n < points.length; n += 1) {
    const start = points[n - 1] ?? 0
    const end = points[n] ?? 0
    if (end - start > IDLE_AFTER_SECONDS) continue
    const running = steps
      .filter((s) => s.done !== null && s.at <= start && s.done >= end && s.turn !== null)
      .sort((a, b) => a.at - b.at)[0]
    const turn = running?.turn ?? (idleAt(start) ? null : turnAt(start))
    if (turn === null || turn === undefined) continue
    const last = spans.at(-1)
    if (last && last.turn === turn && last.end === start)
      spans[spans.length - 1] = { turn, start: last.start, end }
    else spans.push({ turn, start, end })
  }
  return { turns, spans }
}

// OpenCode's turns from its database: one per user message of a root session, its tokens and cost
// from each model step of that session and of the subagents under it, its time from the gaps
// between the steps.
export class OpenCodeUsage implements TurnSource {
  readonly db: Db
  readonly catchUp = null
  private readonly copies = ownCopies('usage')

  constructor(
    private readonly source: string,
    path: string,
    private readonly costLog: string,
  ) {
    sweepCopies('usage')
    this.db = openDb(path, 30_000)
    if (this.schema() !== SCHEMA_VERSION) this.rebuild()
  }

  private schema(): number | null {
    try {
      const row = this.db.raw.prepare("SELECT value FROM meta WHERE key = 'schema'").get()
      return row ? Number(row.value) : null
    } catch {
      return null // no meta table: a new or foreign file, rebuilt
    }
  }

  // Another opener may have rebuilt the file meanwhile: the schema is read again inside. The cost
  // already logged is kept across a rebuild, so no line is written twice.
  private rebuild(): void {
    this.db.transaction(() => {
      if (this.schema() === SCHEMA_VERSION) return
      const tables = this.db.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => String(row.name))
      for (const name of tables)
        this.db.raw.exec(`DROP TABLE IF EXISTS "${name.replaceAll('"', '""')}"`)
      this.db.raw.exec(SCHEMA)
      this.db.raw.prepare("INSERT INTO meta VALUES ('schema', ?)").run(String(SCHEMA_VERSION))
    })
  }

  close(): void {
    this.db.close()
    dropCopies(this.copies)
  }

  ingest(): void {
    const since = Number(
      this.db.raw.prepare("SELECT value FROM meta WHERE key = 'watermark'").get()?.value ?? 0,
    )
    const read = openAgentDb(this.source, (db) => readSince(db, since), this.copies)
    if (read === UNREADABLE) return
    const changed = this.db.transaction(() => {
      const touched = new Map<string, number>()
      const names = this.keepSessions(read.sessions)
      for (const row of read.messages) {
        const at = this.keepMessage(row)
        if (at === null) continue
        const root = this.rootOf(str(row, 'session_id'))
        touched.set(root, Math.min(touched.get(root) ?? at, at))
      }
      for (const [root, from] of touched) this.deriveTurns(root, from)
      for (const root of names)
        this.db.raw.prepare('INSERT OR IGNORE INTO pending VALUES (?, ?)').run(root, '')
      this.db.raw
        .prepare("INSERT OR REPLACE INTO meta VALUES ('watermark', ?)")
        .run(String(read.watermark))
      return touched.size > 0
    })
    if (changed || !existsSync(this.costLog)) this.writeCostLog()
  }

  // Every session's parent and title; the roots whose title changed.
  private keepSessions(sessions: Read['sessions']): Set<string> {
    const raw = this.db.raw
    const byId = new Map(sessions.map((s) => [s.id, s]))
    const rootOf = (id: string): string => {
      let at = id
      for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
        const parent = byId.get(at)?.parent ?? null
        if (parent === null || !byId.has(parent)) return at
        at = parent
      }
      return at
    }
    const renamed = new Set<string>()
    const select = raw.prepare('SELECT parent, root, title FROM sessions WHERE id = ?')
    const upsert = raw.prepare('INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?)')
    for (const s of sessions) {
      const root = rootOf(s.id)
      const was = select.get(s.id)
      if (
        was &&
        nullable(was, 'parent') === s.parent &&
        str(was, 'root') === root &&
        nullable(was, 'title') === s.title
      )
        continue
      upsert.run(s.id, s.parent, root, s.title)
      if (s.parent === null && nullable(was, 'title') !== s.title) renamed.add(s.id)
      // A session that moved under another root brings its messages along.
      if (was && str(was, 'root') !== root) {
        raw.prepare('UPDATE messages SET root = ? WHERE session_id = ?').run(root, s.id)
        this.deriveTurns(str(was, 'root'), 0)
        this.deriveTurns(root, 0)
      }
    }
    return renamed
  }

  private rootOf(session: string): string {
    const row = this.db.raw.prepare('SELECT root FROM sessions WHERE id = ?').get(session)
    return row ? str(row, 'root') : session
  }

  // Keeps one message as usage reads it; its time, or null for a row with none or one unchanged
  // (the last pass's newest rows are read again, as a row may change within its millisecond).
  private keepMessage(row: Row): number | null {
    const at = seconds(row.created) ?? seconds(row.time_created)
    if (at === null) return null
    const session = str(row, 'session_id')
    const type = str(row, 'type')
    const head = typeof row.head === 'string' ? row.head : ''
    const origin =
      type === 'user' ? (head.trimStart().startsWith(MENKAR_POST) ? 'peer' : 'human') : null
    // A step's reasoning is billed as output.
    const output = count(row.output) + count(row.reasoning)
    const cost = typeof row.cost === 'number' && Number.isFinite(row.cost) ? row.cost : 0
    const values = [
      str(row, 'id'),
      session,
      this.rootOf(session),
      type,
      num(row, 'seq'),
      at,
      seconds(row.completed),
      typeof row.model === 'string' ? row.model : null,
      count(row.input),
      output,
      count(row.cache_write),
      count(row.cache_read),
      cost,
      origin,
    ]
    const was = this.db.raw.prepare('SELECT * FROM messages WHERE id = ?').get(values[0] ?? '')
    if (was && JSON.stringify(Object.values(was)) === JSON.stringify(values)) return null
    this.db.raw
      .prepare('INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(...values)
    return at
  }

  // The root's turns, derived again from its tree's messages. The turns opened at or after
  // `from`, and the one in effect then, are written again.
  private deriveTurns(root: string, from: number): void {
    const raw = this.db.raw
    const tree: { opens: Tree['opens']; ends: number[]; resumes: number[]; steps: Tree['steps'] } =
      {
        opens: [],
        ends: [],
        resumes: [],
        steps: [],
      }
    for (const m of raw
      .prepare('SELECT id, session_id, type, at, done, origin FROM messages WHERE root = ?')
      .all(root)) {
      const own = str(m, 'session_id') === root
      const type = str(m, 'type')
      if (own && type === 'user')
        tree.opens.push({ at: num(m, 'at'), message: str(m, 'id'), origin: str(m, 'origin') })
      else if (own && type === 'idle') tree.ends.push(num(m, 'at'))
      else if (own && type === 'synthetic') tree.resumes.push(num(m, 'at'))
      else if (STEPS.includes(type))
        tree.steps.push({ at: num(m, 'at'), done: m.done === null ? null : num(m, 'done') })
    }
    const { turns, spans } = deriveTree(tree)
    const before = turns.filter((t) => t.opened < from).at(-1)
    const rewritten = turns.filter((t) => t.opened >= from || t === before)
    const known = raw
      .prepare('SELECT uuid FROM turns WHERE session_id = ? AND opened >= ?')
      .all(root, before?.opened ?? from)
    for (const k of known) raw.prepare('DELETE FROM spans WHERE turn = ?').run(str(k, 'uuid'))
    raw
      .prepare('DELETE FROM turns WHERE session_id = ? AND opened >= ?')
      .run(root, before?.opened ?? from)
    const insertTurn = raw.prepare('INSERT OR REPLACE INTO turns VALUES (?, ?, ?, ?, ?)')
    const insertSpan = raw.prepare('INSERT OR IGNORE INTO spans VALUES (?, ?, ?, ?)')
    const pending = raw.prepare('INSERT OR IGNORE INTO pending VALUES (?, ?)')
    const kept = new Set(rewritten.map((t) => t.uuid))
    for (const t of rewritten) {
      insertTurn.run(t.uuid, root, t.origin, t.opened, t.message)
      pending.run(root, t.uuid)
    }
    for (const s of spans) if (kept.has(s.turn)) insertSpan.run(s.turn, 'execution', s.start, s.end)
  }

  // The exact cost OpenCode reports, as the statusline log's lines beside the cache, which the
  // reports read among those logs. Written whole from the cache, never appended: a line written
  // again after a later one would count that later cost twice.
  // Every root's running total after each of its steps that cost something, at the
  // step's start, so the cost lands on the turn its tokens do. A root's first line is a zero at its
  // first message, which falls in its first turn: the report counts a first line whole only there,
  // and takes a later one as the base of a total it did not see grow.
  private writeCostLog(): void {
    const lines: string[] = []
    const line = (root: string, at: number, usd: number) =>
      `${JSON.stringify({ at: new Date(at * 1000).toISOString(), session_id: root, cost_usd: usd })}\n`
    const first = this.db.raw.prepare('SELECT MIN(at) AS at FROM messages WHERE root = ?')
    let root: string | null = null
    let total = 0
    for (const step of this.db.raw
      .prepare(
        `SELECT root, at, cost FROM messages WHERE type IN ${STEP_TYPES} AND cost != 0` +
          ' ORDER BY root, at, seq',
      )
      .all()) {
      if (str(step, 'root') !== root) {
        root = str(step, 'root')
        total = 0
        lines.push(line(root, num(first.get(root), 'at'), 0))
      }
      total += num(step, 'cost')
      lines.push(line(root, num(step, 'at'), total))
    }
    const text = lines.join('')
    try {
      if (existsSync(this.costLog) && readFileSync(this.costLog, 'utf8') === text) return
      const temporary = `${this.costLog}.${process.pid}.tmp`
      writeFileSync(temporary, text)
      renameSync(temporary, this.costLog)
    } catch (error) {
      log.warn("OpenCode's cost could not be logged; its turns show the estimate", { error })
    }
  }

  pending(): PendingRow[] {
    return this.db.raw
      .prepare('SELECT session_id, turn FROM pending ORDER BY session_id, turn')
      .all()
      .map((row) => ({ sessionId: str(row, 'session_id'), turn: str(row, 'turn') }))
  }

  written(rows: readonly PendingRow[]): void {
    const remove = this.db.raw.prepare('DELETE FROM pending WHERE session_id = ? AND turn = ?')
    this.db.transaction(() => {
      for (const row of rows) remove.run(row.sessionId, row.turn)
    })
  }

  // A turn's spans, and every step of its tree from its opening to the next turn's, summed per
  // (model, UTC hour), each step under the key its own size prices it at.
  turnUsage(sessionId: string, uuid: string): TurnUsage | null {
    if (!uuid.startsWith(PREFIX)) return null
    const raw = this.db.raw
    const row = raw
      .prepare('SELECT origin, opened FROM turns WHERE uuid = ? AND session_id = ?')
      .get(uuid, sessionId)
    if (!row) return null
    const opened = num(row, 'opened')
    const after = raw
      .prepare(
        'SELECT opened FROM turns WHERE session_id = ? AND (opened > ? OR (opened = ? AND uuid > ?))' +
          ' ORDER BY opened, uuid',
      )
      .get(sessionId, opened, opened, uuid)
    const high = after ? num(after, 'opened') : Number.MAX_VALUE
    const spans: CachedSpan[] = raw
      .prepare('SELECT kind, start, end FROM spans WHERE turn = ? ORDER BY start')
      .all(uuid)
      .map((s) => ({ kind: str(s, 'kind'), start: num(s, 'start'), end: num(s, 'end') }))
    const sums = new Map<string, HourTokens>()
    for (const e of raw
      .prepare(
        "SELECT COALESCE(model, 'unknown') AS model, at, input, output, cache_write, cache_read" +
          ` FROM messages WHERE root = ? AND type IN ${STEP_TYPES} AND at >= ? AND at < ?`,
      )
      .all(sessionId, opened, high)) {
      const input = num(e, 'input')
      const output = num(e, 'output')
      const cacheWrite = num(e, 'cache_write')
      const cacheRead = num(e, 'cache_read')
      const model = requestModel(str(e, 'model'), {
        input,
        output,
        cacheWrite,
        cacheWrite1h: 0,
        cacheRead,
      })
      const hour = Math.floor(num(e, 'at') / 3600) * 3600
      const key = JSON.stringify([model, hour])
      const had = sums.get(key)
      sums.set(key, {
        model,
        hour,
        input: (had?.input ?? 0) + input,
        output: (had?.output ?? 0) + output,
        cacheWrite: (had?.cacheWrite ?? 0) + cacheWrite,
        cacheWrite1h: 0,
        cacheRead: (had?.cacheRead ?? 0) + cacheRead,
      })
    }
    const tokens = [...sums.values()].sort((a, b) =>
      a.model < b.model ? -1 : a.model > b.model ? 1 : a.hour - b.hour,
    )
    return { turn: { uuid, sessionId, origin: str(row, 'origin'), opened }, spans, tokens }
  }

  // A root's title, as the catalog names it: OpenCode's own and the user's cannot be told apart.
  names(sessions: Iterable<string>): Map<string, { name: string; given: number }> {
    const found = new Map<string, { name: string; given: number }>()
    const select = this.db.raw.prepare('SELECT title FROM sessions WHERE id = ? AND parent IS NULL')
    for (const sessionId of sessions) {
      const title = nullable(select.get(sessionId), 'title')
      if (title !== null) found.set(sessionId, { name: title, given: 1 })
    }
    return found
  }

  // The database holds every turn's text while the session is there.
  textAt(uuid: string): { file: string; start: number } | null {
    if (!uuid.startsWith(PREFIX)) return null
    return this.db.raw.prepare('SELECT 1 FROM turns WHERE uuid = ?').get(uuid)
      ? { file: this.source, start: 0 }
      : null
  }

  turnText(uuid: string): TurnText | null {
    if (!uuid.startsWith(PREFIX)) return null
    const raw = this.db.raw
    const turn = raw
      .prepare('SELECT session_id, opened, message FROM turns WHERE uuid = ?')
      .get(uuid)
    if (!turn) return null
    const root = str(turn, 'session_id')
    const opened = num(turn, 'opened')
    const next = raw
      .prepare('SELECT MIN(opened) AS at FROM turns WHERE session_id = ? AND opened > ?')
      .get(root, opened)
    const high = next?.at === null || next?.at === undefined ? Number.MAX_VALUE : num(next, 'at')
    const previous = raw
      .prepare(
        "SELECT message FROM turns WHERE session_id = ? AND origin = 'human' AND opened < ?" +
          ' ORDER BY opened DESC',
      )
      .get(root, opened)
    const steps = raw
      .prepare(
        "SELECT id FROM messages WHERE root = ? AND type = 'assistant' AND at >= ? AND at < ?" +
          ' ORDER BY at, seq',
      )
      .all(root, opened, high)
      .map((s) => str(s, 'id'))
    const read = openAgentDb(
      this.source,
      (db) => {
        const textOf = (id: string) => {
          const row = db
            .prepare(
              "SELECT json_extract(data, '$.text') AS text FROM session_message WHERE id = ?",
            )
            .get(id)
          return typeof row?.text === 'string' ? row.text : null
        }
        const tools: Record<string, unknown>[] = []
        const toolsOf = db.prepare(
          `SELECT json_extract(value, '$.name') AS name, json_extract(value, '$.state.input') AS input
           FROM session_message, json_each(session_message.data, '$.content')
           WHERE session_message.id = ? AND json_extract(value, '$.type') = 'tool'`,
        )
        for (const id of steps)
          for (const t of toolsOf.all(id))
            tools.push({
              name: typeof t.name === 'string' ? t.name : 'tool',
              input: parsed(t.input),
            })
        return {
          prompt: textOf(str(turn, 'message')),
          previous: previous ? (textOf(str(previous, 'message')) ?? '') : '',
          tools,
        }
      },
      this.copies,
    )
    if (read === UNREADABLE || read.prompt === null) return null
    return { prompt: read.prompt, previous: read.previous, tools: read.tools }
  }
}

function parsed(value: unknown): unknown {
  if (typeof value !== 'string') return {}
  try {
    return JSON.parse(value)
  } catch (error) {
    if (error instanceof SyntaxError) return {}
    throw error
  }
}

export const usage: UsageSource = {
  open(root: string, cache: string): TurnSource | null {
    if (!existsSync(root)) return null
    const folder = dirname(cache)
    return new OpenCodeUsage(root, join(folder, CACHE_FILE), join(folder, costLogName('opencode')))
  },
}
