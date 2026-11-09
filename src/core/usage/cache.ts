import { closeSync, openSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { type Db, openDb } from '../db'
import { appDirs } from '../paths'
import { listTranscripts } from './files'
import { requestModel } from './prices'
import {
  type ClosedSpan,
  dumpTurn,
  feed as feedTurn,
  isObject,
  loadTurn,
  nameOf,
  type Response,
  responseOf,
  responseTotal,
} from './transcript'

// Derived data, rebuilt from the transcripts whenever its layout changes: nothing here is lost
// when it is dropped, unlike the history.
const SCHEMA_VERSION = 1

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE files (path TEXT PRIMARY KEY, inode INTEGER NOT NULL, offset INTEGER NOT NULL, state TEXT NOT NULL);
CREATE TABLE entries (
  message_id TEXT NOT NULL, request_id TEXT NOT NULL, session_id TEXT NOT NULL,
  sidechain INTEGER NOT NULL, at REAL NOT NULL, model TEXT NOT NULL,
  input INTEGER NOT NULL, output INTEGER NOT NULL, cache_write INTEGER NOT NULL,
  cache_write_1h INTEGER NOT NULL, cache_read INTEGER NOT NULL,
  PRIMARY KEY (message_id, request_id)
);
CREATE INDEX entries_session ON entries (session_id, at);
CREATE INDEX entries_message ON entries (message_id);
CREATE TABLE names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL, claude INTEGER NOT NULL);
CREATE TABLE turns (
  uuid TEXT PRIMARY KEY, file TEXT NOT NULL, session_id TEXT NOT NULL, origin TEXT NOT NULL,
  opened REAL NOT NULL, offset INTEGER NOT NULL
);
CREATE INDEX turns_session ON turns (session_id, opened);
CREATE INDEX turns_file ON turns (file);
CREATE TABLE spans (
  file TEXT NOT NULL, session_id TEXT NOT NULL, turn TEXT NOT NULL, origin TEXT NOT NULL,
  kind TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL
);
CREATE INDEX spans_file ON spans (file);
CREATE INDEX spans_turn ON spans (turn);
CREATE TABLE pending (session_id TEXT NOT NULL, turn TEXT NOT NULL, PRIMARY KEY (session_id, turn));
`

export function cachePath(): string {
  return join(appDirs().cache, 'usage.sqlite')
}

export interface CachedTurn {
  readonly uuid: string
  readonly sessionId: string
  readonly origin: string
  readonly opened: number
}

export interface CachedSpan {
  readonly kind: string
  readonly start: number
  readonly end: number
}

export interface HourTokens {
  readonly model: string
  readonly hour: number
  readonly input: number
  readonly output: number
  readonly cacheWrite: number
  readonly cacheWrite1h: number
  readonly cacheRead: number
}

// A (session, turn) the history has not written yet; turn '' stands for the session's name only.
export interface PendingRow {
  readonly sessionId: string
  readonly turn: string
}

interface Touched {
  readonly sessions: Set<string>
  readonly turns: Set<string>
  readonly responses: Map<string, { sessionId: string; at: number }>
}

type Row = Record<string, unknown>
const num = (row: Row | undefined, key: string): number => Number(row?.[key])
const str = (row: Row | undefined, key: string): string => String(row?.[key])

export class UsageCache {
  readonly db: Db

  constructor(path: string = cachePath()) {
    this.db = openDb(path, 30_000)
    if (this.version() !== SCHEMA_VERSION) this.rebuild()
  }

  close(): void {
    this.db.close()
  }

  private version(): number | null {
    try {
      const row = this.db.raw.prepare("SELECT value FROM meta WHERE key = 'schema'").get()
      return row ? Number(row.value) : null
    } catch {
      return null // no meta table: a new or foreign file, rebuilt below
    }
  }

  private rebuild(): void {
    const tables = this.db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row.name))
    this.db.transaction(() => {
      for (const name of tables)
        this.db.raw.exec(`DROP TABLE IF EXISTS "${name.replaceAll('"', '""')}"`)
      this.db.raw.exec(SCHEMA)
      this.db.raw.prepare("INSERT INTO meta VALUES ('schema', ?)").run(String(SCHEMA_VERSION))
    })
  }

  // Reads what each transcript gained since the last pass. What the pass may have changed is
  // recorded as pending in the same transaction as the new offsets, so a history write that fails
  // later leaves those turns pending instead of read and written nowhere.
  ingest(projectsDir: string): void {
    const touched: Touched = { sessions: new Set(), turns: new Set(), responses: new Map() }
    this.db.transaction(() => {
      for (const { path, sessionId } of listTranscripts(projectsDir)) {
        this.ingestFile(path, sessionId, touched)
      }
      const insert = this.db.raw.prepare('INSERT OR IGNORE INTO pending VALUES (?, ?)')
      for (const row of this.affected(touched)) insert.run(row.sessionId, row.turn)
      for (const sessionId of touched.sessions) insert.run(sessionId, '')
    })
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

  private ingestFile(path: string, sessionId: string, touched: Touched): void {
    let size: number
    let inode: number
    try {
      const stat = statSync(path)
      size = stat.size
      inode = stat.ino
    } catch {
      return // gone between the listing and now
    }
    const known = this.db.raw
      .prepare('SELECT inode, offset, state FROM files WHERE path = ?')
      .get(path)
    const fresh = !(known && num(known, 'inode') === inode && size >= num(known, 'offset'))
    const offset = fresh ? 0 : num(known, 'offset')
    if (size === offset) return
    touched.sessions.add(sessionId)
    if (fresh && known) {
      this.db.raw.prepare('DELETE FROM spans WHERE file = ?').run(path)
      this.db.raw.prepare('DELETE FROM turns WHERE file = ?').run(path)
    }
    const turn = loadTurn(fresh ? null : str(known, 'state'))
    const data = readFrom(path, offset, size - offset)
    // A last line still being written waits for the next pass.
    const complete = data.subarray(0, data.lastIndexOf(0x0a) + 1)
    const insertTurn = this.db.raw.prepare('INSERT OR REPLACE INTO turns VALUES (?, ?, ?, ?, ?, ?)')
    const insertSpan = this.db.raw.prepare('INSERT INTO spans VALUES (?, ?, ?, ?, ?, ?, ?)')
    let at = offset
    let lineStart = 0
    while (lineStart < complete.length) {
      const newline = complete.indexOf(0x0a, lineStart)
      const lineEnd = newline === -1 ? complete.length : newline
      const line = complete.subarray(lineStart, lineEnd)
      const start = at
      at += line.length + 1
      lineStart = lineEnd + 1
      let parsed: unknown
      try {
        parsed = JSON.parse(line.toString('utf8'))
      } catch {
        continue
      }
      if (!isObject(parsed)) continue
      const response = responseOf(parsed, sessionId)
      if (response !== null) {
        // Every copy of the message before and after: keeping one may drop another's tokens.
        this.noteCopies(response.messageId, touched)
        this.keep(response)
        this.noteCopies(response.messageId, touched)
        touched.responses.set(`${sessionId}\u0000${response.at}`, { sessionId, at: response.at })
      }
      this.keepName(parsed, sessionId)
      const before = turn.uuid
      const spans: ClosedSpan[] = feedTurn(turn, parsed)
      if (turn.uuid !== before && turn.uuid !== null && turn.origin !== null) {
        insertTurn.run(turn.uuid, path, sessionId, turn.origin, turn.last ?? 0, start)
        touched.turns.add(turn.uuid)
      }
      for (const span of spans) {
        touched.turns.add(span.turn)
        insertSpan.run(path, sessionId, span.turn, span.origin, span.kind, span.start, span.end)
      }
    }
    this.db.raw
      .prepare('INSERT OR REPLACE INTO files VALUES (?, ?, ?, ?)')
      .run(path, inode, offset + complete.length, dumpTurn(turn))
  }

  private noteCopies(messageId: string, touched: Touched): void {
    for (const row of this.db.raw
      .prepare('SELECT session_id, at FROM entries WHERE message_id = ?')
      .all(messageId)) {
      const sessionId = str(row, 'session_id')
      const at = num(row, 'at')
      touched.responses.set(`${sessionId}\u0000${at}`, { sessionId, at })
    }
  }

  // Of two copies of one (message, request), the main thread's wins, then the larger. A sidechain
  // replaying a response the main thread already has under another request adds nothing, and a
  // main-thread copy arriving later displaces such replays.
  private keep(r: Response): void {
    const raw = this.db.raw
    if (
      r.sidechain &&
      raw.prepare('SELECT 1 FROM entries WHERE message_id = ? AND sidechain = 0').get(r.messageId)
    ) {
      return
    }
    if (!r.sidechain) {
      raw
        .prepare('DELETE FROM entries WHERE message_id = ? AND sidechain = 1 AND request_id != ?')
        .run(r.messageId, r.requestId)
    }
    const current = raw
      .prepare(
        'SELECT sidechain, input + output + cache_write + cache_read AS total FROM entries' +
          ' WHERE message_id = ? AND request_id = ?',
      )
      .get(r.messageId, r.requestId)
    if (current) {
      const currentSidechain = num(current, 'sidechain') === 1
      const better =
        (currentSidechain && !r.sidechain) ||
        (currentSidechain === r.sidechain && responseTotal(r) > num(current, 'total'))
      if (!better) return
    }
    raw
      .prepare('INSERT OR REPLACE INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        r.messageId,
        r.requestId,
        r.sessionId,
        r.sidechain ? 1 : 0,
        r.at,
        r.model,
        r.input,
        r.output,
        r.cacheWrite,
        r.cacheWrite1h,
        r.cacheRead,
      )
  }

  // A given name (`-n`, `/rename`) wins over a generated one; among the same kind, the latest.
  private keepName(entry: Record<string, unknown>, sessionId: string): void {
    const found = nameOf(entry)
    if (found === null) return
    const claude = found.given ? 1 : 0
    const current = this.db.raw
      .prepare('SELECT claude FROM names WHERE session_id = ?')
      .get(sessionId)
    if (current === undefined || claude >= num(current, 'claude')) {
      this.db.raw
        .prepare('INSERT OR REPLACE INTO names VALUES (?, ?, ?)')
        .run(sessionId, found.name, claude)
    }
  }

  // The latest turn of the session opened at or before `at`; `pre:<session>` before any.
  turnInEffect(sessionId: string, at: number): string {
    const row = this.db.raw
      .prepare(
        'SELECT uuid FROM turns WHERE session_id = ? AND opened <= ? ORDER BY opened DESC, uuid DESC',
      )
      .get(sessionId, at)
    return row ? str(row, 'uuid') : `pre:${sessionId}`
  }

  // A turn that opens takes responses from the one before it, so that one is rewritten too.
  private affected(touched: Touched): PendingRow[] {
    const found = new Map<string, PendingRow>()
    const add = (sessionId: string, turn: string) =>
      found.set(`${sessionId}\u0000${turn}`, { sessionId, turn })
    for (const uuid of touched.turns) {
      const row = this.db.raw
        .prepare('SELECT session_id, opened FROM turns WHERE uuid = ?')
        .get(uuid)
      if (!row) continue
      const sessionId = str(row, 'session_id')
      const opened = num(row, 'opened')
      add(sessionId, uuid)
      const before = this.db.raw
        .prepare(
          'SELECT uuid FROM turns WHERE session_id = ? AND (opened < ? OR (opened = ? AND uuid < ?))' +
            ' ORDER BY opened DESC, uuid DESC',
        )
        .get(sessionId, opened, opened, uuid)
      add(sessionId, before ? str(before, 'uuid') : `pre:${sessionId}`)
    }
    for (const { sessionId, at } of touched.responses.values())
      add(sessionId, this.turnInEffect(sessionId, at))
    return [...found.values()]
  }

  // A turn as the cache has it now: its spans, and every response of its session from its opening
  // to the next turn's, summed per (model, UTC hour), each request under the key its own size
  // prices it at. Null when the cache has nothing of it.
  turnUsage(
    sessionId: string,
    uuid: string,
  ): { turn: CachedTurn; spans: CachedSpan[]; tokens: HourTokens[] } | null {
    const raw = this.db.raw
    let turn: CachedTurn
    let low: number
    let high: number
    let spans: CachedSpan[] = []
    if (uuid.startsWith('pre:')) {
      const first = raw
        .prepare('SELECT MIN(opened) AS first FROM turns WHERE session_id = ?')
        .get(sessionId)
      const firstOpened = first?.first
      low = Number.NEGATIVE_INFINITY
      high =
        firstOpened === null || firstOpened === undefined
          ? Number.POSITIVE_INFINITY
          : Number(firstOpened)
      const earliest = raw
        .prepare('SELECT MIN(at) AS at FROM entries WHERE session_id = ? AND at < ?')
        .get(sessionId, high)
      if (earliest?.at === null || earliest?.at === undefined) return null
      turn = { uuid, sessionId, origin: 'unknown', opened: Number(earliest.at) }
    } else {
      const row = raw.prepare('SELECT origin, opened FROM turns WHERE uuid = ?').get(uuid)
      if (!row) return null
      turn = { uuid, sessionId, origin: str(row, 'origin'), opened: num(row, 'opened') }
      const after = raw
        .prepare(
          'SELECT opened FROM turns WHERE session_id = ? AND (opened > ? OR (opened = ? AND uuid > ?))' +
            ' ORDER BY opened, uuid',
        )
        .get(sessionId, turn.opened, turn.opened, uuid)
      low = turn.opened
      high = after ? num(after, 'opened') : Number.POSITIVE_INFINITY
      spans = raw
        .prepare('SELECT kind, start, end FROM spans WHERE turn = ? ORDER BY start, rowid')
        .all(uuid)
        .map((s) => ({ kind: str(s, 'kind'), start: num(s, 'start'), end: num(s, 'end') }))
    }
    const sums = new Map<string, HourTokens>()
    for (const e of raw
      .prepare(
        'SELECT model, CAST(at / 3600 AS INTEGER) * 3600.0 AS hour, input, output,' +
          ' cache_write AS cw, cache_write_1h AS cw1h, cache_read AS cr FROM entries' +
          ' WHERE session_id = ? AND at >= ? AND at < ?',
      )
      .all(sessionId, finite(low), finite(high))) {
      const request = {
        input: num(e, 'input'),
        output: num(e, 'output'),
        cacheWrite: num(e, 'cw'),
        cacheWrite1h: num(e, 'cw1h'),
        cacheRead: num(e, 'cr'),
      }
      const model = requestModel(str(e, 'model'), request)
      const hour = num(e, 'hour')
      const key = JSON.stringify([model, hour])
      const had = sums.get(key)
      sums.set(key, {
        model,
        hour,
        input: (had?.input ?? 0) + request.input,
        output: (had?.output ?? 0) + request.output,
        cacheWrite: (had?.cacheWrite ?? 0) + request.cacheWrite,
        cacheWrite1h: (had?.cacheWrite1h ?? 0) + request.cacheWrite1h,
        cacheRead: (had?.cacheRead ?? 0) + request.cacheRead,
      })
    }
    const tokens = [...sums.values()].sort((a, b) =>
      a.model < b.model ? -1 : a.model > b.model ? 1 : a.hour - b.hour,
    )
    return { turn, spans, tokens }
  }

  // Claude's name for each of these sessions it has one for, and whether it was given (1).
  names(sessions: Iterable<string>): Map<string, { name: string; claude: number }> {
    const found = new Map<string, { name: string; claude: number }>()
    const select = this.db.raw.prepare('SELECT name, claude FROM names WHERE session_id = ?')
    for (const sessionId of sessions) {
      const row = select.get(sessionId)
      if (row) found.set(sessionId, { name: str(row, 'name'), claude: num(row, 'claude') })
    }
    return found
  }

  // A turn's transcript, the byte its opening line starts at, and the byte the next turn of that
  // file starts at (null: the turn runs to the end of the file).
  extent(uuid: string): { file: string; start: number; end: number | null } | null {
    const row = this.db.raw.prepare('SELECT file, offset FROM turns WHERE uuid = ?').get(uuid)
    if (!row) return null
    const file = str(row, 'file')
    const start = num(row, 'offset')
    const next = this.db.raw
      .prepare('SELECT MIN(offset) AS next FROM turns WHERE file = ? AND offset > ?')
      .get(file, start)
    const end = next?.next === null || next?.next === undefined ? null : Number(next.next)
    return { file, start, end }
  }

  // The latest turn the human started in the same session before this one.
  previousHuman(uuid: string): string | null {
    const row = this.db.raw
      .prepare(
        'SELECT p.uuid AS uuid FROM turns t JOIN turns p ON p.session_id = t.session_id' +
          " WHERE t.uuid = ? AND p.origin = 'human'" +
          ' AND (p.opened < t.opened OR (p.opened = t.opened AND p.uuid < t.uuid))' +
          ' ORDER BY p.opened DESC, p.uuid DESC',
      )
      .get(uuid)
    return row ? str(row, 'uuid') : null
  }

  // The transcript a turn was read from and the byte its opening line starts at.
  source(uuid: string): { file: string; offset: number } | null {
    const row = this.db.raw.prepare('SELECT file, offset FROM turns WHERE uuid = ?').get(uuid)
    return row ? { file: str(row, 'file'), offset: num(row, 'offset') } : null
  }
}

// The open ends of a range are bound as the largest finite doubles rather than as infinities.
function finite(value: number): number {
  if (value === Number.POSITIVE_INFINITY) return Number.MAX_VALUE
  if (value === Number.NEGATIVE_INFINITY) return -Number.MAX_VALUE
  return value
}

function readFrom(path: string, offset: number, length: number): Buffer {
  const buffer = Buffer.alloc(length)
  const fd = openSync(path, 'r')
  try {
    let read = 0
    while (read < length) {
      const n = readSync(fd, buffer, read, length - read, offset + read)
      if (n === 0) break
      read += n
    }
    return buffer.subarray(0, read)
  } finally {
    closeSync(fd)
  }
}
