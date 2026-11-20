import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Badge, Details, RecentMessage } from '../../sessions/details'
import type { DiscoveredSession } from '../../sessions/scanner'
import {
  chunkLines,
  entries,
  field,
  HEAD_BYTES,
  isDir,
  type Line,
  nearestExisting,
  parseLine,
  type ReadRange,
  readRange,
  subdirs,
  TAIL_BYTES,
} from '../shared/jsonl'
import { streamLines } from '../shared/zstd'
import type { Found, SessionCatalog, SessionReader } from '../types'
import { codexHome } from './config'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
// `rollout-<local time>-<thread>[_<rollout>].jsonl[.zst]`: a reverted thread goes on in a new file
// named after its thread and the new rollout.
const ROLLOUT = new RegExp(
  `^rollout-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-(${UUID})(?:_${UUID})?\\.jsonl(\\.zst)?$`,
)
const PREVIEW_CHARS = 120
const RECENT = 12
const RECENT_CHARS = 500
// A head with no user message this far in belongs to a session no one has typed into yet.
const HEAD_LINE_LIMIT = 200
// How far back the last reply is looked for, each window wider than the last.
const REPLY_WINDOWS = [TAIL_BYTES, 1024 * 1024, 8 * 1024 * 1024]
// Threads Codex starts for itself, which its own picker does not offer.
const OWN_THREADS = new Set(['subagent', 'guardian_review'])

const compressed = (path: string) => path.endsWith('.zst')

// What one rollout line says, as far as the list, the details and the export care.
type Event =
  | { kind: 'meta'; cwd: string | null; at: string | null; hidden: boolean; paginated: boolean }
  | { kind: 'user'; text: string }
  | { kind: 'agent'; text: string }
  | { kind: 'tool'; name: string; server: string | null }
  | { kind: 'model'; model: string }
  | { kind: 'aborted' }

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)

// Every `text` of an item's content, joined; null when it has none.
function contentText(item: unknown): string | null {
  const content = field(item, 'content')
  if (!Array.isArray(content)) return null
  const texts = content.map((part) => str(field(part, 'text'))).filter((t) => t !== null)
  return texts.length > 0 ? texts.join(' ') : null
}

function metaEvent(payload: unknown): Event {
  const source = field(payload, 'source')
  const threadSource = str(field(payload, 'thread_source'))
  const hidden =
    source === 'exec' ||
    (typeof source === 'object' && source !== null && 'subagent' in source) ||
    (threadSource !== null && OWN_THREADS.has(threadSource))
  return {
    kind: 'meta',
    cwd: str(field(payload, 'cwd')),
    at: str(field(payload, 'timestamp')),
    hidden,
    paginated: field(payload, 'history_mode') === 'paginated',
  }
}

// A paginated rollout tells its conversation in `item_completed` events, a legacy one in
// `user_message` and `agent_message` events. Both also keep the model's own copy, `response_item`s
// that repeat each message and carry the context Codex injects as the user's: those are never read
// as messages. A legacy rollout's tool calls are only there.
function eventOf(line: Line, paginated: boolean): Event | null {
  const payload = line.payload
  const type = str(field(payload, 'type'))
  switch (line.type) {
    case 'session_meta':
      return metaEvent(payload)
    case 'turn_context': {
      const model = str(field(payload, 'model'))
      return model ? { kind: 'model', model } : null
    }
    case 'response_item':
      if (paginated) return null
      if (type === 'function_call' || type === 'custom_tool_call')
        return { kind: 'tool', name: str(field(payload, 'name')) ?? type, server: null }
      if (type === 'local_shell_call') return { kind: 'tool', name: 'shell', server: null }
      return null
    case 'event_msg':
      break
    default:
      return null
  }
  if (type === 'turn_aborted') return { kind: 'aborted' }
  if (paginated) {
    if (type !== 'item_completed') return null
    const item = field(payload, 'item')
    const itemType = str(field(item, 'type'))
    if (itemType === 'UserMessage' || itemType === 'AgentMessage') {
      const text = contentText(item)
      if (text === null) return null
      return { kind: itemType === 'UserMessage' ? 'user' : 'agent', text }
    }
    if (itemType === 'McpToolCall') {
      const server = str(field(item, 'server'))
      const tool = str(field(item, 'tool'))
      return { kind: 'tool', name: [server, tool].filter(Boolean).join('/'), server }
    }
    if (itemType === 'CommandExecution') return { kind: 'tool', name: 'shell', server: null }
    if (itemType === 'DynamicToolCall' || itemType === 'FileChange' || itemType === 'WebSearch')
      return { kind: 'tool', name: itemType, server: null }
    return null
  }
  if (type === 'user_message' || type === 'agent_message') {
    const text = str(field(payload, 'message'))
    if (text === null) return null
    return { kind: type === 'user_message' ? 'user' : 'agent', text }
  }
  // The legacy call's own line names no server; its end does, and is not counted again.
  if (type === 'mcp_tool_call_end') {
    const server = str(field(field(payload, 'invocation'), 'server'))
    return server ? { kind: 'tool', name: '', server } : null
  }
  return null
}

const oneLine = (text: string, max: number) => text.replace(/\s+/g, ' ').trim().slice(0, max)

interface Head {
  readonly seenMeta: boolean
  readonly hidden: boolean
  readonly cwd: string | null
  readonly preview: string
  readonly paginated: boolean
}

const emptyHead = (): Head => ({
  seenMeta: false,
  hidden: false,
  cwd: null,
  preview: '',
  paginated: false,
})

// Folds the head's lines until the thread's meta and the first message the user typed are known.
class HeadFold {
  head = emptyHead()
  #lines = 0

  // False once nothing more is needed.
  take(raw: string): boolean {
    this.#lines += 1
    const line = parseLine(raw)
    const event = line ? eventOf(line, this.head.paginated) : null
    if (event?.kind === 'meta' && !this.head.seenMeta) {
      this.head = {
        ...this.head,
        seenMeta: true,
        hidden: event.hidden,
        cwd: event.cwd,
        paginated: event.paginated,
      }
    } else if (event?.kind === 'user' && !this.head.preview) {
      this.head = { ...this.head, preview: oneLine(event.text, PREVIEW_CHARS) }
    }
    return !this.final() && this.#lines < HEAD_LINE_LIMIT
  }

  final(): boolean {
    return this.head.seenMeta && (this.head.hidden || this.head.preview !== '')
  }

  // Whether the head's lines ran out before it was final: what follows is not the head.
  exhausted(): boolean {
    return this.#lines >= HEAD_LINE_LIMIT
  }
}

async function readHead(file: string, size: number, read: ReadRange): Promise<HeadFold> {
  const fold = new HeadFold()
  if (compressed(file)) {
    for await (const raw of streamLines(file)) if (!fold.take(raw)) break
    return fold
  }
  const end = Math.min(size, HEAD_BYTES)
  const text = (await read(file, 0, end)).toString('utf8')
  // Past the window's last newline the line may be unfinished: it is read again next time.
  const complete = end === size ? text : text.slice(0, text.lastIndexOf('\n') + 1)
  for (const raw of chunkLines(complete, true)) if (!fold.take(raw)) break
  return fold
}

// The tail's last word: a reply that asks something, a turn the user interrupted, or neither.
function badgeOf(tail: string, fromStart: boolean): Badge {
  let latest: 'interrupted' | 'agent' | 'user' | null = null
  let agentText = ''
  for (const raw of chunkLines(tail, fromStart)) {
    const line = parseLine(raw)
    if (!line) continue
    // The tail may not reach the meta: both forms of a message are read, and the last one counts.
    const event = eventOf(line, true) ?? eventOf(line, false)
    if (event?.kind === 'aborted') latest = 'interrupted'
    else if (event?.kind === 'user') latest = 'user'
    else if (event?.kind === 'agent') {
      latest = 'agent'
      agentText = event.text
    }
  }
  if (latest === 'interrupted') return 'interrupted'
  if (latest === 'agent' && agentText.trimEnd().endsWith('?')) return 'waiting'
  return null
}

// The last reply a closed turn left: Codex records it on the turn's `task_complete`.
function lastCompletedReply(lines: Iterable<string>): string | null {
  let reply: string | null = null
  for (const raw of lines) {
    if (!raw.includes('"task_complete"')) continue
    const payload = parseLine(raw)?.payload
    if (field(payload, 'type') !== 'task_complete') continue
    const text = str(field(payload, 'last_agent_message'))?.trim()
    if (text) reply = text
  }
  return reply
}

async function lastReply(locator: string): Promise<string | null> {
  if (compressed(locator)) {
    let reply: string | null = null
    for await (const raw of streamLines(locator)) {
      const found = lastCompletedReply([raw])
      if (found !== null) reply = found
    }
    return reply
  }
  const { size } = await stat(locator)
  for (const window of REPLY_WINDOWS) {
    const start = Math.max(0, size - window)
    const text = (await readRange(locator, start, size)).toString('utf8')
    const reply = lastCompletedReply(chunkLines(text, start === 0))
    if (reply !== null || start === 0) return reply
  }
  return null
}

// One pass over a whole rollout, streamed, for the details and the export.
interface Conversation {
  readonly details: Details
  // What the export shows, in order.
  readonly said: ReadonlyArray<{ readonly fromUser: boolean; text: string; tools: string[] }>
}

async function conversation(locator: string): Promise<Conversation> {
  let paginated = false
  let user = 0
  let assistant = 0
  let toolCalls = 0
  let created: string | null = null
  let lastActivity: string | null = null
  let cwd: string | null = null
  let meta = false
  const models = new Set<string>()
  const mcp = new Map<string, number>()
  const recent: RecentMessage[] = []
  const said: Array<{ fromUser: boolean; text: string; tools: string[] }> = []
  let pendingTools: string[] = []
  for await (const raw of streamLines(locator)) {
    const line = parseLine(raw)
    if (!line) continue
    const at = str(line.timestamp)
    if (at !== null) {
      created ??= at
      lastActivity = at
    }
    const event = eventOf(line, paginated)
    if (!event) continue
    switch (event.kind) {
      case 'meta':
        if (meta) break
        meta = true
        paginated = event.paginated
        cwd = event.cwd
        if (event.at !== null) created = event.at
        break
      case 'model':
        models.add(event.model)
        break
      case 'tool':
        if (event.server !== null) mcp.set(event.server, (mcp.get(event.server) ?? 0) + 1)
        if (event.name === '') break
        toolCalls += 1
        pendingTools.push(event.name)
        break
      case 'user':
      case 'agent': {
        const fromUser = event.kind === 'user'
        if (fromUser) user += 1
        else assistant += 1
        recent.push({ fromUser, text: oneLine(event.text, RECENT_CHARS) })
        if (fromUser && pendingTools.length > 0) {
          said.push({ fromUser: false, text: '', tools: pendingTools })
          pendingTools = []
        }
        said.push({ fromUser, text: event.text.trim(), tools: fromUser ? [] : pendingTools })
        if (!fromUser) pendingTools = []
        break
      }
      case 'aborted':
        break
    }
  }
  if (pendingTools.length > 0) said.push({ fromUser: false, text: '', tools: pendingTools })
  return {
    details: {
      user,
      assistant,
      toolCalls,
      models: [...models].sort(),
      created,
      lastActivity,
      cwd,
      mcpUsed: [...mcp].sort((a, b) => b[1] - a[1]),
      recent: recent.slice(-RECENT),
    },
    said,
  }
}

async function exportMarkdown(name: string, id: string, locator: string): Promise<string> {
  const { details: d, said } = await conversation(locator)
  const header = [`# ${name}`, '', `- **Session:** \`${id}\``]
  if (d.cwd) header.push(`- **Project:** \`${d.cwd}\``)
  if (d.created) header.push(`- **Created:** ${d.created}`)
  if (d.lastActivity) header.push(`- **Last activity:** ${d.lastActivity}`)
  const turns = said.flatMap(({ fromUser, text, tools }) => {
    if (fromUser) return text ? [`### You\n\n${text}`] : []
    const parts = ['### Codex']
    if (text) parts.push(text)
    if (tools.length > 0) parts.push(`*Used ${tools.map((t) => `\`${t}\``).join(', ')}*`)
    return parts.length > 1 ? [parts.join('\n\n')] : []
  })
  const body = turns.length > 0 ? turns.join('\n\n') : '_No messages._'
  return `${header.join('\n')}\n\n---\n\n${body}\n`
}

// Each rollout under `sessions/YYYY/MM/DD/`, one per thread: a plain file wins over its compressed
// sibling (both exist while Codex compresses or restores one), and of a reverted thread's files
// the one written last.
async function find(root: string): Promise<Found[]> {
  const byThread = new Map<string, Found[]>()
  for (const year of await subdirs(root))
    for (const month of await subdirs(year))
      for (const day of await subdirs(month))
        for (const file of await entries(day)) {
          const match = file.isFile() ? ROLLOUT.exec(file.name) : null
          const id = match?.[1]
          if (!id) continue
          const found: Found = { agent: 'codex', id, locator: join(day, file.name), folder: day }
          byThread.set(id, [...(byThread.get(id) ?? []), found])
        }
  const out: Found[] = []
  for (const files of byThread.values()) {
    const plain = files.filter((f) => !compressed(f.locator))
    const pick = plain.length > 0 ? plain : files
    out.push(pick.length === 1 ? (pick[0] as Found) : await latest(pick))
  }
  return out
}

async function latest(files: Found[]): Promise<Found> {
  const dated = await Promise.all(
    files.map(async (f) => ({
      f,
      at: await stat(f.locator).then(
        (s) => s.mtimeMs,
        () => -1,
      ),
    })),
  )
  dated.sort((a, b) => b.at - a.at || b.f.locator.localeCompare(a.f.locator))
  return (dated[0] as { f: Found }).f
}

// Codex's home, for `session_index.jsonl`, and every folder a rollout can appear or change in: a
// resume writes into the day folder the thread began in. Nothing while Codex has no home: its
// nearest existing ancestor would be the user's home, whose every change would rescan.
async function watchTargets(root: string): Promise<string[]> {
  const home = dirname(root)
  if (!isDir(home)) return []
  const years = await subdirs(root)
  const months = (await Promise.all(years.map(subdirs))).flat()
  const days = (await Promise.all(months.map(subdirs))).flat()
  return [...new Set([home, await nearestExisting(root), ...years, ...months, ...days])]
}

// The names in `session_index.jsonl`, read as it grows. Codex appends a line per name, a title it
// made or a rename alike; the last line for a thread wins whatever its `updated_at`, and an empty
// name clears it.
class NameIndex {
  #ino = -1
  #offset = 0
  #names = new Map<string, string>()

  async refresh(path: string, read: ReadRange): Promise<void> {
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.#ino = -1
      this.#offset = 0
      this.#names.clear()
      return
    }
    if (info.ino !== this.#ino || info.size < this.#offset) {
      this.#ino = info.ino
      this.#offset = 0
      this.#names.clear()
    }
    if (info.size === this.#offset) return
    const chunk = await read(path, this.#offset, info.size)
    const complete = chunk.lastIndexOf(0x0a) + 1
    for (const raw of chunkLines(chunk.toString('utf8', 0, complete), true)) {
      const line = parseLine(raw)
      const id = str(line?.id)
      const name = str(line?.thread_name)
      if (id === null || name === null) continue
      if (name.trim()) this.#names.set(id, name.trim())
      else this.#names.delete(id)
    }
    this.#offset += complete
  }

  name(id: string): string | null {
    return this.#names.get(id) ?? null
  }
}

interface FileState {
  ino: number
  size: number
  mtimeMs: number
  head: Head
  headFinal: boolean
  badge: Badge
}

// The rollouts read again only where they changed: the head until it is final, the tail when the
// file grew. A compressed rollout never changes; only its head is read, as a stream.
class RolloutReader implements SessionReader {
  readonly #read: ReadRange
  readonly #files = new Map<string, FileState>()
  readonly #index = new NameIndex()

  constructor(read: ReadRange) {
    this.#read = read
  }

  retain(locators: ReadonlySet<string>): void {
    for (const file of this.#files.keys()) if (!locators.has(file)) this.#files.delete(file)
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
    let state = this.#files.get(file)
    if (!state || state.ino !== info.ino || info.size < state.size) {
      state = {
        ino: info.ino,
        size: -1,
        mtimeMs: -1,
        head: emptyHead(),
        headFinal: false,
        badge: null,
      }
      this.#files.set(file, state)
    }
    const changed = state.size !== info.size || state.mtimeMs !== info.mtimeMs
    if (changed && !state.headFinal) {
      const fold = await readHead(file, info.size, this.#read)
      state.head = fold.head
      state.headFinal =
        fold.final() || fold.exhausted() || compressed(file) || info.size > HEAD_BYTES
    }
    if (changed && !compressed(file)) {
      const start = Math.max(0, info.size - TAIL_BYTES)
      state.badge = badgeOf(
        (await this.#read(file, start, info.size)).toString('utf8'),
        start === 0,
      )
    }
    state.size = info.size
    state.mtimeMs = info.mtimeMs
    if (state.head.hidden || !state.head.preview) return null

    // The rollout sits in `<home>/sessions/YYYY/MM/DD/`.
    const home = dirname(dirname(dirname(dirname(item.folder))))
    await this.#index.refresh(join(home, 'session_index.jsonl'), this.#read)
    return {
      agent: item.agent,
      id: item.id,
      file,
      folder: item.folder,
      cwd: state.head.cwd,
      preview: state.head.preview,
      badge: state.badge,
      customTitle: this.#index.name(item.id),
      aiTitle: null,
      mtimeMs: info.mtimeMs,
      size: info.size,
    }
  }
}

export const catalog: SessionCatalog = {
  root: () => join(codexHome(), 'sessions'),
  names: true,
  find,
  reader: (read) => new RolloutReader(read),
  watchTargets,
  lastReply,
  details: async (locator) => (await conversation(locator)).details,
  exportMarkdown,
  location: (locator) => locator,
  trash: null,
  transcript: null,
  turnEnd: null,
}
