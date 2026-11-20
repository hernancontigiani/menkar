import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { TurnText } from '../../classifier/input'
import { type Db, openDb } from '../../db'
import { log } from '../../log'
import type { CachedSpan, HourTokens, PendingRow } from '../../usage/cache'
import { requestModel } from '../../usage/prices'
import { IDLE_AFTER_SECONDS, parseSeconds } from '../../usage/transcript'
import { field, type Line, parseLine } from '../shared/jsonl'
import { streamLines } from '../shared/zstd'
import type { TurnSource, TurnUsage, UsageSource } from '../types'
import { ROLLOUT } from './catalog'

// Derived from the rollouts and rebuilt whenever its layout changes: nothing here is lost when it
// is dropped.
const SCHEMA_VERSION = 1
export const CACHE_FILE = 'usage-cache-codex.sqlite'

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE files (path TEXT PRIMARY KEY, inode INTEGER NOT NULL, offset INTEGER NOT NULL, state TEXT NOT NULL);
CREATE TABLE turns (
  uuid TEXT PRIMARY KEY, session_id TEXT NOT NULL, file TEXT NOT NULL, origin TEXT NOT NULL,
  opened REAL NOT NULL, offset INTEGER NOT NULL
);
CREATE INDEX turns_session ON turns (session_id, opened);
CREATE INDEX turns_file ON turns (file, offset);
CREATE TABLE spans (
  turn TEXT NOT NULL, kind TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL,
  PRIMARY KEY (turn, kind, start, end)
);
CREATE TABLE entries (
  key TEXT PRIMARY KEY, kind TEXT NOT NULL, session_id TEXT NOT NULL, turn_id TEXT NOT NULL,
  at REAL NOT NULL, input INTEGER NOT NULL, output INTEGER NOT NULL, cache_write INTEGER NOT NULL,
  cache_read INTEGER NOT NULL
);
CREATE INDEX entries_session ON entries (session_id, at);
CREATE INDEX entries_turn ON entries (turn_id, kind);
CREATE TABLE models (turn_id TEXT PRIMARY KEY, model TEXT NOT NULL);
CREATE TABLE names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE pending (session_id TEXT NOT NULL, turn TEXT NOT NULL, PRIMARY KEY (session_id, turn));
`

const PREFIX = 'codex:'
// A turn Menkar's own message opened, not the human.
const MENKAR_POST = '[Menkar]'
const SLICE_BYTES = 4 * 1024 * 1024
// Lines handled per transaction while a compressed rollout streams.
const STREAM_BATCH = 500

type Row = Record<string, unknown>
const num = (row: Row | undefined, key: string): number => Number(row?.[key])
const str = (row: Row | undefined, key: string): string => String(row?.[key])
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0

// Where a rollout's reading stopped, kept between passes with its offset.
interface FileState {
  // The session its tokens count for: a subagent's parent, else its own thread.
  session: string | null
  // A subagent's thread opens no turn of its own.
  subagent: boolean
  // The task running now, and how many user messages it has had.
  task: string | null
  messages: number
  // The turn open now, and the time of its last activity; null once its task ended.
  uuid: string | null
  last: number | null
  // The rollout writes one record per response: its token_counts are then not read.
  records: boolean
}

const freshState = (): FileState => ({
  session: null,
  subagent: false,
  task: null,
  messages: 0,
  uuid: null,
  last: null,
  records: false,
})

function loadState(value: string | null): FileState {
  if (value === null) return freshState()
  try {
    return { ...freshState(), ...(JSON.parse(value) as Partial<FileState>) }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return freshState()
  }
}

// One request's tokens, as Codex's usage has them: its input includes the cached part.
interface Usage {
  // The whole prompt, which prices the request (input, cached and written together).
  readonly prompt: number
  readonly input: number
  readonly output: number
  readonly cacheWrite: number
  readonly cacheRead: number
}

function usageOf(value: unknown): Usage | null {
  if (typeof value !== 'object' || value === null) return null
  const prompt = count(field(value, 'input_tokens'))
  const cacheRead = count(field(value, 'cached_input_tokens'))
  const cacheWrite = count(field(value, 'cache_write_input_tokens'))
  return {
    prompt,
    input: Math.max(0, prompt - cacheRead - cacheWrite),
    output: count(field(value, 'output_tokens')),
    cacheWrite,
    cacheRead,
  }
}

// The user's text of a line that is a user message, in either of the rollout's two forms.
function userText(line: Line): { text: string; task: string | null } | null {
  if (line.type !== 'event_msg') return null
  const payload = line.payload
  const type = field(payload, 'type')
  if (type === 'item_completed') {
    const item = field(payload, 'item')
    if (field(item, 'type') !== 'UserMessage') return null
    const content = field(item, 'content')
    const parts = Array.isArray(content) ? content.map((p) => text(field(p, 'text'))) : []
    return {
      text: parts.filter((p): p is string => p !== null).join(' '),
      task: text(field(payload, 'turn_id')),
    }
  }
  if (type === 'user_message') {
    const message = text(field(payload, 'message'))
    return message === null ? null : { text: message, task: null }
  }
  return null
}

// A tool the agent called, as the classifier names it: "<name>: <command>".
function toolOf(line: Line): Record<string, unknown> | null {
  const payload = line.payload
  if (line.type === 'event_msg' && field(payload, 'type') === 'item_completed') {
    const item = field(payload, 'item')
    const type = text(field(item, 'type'))
    if (type === 'CommandExecution') {
      const command = field(item, 'command')
      return {
        name: 'shell',
        input: { command: Array.isArray(command) ? command.join(' ') : String(command ?? '') },
      }
    }
    if (type === 'McpToolCall') {
      const name = [text(field(item, 'server')), text(field(item, 'tool'))].filter(Boolean)
      return { name: name.join('/'), input: {} }
    }
    if (type === 'DynamicToolCall' || type === 'FileChange' || type === 'WebSearch')
      return { name: type, input: {} }
    return null
  }
  if (line.type !== 'response_item') return null
  const type = text(field(payload, 'type'))
  if (type === 'function_call' || type === 'custom_tool_call')
    return { name: text(field(payload, 'name')) ?? type, input: {} }
  if (type === 'local_shell_call') {
    const command = field(field(payload, 'action'), 'command')
    return {
      name: 'shell',
      input: { command: Array.isArray(command) ? command.join(' ') : '' },
    }
  }
  return null
}

function readBytes(path: string, start: number, length: number): Buffer {
  const buffer = Buffer.alloc(length)
  const fd = openSync(path, 'r')
  try {
    let read = 0
    while (read < length) {
      const n = readSync(fd, buffer, read, length - read, start + read)
      if (n === 0) break
      read += n
    }
    return buffer.subarray(0, read)
  } finally {
    closeSync(fd)
  }
}

function list(dir: string): string[] {
  try {
    return readdirSync(dir).sort()
  } catch {
    return [] // a folder that vanished or cannot be listed has no rollouts to read
  }
}

// Every rollout under `sessions/YYYY/MM/DD`, with its thread.
function rollouts(root: string): { path: string; thread: string }[] {
  const found: { path: string; thread: string }[] = []
  for (const year of list(root))
    for (const month of list(join(root, year)))
      for (const day of list(join(root, year, month)))
        for (const name of list(join(root, year, month, day))) {
          const match = ROLLOUT.exec(name)
          if (match?.[1]) found.push({ path: join(root, year, month, day, name), thread: match[1] })
        }
  return found
}

interface Touched {
  readonly turns: Set<string>
  readonly sessions: Set<string>
  readonly entries: Map<string, { session: string; at: number }>
}

const emptyTouched = (): Touched => ({ turns: new Set(), sessions: new Set(), entries: new Map() })

// Codex's turns from its rollouts: one per user message, its tokens from the records Codex writes
// for each response, its time from the gaps between the turn's lines.
export class CodexUsage implements TurnSource {
  readonly db: Db
  readonly catchUp: () => Promise<void>

  constructor(
    private readonly root: string,
    path: string,
  ) {
    this.db = openDb(path, 30_000)
    if (this.schema() !== SCHEMA_VERSION) this.rebuild()
    this.catchUp = () => this.readCompressed()
  }

  private schema(): number | null {
    try {
      const row = this.db.raw.prepare("SELECT value FROM meta WHERE key = 'schema'").get()
      return row ? Number(row.value) : null
    } catch {
      return null // no meta table: a new or foreign file, rebuilt
    }
  }

  // Another opener may have rebuilt the file meanwhile: the schema is read again inside.
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
  }

  ingest(): void {
    const touched = emptyTouched()
    this.db.transaction(() => {
      for (const { path, thread } of rollouts(this.root))
        if (!path.endsWith('.zst')) this.ingestPlain(path, thread, touched)
      this.ingestNames(touched)
      this.markPending(touched)
    })
  }

  // A compressed rollout is read once, as a stream. One that replaces a plain rollout already read
  // goes on from the plain one's offset and state (its bytes are the same), so only what the plain
  // one had not reached is read; a request is keyed by its response, so nothing counts twice.
  private async readCompressed(): Promise<void> {
    for (const { path, thread } of rollouts(this.root)) {
      if (!path.endsWith('.zst')) continue
      if (this.db.raw.prepare('SELECT 1 FROM files WHERE path = ?').get(path)) continue
      let inode: number
      try {
        inode = statSync(path).ino
      } catch {
        continue // gone between the listing and now
      }
      const plain = this.db.raw
        .prepare('SELECT offset, state FROM files WHERE path = ?')
        .get(path.slice(0, -'.zst'.length))
      const skip = plain ? num(plain, 'offset') : 0
      const state = loadState(plain ? str(plain, 'state') : null)
      let at = 0
      let batch: { raw: string; start: number }[] = []
      const flush = () => {
        const lines = batch
        batch = []
        const touched = emptyTouched()
        this.db.transaction(() => {
          for (const { raw, start } of lines) this.feed(raw, start, path, thread, state, touched)
          this.markPending(touched)
        })
      }
      try {
        for await (const raw of streamLines(path)) {
          const start = at
          at += Buffer.byteLength(raw) + 1
          if (start < skip) continue
          batch.push({ raw, start })
          if (batch.length >= STREAM_BATCH) flush()
        }
      } catch (error) {
        log.warn('a compressed Codex rollout could not be read for usage', { path, error })
        continue
      }
      flush()
      this.db.raw
        .prepare('INSERT OR REPLACE INTO files VALUES (?, ?, ?, ?)')
        .run(path, inode, at, JSON.stringify(state))
    }
  }

  private ingestPlain(path: string, thread: string, touched: Touched): void {
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
    let offset = fresh ? 0 : num(known, 'offset')
    if (size === offset) return
    const state = loadState(fresh ? null : str(known, 'state'))
    while (offset < size) {
      const data = readBytes(path, offset, Math.min(SLICE_BYTES, size - offset))
      // A last line still being written waits for the next pass; a slice cut mid-line, the next.
      const end = data.lastIndexOf(0x0a) + 1
      if (end === 0) break
      let lineStart = 0
      while (lineStart < end) {
        const newline = data.indexOf(0x0a, lineStart)
        const raw = data.toString('utf8', lineStart, newline)
        this.feed(raw, offset + lineStart, path, thread, state, touched)
        lineStart = newline + 1
      }
      offset += end
    }
    this.db.raw
      .prepare('INSERT OR REPLACE INTO files VALUES (?, ?, ?, ?)')
      .run(path, inode, offset, JSON.stringify(state))
  }

  // Advances a rollout's reading by one line.
  private feed(
    raw: string,
    start: number,
    file: string,
    thread: string,
    state: FileState,
    touched: Touched,
  ): void {
    const line = parseLine(raw)
    if (line === null) return
    const payload = line.payload
    const at = parseSeconds(line.timestamp)
    if (line.type === 'session_meta' && state.session === null) {
      const parent = text(field(payload, 'parent_thread_id'))
      state.session = parent ?? text(field(payload, 'id')) ?? thread
      state.subagent = parent !== null || field(payload, 'thread_source') === 'subagent'
      return
    }
    const session = state.session ?? thread
    if (line.type === 'turn_context') {
      const task = text(field(payload, 'turn_id'))
      const model = text(field(payload, 'model'))
      if (task !== null && model !== null)
        this.db.raw.prepare('INSERT OR REPLACE INTO models VALUES (?, ?)').run(task, model)
      return
    }
    if (at === null) return
    const type = field(payload, 'type')
    if (line.type === 'event_msg' && type === 'task_started') {
      state.task = text(field(payload, 'turn_id'))
      state.messages = 0
      this.activity(state, at)
      return
    }
    const user = userText(line)
    if (user !== null && !state.subagent) {
      const task = user.task ?? state.task
      if (task !== state.task) {
        state.task = task
        state.messages = 0
      }
      state.messages += 1
      const uuid =
        task === null
          ? `${PREFIX}${thread}:${String(line.timestamp)}`
          : `${PREFIX}${task}${state.messages > 1 ? `:${state.messages}` : ''}`
      const origin = user.text.trimStart().startsWith(MENKAR_POST) ? 'peer' : 'human'
      this.db.raw
        .prepare('INSERT OR IGNORE INTO turns VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuid, session, file, origin, at, start)
      touched.turns.add(uuid)
      state.uuid = uuid
      state.last = at
      return
    }
    if (line.type === 'token_usage_record') {
      state.records = true
      const usage = usageOf(field(payload, 'usage'))
      const response = text(field(payload, 'response_id'))
      const task = text(field(payload, 'turn_id')) ?? state.task ?? ''
      if (usage !== null)
        this.keep(`record:${response ?? `${thread}:${start}`}`, session, task, at, usage, touched)
    } else if (line.type === 'event_msg' && type === 'token_count') {
      this.counted(field(payload, 'info'), session, thread, state, at, touched)
    }
    this.activity(state, at)
    if (line.type === 'event_msg' && (type === 'task_complete' || type === 'turn_aborted')) {
      state.uuid = null
      state.last = null
    }
  }

  // A token_count is read only in a rollout with no records (an older Codex). Codex writes one
  // after each request and repeats it with no new request (a rate-limits update, a task's start,
  // a compaction's re-estimate) with the thread's total unmoved: keyed by that total, a repeat is
  // the entry already kept. The fill Codex writes when the window overflowed is no request.
  private counted(
    info: unknown,
    session: string,
    thread: string,
    state: FileState,
    at: number,
    touched: Touched,
  ): void {
    if (state.records || typeof info !== 'object' || info === null) return
    const last = usageOf(field(info, 'last_token_usage'))
    if (last === null || (last.prompt === 0 && last.output === 0)) return
    const total = JSON.stringify(field(info, 'total_token_usage') ?? null)
    this.keep(`count:${thread}:${total}`, session, state.task ?? '', at, last, touched)
  }

  private keep(
    key: string,
    session: string,
    task: string,
    at: number,
    usage: Usage,
    touched: Touched,
  ): void {
    const kind = key.startsWith('record:') ? 'record' : 'count'
    const inserted = this.db.raw
      .prepare('INSERT OR IGNORE INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        key,
        kind,
        session,
        task,
        at,
        usage.input,
        usage.output,
        usage.cacheWrite,
        usage.cacheRead,
      )
    if (Number(inserted.changes) === 0) return
    touched.entries.set(`${session}\u0000${at}`, { session, at })
  }

  // Working time: the gaps between a turn's lines, a gap over two hours being idle.
  private activity(state: FileState, at: number): void {
    if (state.uuid === null || state.last === null) return
    if (at > state.last && at - state.last <= IDLE_AFTER_SECONDS) {
      this.db.raw
        .prepare('INSERT OR IGNORE INTO spans VALUES (?, ?, ?, ?)')
        .run(state.uuid, 'execution', state.last, at)
    }
    if (at > state.last) state.last = at
  }

  // `session_index.jsonl` beside the sessions: appended, the last line for a thread winning, an
  // empty name clearing it. Read from where the last pass stopped.
  private ingestNames(touched: Touched): void {
    const path = join(dirname(this.root), 'session_index.jsonl')
    let size: number
    let inode: number
    try {
      const stat = statSync(path)
      size = stat.size
      inode = stat.ino
    } catch {
      return // no names yet
    }
    const known = this.db.raw.prepare("SELECT value FROM meta WHERE key = 'index'").get()
    let offset = 0
    if (known) {
      const [knownInode, knownOffset] = JSON.parse(str(known, 'value')) as [number, number]
      if (knownInode === inode && knownOffset <= size) offset = knownOffset
    }
    if (offset === size) return
    const data = readBytes(path, offset, size - offset)
    const end = data.lastIndexOf(0x0a) + 1
    for (const raw of data.toString('utf8', 0, end).split('\n')) {
      const line = parseLine(raw)
      const id = line ? text(line.id) : null
      const name = line ? text(line.thread_name) : null
      if (id === null || name === null) continue
      if (name === '') this.db.raw.prepare('DELETE FROM names WHERE session_id = ?').run(id)
      else this.db.raw.prepare('INSERT OR REPLACE INTO names VALUES (?, ?)').run(id, name)
      touched.sessions.add(id)
    }
    this.db.raw
      .prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)')
      .run('index', JSON.stringify([inode, offset + end]))
  }

  // A turn that opens takes tokens from the one before it, so that one is written again too.
  private markPending(touched: Touched): void {
    const insert = this.db.raw.prepare('INSERT OR IGNORE INTO pending VALUES (?, ?)')
    for (const uuid of touched.turns) {
      const row = this.db.raw
        .prepare('SELECT session_id, opened FROM turns WHERE uuid = ?')
        .get(uuid)
      if (!row) continue
      const session = str(row, 'session_id')
      insert.run(session, uuid)
      const before = this.inEffect(session, num(row, 'opened'), uuid)
      if (before !== null) insert.run(session, before)
    }
    for (const { session, at } of touched.entries.values()) {
      const uuid = this.inEffect(session, at, null)
      if (uuid !== null) insert.run(session, uuid)
    }
    for (const session of touched.sessions) insert.run(session, '')
  }

  // The latest turn of the session opened at or before `at` (before `except`, when given).
  private inEffect(session: string, at: number, except: string | null): string | null {
    const row = this.db.raw
      .prepare(
        'SELECT uuid FROM turns WHERE session_id = ? AND (opened < ? OR (opened = ? AND uuid < ?))' +
          ' ORDER BY opened DESC, uuid DESC',
      )
      .get(session, at, at, except ?? '￿')
    return row ? str(row, 'uuid') : null
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

  // A turn's spans, and every request of its session from its opening to the next turn's, summed
  // per (model, UTC hour), each request under the key its own size prices it at.
  turnUsage(sessionId: string, uuid: string): TurnUsage | null {
    if (!uuid.startsWith(PREFIX)) return null
    const raw = this.db.raw
    const row = raw.prepare('SELECT origin, opened FROM turns WHERE uuid = ?').get(uuid)
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
        "SELECT COALESCE(m.model, 'unknown') AS model, e.at AS at," +
          ' e.input AS input, e.output AS output, e.cache_write AS cw, e.cache_read AS cr' +
          ' FROM entries e LEFT JOIN models m ON m.turn_id = e.turn_id' +
          ' WHERE e.session_id = ? AND e.at >= ? AND e.at < ?',
      )
      .all(sessionId, opened, high)) {
      const input = num(e, 'input')
      const cacheWrite = num(e, 'cw')
      const cacheRead = num(e, 'cr')
      const model = requestModel(str(e, 'model'), {
        input,
        output: num(e, 'output'),
        cacheWrite,
        cacheWrite1h: 0,
        cacheRead,
      })
      const hour = Math.floor(num(e, 'at') / 3600) * 3600
      const sumKey = JSON.stringify([model, hour])
      const had = sums.get(sumKey)
      sums.set(sumKey, {
        model,
        hour,
        input: (had?.input ?? 0) + input,
        output: (had?.output ?? 0) + num(e, 'output'),
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

  names(sessions: Iterable<string>): Map<string, { name: string; given: number }> {
    const found = new Map<string, { name: string; given: number }>()
    const select = this.db.raw.prepare('SELECT name FROM names WHERE session_id = ?')
    for (const sessionId of sessions) {
      const row = select.get(sessionId)
      // Codex's own titles and the user's renames are the same in its index: a name it keeps.
      if (row) found.set(sessionId, { name: str(row, 'name'), given: 1 })
    }
    return found
  }

  textAt(uuid: string): { file: string; start: number } | null {
    if (!uuid.startsWith(PREFIX)) return null
    const row = this.db.raw.prepare('SELECT file, offset FROM turns WHERE uuid = ?').get(uuid)
    return row ? { file: str(row, 'file'), start: num(row, 'offset') } : null
  }

  // The turn's lines, from its user message to the next turn of that rollout; empty when the
  // rollout no longer holds them as a plain file.
  private linesOf(uuid: string): Line[] {
    const at = this.textAt(uuid)
    if (at === null || at.file.endsWith('.zst') || !existsSync(at.file)) return []
    const next = this.db.raw
      .prepare('SELECT MIN(offset) AS next FROM turns WHERE file = ? AND offset > ?')
      .get(at.file, at.start)
    let data: Buffer
    try {
      const size = statSync(at.file).size
      const end = next?.next === null || next?.next === undefined ? size : Number(next.next)
      data = readBytes(at.file, at.start, Math.max(0, Math.min(end, size) - at.start))
    } catch {
      return [] // the rollout is gone
    }
    return data
      .toString('utf8')
      .split('\n')
      .map(parseLine)
      .filter((line): line is Line => line !== null)
  }

  turnText(uuid: string): TurnText | null {
    const lines = this.linesOf(uuid)
    const first = lines[0] ? userText(lines[0]) : null
    if (first === null) return null
    const tools = lines
      .slice(1)
      .map(toolOf)
      .filter((tool): tool is Record<string, unknown> => tool !== null)
    const previous = this.db.raw
      .prepare(
        'SELECT p.uuid AS uuid FROM turns t JOIN turns p ON p.session_id = t.session_id' +
          " WHERE t.uuid = ? AND p.origin = 'human'" +
          ' AND (p.opened < t.opened OR (p.opened = t.opened AND p.uuid < t.uuid))' +
          ' ORDER BY p.opened DESC, p.uuid DESC',
      )
      .get(uuid)
    const before = previous ? this.linesOf(str(previous, 'uuid'))[0] : undefined
    return {
      prompt: first.text,
      previous: before ? (userText(before)?.text ?? '') : '',
      tools,
    }
  }
}

export const usage: UsageSource = {
  open(root: string, cache: string): TurnSource | null {
    if (!existsSync(root)) return null
    return new CodexUsage(root, join(dirname(cache), CACHE_FILE))
  },
}
