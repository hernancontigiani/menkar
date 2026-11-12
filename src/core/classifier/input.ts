import { CATEGORIES, type Category, PREAMBLE, SYSTEM_PROMPT } from './prompt.ts'

// What is sent for one turn, before it is shaped.
export interface TurnText {
  readonly prompt: string
  // the human's previous prompt in the session, or ''
  readonly previous: string
  // the agent's tool_use blocks after the prompt
  readonly tools: readonly Record<string, unknown>[]
}

// Lengths and cuts in code points, as the evaluation counted them, so the text measured is the text
// sent.
const chars = (text: string): string[] => Array.from(text)
const head = (text: string, n: number) => chars(text).slice(0, n).join('')
const tail = (text: string, n: number) => chars(text).slice(-n).join('')
const length = (text: string) => chars(text).length

export function shapePrompt(turn: TurnText): string {
  let text = turn.prompt.trim()
  if (length(text) > 1500) text = `${head(text, 750)}\n[...]\n${tail(text, 750)}`
  if (length(text) < 40 && turn.previous)
    text = `previous: ${head(turn.previous, 300)}\nprompt: ${text}`
  return text
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The tools the agent called: the first 12, each "<name>: <file, command or pattern>". Their
// results, the assistant's text and their other inputs are never sent.
export function toolsLine(turn: TurnText): string {
  const out = turn.tools.slice(0, 12).map((block) => {
    const input = isObject(block.input) ? block.input : {}
    const detail = input.file_path || input.command || input.pattern || ''
    return `${String(block.name)}: ${head(String(detail).replaceAll('\n', ' '), 70)}`
  })
  return out.join('; ') || '(none)'
}

// JSON with the separators Python's json.dumps uses (", " and ": "), as the measured input had.
function pythonJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pythonJson).join(', ')}]`
  if (isObject(value)) {
    return `{${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}: ${pythonJson(v)}`)
      .join(', ')}}`
  }
  return JSON.stringify(value)
}

// The text sent for a batch: an index for each turn, never its uuid nor its session's id or name.
export function batchInput(turns: readonly TurnText[]): string {
  const items = turns.map((turn, id) => ({
    id,
    previous: head(turn.previous, 300),
    prompt: shapePrompt(turn),
    tools: toolsLine(turn),
  }))
  return PREAMBLE + pythonJson(items)
}

// The batch index → category for each answer that is one of the seven; anything else is no answer.
export function parseReply(stdout: string, count: number): Map<number, Category> {
  const picked = new Map<number, Category>()
  let answers: unknown
  try {
    const envelope: unknown = JSON.parse(stdout)
    const body = isObject(envelope) && typeof envelope.result === 'string' ? envelope.result : ''
    const found = /\[[\s\S]*\]/.exec(body)
    answers = found ? JSON.parse(found[0]) : []
  } catch {
    return picked // an output that is not the JSON expected answers nothing
  }
  if (!Array.isArray(answers)) return picked
  for (const answer of answers) {
    if (!isObject(answer)) continue
    const { id, category } = answer
    if (
      typeof id === 'number' &&
      Number.isInteger(id) &&
      id >= 0 &&
      id < count &&
      (CATEGORIES as readonly unknown[]).includes(category)
    ) {
      picked.set(id, category as Category)
    }
  }
  return picked
}

// Haiku in print mode, with no tools, no saved session, no MCP server of the user's, and the
// classifier's own prompt. Not --bare: it needs an API key and ignores the user's login.
export function command(): readonly string[] {
  return [
    '-p',
    '--model',
    'haiku',
    '--output-format',
    'json',
    '--tools',
    '',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--system-prompt',
    SYSTEM_PROMPT,
  ]
}

const TELEMETRY_OFF = {
  DISABLE_TELEMETRY: '1',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  DISABLE_ERROR_REPORTING: '1',
}

// The app's environment without what would make `claude` think it runs inside a session.
export function environment(
  base: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE_')) continue
    env[key] = value
  }
  return { ...env, ...TELEMETRY_OFF }
}
