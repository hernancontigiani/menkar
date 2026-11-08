import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { fileStamp, now } from '../clock'
import { type Db, openDb } from '../db'
import { log } from '../log'
import { appDirs } from '../paths'
import type { UsageCache } from './cache'
import { addTokens, type Tokens, ZERO_TOKENS } from './nodes'
import { cost } from './prices'

export { addTokens, type Tokens, totalTokens, ZERO_TOKENS } from './nodes'

// The one file whose loss loses what no transcript can rebuild: one row per turn, never pruned. A
// file from a newer Menkar is left untouched; an unreadable one is moved aside, never deleted.
export const HISTORY_VERSION = 2
export const BUSY_TIMEOUT_MS = 30_000

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
`

// Each step takes a file from the version it is keyed by to the next.
const MIGRATIONS: Readonly<Record<number, string>> = {
  1: `ALTER TABLE turns ADD COLUMN category TEXT;
ALTER TABLE turns ADD COLUMN category_tries INTEGER NOT NULL DEFAULT 0;`,
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
  cost: number
  allPriced: boolean
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

export function keyOf(
  projectId: string | null,
  sessionId: string,
  category: string | null,
): string {
  return JSON.stringify([projectId, sessionId, category])
}

export class UsageHistory {
  readonly path: string
  readonly tooNew: boolean
  private readonly db: Db | null

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
    if (version === 0) {
      db.transaction(() => {
        db.raw.exec(HISTORY_SCHEMA)
        db.setUserVersion(HISTORY_VERSION)
      })
    }
    for (let v = version; v > 0 && v < HISTORY_VERSION; v += 1) {
      const step = MIGRATIONS[v]
      if (step === undefined) throw new Error(`no migration from usage history version ${v}`)
      db.transaction(() => {
        db.raw.exec(step)
        db.setUserVersion(v + 1)
      })
    }
    this.tooNew = false
    this.db = db
  }

  close(): void {
    this.db?.close()
  }

  private moveAside(error: unknown): void {
    const base = `${this.path}.broken-${fileStamp(now())}`
    let target = base
    for (let n = 2; existsSync(target); n += 1) target = `${base}-${n}`
    renameSync(this.path, target)
    log.warn('usage history unreadable, moved aside', { path: target, error })
  }

  // Copies each turn the cache holds as pending, whole, then tells the cache they are written. A
  // turn the cache no longer has (its transcript is gone) is left as it is. A turn keeps the
  // project it was written with; one written with none takes its session's project once it has
  // one.
  write(cache: UsageCache, memberships: Memberships): void {
    const db = this.db
    if (db === null) return // too new: the cache keeps them pending
    const pending = cache.pending()
    const raw = db.raw
    db.transaction(() => {
      const kept = raw.prepare(
        'SELECT project_id, project_name, category, category_tries FROM turns WHERE uuid = ?',
      )
      const removes = ['turns', 'spans', 'tokens'].map((table) =>
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
      for (const [sessionId, { name, claude }] of cache.names(sessions)) {
        const current = currentName.get(sessionId)
        if (current === undefined || claude >= num(current, 'claude'))
          setName.run(sessionId, name, claude)
      }
    })
    cache.written(pending) // only after the commit: writing a turn twice is the same as once
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
          usage: { execution: {}, blocked: 0, tokens: ZERO_TOKENS, cost: 0, allPriced: true },
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
    if (this.db === null) return null
    const raw = this.db.raw
    const row =
      raw
        .prepare(
          'SELECT project_id FROM turns WHERE session_id = ? AND opened <= ? ORDER BY opened DESC, uuid DESC',
        )
        .get(sessionId, at) ??
      raw
        .prepare('SELECT project_id FROM turns WHERE session_id = ? ORDER BY opened, uuid')
        .get(sessionId)
    return nullableStr(row, 'project_id')
  }

  // The category of the session's turn in effect at `at`, resolved as in a report.
  categoryAt(sessionId: string, at: number): string | null {
    if (this.db === null) return null
    const row = this.db.raw
      .prepare(
        `SELECT ${CATEGORY} AS c FROM turns t WHERE t.session_id = ? AND t.opened <= ?` +
          ' ORDER BY t.opened DESC, t.uuid DESC',
      )
      .get(sessionId, at)
    return nullableStr(row, 'c')
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
}

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
