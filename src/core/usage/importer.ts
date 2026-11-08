import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { openDb } from '../db'
import { log } from '../log'
import { agentPaths } from '../paths'
import { BUSY_TIMEOUT_MS, HISTORY_SCHEMA, HISTORY_VERSION, UsageHistory } from './history'
import { importedStatuslineLogPath } from './statusline'

export interface ImportSources {
  readonly history: string
  readonly statuslineLog: string
}

export function agentTabletSources(): ImportSources {
  const paths = agentPaths()
  return {
    history: join(paths.agentTabletData, 'history.sqlite'),
    statuslineLog: join(paths.agentTabletCache, 'usage.jsonl'),
  }
}

// The steps an import takes that a test may fail midway.
export interface ImportIo {
  rename(from: string, to: string): void
}

const realIo: ImportIo = { rename: renameSync }

// Opens Menkar's usage history. The first time — no file at its path — it is first filled from
// agent-tablet's, so the months agent-tablet recorded show from Menkar's first day; any existing
// file, even an empty or unreadable one, means that already happened.
export function openHistory(
  path: string,
  sources: ImportSources = agentTabletSources(),
  importedLog: string = importedStatuslineLogPath(),
  io: ImportIo = realIo,
): UsageHistory {
  if (!existsSync(path) && !importAgentTablet(path, sources, importedLog, io)) {
    // No history is created in its place, or the next start would take it for an import done.
    throw new Error('the agent-tablet import failed; the usage history was not created')
  }
  return new UsageHistory(path)
}

const AGENT_TABLET_VERSIONS = new Set([1, 2])

type Row = Record<string, unknown>

interface Source {
  readonly version: number
  read(sql: string): Row[]
  close(): void
}

function readSource(source: string): Source | null {
  let db: DatabaseSync
  try {
    db = new DatabaseSync(source, { readOnly: true, timeout: BUSY_TIMEOUT_MS })
  } catch (error) {
    log.warn('agent-tablet usage history could not be opened; not imported', {
      path: source,
      error,
    })
    return null
  }
  try {
    const check = db.prepare('PRAGMA quick_check').get()
    if (check === undefined || Object.values(check)[0] !== 'ok') {
      log.warn('agent-tablet usage history is damaged; not imported', { path: source })
      db.close()
      return null
    }
    const version = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0)
    return {
      version,
      read: (sql) => db.prepare(sql).all() as Row[],
      close: () => db.close(),
    }
  } catch (error) {
    db.close()
    log.warn('agent-tablet usage history is unreadable; not imported', { path: source, error })
    return null
  }
}

// Copies agent-tablet's history row for row into a new file beside `target`, renamed into place
// once committed, and its statusline log beside it; agent-tablet's files are only read. False when
// the copy failed: no history is left at `target`, so the next start tries again. Nothing to
// import (no file, an unreadable or newer one) is not a failure.
export function importAgentTablet(
  target: string,
  sources: ImportSources,
  importedLog: string,
  io: ImportIo = realIo,
): boolean {
  if (!existsSync(sources.history)) {
    log.info('no agent-tablet usage history to import', { path: sources.history })
    try {
      copyLog(sources.statuslineLog, importedLog, io)
    } catch (error) {
      log.warn('agent-tablet statusline log could not be copied', {
        from: sources.statuslineLog,
        error,
      })
    }
    return true
  }
  const source = readSource(sources.history)
  if (source === null) return true
  const temporary = `${target}.import-${process.pid}`
  try {
    if (source.version === 0) {
      log.info('agent-tablet usage history is empty; nothing imported', { path: sources.history })
      return true
    }
    if (!AGENT_TABLET_VERSIONS.has(source.version)) {
      log.warn('agent-tablet usage history is from a newer version; not imported', {
        path: sources.history,
        version: source.version,
      })
      return true
    }
    const turns = source.read(
      source.version === 1
        ? 'SELECT uuid, session_id, origin, opened, project_id, project_name, NULL AS category,' +
            ' 0 AS category_tries FROM turns'
        : 'SELECT uuid, session_id, origin, opened, project_id, project_name, category,' +
            ' category_tries FROM turns',
    )
    const spans = source.read('SELECT uuid, kind, start, end FROM spans')
    const tokens = source.read(
      'SELECT uuid, model, hour, input, output, cache_write, cache_write_1h, cache_read FROM tokens',
    )
    const names = source.read('SELECT session_id, name, claude FROM names')
    copyLog(sources.statuslineLog, importedLog, io)
    rmSync(temporary, { force: true })
    const db = openDb(temporary, BUSY_TIMEOUT_MS)
    try {
      db.transaction(() => {
        db.raw.exec(HISTORY_SCHEMA)
        insertAll(db.raw, 'turns', 8, turns)
        insertAll(db.raw, 'spans', 4, spans)
        insertAll(db.raw, 'tokens', 8, tokens)
        insertAll(db.raw, 'names', 3, names)
        db.setUserVersion(HISTORY_VERSION)
      })
    } finally {
      db.close()
    }
    io.rename(temporary, target)
    log.info('agent-tablet usage history imported', {
      from: sources.history,
      to: target,
      turns: turns.length,
    })
    return true
  } catch (error) {
    rmSync(temporary, { force: true })
    rmSync(`${temporary}-journal`, { force: true })
    log.warn('agent-tablet usage history import failed; will retry on the next start', {
      from: sources.history,
      to: target,
      error,
    })
    return false
  } finally {
    source.close()
  }
}

type Bindable = string | number | bigint | null | Uint8Array

function insertAll(db: DatabaseSync, table: string, columns: number, rows: readonly Row[]): void {
  const insert = db.prepare(`INSERT INTO ${table} VALUES (${Array(columns).fill('?').join(', ')})`)
  for (const row of rows) insert.run(...(Object.values(row) as Bindable[]))
}

// agent-tablet's statusline log carries the exact cost of the sessions it started.
function copyLog(source: string, target: string, io: ImportIo): void {
  if (!existsSync(source)) return
  mkdirSync(dirname(target), { recursive: true })
  const temporary = `${target}.import-${process.pid}`
  copyFileSync(source, temporary)
  io.rename(temporary, target)
}
