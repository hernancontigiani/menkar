import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import type { StatementSync } from 'node:sqlite'
import type { TurnSource } from '../agents/types'
import { fileStamp, now } from '../clock'
import { type Db, openDb } from '../db'
import { log } from '../log'
import { appDirs } from '../paths'
import { type ActivityImport, activityDir, batchFiles, importBatch } from './activity'
import type { ActivityRows, PresenceKind } from './bursts'
import type { HourTokens } from './cache'
import type { TaskStateRow } from './flow'
import { addModels, addTokens, type ModelUsage, type Tokens, ZERO_TOKENS } from './nodes'
import { cost, shownModel } from './prices'

export { addTokens, type Tokens, totalTokens, ZERO_TOKENS } from './nodes'

// The one file whose loss loses what no transcript can rebuild: one row per turn, never pruned. A
// file from a newer Menkar is left untouched; an unreadable one is moved aside, never deleted.
export const HISTORY_VERSION = 4
export const BUSY_TIMEOUT_MS = 30_000

const ACTIVITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, at REAL NOT NULL, kind TEXT NOT NULL, project_id TEXT,
  session_id TEXT, topic INTEGER, task INTEGER, next TEXT, blocked_seconds REAL
);
CREATE INDEX IF NOT EXISTS activity_time ON activity (at);
CREATE TABLE IF NOT EXISTS task_states (
  id TEXT PRIMARY KEY, at REAL NOT NULL, project_id TEXT NOT NULL, task INTEGER NOT NULL,
  state TEXT NOT NULL, wait_kind TEXT, wait_ref TEXT, assignee TEXT,
  baseline INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS task_states_task ON task_states (project_id, task, at);
CREATE INDEX IF NOT EXISTS task_states_time ON task_states (at);
`

export const HISTORY_SCHEMA = `
CREATE TABLE turns (
  uuid TEXT PRIMARY KEY, session_id TEXT NOT NULL, origin TEXT NOT NULL, opened REAL NOT NULL,
  project_id TEXT, project_name TEXT, category TEXT, category_tries INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX turns_session ON turns (session_id, opened);
CREATE INDEX turns_project ON turns (project_id);
CREATE TABLE spans (uuid TEXT NOT NULL, kind TEXT NOT NULL, start REAL NOT NULL, end REAL NOT NULL);
CREATE INDEX spans_uuid ON spans (uuid);
CREATE INDEX spans_time ON spans (start, end);
CREATE TABLE tokens (
  uuid TEXT NOT NULL, model TEXT NOT NULL, hour REAL NOT NULL,
  input INTEGER NOT NULL, output INTEGER NOT NULL, cache_write INTEGER NOT NULL,
  cache_write_1h INTEGER NOT NULL, cache_read INTEGER NOT NULL,
  PRIMARY KEY (uuid, model, hour)
);
CREATE INDEX tokens_hour ON tokens (hour);
CREATE TABLE names (session_id TEXT PRIMARY KEY, name TEXT NOT NULL, claude INTEGER NOT NULL);
CREATE TABLE rederive (uuid TEXT PRIMARY KEY);
${ACTIVITY_SCHEMA}`

// Each step takes a file from the version it is keyed by to the next.
const MIGRATIONS: Readonly<Record<number, string>> = {
  1: `ALTER TABLE turns ADD COLUMN category TEXT;
ALTER TABLE turns ADD COLUMN category_tries INTEGER NOT NULL DEFAULT 0;`,
  // Tokens written before Haiku 5.5 was priced per request: every turn is queued for `rederive`,
  // which needs the cache and so runs in the pass, not here.
  2: `CREATE TABLE rederive (uuid TEXT PRIMARY KEY);
INSERT INTO rederive SELECT uuid FROM turns;`,
  // Two workers open the history at start-up and may both read version 3.
  3: ACTIVITY_SCHEMA,
}

export function historyPath(): string {
  return join(appDirs().data, 'history.sqlite')
}

// A turn neither the human nor an unknown author started takes the category of its session's
// latest human turn before it. Resolved when reported, never written, so a late classification
// reaches the turns after it.
const CATEGORY = `CASE WHEN t.origin IN ('human', 'unknown') THEN t.category ELSE (
  SELECT h.category FROM turns h WHERE h.session_id = t.session_id AND h.origin = 'human'
  AND (h.opened < t.opened OR (h.opened = t.opened AND h.uuid < t.uuid))
  ORDER BY h.opened DESC, h.uuid DESC LIMIT 1) END`

// Each session's current project, and each project's current name.
export interface Memberships {
  readonly sessions: ReadonlyMap<string, { readonly id: string; readonly name: string }>
  readonly projectNames: ReadonlyMap<string, string>
}

export const NO_MEMBERSHIPS: Memberships = { sessions: new Map(), projectNames: new Map() }

export interface Usage {
  execution: Record<string, number>
  blocked: number
  tokens: Tokens
  models: Record<string, ModelUsage>
  cost: number
  allPriced: boolean
}

// One turn as the export reads it, whole.
export interface ExportedTurn {
  readonly uuid: string
  readonly sessionId: string
  readonly origin: string
  readonly opened: number
  readonly projectId: string | null
  readonly category: string | null
  // its spans: working and blocked, in seconds
  seconds: number
  blocked: number
  readonly tokens: { readonly model: string; readonly hour: number; readonly tokens: Tokens }[]
}

// (project id, session, category) → its usage; category is null without categories.
export interface UsageKey {
  readonly projectId: string | null
  readonly sessionId: string
  readonly category: string | null
}

type Row = Record<string, unknown>
const num = (row: Row | undefined, key: string): number => Number(row?.[key])
const nullableStr = (row: Row | undefined, key: string): string | null => {
  const value = row?.[key]
  return value === null || value === undefined ? null : String(value)
}

function quickCheckOk(db: Db): boolean {
  const row = db.raw.prepare('PRAGMA quick_check').get()
  return row !== undefined && Object.values(row)[0] === 'ok'
}

// Whether two sets of a turn's token rows hold the same tokens per (model, hour), the long-prompt
// mark aside.
function sameTotals(a: readonly HourTokens[], b: readonly HourTokens[]): boolean {
  const sums = (rows: readonly HourTokens[]) => {
    const out = new Map<string, number[]>()
    for (const t of rows) {
      const key = JSON.stringify([shownModel(t.model), t.hour])
      const had = out.get(key) ?? [0, 0, 0, 0, 0]
      const add = [t.input, t.output, t.cacheWrite, t.cacheWrite1h, t.cacheRead]
      out.set(
        key,
        had.map((v, i) => v + (add[i] ?? 0)),
      )
    }
    return out
  }
  const x = sums(a)
  const y = sums(b)
  if (x.size !== y.size) return false
  for (const [key, values] of x) {
    const other = y.get(key)
    if (!other || values.some((v, i) => v !== other[i])) return false
  }
  return true
}

export function keyOf(
  projectId: string | null,
  sessionId: string,
  category: string | null,
): string {
  return JSON.stringify([projectId, sessionId, category])
}

// Brings a file read at `version` to the current one. Another opener may have moved it between
// that read and the lock, so each step re-reads the version inside its transaction.
export function migrateHistory(db: Db, version: number): void {
  if (version === 0) {
    db.transaction(() => {
      if (db.userVersion() !== 0) return
      db.raw.exec(HISTORY_SCHEMA)
      db.setUserVersion(HISTORY_VERSION)
    })
  }
  for (let v = version; v > 0 && v < HISTORY_VERSION; v += 1) {
    const step = MIGRATIONS[v]
    if (step === undefined) throw new Error(`no migration from usage history version ${v}`)
    db.transaction(() => {
      if (db.userVersion() !== v) return
      db.raw.exec(step)
      db.setUserVersion(v + 1)
    })
  }
}

export class UsageHistory {
  readonly path: string
  readonly tooNew: boolean
  private readonly db: Db | null
  private readonly statements = new Map<string, StatementSync>()

  // Opens the history, creating, migrating or moving it aside by the rules above.
  constructor(path: string = historyPath(), busyTimeoutMs = BUSY_TIMEOUT_MS) {
    this.path = path
    let db: Db
    let version: number
    try {
      db = openDb(path, busyTimeoutMs)
    } catch (error) {
      if (!existsSync(path)) throw error // not a damaged file: the directory or the disk failed
      this.moveAside(error)
      db = openDb(path, busyTimeoutMs)
    }
    try {
      if (!quickCheckOk(db)) throw new Error('quick_check did not return ok')
      version = db.userVersion()
    } catch (error) {
      db.close()
      this.moveAside(error)
      db = openDb(path, busyTimeoutMs)
      version = 0
    }
    if (version > HISTORY_VERSION) {
      db.close()
      log.warn('usage history is from a newer version, left untouched', { path, version })
      this.tooNew = true
      this.db = null
      return
    }
    migrateHistory(db, version)
    this.tooNew = false
    this.db = db
  }

  close(): void {
    this.db?.close()
  }

  // A report asks the same few queries once per statusline line: each is prepared once.
  private prepared(db: Db, sql: string): StatementSync {
    let statement = this.statements.get(sql)
    if (statement === undefined) {
      statement = db.raw.prepare(sql)
      this.statements.set(sql, statement)
    }
    return statement
  }

  private moveAside(error: unknown): void {
    const base = `${this.path}.broken-${fileStamp(now())}`
    let target = base
    for (let n = 2; existsSync(target); n += 1) target = `${base}-${n}`
    renameSync(this.path, target)
    log.warn('usage history unreadable, moved aside', { path: target, error })
  }

  // Copies each turn an agent's cache holds as pending, whole, then tells the cache they are
  // written. A turn the cache no longer has (its transcript is gone) is left as it is. A turn
  // keeps the project it was written with; one written with none takes its session's project once
  // it has one.
  write(
    cache: Pick<TurnSource, 'pending' | 'turnUsage' | 'names' | 'written'>,
    memberships: Memberships,
  ): void {
    const db = this.db
    if (db === null) return // too new: the cache keeps them pending
    const pending = cache.pending()
    const raw = db.raw
    db.transaction(() => {
      const kept = raw.prepare(
        'SELECT project_id, project_name, category, category_tries FROM turns WHERE uuid = ?',
      )
      const removes = ['turns', 'spans', 'tokens', 'rederive'].map((table) =>
        raw.prepare(`DELETE FROM ${table} WHERE uuid = ?`),
      )
      const insertTurn = raw.prepare('INSERT INTO turns VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      const insertSpan = raw.prepare('INSERT INTO spans VALUES (?, ?, ?, ?)')
      const insertTokens = raw.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      for (const { sessionId, turn: uuid } of pending) {
        if (uuid === '') continue
        const found = cache.turnUsage(sessionId, uuid)
        if (found === null) continue
        const old = kept.get(uuid)
        const member = memberships.sessions.get(sessionId)
        const project =
          old && old.project_id !== null
            ? [nullableStr(old, 'project_id'), nullableStr(old, 'project_name')]
            : [member?.id ?? null, member?.name ?? null]
        const category = old
          ? [nullableStr(old, 'category'), num(old, 'category_tries')]
          : [null, 0]
        for (const remove of removes) remove.run(uuid)
        insertTurn.run(
          uuid,
          sessionId,
          found.turn.origin,
          found.turn.opened,
          ...project,
          ...category,
        )
        for (const span of mergedSpans(found.spans))
          insertSpan.run(uuid, span.kind, span.start, span.end)
        for (const t of found.tokens) {
          insertTokens.run(
            uuid,
            t.model,
            t.hour,
            t.input,
            t.output,
            t.cacheWrite,
            t.cacheWrite1h,
            t.cacheRead,
          )
        }
      }
      const adopt = raw.prepare(
        'UPDATE turns SET project_id = ?, project_name = ? WHERE session_id = ? AND project_id IS NULL',
      )
      for (const [sessionId, project] of memberships.sessions)
        adopt.run(project.id, project.name, sessionId)
      const rename = raw.prepare(
        'UPDATE turns SET project_name = ? WHERE project_id = ? AND project_name IS NOT ?',
      )
      for (const [projectId, name] of memberships.projectNames) rename.run(name, projectId, name)
      const currentName = raw.prepare('SELECT claude FROM names WHERE session_id = ?')
      const setName = raw.prepare('INSERT OR REPLACE INTO names VALUES (?, ?, ?)')
      const sessions = new Set(pending.map((row) => row.sessionId))
      for (const [sessionId, { name, given }] of cache.names(sessions)) {
        const current = currentName.get(sessionId)
        if (current === undefined || given >= num(current, 'claude'))
          setName.run(sessionId, name, given)
      }
    })
    cache.written(pending) // only after the commit: writing a turn twice is the same as once
  }

  // Rewrites the tokens of each turn queued by the version-3 migration from the cache's requests,
  // so Haiku 5.5's long-prompt tier is decided per request. A turn is replaced only when what the
  // cache has adds up to what the history holds; one with no transcript left, or whose files
  // changed since, keeps its rows as they were. One short transaction per turn, touching only its
  // tokens, so a classifier writing categories meanwhile waits at most one turn.
  rederive(cache: Pick<TurnSource, 'turnUsage'>): void {
    const db = this.db
    if (db === null) return
    const raw = db.raw
    const queued = raw
      .prepare(
        'SELECT r.uuid AS uuid, t.session_id AS s FROM rederive r LEFT JOIN turns t ON t.uuid = r.uuid',
      )
      .all()
    if (queued.length === 0) return
    const stored = raw.prepare(
      'SELECT model, hour, input, output, cache_write AS cw, cache_write_1h AS cw1h,' +
        ' cache_read AS cr FROM tokens WHERE uuid = ?',
    )
    const removeTokens = raw.prepare('DELETE FROM tokens WHERE uuid = ?')
    const insertTokens = raw.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const done = raw.prepare('DELETE FROM rederive WHERE uuid = ?')
    let rederived = 0
    let groupPriced = 0
    for (const q of queued) {
      const uuid = String(q.uuid)
      const found = q.s === null || q.s === undefined ? null : cache.turnUsage(String(q.s), uuid)
      const replaced = db.transaction(() => {
        const same =
          found !== null &&
          sameTotals(
            stored.all(uuid).map((t) => ({
              model: String(t.model),
              hour: num(t, 'hour'),
              input: num(t, 'input'),
              output: num(t, 'output'),
              cacheWrite: num(t, 'cw'),
              cacheWrite1h: num(t, 'cw1h'),
              cacheRead: num(t, 'cr'),
            })),
            found.tokens,
          )
        if (same) {
          removeTokens.run(uuid)
          for (const t of found.tokens) {
            insertTokens.run(
              uuid,
              t.model,
              t.hour,
              t.input,
              t.output,
              t.cacheWrite,
              t.cacheWrite1h,
              t.cacheRead,
            )
          }
        }
        done.run(uuid)
        return same
      })
      if (replaced) rederived += 1
      else groupPriced += 1
    }
    log.info('usage history re-derived per request', { rederived, groupPriced })
  }

  // Time, tokens and estimated cost per (project, session, category) in [low, high): spans
  // clipped to it, tokens by the UTC hour they fell in, each group priced at its hour's date.
  usage(
    low: number,
    high: number,
    categories: boolean,
  ): Map<string, { key: UsageKey; usage: Usage }> {
    const found = new Map<string, { key: UsageKey; usage: Usage }>()
    if (this.db === null) return found
    const raw = this.db.raw
    const category = categories ? CATEGORY : 'NULL'
    const row = (projectId: string | null, sessionId: string, cat: string | null) => {
      const id = keyOf(projectId, sessionId, cat)
      let entry = found.get(id)
      if (!entry) {
        entry = {
          key: { projectId, sessionId, category: cat },
          usage: {
            execution: {},
            blocked: 0,
            tokens: ZERO_TOKENS,
            models: {},
            cost: 0,
            allPriced: true,
          },
        }
        found.set(id, entry)
      }
      return entry.usage
    }
    for (const r of raw
      .prepare(
        `SELECT t.project_id AS p, t.session_id AS s, ${category} AS c, t.origin AS o, s.kind AS k,` +
          ' SUM(MIN(s.end, ?) - MAX(s.start, ?)) AS seconds' +
          ' FROM spans s JOIN turns t ON t.uuid = s.uuid WHERE s.end > ? AND s.start < ?' +
          ' GROUP BY t.project_id, t.session_id, c, t.origin, s.kind',
      )
      .all(high, low, low, high)) {
      const u = row(nullableStr(r, 'p'), String(r.s), nullableStr(r, 'c'))
      const seconds = num(r, 'seconds')
      if (r.k === 'blocked') u.blocked += seconds
      else u.execution[String(r.o)] = (u.execution[String(r.o)] ?? 0) + seconds
    }
    for (const r of raw
      .prepare(
        `SELECT t.project_id AS p, t.session_id AS s, ${category} AS c, k.model AS m, k.hour AS h,` +
          ' SUM(k.input) AS i, SUM(k.output) AS o, SUM(k.cache_write) AS cw,' +
          ' SUM(k.cache_write_1h) AS cw1h, SUM(k.cache_read) AS cr' +
          ' FROM tokens k JOIN turns t ON t.uuid = k.uuid WHERE k.hour >= ? AND k.hour < ?' +
          ' GROUP BY t.project_id, t.session_id, c, k.model, k.hour',
      )
      .all(low, high)) {
      const u = row(nullableStr(r, 'p'), String(r.s), nullableStr(r, 'c'))
      const tokens: Tokens = {
        input: num(r, 'i'),
        output: num(r, 'o'),
        cacheWrite: num(r, 'cw'),
        cacheWrite1h: num(r, 'cw1h'),
        cacheRead: num(r, 'cr'),
      }
      u.tokens = addTokens(u.tokens, tokens)
      const priced = cost(String(r.m), num(r, 'h'), tokens)
      if (priced === null) u.allPriced = false
      else u.cost += priced
      u.models = addModels(u.models, {
        [shownModel(String(r.m))]: { tokens, cost: priced ?? 0, priced: priced !== null },
      })
    }
    return found
  }

  // Turns of these origins opened at or after `since` with no category and fewer than `tries`
  // failed tries, oldest first, with whether a later turn of their session exists.
  unclassified(
    since: number,
    tries: number,
    origins: readonly string[],
  ): { uuid: string; opened: number; later: boolean }[] {
    if (this.db === null) return []
    const marks = origins.map(() => '?').join(', ')
    return this.db.raw
      .prepare(
        'SELECT t.uuid AS uuid, t.opened AS opened, EXISTS (SELECT 1 FROM turns n' +
          ' WHERE n.session_id = t.session_id AND (n.opened > t.opened OR' +
          ' (n.opened = t.opened AND n.uuid > t.uuid))) AS later' +
          ` FROM turns t WHERE t.origin IN (${marks}) AND t.category IS NULL` +
          ' AND t.category_tries < ? AND t.opened >= ? ORDER BY t.opened, t.uuid',
      )
      .all(...origins, tries, since)
      .map((r) => ({
        uuid: String(r.uuid),
        opened: num(r, 'opened'),
        later: num(r, 'later') === 1,
      }))
  }

  // Only a turn's category is written: its time, tokens and cost stay as they are.
  setCategories(categories: ReadonlyMap<string, string>): void {
    const db = this.db
    if (db === null || categories.size === 0) return
    const update = db.raw.prepare('UPDATE turns SET category = ? WHERE uuid = ?')
    db.transaction(() => {
      for (const [uuid, category] of categories) update.run(category, uuid)
    })
  }

  // A classification that came back with no valid answer for these turns.
  countTry(uuids: readonly string[]): void {
    const db = this.db
    if (db === null || uuids.length === 0) return
    const update = db.raw.prepare(
      'UPDATE turns SET category_tries = category_tries + 1 WHERE uuid = ?',
    )
    db.transaction(() => {
      for (const uuid of uuids) update.run(uuid)
    })
  }

  // The project of the session's turn in effect at `at` (its first turn, before any).
  projectAt(sessionId: string, at: number): string | null {
    const db = this.db
    if (db === null) return null
    const row =
      this.prepared(
        db,
        'SELECT project_id FROM turns WHERE session_id = ? AND opened <= ? ORDER BY opened DESC, uuid DESC',
      ).get(sessionId, at) ??
      this.prepared(
        db,
        'SELECT project_id FROM turns WHERE session_id = ? ORDER BY opened, uuid',
      ).get(sessionId)
    return nullableStr(row, 'project_id')
  }

  // The category of the session's turn in effect at `at`, resolved as in a report.
  categoryAt(sessionId: string, at: number): string | null {
    const db = this.db
    if (db === null) return null
    const row = this.prepared(
      db,
      `SELECT ${CATEGORY} AS c FROM turns t WHERE t.session_id = ? AND t.opened <= ?` +
        ' ORDER BY t.opened DESC, t.uuid DESC',
    ).get(sessionId, at)
    return nullableStr(row, 'c')
  }

  // The turn a moment belongs to in a session: the latest opened at or before it, else its first.
  turnAt(sessionId: string, at: number): string | null {
    if (this.db === null) return null
    const raw = this.db.raw
    const row =
      raw
        .prepare(
          'SELECT uuid FROM turns WHERE session_id = ? AND opened <= ? ORDER BY opened DESC, uuid DESC',
        )
        .get(sessionId, at) ??
      raw
        .prepare('SELECT uuid FROM turns WHERE session_id = ? ORDER BY opened, uuid')
        .get(sessionId)
    return nullableStr(row, 'uuid')
  }

  // Whether `at` falls in the session's first turn: no other of its turns opened before it.
  inFirstTurn(sessionId: string, at: number): boolean {
    const db = this.db
    if (db === null) return false
    const row = this.prepared(
      db,
      'SELECT COUNT(*) AS n FROM turns WHERE session_id = ? AND opened <= ?',
    ).get(sessionId, at)
    return num(row, 'n') <= 1
  }

  // Every turn opened in [low, high), whole: its spans and tokens are not clipped to the range. The
  // category is the one reports show (a turn the human did not start takes its session's).
  turnsOpened(low: number, high: number): ExportedTurn[] {
    if (this.db === null) return []
    const raw = this.db.raw
    const turns = new Map<string, ExportedTurn>()
    for (const r of raw
      .prepare(
        `SELECT t.uuid AS u, t.session_id AS s, t.origin AS o, t.opened AS d, t.project_id AS p,` +
          ` ${CATEGORY} AS c FROM turns t WHERE t.opened >= ? AND t.opened < ?` +
          ' ORDER BY t.opened, t.uuid',
      )
      .all(low, high)) {
      turns.set(String(r.u), {
        uuid: String(r.u),
        sessionId: String(r.s),
        origin: String(r.o),
        opened: num(r, 'd'),
        projectId: nullableStr(r, 'p'),
        category: nullableStr(r, 'c'),
        seconds: 0,
        blocked: 0,
        tokens: [],
      })
    }
    for (const r of raw
      .prepare(
        'SELECT s.uuid AS u, s.kind AS k, SUM(s.end - s.start) AS seconds FROM spans s' +
          ' JOIN turns t ON t.uuid = s.uuid WHERE t.opened >= ? AND t.opened < ? GROUP BY s.uuid, s.kind',
      )
      .all(low, high)) {
      const turn = turns.get(String(r.u))
      if (!turn) continue
      if (r.k === 'blocked') turn.blocked += num(r, 'seconds')
      else turn.seconds += num(r, 'seconds')
    }
    for (const r of raw
      .prepare(
        'SELECT k.uuid AS u, k.model AS m, k.hour AS h, k.input AS i, k.output AS o,' +
          ' k.cache_write AS cw, k.cache_write_1h AS cw1h, k.cache_read AS cr FROM tokens k' +
          ' JOIN turns t ON t.uuid = k.uuid WHERE t.opened >= ? AND t.opened < ?' +
          ' ORDER BY k.uuid, k.model, k.hour',
      )
      .all(low, high)) {
      turns.get(String(r.u))?.tokens.push({
        model: String(r.m),
        hour: num(r, 'h'),
        tokens: {
          input: num(r, 'i'),
          output: num(r, 'o'),
          cacheWrite: num(r, 'cw'),
          cacheWrite1h: num(r, 'cw1h'),
          cacheRead: num(r, 'cr'),
        },
      })
    }
    return [...turns.values()]
  }

  name(sessionId: string): string | null {
    if (this.db === null) return null
    return nullableStr(
      this.db.raw.prepare('SELECT name FROM names WHERE session_id = ?').get(sessionId),
      'name',
    )
  }

  // A session's tokens over its whole history, deduplicated as every usage figure is, its subagents'
  // included; null when the history has no tokens of it.
  sessionTokens(sessionId: string): Tokens | null {
    if (this.db === null) return null
    const row = this.db.raw
      .prepare(
        'SELECT COUNT(*) AS n, SUM(k.input) AS i, SUM(k.output) AS o, SUM(k.cache_write) AS cw,' +
          ' SUM(k.cache_write_1h) AS cw1h, SUM(k.cache_read) AS cr' +
          ' FROM tokens k JOIN turns t ON t.uuid = k.uuid WHERE t.session_id = ?',
      )
      .get(sessionId)
    if (!row || num(row, 'n') === 0) return null
    return {
      input: num(row, 'i'),
      output: num(row, 'o'),
      cacheWrite: num(row, 'cw'),
      cacheWrite1h: num(row, 'cw1h'),
      cacheRead: num(row, 'cr'),
    }
  }

  // When the first turn the history holds was opened, in Unix seconds.
  firstOpened(): number | null {
    if (this.db === null) return null
    const row = this.db.raw.prepare('SELECT MIN(opened) AS first FROM turns').get()
    return row?.first === null || row?.first === undefined ? null : Number(row.first)
  }

  // Each project turns were filed under: its current name while it exists, else the name stored
  // on its most recently opened turn, else its id.
  projectLabels(current: ReadonlyMap<string, string>): Map<string, string> {
    const labels = new Map<string, string>()
    if (this.db === null) return labels
    for (const r of this.db.raw
      .prepare(
        'SELECT project_id AS p, project_name AS n, MAX(opened) FROM turns' +
          ' WHERE project_id IS NOT NULL GROUP BY project_id',
      )
      .all()) {
      const id = String(r.p)
      labels.set(id, current.get(id) || nullableStr(r, 'n') || id)
    }
    return labels
  }

  // For a test or a tool that must read the rows as stored.
  get handle(): Db | null {
    return this.db
  }

  // Null when the history is too new: the batch is left for a Menkar that can write it.
  importActivity(path: string): ActivityImport | null {
    return this.db === null ? null : importBatch(this.db, path)
  }

  importActivityDir(dir: string = activityDir()): ActivityImport | null {
    if (this.db === null) return null
    const total: ActivityImport = { imported: 0, skipped: 0, newer: 0 }
    for (const path of batchFiles(dir)) {
      const one = importBatch(this.db, path)
      total.imported += one.imported
      total.skipped += one.skipped
      total.newer += one.newer
    }
    return total
  }

  // What the bursts are read from, in [low, high): the human turns and the human's actions, of
  // `project` when given; presence and prompted starts are every project's.
  humanActions(low: number, high: number, project?: string): ActivityRows {
    const empty: ActivityRows = { messages: [], actions: [], presence: [], promptedStarts: [] }
    const db = this.db
    if (db === null) return empty
    const scoped = project === undefined ? '' : ' AND project_id = ?'
    const args = (...values: number[]) => (project === undefined ? values : [...values, project])
    const messages = this.prepared(
      db,
      'SELECT uuid AS u, session_id AS s, opened AS d, project_id AS p FROM turns' +
        ` WHERE origin = 'human' AND opened >= ? AND opened < ?${scoped} ORDER BY opened, uuid`,
    )
      .all(...args(low, high))
      .map((r) => ({
        uuid: String(r.u),
        sessionId: String(r.s),
        at: num(r, 'd'),
        project: nullableStr(r, 'p'),
      }))
    const actions = this.prepared(
      db,
      `SELECT at AS a, kind AS k FROM activity WHERE kind IN ${sqlList(ACTION_KINDS)}` +
        ` AND at >= ? AND at < ?${scoped} ORDER BY at, id`,
    )
      .all(...args(low, high))
      .map((r) => ({ at: num(r, 'a'), kind: String(r.k) as (typeof ACTION_KINDS)[number] }))
    const presenceKinds = sqlList(PRESENCE_KINDS)
    const presence = [
      ...this.prepared(
        db,
        `SELECT at AS a, kind AS k FROM activity WHERE kind IN ${presenceKinds} AND at < ?` +
          ' ORDER BY at DESC, id DESC LIMIT 1',
      ).all(low),
      ...this.prepared(
        db,
        `SELECT at AS a, kind AS k FROM activity WHERE kind IN ${presenceKinds}` +
          ' AND at >= ? AND at < ? ORDER BY at, id',
      ).all(low, high),
    ].map((r) => ({ at: num(r, 'a'), kind: String(r.k) as PresenceKind }))
    const promptedStarts = this.prepared(
      db,
      'SELECT a.at AS a, a.session_id AS s, t.uuid AS u, t.origin AS o FROM activity a' +
        ` LEFT JOIN turns t ON t.uuid = (${firstTurnAfter('a.session_id', 'a.at')})` +
        " WHERE a.kind = 'prompted_start' AND a.session_id IS NOT NULL AND a.at >= ? AND a.at < ?" +
        ' ORDER BY a.at, a.id',
    )
      .all(low, high)
      .map((r) => ({
        at: num(r, 'a'),
        sessionId: String(r.s),
        firstTurn: r.u === null ? null : { uuid: String(r.u), origin: String(r.o) },
      }))
    return { messages, actions, presence, promptedStarts }
  }

  // Which of these activity ids the history already holds.
  knownActivityIds(ids: readonly string[]): Set<string> {
    const db = this.db
    if (db === null || ids.length === 0) return new Set()
    return new Set(
      this.prepared(db, 'SELECT id FROM activity WHERE id IN (SELECT value FROM json_each(?))')
        .all(JSON.stringify(ids))
        .map((r) => String(r.id)),
    )
  }

  // A session's first turn opened at or after `at`, as `humanActions` joins it to a prompted start.
  firstTurnAt(sessionId: string, at: number): { uuid: string; origin: string } | null {
    const db = this.db
    if (db === null) return null
    const row = this.prepared(
      db,
      `SELECT uuid AS u, origin AS o FROM turns WHERE uuid = (${firstTurnAfter('?', '?')})`,
    ).get(sessionId, at)
    return row === undefined ? null : { uuid: String(row.u), origin: String(row.o) }
  }

  // Every activity row in [low, high), oldest first, for the export.
  activityRows(low: number, high: number): StoredActivity[] {
    const db = this.db
    if (db === null) return []
    return this.prepared(
      db,
      'SELECT id, at, kind, project_id, session_id, topic, task, next, blocked_seconds' +
        ' FROM activity WHERE at >= ? AND at < ? ORDER BY at, id',
    )
      .all(low, high)
      .map((r) => ({
        id: String(r.id),
        at: num(r, 'at'),
        kind: String(r.kind),
        projectId: nullableStr(r, 'project_id'),
        sessionId: nullableStr(r, 'session_id'),
        topic: r.topic === null ? null : num(r, 'topic'),
        task: r.task === null ? null : num(r, 'task'),
        next: nullableStr(r, 'next'),
        blockedSeconds: r.blocked_seconds === null ? null : num(r, 'blocked_seconds'),
      }))
  }

  // The task states in [low, high), and each task's last one before `low`, which says what it was
  // in when the range began; of `project` when given. Oldest first.
  taskStateRows(low: number, high: number, project?: string): TaskStateRow[] {
    const db = this.db
    if (db === null) return []
    const scoped = project === undefined ? '' : ' AND project_id = ?'
    const columns = 'id, at, project_id, task, state, wait_kind, wait_ref, assignee, baseline'
    const args = project === undefined ? [low, high, low] : [low, high, project, low, project]
    return this.prepared(
      db,
      `SELECT ${columns} FROM task_states WHERE at >= ? AND at < ?${scoped}` +
        ` UNION ALL SELECT ${columns} FROM task_states s WHERE at < ?${scoped}` +
        ' AND id = (SELECT p.id FROM task_states p WHERE p.project_id = s.project_id' +
        ' AND p.task = s.task AND p.at < ? ORDER BY p.at DESC, p.id DESC LIMIT 1)' +
        ' ORDER BY at, id',
    )
      .all(...args, low)
      .map((r) => ({
        id: String(r.id),
        at: num(r, 'at'),
        projectId: String(r.project_id),
        task: num(r, 'task'),
        state: String(r.state),
        waitKind: nullableStr(r, 'wait_kind'),
        waitRef: nullableStr(r, 'wait_ref'),
        assignee: nullableStr(r, 'assignee'),
        baseline: num(r, 'baseline') !== 0,
      }))
  }
}

// One row of the activity table, as stored.
export interface StoredActivity {
  readonly id: string
  readonly at: number
  readonly kind: string
  readonly projectId: string | null
  readonly sessionId: string | null
  readonly topic: number | null
  readonly task: number | null
  readonly next: string | null
  readonly blockedSeconds: number | null
}

const ACTION_KINDS = ['prompt_answered', 'topic_discussed', 'topic_closed', 'present'] as const
const PRESENCE_KINDS = ['away', 'back', 'app_start'] as const
const firstTurnAfter = (session: string, at: string) =>
  `SELECT f.uuid FROM turns f WHERE f.session_id = ${session}` +
  ` AND f.opened >= ${at} ORDER BY f.opened, f.uuid LIMIT 1`
const sqlList = (kinds: readonly string[]) => `(${kinds.map((k) => `'${k}'`).join(', ')})`

// Execution spans that touch become one: the two-hour rule makes most of a turn contiguous.
export function mergedSpans<T extends { kind: string; start: number; end: number }>(
  spans: readonly T[],
): { kind: string; start: number; end: number }[] {
  const merged: { kind: string; start: number; end: number }[] = []
  for (const span of spans) {
    const last = merged.at(-1)
    if (last && span.kind === 'execution' && last.kind === 'execution' && last.end === span.start) {
      last.end = span.end
    } else {
      merged.push({ kind: span.kind, start: span.start, end: span.end })
    }
  }
  return merged
}
