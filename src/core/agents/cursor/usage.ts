import { closeSync, existsSync, openSync, readFileSync, readSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { TurnText } from '../../classifier/input'
import { type Db, openDb } from '../../db'
import { statePath } from '../../state'
import type { PendingRow } from '../../usage/cache'
import { requestModel } from '../../usage/prices'
import type { TurnSource, TurnUsage, UsageSource } from '../types'
import { classifierOn, HOOK_LOG, PROMPTS_DIR } from './hooks'

// Derived from the hook log and rebuilt whenever its layout changes: the log is read again whole.
const SCHEMA_VERSION = 1
export const CACHE_FILE = 'usage-cache-cursor.sqlite'

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE turns (
  uuid TEXT PRIMARY KEY, session_id TEXT NOT NULL, generation TEXT NOT NULL, origin TEXT NOT NULL,
  opened REAL NOT NULL, ended REAL, model TEXT, input INTEGER NOT NULL DEFAULT 0,
  output INTEGER NOT NULL DEFAULT 0, cache_write INTEGER NOT NULL DEFAULT 0,
  cache_read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX turns_session ON turns (session_id, opened);
CREATE TABLE pending (session_id TEXT NOT NULL, turn TEXT NOT NULL, PRIMARY KEY (session_id, turn));
`

const PREFIX = 'cursor:'
const SLICE_BYTES = 4 * 1024 * 1024

type Row = Record<string, unknown>
const num = (row: Row | undefined, key: string): number => Number(row?.[key])
const str = (row: Row | undefined, key: string): string => String(row?.[key])
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
const plainId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value)

function parsed(raw: string): Row | null {
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Row)
      : null
  } catch (error) {
    if (error instanceof SyntaxError) return null // a line cut by a full disk: skipped
    throw error
  }
}

// Cursor's turns, from the log its hooks append in Menkar's cache: a turn per prompt, its time from
// the prompt to the turn's end, its tokens the turn's totals as its end gives them. A turn that ends
// with no prompt before it was opened by a stop hook's answer, which fires no prompt hook: it is
// Menkar's, and starts where the session's last turn ended.
export class CursorUsage implements TurnSource {
  readonly db: Db
  readonly catchUp = null

  constructor(
    private readonly log: string,
    private readonly prompts: string,
    path: string,
    private readonly state: string,
  ) {
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

  private meta(key: string): string | null {
    const row = this.db.raw.prepare('SELECT value FROM meta WHERE key = ?').get(key)
    return row ? str(row, 'value') : null
  }

  ingest(): void {
    // The text was kept for the classifier alone: with it off, what was kept goes.
    if (!classifierOn(this.state)) rmSync(this.prompts, { recursive: true, force: true })
    let info: ReturnType<typeof statSync>
    try {
      info = statSync(this.log)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    // A log replaced or cut is read again from its start; the turns it repeats keep their rows.
    const sameFile = this.meta('inode') === String(info.ino)
    let offset = sameFile ? Number(this.meta('offset') ?? 0) : 0
    if (offset > info.size) offset = 0
    const fd = openSync(this.log, 'r')
    try {
      while (offset < info.size) {
        const length = Math.min(SLICE_BYTES, info.size - offset)
        const buffer = Buffer.alloc(length)
        const read = readSync(fd, buffer, 0, length, offset)
        const end = buffer.subarray(0, read).lastIndexOf(0x0a)
        // A line still being appended waits for the next pass.
        if (end < 0) break
        const lines = buffer.subarray(0, end).toString('utf8').split('\n')
        const next = offset + end + 1
        this.db.transaction(() => {
          for (const raw of lines) {
            const line = parsed(raw)
            if (line?.event === 'prompt') this.prompt(line)
            else if (line?.event === 'stop') this.stop(line)
          }
          this.db.raw.prepare("INSERT OR REPLACE INTO meta VALUES ('offset', ?)").run(String(next))
          this.db.raw
            .prepare("INSERT OR REPLACE INTO meta VALUES ('inode', ?)")
            .run(String(info.ino))
        })
        offset = next
      }
    } finally {
      closeSync(fd)
    }
  }

  private prompt(line: Row): void {
    const { session_id: session, generation_id: generation, at } = line
    if (!plainId(session) || !plainId(generation) || typeof at !== 'number') return
    const origin = line.origin === 'peer' ? 'peer' : 'human'
    const uuid = `${PREFIX}${generation}`
    this.db.raw
      .prepare(
        'INSERT INTO turns (uuid, session_id, generation, origin, opened) VALUES (?, ?, ?, ?, ?)' +
          ' ON CONFLICT (uuid) DO UPDATE SET origin = excluded.origin, opened = excluded.opened',
      )
      .run(uuid, session, generation, origin, at)
    this.db.raw.prepare('INSERT OR IGNORE INTO pending VALUES (?, ?)').run(session, uuid)
  }

  private stop(line: Row): void {
    const { session_id: session, at } = line
    if (!plainId(session) || typeof at !== 'number') return
    const raw = this.db.raw
    const generation = plainId(line.generation_id) ? line.generation_id : `stop-${at}`
    const uuid = `${PREFIX}${generation}`
    const known = raw.prepare('SELECT ended FROM turns WHERE uuid = ?').get(uuid)
    // An interrupted turn ends twice, aborted then failed: its first end is the one.
    if (known && known.ended !== null) return
    if (!known) {
      const last = raw
        .prepare(
          'SELECT ended FROM turns WHERE session_id = ? AND ended IS NOT NULL AND ended <= ?' +
            ' ORDER BY ended DESC',
        )
        .get(session, at)
      raw
        .prepare(
          'INSERT INTO turns (uuid, session_id, generation, origin, opened) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuid, session, generation, 'peer', last ? num(last, 'ended') : at)
    }
    // Cursor's input counts the part read from the cache too; Menkar's is the part read afresh.
    const cacheRead = count(line.cache_read_tokens)
    const cacheWrite = count(line.cache_write_tokens)
    raw
      .prepare(
        'UPDATE turns SET ended = ?, model = ?, input = ?, output = ?, cache_write = ?,' +
          ' cache_read = ? WHERE uuid = ?',
      )
      .run(
        at,
        typeof line.model === 'string' && line.model !== '' ? line.model : null,
        Math.max(0, count(line.input_tokens) - cacheRead),
        count(line.output_tokens),
        cacheWrite,
        cacheRead,
        uuid,
      )
    raw.prepare('INSERT OR IGNORE INTO pending VALUES (?, ?)').run(session, uuid)
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

  // A turn's one stretch, from its prompt to its end, and its tokens under the hour it ended in.
  turnUsage(sessionId: string, uuid: string): TurnUsage | null {
    if (!uuid.startsWith(PREFIX)) return null
    const row = this.db.raw
      .prepare('SELECT * FROM turns WHERE uuid = ? AND session_id = ?')
      .get(uuid, sessionId)
    if (!row) return null
    const opened = num(row, 'opened')
    const ended = row.ended === null ? null : num(row, 'ended')
    const tokens = {
      input: num(row, 'input'),
      output: num(row, 'output'),
      cacheWrite: num(row, 'cache_write'),
      cacheWrite1h: 0,
      cacheRead: num(row, 'cache_read'),
    }
    const any = tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead > 0
    return {
      turn: { uuid, sessionId, origin: str(row, 'origin'), opened },
      spans:
        ended !== null && ended > opened ? [{ kind: 'execution', start: opened, end: ended }] : [],
      tokens:
        ended !== null && any
          ? [
              {
                model: requestModel(row.model === null ? 'unknown' : str(row, 'model'), tokens),
                hour: Math.floor(ended / 3600) * 3600,
                ...tokens,
              },
            ]
          : [],
    }
  }

  // Cursor keeps no name for a chat in what Menkar reads.
  names(): Map<string, { name: string; given: number }> {
    return new Map()
  }

  private promptFile(uuid: string): string | null {
    if (!uuid.startsWith(PREFIX)) return null
    const file = join(this.prompts, `${uuid.slice(PREFIX.length)}.txt`)
    return existsSync(file) ? file : null
  }

  textAt(uuid: string): { file: string; start: number } | null {
    const file = this.promptFile(uuid)
    return file === null ? null : { file, start: 0 }
  }

  // The prompt as the hook kept it, and the human's previous one in the session; the tools it called
  // are not known.
  turnText(uuid: string): TurnText | null {
    const file = this.promptFile(uuid)
    if (file === null) return null
    const turn = this.db.raw
      .prepare('SELECT session_id, opened FROM turns WHERE uuid = ?')
      .get(uuid)
    let previous = ''
    if (turn) {
      const before = this.db.raw
        .prepare(
          "SELECT uuid FROM turns WHERE session_id = ? AND origin = 'human' AND opened < ?" +
            ' ORDER BY opened DESC',
        )
        .get(str(turn, 'session_id'), num(turn, 'opened'))
      const earlier = before ? this.promptFile(str(before, 'uuid')) : null
      if (earlier !== null) previous = readText(earlier) ?? ''
    }
    const prompt = readText(file)
    return prompt === null ? null : { prompt, previous, tools: [] }
  }
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null // removed meanwhile
    throw error
  }
}

export const usage: UsageSource = {
  // The log is Menkar's own, beside the pass's cache; nothing is opened while Cursor is not there
  // or its hooks have written nothing.
  open(root: string, cache: string): TurnSource | null {
    const folder = dirname(cache)
    const log = join(folder, HOOK_LOG)
    if (!existsSync(root) || !existsSync(log)) return null
    return new CursorUsage(log, join(folder, PROMPTS_DIR), join(folder, CACHE_FILE), statePath())
  },
}
