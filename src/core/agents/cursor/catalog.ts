import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { agentPaths } from '../../paths'
import type { Badge, Details, Head, RecentMessage } from '../../sessions/details'
import type { DiscoveredSession } from '../../sessions/scanner'
import {
  chunkLines,
  dashedPath,
  entries,
  HEAD_BYTES,
  HEAD_LINES,
  isDir,
  type Line,
  markdownExport,
  messageText,
  nearestExisting,
  parseLine,
  type ReadRange,
  readRange,
  subdirs,
  TAIL_BYTES,
  textLines,
  toolUses,
} from '../shared/jsonl'
import type { Found, SessionCatalog, SessionReader, TranscriptReading } from '../types'

const PREVIEW_CHARS = 120
const RECENT = 12
const USER_QUERY = /<\/?user_query>/g
// cursor-agent puts the time the message was sent before what the user typed.
const TIMESTAMP = /^\s*<timestamp>[^<]*<\/timestamp>/

const userText = (value: string) => value.replace(TIMESTAMP, '').replace(USER_QUERY, '')

// A message the user typed: text, trimmed, not empty and not injected (`<…>`).
function typed(line: Line): string | null {
  if (line.role !== 'user') return null
  const raw = messageText(line)
  const text = (raw !== null ? userText(raw) : raw)?.trim()
  return text && !text.startsWith('<') ? text : null
}

// `text` is the start of the file; only its first HEAD_LINES lines count.
function head(text: string): Head {
  let cwd: string | null = null
  let preview = ''
  for (const raw of text.split('\n').slice(0, HEAD_LINES)) {
    const line = parseLine(raw)
    if (!line) continue
    if (cwd === null && typeof line.cwd === 'string') cwd = line.cwd
    if (!preview && line.role === 'user') {
      const content = messageText(line)
      const said = (content !== null ? userText(content) : content)?.trim()
      if (said && !said.startsWith('<')) preview = said.replace(/\s+/g, ' ').slice(0, PREVIEW_CHARS)
    }
    if (preview) break
  }
  return { cwd, preview }
}

function badge(tail: string, fromStart: boolean): Badge {
  let latest: 'assistant' | 'user' | null = null
  let assistantText = ''
  for (const raw of chunkLines(tail, fromStart)) {
    const line = parseLine(raw)
    if (!line) continue
    const content = messageText(line)
    if (content === null) continue
    if (line.role === 'assistant') {
      latest = 'assistant'
      assistantText = content
    } else if (line.role === 'user') {
      if (!userText(content).trim().startsWith('<')) latest = 'user'
    }
  }
  if (latest === 'assistant' && assistantText.trimEnd().endsWith('?')) return 'waiting'
  return null
}

function details(text: string): Details {
  let user = 0
  let assistant = 0
  let toolCalls = 0
  let cwd: string | null = null
  const recent: RecentMessage[] = []
  for (const line of textLines(text)) {
    if (cwd === null && typeof line.cwd === 'string') cwd = line.cwd
    const kind = line.role
    if (kind === 'user') user += 1
    if (kind === 'assistant') {
      assistant += 1
      toolCalls += toolUses(line).length
    }
    const said = messageText(line)
    if ((kind === 'user' || kind === 'assistant') && said) {
      recent.push({
        fromUser: kind === 'user',
        text: kind === 'user' ? userText(said).trim() : said,
      })
    }
  }
  return {
    user,
    assistant,
    toolCalls,
    models: [],
    created: null,
    lastActivity: null,
    cwd,
    mcpUsed: [],
    recent: recent.slice(-RECENT),
  }
}

const transcript: TranscriptReading = {
  head,
  // The cwd comes from the project folder's name, not from the transcript.
  headFinal: (read) => read.preview !== '',
  badge,
  titles: null,
  details,
  exportMarkdown: (name, id, text) =>
    markdownExport(name, id, text, details(text), 'Cursor', typed, (l) => l.role === 'assistant'),
}

interface Seen {
  readonly ino: number
  readonly size: number
  readonly mtimeMs: number
  readonly session: DiscoveredSession
}

// Cursor's TUI writes its transcript whole from its own state, dropping lines it never saw, so no
// offset is trusted: any change of the file reads its head and its tail windows again.
class RewrittenJsonlReader implements SessionReader {
  readonly #read: ReadRange
  readonly #seen = new Map<string, Seen>()

  constructor(read: ReadRange) {
    this.#read = read
  }

  retain(locators: ReadonlySet<string>): void {
    for (const file of this.#seen.keys()) if (!locators.has(file)) this.#seen.delete(file)
  }

  async read(item: Found): Promise<DiscoveredSession | null> {
    const file = item.locator
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
    if (info.size === 0) return null
    const seen = this.#seen.get(file)
    if (seen && seen.ino === info.ino && seen.size === info.size && seen.mtimeMs === info.mtimeMs)
      return seen.session
    const headText = (await this.#read(file, 0, Math.min(info.size, HEAD_BYTES))).toString('utf8')
    const start = Math.max(0, info.size - TAIL_BYTES)
    const tail = (await this.#read(file, start, info.size)).toString('utf8')
    const read = head(headText)
    const session: DiscoveredSession = {
      agent: item.agent,
      id: item.id,
      file,
      folder: item.folder,
      cwd: item.cwd ?? read.cwd,
      preview: read.preview,
      badge: badge(tail, start === 0),
      customTitle: null,
      aiTitle: null,
      mtimeMs: info.mtimeMs,
      size: info.size,
    }
    this.#seen.set(file, { ino: info.ino, size: info.size, mtimeMs: info.mtimeMs, session })
    return session
  }
}

// The reply of the last turn that ended: the last assistant text before the last `turn_ended`. A
// turn still running, or one interrupted before any text, leaves the earlier turn's.
export function lastClosedReply(lines: readonly string[]): string | null {
  let reply: string | null = null
  let latest: string | null = null
  for (const raw of lines) {
    const line = parseLine(raw)
    if (!line) continue
    if (line.type === 'turn_ended') {
      if (latest !== null) reply = latest
      latest = null
    } else if (line.role === 'user') latest = null
    else if (line.role === 'assistant') {
      const text = messageText(line)?.trim()
      if (text) latest = text
    }
  }
  return reply
}

const REPLY_WINDOWS = [TAIL_BYTES, 1024 * 1024, 8 * 1024 * 1024]

async function lastReply(locator: string): Promise<string | null> {
  const { size } = await stat(locator)
  for (const window of REPLY_WINDOWS) {
    const start = Math.max(0, size - window)
    const text = (await readRange(locator, start, size)).toString('utf8')
    const reply = lastClosedReply(chunkLines(text, start === 0))
    if (reply !== null || start === 0) return reply
  }
  return null
}

// Each session is a directory under a project's agent-transcripts/, read from its `<id>.jsonl`,
// else from its first .jsonl.
async function find(projects: string): Promise<Found[]> {
  const found: Found[] = []
  for (const folder of await entries(projects)) {
    if (!folder.isDirectory()) continue
    const transcripts = join(projects, folder.name, 'agent-transcripts')
    let cwd: string | undefined
    for (const session of await entries(transcripts)) {
      if (!session.isDirectory()) continue
      const dir = join(transcripts, session.name)
      const jsonls = (await entries(dir))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
        .map((entry) => entry.name)
        .sort()
      const name = jsonls.includes(`${session.name}.jsonl`) ? `${session.name}.jsonl` : jsonls[0]
      if (name === undefined) continue
      cwd ??= dashedPath(folder.name, isDir)
      found.push({ agent: 'cursor', id: session.name, locator: join(dir, name), folder: dir, cwd })
    }
  }
  return found
}

// The projects directory, each folder in it and each agent-transcripts inside those.
async function watchTargets(root: string): Promise<string[]> {
  const folders = await subdirs(root)
  const transcripts = (await Promise.all(folders.map(subdirs)))
    .flat()
    .filter((dir) => dir.endsWith('/agent-transcripts'))
  return [await nearestExisting(root), ...folders, ...transcripts]
}

export const catalog: SessionCatalog = {
  root: () => agentPaths().cursorProjects,
  names: false,
  find,
  reader: (read) => new RewrittenJsonlReader(read),
  watchTargets,
  lastReply,
  details: async (locator) => details(await readFile(locator, 'utf8')),
  exportMarkdown: async (name, id, locator) =>
    transcript.exportMarkdown(name, id, await readFile(locator, 'utf8')),
  location: (locator) => locator,
  trash: { target: (locator) => locator },
  transcript,
  turnEnd: null,
  close: null,
}
