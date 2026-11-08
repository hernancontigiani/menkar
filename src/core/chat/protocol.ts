// What a chat process is started with, what is written to it, and what its stdout lines mean. No
// Node import.
import type { ChatVariant } from './variants'

export type ChatEvent =
  | { readonly kind: 'session'; readonly id: string }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'tool'; readonly name: string }
  | {
      readonly kind: 'permission'
      readonly requestId: string
      readonly tool: string
      readonly title: string
      readonly body: string | null
      readonly input: Readonly<Record<string, unknown>>
    }
  | { readonly kind: 'rateLimited' }
  | { readonly kind: 'turnEnd' }
  | { readonly kind: 'error'; readonly message: string }

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Claude: one process per chat tab, the permission prompt routed to the app (without it the default
// mode would deny every tool silently), none of the terminal session's flags.
export function claudeArgs(resume: string | null): string[] {
  return [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--permission-mode',
    'default',
    '--permission-prompt-tool',
    'stdio',
    ...(resume ? ['--resume', resume] : []),
  ]
}

// Cursor: one process per sent message; `ask` is read-only, `trusted` runs edits and commands.
export function cursorArgs(variant: ChatVariant, resume: string | null, message: string): string[] {
  return [
    '-p',
    '--output-format',
    'stream-json',
    '--stream-partial-output',
    '--trust',
    ...(resume ? ['--resume', resume] : []),
    ...(variant.key === 'trusted' ? ['--force'] : ['--mode', 'ask']),
    message,
  ]
}

export function userLine(text: string): string {
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } })}\n`
}

export function allowLine(requestId: string, input: Readonly<Record<string, unknown>>): string {
  return `${JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: { behavior: 'allow', updatedInput: input },
    },
  })}\n`
}

export function denyLine(requestId: string, message: string): string {
  return `${JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: { behavior: 'deny', message },
    },
  })}\n`
}

// The body of a permission card: the request's description, else the first useful input field.
export function permissionBody(description: unknown, input: Json): string | null {
  if (typeof description === 'string' && description.trim()) return description.trim()
  for (const key of ['command', 'file_path', 'path', 'pattern', 'url', 'prompt']) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function parseLine(line: string): Json | null {
  if (!line.trim()) return null
  try {
    const value: unknown = JSON.parse(line)
    return isObject(value) ? value : null
  } catch {
    return null // not JSON: skipped
  }
}

const errorText = (data: Json): string =>
  typeof data.result === 'string' && data.result
    ? data.result
    : data.api_error_status !== undefined && data.api_error_status !== null
      ? String(data.api_error_status)
      : 'error'

export function claudeEvents(line: string): ChatEvent[] {
  const data = parseLine(line)
  if (data === null) return []
  if (data.type === 'system' && data.subtype === 'init' && typeof data.session_id === 'string') {
    return [{ kind: 'session', id: data.session_id }]
  }
  if (data.type === 'stream_event' && isObject(data.event)) {
    const event = data.event
    if (event.type === 'content_block_start' && isObject(event.content_block)) {
      const block = event.content_block
      return block.type === 'tool_use' ? [{ kind: 'tool', name: String(block.name ?? '') }] : []
    }
    if (event.type === 'content_block_delta' && isObject(event.delta)) {
      const delta = event.delta
      return delta.type === 'text_delta' && typeof delta.text === 'string'
        ? [{ kind: 'text', text: delta.text }]
        : []
    }
    return []
  }
  if (
    data.type === 'control_request' &&
    isObject(data.request) &&
    data.request.subtype === 'can_use_tool'
  ) {
    const request = data.request
    const input = isObject(request.input) ? request.input : {}
    const tool = String(request.tool_name ?? '')
    const display =
      typeof request.display_name === 'string' && request.display_name ? request.display_name : tool
    return [
      {
        kind: 'permission',
        requestId: String(data.request_id ?? ''),
        tool,
        title: display,
        body: permissionBody(request.description, input),
        input,
      },
    ]
  }
  if (data.type === 'rate_limit_event' && isObject(data.rate_limit_info)) {
    return data.rate_limit_info.status === 'allowed' ? [] : [{ kind: 'rateLimited' }]
  }
  if (data.type === 'result') {
    return data.is_error
      ? [{ kind: 'error', message: errorText(data) }, { kind: 'turnEnd' }]
      : [{ kind: 'turnEnd' }]
  }
  return []
}

export function cursorEvents(line: string): ChatEvent[] {
  const data = parseLine(line)
  if (data === null) return []
  if (data.type === 'system' && data.subtype === 'init' && typeof data.session_id === 'string') {
    return [{ kind: 'session', id: data.session_id }]
  }
  // The final whole message repeats what streamed; only the streamed pieces carry a timestamp.
  if (data.type === 'assistant' && data.timestamp_ms !== undefined && isObject(data.message)) {
    const content = Array.isArray(data.message.content) ? data.message.content : []
    const text = content
      .filter((b): b is Json => isObject(b) && b.type === 'text' && typeof b.text === 'string')
      .map((b) => String(b.text))
      .join('')
    return text ? [{ kind: 'text', text }] : []
  }
  if (data.type === 'tool_call' && data.subtype === 'started' && isObject(data.tool_call)) {
    const key = Object.keys(data.tool_call).find((k) => k.endsWith('ToolCall'))
    if (!key) return []
    const name = key.slice(0, -'ToolCall'.length)
    return [{ kind: 'tool', name: name.charAt(0).toUpperCase() + name.slice(1) }]
  }
  if (data.type === 'result') {
    return data.is_error
      ? [{ kind: 'error', message: errorText(data) }, { kind: 'turnEnd' }]
      : [{ kind: 'turnEnd' }]
  }
  return []
}

// Stdout arrives in pieces: a partial line waits for the rest.
export class LineSplitter {
  private pending = ''
  push(chunk: string): string[] {
    this.pending += chunk
    const lines = this.pending.split('\n')
    this.pending = lines.pop() ?? ''
    return lines
  }
}
