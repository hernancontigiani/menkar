// What Menkar reads of OpenCode's database (v2.3.0): plain functions over an open database, run
// in the catalog's worker. The schema is OpenCode's own and undocumented, so every JSON column is
// read defensively.
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type { Badge, Details, RecentMessage } from '../../sessions/details'
import { openAgentDb, type UNREADABLE } from '../shared/db'

const PREVIEW_CHARS = 120
const RECENT = 12
const RECENT_CHARS = 500

// A root session as OpenCode's own picker lists it: not a subagent's, not archived.
export interface SessionRow {
  readonly id: string
  readonly directory: string
  readonly title: string | null
  readonly created: number
  readonly updated: number
}

export interface SessionHead {
  readonly preview: string
  readonly badge: Badge
  // The bytes its messages and parts hold.
  readonly size: number
}

export interface Conversation {
  readonly details: Details
  readonly said: ReadonlyArray<{ readonly fromUser: boolean; text: string; tools: string[] }>
}

export type Request =
  | { readonly op: 'list'; readonly db: string }
  | { readonly op: 'head'; readonly db: string; readonly id: string }
  | { readonly op: 'conversation'; readonly db: string; readonly id: string }
  | { readonly op: 'lastReply'; readonly db: string; readonly id: string }

export interface Answers {
  readonly list: SessionRow[]
  readonly head: SessionHead | null
  readonly conversation: Conversation | null
  readonly lastReply: string | null
}

export type Answer<R extends Request> = Answers[R['op']] | typeof UNREADABLE

// The title OpenCode stored for a session it had not titled yet, before it kept NULL instead.
const FALLBACK_TITLE = /^(New session|Child session) - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const num = (value: unknown): number => (typeof value === 'number' ? value : 0)

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined
}

function json(text: unknown): unknown {
  if (typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  }
}

const oneLine = (text: string, max: number) => text.replace(/\s+/g, ' ').trim().slice(0, max)

function list(db: DatabaseSync): SessionRow[] {
  return db
    .prepare(
      `SELECT id, directory, title, time_created, time_updated FROM session_v2
       WHERE parent_id IS NULL AND time_archived IS NULL`,
    )
    .all()
    .map((row) => {
      const title = str(row.title)?.trim() || null
      return {
        id: String(row.id),
        directory: String(row.directory),
        title: title === null || FALLBACK_TITLE.test(title) ? null : title,
        created: num(row.time_created),
        updated: num(row.time_updated),
      }
    })
}

// One message as the list, the details and the export care: who said it and what.
type Said =
  | { kind: 'user'; text: string }
  | { kind: 'agent'; text: string; tools: string[]; model: string | null; finish: string | null }
  | { kind: 'idle'; outcome: string | null }

// A message's parts: its rows in `session_part` by ordinal first, then the ones inline in its data,
// the order OpenCode reads them in. Rows are written only when an experimental option is on.
function partsOf(db: DatabaseSync, messageId: string, data: unknown): unknown[] {
  const rows = db
    .prepare('SELECT data FROM session_part WHERE message_id = ? ORDER BY ordinal')
    .all(messageId)
    .map((row) => json(row.data))
  const inline = field(data, 'content')
  return [...rows, ...(Array.isArray(inline) ? inline : [])]
}

function saidOf(db: DatabaseSync, row: Record<string, SQLInputValue>): Said | null {
  const data = json(row.data)
  switch (row.type) {
    case 'user': {
      const text = str(field(data, 'text'))
      return text === null ? null : { kind: 'user', text }
    }
    case 'assistant': {
      const parts = partsOf(db, String(row.id), data)
      const texts = parts
        .filter((part) => field(part, 'type') === 'text')
        .map((part) => str(field(part, 'text')))
        .filter((text) => text !== null)
      const tools = parts
        .filter((part) => field(part, 'type') === 'tool')
        .map((part) => str(field(part, 'name')) ?? 'tool')
      return {
        kind: 'agent',
        text: texts.join('\n\n'),
        tools,
        model: str(field(field(data, 'model'), 'id')),
        finish: str(field(data, 'finish')),
      }
    }
    case 'idle':
      return { kind: 'idle', outcome: str(field(data, 'outcome')) }
    default:
      return null
  }
}

function messages(db: DatabaseSync, id: string): Said[] {
  return db
    .prepare('SELECT id, type, data FROM session_message WHERE session_id = ? ORDER BY seq')
    .all(id)
    .map((row) => saidOf(db, row))
    .filter((said) => said !== null)
}

function size(db: DatabaseSync, id: string): number {
  const row = db
    .prepare(
      `SELECT (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM session_message WHERE session_id = ?)
            + (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM session_part WHERE session_id = ?) AS bytes`,
    )
    .get(id, id)
  return num(row?.bytes)
}

// The last word of its messages: an execution the user interrupted, a reply that asks something,
// or neither.
function badgeOf(said: readonly Said[]): Badge {
  let latest: 'interrupted' | 'agent' | 'user' | null = null
  let agentText = ''
  for (const s of said) {
    if (s.kind === 'idle') {
      if (s.outcome === 'interrupted') latest = 'interrupted'
    } else if (s.kind === 'user') latest = 'user'
    else if (s.text) {
      latest = 'agent'
      agentText = s.text
    }
  }
  if (latest === 'interrupted') return 'interrupted'
  if (latest === 'agent' && agentText.trimEnd().endsWith('?')) return 'waiting'
  return null
}

function head(db: DatabaseSync, id: string): SessionHead | null {
  const said = messages(db, id)
  if (said.length === 0) return null
  const first = said.find((s) => s.kind === 'user')
  return {
    preview: first ? oneLine(first.text, PREVIEW_CHARS) : '',
    badge: badgeOf(said),
    size: size(db, id),
  }
}

// The reply an execution closed with: each ends in an `idle` message, and its reply is the text of
// the last step before it, past the steps that only called tools.
function lastReply(db: DatabaseSync, id: string): string | null {
  const said = messages(db, id)
  const end = said.findLastIndex((s) => s.kind === 'idle')
  for (let i = end - 1; i >= 0; i -= 1) {
    const s = said[i]
    if (s?.kind === 'user') return null
    if (s?.kind === 'agent' && s.text.trim()) return s.text.trim()
  }
  return null
}

function conversation(db: DatabaseSync, id: string): Conversation | null {
  const session = db
    .prepare('SELECT directory, time_created, time_updated FROM session_v2 WHERE id = ?')
    .get(id)
  if (!session) return null
  const said = messages(db, id)
  const models = new Set<string>()
  const recent: RecentMessage[] = []
  const out: Array<{ fromUser: boolean; text: string; tools: string[] }> = []
  let user = 0
  let assistant = 0
  let toolCalls = 0
  let pendingTools: string[] = []
  for (const s of said) {
    if (s.kind === 'idle') continue
    if (s.kind === 'agent') {
      if (s.model) models.add(s.model)
      toolCalls += s.tools.length
      pendingTools.push(...s.tools)
      if (!s.text.trim()) continue
      assistant += 1
      recent.push({ fromUser: false, text: oneLine(s.text, RECENT_CHARS) })
      out.push({ fromUser: false, text: s.text.trim(), tools: pendingTools })
      pendingTools = []
      continue
    }
    user += 1
    recent.push({ fromUser: true, text: oneLine(s.text, RECENT_CHARS) })
    if (pendingTools.length > 0) out.push({ fromUser: false, text: '', tools: pendingTools })
    pendingTools = []
    out.push({ fromUser: true, text: s.text.trim(), tools: [] })
  }
  if (pendingTools.length > 0) out.push({ fromUser: false, text: '', tools: pendingTools })
  const iso = (value: unknown) => (typeof value === 'number' ? new Date(value).toISOString() : null)
  return {
    details: {
      user,
      assistant,
      toolCalls,
      models: [...models].sort(),
      created: iso(session.time_created),
      lastActivity: iso(session.time_updated),
      cwd: str(session.directory),
      // OpenCode names an MCP server's tool `<server>_<tool>`, which a server's own underscores
      // make ambiguous: no server is guessed.
      mcpUsed: [],
      recent: recent.slice(-RECENT),
    },
    said: out,
  }
}

// Runs one request against the database, opened and closed for it.
export function answer<R extends Request>(request: R): Answer<R> {
  const result = openAgentDb(request.db, (db): Answers[Request['op']] => {
    switch (request.op) {
      case 'list':
        return list(db)
      case 'head':
        return head(db, request.id)
      case 'conversation':
        return conversation(db, request.id)
      case 'lastReply':
        return lastReply(db, request.id)
    }
  })
  return result as Answer<R>
}
