// Transcript lines as Claude Code and Cursor write them, built from the shapes the spec records.
// Synthetic only: no line here comes from a real session.

export type Line = Record<string, unknown>

export const ID = '1b4e28ba-2fa1-11d2-883f-0016d3cca427'
export const ID2 = '9c2d5f10-3e4b-4c5d-8e6f-7a8b9c0d1e2f'

type Block = { type: 'text'; text: string } | { type: 'tool_use'; name: string; input?: unknown }

export const text = (value: string): Block => ({ type: 'text', text: value })
export const toolUse = (name: string, input: unknown = {}): Block => ({
  type: 'tool_use',
  name,
  input,
})

export function user(content: string | Block[] | Line[], extra: Line = {}): Line {
  return { type: 'user', message: { role: 'user', content }, ...extra }
}

export function toolResult(): Line {
  return user([{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }])
}

export function assistant(content: string | Block[], extra: Line = {}): Line {
  return { type: 'assistant', message: { role: 'assistant', content }, ...extra }
}

export const customTitle = (name: string): Line => ({
  type: 'custom-title',
  customTitle: name,
  sessionId: ID,
})

export const aiTitle = (title: string): Line => ({
  type: 'ai-title',
  aiTitle: title,
  sessionId: ID,
})

export const cursorUser = (query: string): Line => ({
  role: 'user',
  message: { content: [text(`<user_query>\n${query}\n</user_query>`)] },
})

export const cursorAssistant = (value: string): Line => ({
  role: 'assistant',
  message: { content: [text(value)] },
})

export function jsonl(lines: Array<Line | string>): string {
  const body = lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
  return `${body.join('\n')}\n`
}
