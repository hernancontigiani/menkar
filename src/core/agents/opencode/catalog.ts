import { type Stats, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { log } from '../../log'
import type { Details } from '../../sessions/details'
import type { DiscoveredSession } from '../../sessions/scanner'
import { UNREADABLE } from '../shared/db'
import { isDir } from '../shared/jsonl'
import type { Found, SessionCatalog, SessionReader } from '../types'
import { closeReads, dbReads } from './reads'
import type { Answer, Request, SessionHead, SessionRow } from './store'

const EMPTY_DETAILS: Details = {
  user: 0,
  assistant: 0,
  toolCalls: 0,
  models: [],
  created: null,
  lastActivity: null,
  cwd: null,
  mcpUsed: [],
  recent: [],
}

// OpenCode's database: `$XDG_DATA_HOME/opencode/opencode.db`, or OPENCODE_DB, a path taken from
// that folder when relative. A build of another channel than the one released names its database
// after the channel, which only that binary knows: the released one's name is read.
function dbPath(): string {
  const value = process.env.XDG_DATA_HOME
  const data = value?.startsWith('/') ? value : join(homedir(), '.local', 'share')
  const folder = join(data, 'opencode')
  const set = process.env.OPENCODE_DB
  return set ? resolve(folder, set) : join(folder, 'opencode.db')
}

// The locator is the database and the session's id in it.
const SEPARATOR = '#'
const locatorOf = (db: string, id: string) => `${db}${SEPARATOR}${id}`

function parse(locator: string): { db: string; id: string } {
  const at = locator.lastIndexOf(SEPARATOR)
  return { db: locator.slice(0, at), id: locator.slice(at + 1) }
}

const statOf = (path: string): Stats | undefined => statSync(path, { throwIfNoEntry: false })
const mark = (stats: Stats | undefined) =>
  stats ? `${stats.ino}:${stats.size}:${stats.mtimeMs}` : ''

// A read that could not be made answers as if there were nothing, logged once per kind of failure.
const failed = new Set<string>()

async function ask<R extends Request>(request: R): Promise<Answer<R> | null> {
  try {
    const answer = await dbReads().ask(request)
    failed.delete(request.op)
    return answer
  } catch (error) {
    if (!failed.has(request.op)) {
      failed.add(request.op)
      log.warn("OpenCode's database could not be read", { op: request.op, error })
    }
    return null
  }
}

// What the last listing found, by database: read again only when the database file or its -wal
// moved, the two files every write of OpenCode's reaches.
const listings = new Map<string, { mark: string; rows: Map<string, SessionRow> }>()

async function listing(db: string): Promise<Map<string, SessionRow>> {
  const dbStats = statOf(db)
  if (!dbStats) {
    listings.delete(db)
    return new Map()
  }
  const now = `${mark(dbStats)}|${mark(statOf(`${db}-wal`))}`
  const was = listings.get(db)
  if (was?.mark === now) return was.rows
  const rows = await ask({ op: 'list', db })
  if (rows === null || rows === UNREADABLE) return was?.rows ?? new Map()
  const fresh = new Map(rows.map((row) => [row.id, row]))
  listings.set(db, { mark: now, rows: fresh })
  return fresh
}

async function find(root: string): Promise<Found[]> {
  return [...(await listing(root)).values()].map((row) => ({
    agent: 'opencode',
    id: row.id,
    locator: locatorOf(root, row.id),
    // Where its rows are: the database's folder.
    folder: dirname(root),
    cwd: row.directory,
  }))
}

// Each session's messages read again only when its row says it was updated.
class RowReader implements SessionReader {
  readonly #heads = new Map<string, { updated: number; head: SessionHead | null }>()

  retain(locators: ReadonlySet<string>): void {
    for (const locator of this.#heads.keys())
      if (!locators.has(locator)) this.#heads.delete(locator)
  }

  async read(item: Found): Promise<DiscoveredSession | null> {
    const { db, id } = parse(item.locator)
    const row = listings.get(db)?.rows.get(id)
    if (!row) return null
    let known = this.#heads.get(item.locator)
    if (known?.updated !== row.updated) {
      const head = await ask({ op: 'head', db, id })
      if (head === null || head === UNREADABLE) return null
      known = { updated: row.updated, head }
      this.#heads.set(item.locator, known)
    }
    const head = known.head
    if (!head?.preview) return null
    return {
      agent: item.agent,
      id,
      file: item.locator,
      folder: item.folder,
      cwd: row.directory,
      preview: head.preview,
      badge: head.badge,
      // A title OpenCode generated and one the user gave are kept alike: both are its name.
      customTitle: row.title,
      aiTitle: null,
      mtimeMs: row.updated,
      size: head.size,
    }
  }
}

// Its data folder, where the database and its sidecars change. Nothing while OpenCode has none.
async function watchTargets(root: string): Promise<string[]> {
  const folder = dirname(root)
  return isDir(folder) ? [folder] : []
}

async function conversation(locator: string) {
  const answer = await ask({ op: 'conversation', ...parse(locator) })
  return answer === UNREADABLE ? null : answer
}

async function exportMarkdown(name: string, id: string, locator: string): Promise<string> {
  const read = await conversation(locator)
  const d = read?.details ?? EMPTY_DETAILS
  const header = [`# ${name}`, '', `- **Session:** \`${id}\``]
  if (d.cwd) header.push(`- **Project:** \`${d.cwd}\``)
  if (d.created) header.push(`- **Created:** ${d.created}`)
  if (d.lastActivity) header.push(`- **Last activity:** ${d.lastActivity}`)
  const turns = (read?.said ?? []).flatMap(({ fromUser, text, tools }) => {
    if (fromUser) return text ? [`### You\n\n${text}`] : []
    const parts = ['### OpenCode']
    if (text) parts.push(text)
    if (tools.length > 0) parts.push(`*Used ${tools.map((t) => `\`${t}\``).join(', ')}*`)
    return parts.length > 1 ? [parts.join('\n\n')] : []
  })
  const body = turns.length > 0 ? turns.join('\n\n') : '_No messages._'
  return `${header.join('\n')}\n\n---\n\n${body}\n`
}

// Whether the session's row says a turn of it runs now, in whichever server ran it last; null when
// it cannot be read.
export async function runningNow(id: string): Promise<boolean | null> {
  const answer = await ask({ op: 'times', db: dbPath(), id })
  if (answer === null || answer === UNREADABLE) return null
  return answer.busy > answer.idle
}

export const catalog: SessionCatalog = {
  root: dbPath,
  names: true,
  find,
  reader: () => new RowReader(),
  watchTargets,
  lastReply: async (locator) => {
    const answer = await ask({ op: 'lastReply', ...parse(locator) })
    return answer === UNREADABLE ? null : answer
  },
  details: async (locator) => (await conversation(locator))?.details ?? EMPTY_DETAILS,
  exportMarkdown,
  // A session is rows in a database, not a file to show.
  location: () => null,
  trash: null,
  transcript: null,
  turnEnd: null,
  close: () => {
    listings.clear()
    closeReads()
  },
}
