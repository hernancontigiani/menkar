import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { agentPaths } from '../../paths'
import type { Badge, Details, Head, RecentMessage } from '../../sessions/details'
import { lastReply, onlyTeamUpdates, reportClosedTurn } from '../../sessions/lastreply'
import {
  applyNameLines,
  chunkLines,
  entries,
  field,
  firstCwd,
  HEAD_LINES,
  JsonlReader,
  type Line,
  markdownExport,
  messageText,
  nameLines,
  nearestExisting,
  parseLine,
  subdirs,
  textLines,
  toolUses,
} from '../shared/jsonl'
import type { Found, SessionCatalog, TranscriptReading } from '../types'

const UUID_JSONL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/
const PREVIEW_CHARS = 120
const INTERRUPTED = '[Request interrupted by user'
const RECENT = 12
const RECENT_CHARS = 500

// A message the user typed: text, trimmed, not empty and not injected (`<…>`).
function typed(line: Line): string | null {
  if (line.type !== 'user') return null
  const text = messageText(line)?.trim()
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
    if (!preview && line.type === 'user') {
      const said = messageText(line)?.trim()
      if (said && !said.startsWith('<')) preview = said.replace(/\s+/g, ' ').slice(0, PREVIEW_CHARS)
    }
    if (preview && cwd !== null) break
  }
  return { cwd, preview }
}

function badge(tail: string, fromStart: boolean): Badge {
  let latest: 'interrupted' | 'assistant' | 'user' | null = null
  let assistantText = ''
  for (const raw of chunkLines(tail, fromStart)) {
    const line = parseLine(raw)
    if (!line) continue
    const content = messageText(line)
    if (content === null) continue
    if (content.includes(INTERRUPTED)) {
      latest = 'interrupted'
    } else if (line.type === 'assistant') {
      latest = 'assistant'
      assistantText = content
    } else if (line.type === 'user') {
      if (!content.trim().startsWith('<')) latest = 'user'
    }
  }
  if (latest === 'interrupted') return 'interrupted'
  if (latest === 'assistant' && assistantText.trimEnd().endsWith('?')) return 'waiting'
  return null
}

function details(text: string): Details {
  let user = 0
  let assistant = 0
  let toolCalls = 0
  let created: string | null = null
  let lastActivity: string | null = null
  let cwd: string | null = null
  const models = new Set<string>()
  const mcp = new Map<string, number>()
  const recent: RecentMessage[] = []
  for (const line of textLines(text)) {
    if (cwd === null && typeof line.cwd === 'string') cwd = line.cwd
    if (typeof line.timestamp === 'string') {
      created ??= line.timestamp
      lastActivity = line.timestamp
    }
    const userText = typed(line)
    if (userText !== null) {
      user += 1
      recent.push({ fromUser: true, text: userText.replace(/\s+/g, ' ').slice(0, RECENT_CHARS) })
    }
    if (line.type === 'assistant') {
      assistant += 1
      const model = field(line.message, 'model')
      if (typeof model === 'string' && !model.startsWith('<')) models.add(model)
      const said = messageText(line)
      if (said)
        recent.push({ fromUser: false, text: said.replace(/\s+/g, ' ').slice(0, RECENT_CHARS) })
      for (const use of toolUses(line)) {
        toolCalls += 1
        const name = field(use, 'name')
        const server = typeof name === 'string' ? /^mcp__(.+?)__/.exec(name)?.[1] : undefined
        if (server) mcp.set(server, (mcp.get(server) ?? 0) + 1)
      }
    }
  }
  return {
    user,
    assistant,
    toolCalls,
    models: [...models].sort(),
    created,
    lastActivity,
    cwd,
    mcpUsed: [...mcp].sort((a, b) => b[1] - a[1]),
    recent: recent.slice(-RECENT),
  }
}

const transcript: TranscriptReading = {
  head,
  headFinal: (read) => read.preview !== '' && read.cwd !== null,
  badge,
  titles: {
    slice: (chunk, complete, prev) => ({
      names: applyNameLines(prev.names, nameLines(chunk, complete)),
      laterCwd: prev.laterCwd ?? firstCwd(chunk, complete),
    }),
  },
  details,
  exportMarkdown: (name, id, text) =>
    markdownExport(name, id, text, details(text), 'Claude', typed, (l) => l.type === 'assistant'),
}

// A session is a non-empty `<uuid>.jsonl` directly in a project folder; the folders beside it
// (subagents/, tool-results/) are not sessions.
async function find(projects: string): Promise<Found[]> {
  const found: Found[] = []
  for (const folder of await entries(projects)) {
    if (!folder.isDirectory()) continue
    const dir = join(projects, folder.name)
    for (const file of await entries(dir)) {
      if (file.isFile() && UUID_JSONL.test(file.name)) {
        found.push({
          agent: 'claude',
          id: file.name.slice(0, -'.jsonl'.length),
          locator: join(dir, file.name),
          folder: dir,
        })
      }
    }
  }
  return found
}

export const catalog: SessionCatalog = {
  root: () => agentPaths().claudeProjects,
  names: true,
  find,
  reader: (read) => new JsonlReader(transcript, read),
  // The projects directory and each folder in it. Not recursive: a session's subagents/ and
  // tool-results/ churn constantly and are not sessions.
  watchTargets: async (root) => [await nearestExisting(root), ...(await subdirs(root))],
  lastReply,
  details: async (locator) => details(await readFile(locator, 'utf8')),
  exportMarkdown: async (name, id, locator) =>
    transcript.exportMarkdown(name, id, await readFile(locator, 'utf8')),
  location: (locator) => locator,
  // The .jsonl alone: its sibling directory (subagents/, tool-results/) stays.
  trash: { target: (locator) => locator },
  transcript,
  turnEnd: { onlyTeamUpdates, reportedTo: reportClosedTurn },
  close: null,
}
