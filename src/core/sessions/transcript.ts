import { type Agent, cursorUserText, type Line, messageText, parseLine, role } from './lines'

// What the session menus read from a whole transcript: details, export, replay. Pure functions
// over the file's text; the caller reads it off the UI path.

const lines = (file: string) =>
  file
    .split('\n')
    .flatMap((raw) => (raw ? [parseLine(raw)].filter((l): l is Line => l !== null) : []))

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined

const blocks = (line: Line): unknown[] => {
  const content = field(line.message, 'content')
  return Array.isArray(content) ? content : []
}

const toolUses = (line: Line) => blocks(line).filter((b) => field(b, 'type') === 'tool_use')

// A message the user typed: text, trimmed, not empty and not injected (`<…>`).
function typed(line: Line, agent: Agent): string | null {
  if (role(line, agent) !== 'user') return null
  const raw = messageText(line)
  const text = (agent === 'cursor' && raw !== null ? cursorUserText(raw) : raw)?.trim()
  return text && !text.startsWith('<') ? text : null
}

export interface RecentMessage {
  readonly fromUser: boolean
  readonly text: string
}

export interface Details {
  readonly user: number
  readonly assistant: number
  readonly toolCalls: number
  readonly models: readonly string[]
  readonly created: string | null
  readonly lastActivity: string | null
  readonly cwd: string | null
  // [server, count], most used first.
  readonly mcpUsed: ReadonlyArray<readonly [string, number]>
  readonly recent: readonly RecentMessage[]
}

const RECENT = 12
const RECENT_CHARS = 500

export function details(file: string, agent: Agent): Details {
  let user = 0
  let assistant = 0
  let toolCalls = 0
  let created: string | null = null
  let lastActivity: string | null = null
  let cwd: string | null = null
  const models = new Set<string>()
  const mcp = new Map<string, number>()
  const recent: RecentMessage[] = []
  for (const line of lines(file)) {
    if (cwd === null && typeof line.cwd === 'string') cwd = line.cwd
    if (agent === 'claude' && typeof line.timestamp === 'string') {
      created ??= line.timestamp
      lastActivity = line.timestamp
    }
    const kind = role(line, agent)
    if (agent === 'cursor') {
      if (kind === 'user') user += 1
      if (kind === 'assistant') assistant += 1
      const text = messageText(line)
      if ((kind === 'user' || kind === 'assistant') && text) {
        recent.push({
          fromUser: kind === 'user',
          text: kind === 'user' ? cursorUserText(text).trim() : text,
        })
      }
      continue
    }
    const userText = typed(line, agent)
    if (userText !== null) {
      user += 1
      recent.push({ fromUser: true, text: userText.replace(/\s+/g, ' ').slice(0, RECENT_CHARS) })
    }
    if (kind === 'assistant') {
      assistant += 1
      const model = field(line.message, 'model')
      if (typeof model === 'string' && !model.startsWith('<')) models.add(model)
      const text = messageText(line)
      if (text)
        recent.push({ fromUser: false, text: text.replace(/\s+/g, ' ').slice(0, RECENT_CHARS) })
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

// The name with every character that is not a letter, digit, space, `-` or `_` replaced by `_`.
export function safeFileName(name: string): string {
  const safe = name.replace(/[^\p{L}\p{N} _-]/gu, '_').trim()
  return `${safe || 'session'}.md`
}

export function exportMarkdown(name: string, id: string, file: string, agent: Agent): string {
  const all = lines(file)
  const d = details(file, agent)
  const header = [`# ${name}`, '', `- **Session:** \`${id}\``]
  if (d.cwd) header.push(`- **Project:** \`${d.cwd}\``)
  if (d.created) header.push(`- **Created:** ${d.created}`)
  if (d.lastActivity) header.push(`- **Last activity:** ${d.lastActivity}`)
  const agentName = agent === 'claude' ? 'Claude' : 'Cursor'
  const turns: string[] = []
  for (const line of all) {
    const userText = typed(line, agent)
    if (userText !== null) {
      turns.push(`### You\n\n${userText}`)
      continue
    }
    if (role(line, agent) !== 'assistant') continue
    const text = messageText(line)?.trim() ?? ''
    const tools = toolUses(line).map((use) => `\`${String(field(use, 'name'))}\``)
    if (!text && tools.length === 0) continue
    const parts = [`### ${agentName}`]
    if (text) parts.push(text)
    if (tools.length > 0) parts.push(`*Used ${tools.join(', ')}*`)
    turns.push(parts.join('\n\n'))
  }
  const bodyText = turns.length > 0 ? turns.join('\n\n') : '_No messages._'
  return `${header.join('\n')}\n\n---\n\n${bodyText}\n`
}

export interface Turn {
  readonly kind: 'user' | 'assistant' | 'tool'
  readonly text: string
}

const DROPPED = new Set(['No response requested.', '(no content)'])
const basename = (path: unknown) => (typeof path === 'string' ? (path.split('/').pop() ?? '') : '')

function chip(use: unknown): Turn {
  const name = String(field(use, 'name') ?? '')
  const input = field(use, 'input')
  let summary = name
  if (['Edit', 'Write', 'Read', 'NotebookEdit'].includes(name)) {
    const file = basename(field(input, 'file_path') ?? field(input, 'notebook_path'))
    if (file) summary = `${name} ${file}`
  } else if (name === 'Bash' && typeof field(input, 'command') === 'string') {
    summary = `Bash: ${String(field(input, 'command')).replace(/\s+/g, ' ').slice(0, 60)}`
  } else if ((name === 'Grep' || name === 'Glob') && typeof field(input, 'pattern') === 'string') {
    summary = `${name} ${String(field(input, 'pattern'))}`
  } else if (name === 'Task' && typeof field(input, 'description') === 'string') {
    summary = `Task: ${String(field(input, 'description'))}`
  }
  return { kind: 'tool', text: `🔧 ${summary}` }
}

function question(use: unknown): Turn {
  const first = (field(field(use, 'input'), 'questions') as unknown[] | undefined)?.[0]
  const header = field(first, 'header')
  const options = (field(first, 'options') as unknown[] | undefined) ?? []
  const text = [
    `❓ ${typeof header === 'string' && header ? header : 'Question'}`,
    String(field(first, 'question') ?? ''),
    ...options.map((o) => `- ${String(field(o, 'label') ?? '')}`),
  ]
  return { kind: 'assistant', text: text.join('\n') }
}

export function replayTurns(file: string, agent: Agent): Turn[] {
  const turns: Turn[] = []
  for (const line of lines(file)) {
    const userText = typed(line, agent)
    if (userText !== null) {
      turns.push({ kind: 'user', text: userText })
      continue
    }
    if (role(line, agent) !== 'assistant') continue
    if (agent === 'cursor') {
      const text = messageText(line)?.trim()
      if (text && !text.startsWith('<')) turns.push({ kind: 'assistant', text })
      continue
    }
    const content = field(line.message, 'content')
    const list =
      typeof content === 'string'
        ? [{ type: 'text', text: content }]
        : Array.isArray(content)
          ? content
          : []
    let bubble: string[] = []
    const close = () => {
      const text = bubble.join(' ').trim()
      if (text && !DROPPED.has(text)) turns.push({ kind: 'assistant', text })
      bubble = []
    }
    for (const block of list) {
      const type = field(block, 'type')
      if (type === 'text' && typeof field(block, 'text') === 'string')
        bubble.push(String(field(block, 'text')))
      else if (type === 'tool_use') {
        close()
        turns.push(field(block, 'name') === 'AskUserQuestion' ? question(block) : chip(block))
      }
    }
    close()
  }
  return turns
}
