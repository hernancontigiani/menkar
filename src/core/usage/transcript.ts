// What a Claude Code transcript line means for usage: the response it carries (tokens), and the
// turn and time spans it opens or closes. Transcripts are read, never written.

export const IDLE_AFTER_SECONDS = 2 * 3600
const ASKS_THE_HUMAN = new Set(['AskUserQuestion'])

export type Json = Record<string, unknown>

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ISO =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/

// Unix seconds of an ISO 8601 timestamp; a value without a zone is local time, a bare date is
// local midnight. Anything else is null.
export function parseSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO.test(value)) return null
  let text = value.replace(' ', 'T')
  if (text.length === 10) text += 'T00:00'
  const ms = Date.parse(text)
  return Number.isNaN(ms) ? null : ms / 1000
}

function count(value: unknown): number {
  return Number.isSafeInteger(value) ? (value as number) : 0
}

export interface Response {
  readonly messageId: string
  readonly requestId: string
  readonly sessionId: string
  readonly sidechain: boolean
  readonly at: number
  readonly model: string
  readonly input: number
  readonly output: number
  readonly cacheWrite: number
  readonly cacheWrite1h: number
  readonly cacheRead: number
}

export function responseTotal(r: Pick<Response, 'input' | 'output' | 'cacheWrite' | 'cacheRead'>) {
  return r.input + r.output + r.cacheWrite + r.cacheRead
}

// The tokens an assistant line reports, keyed for deduplication: a response is written once per
// content block and copied into resumed and forked transcripts.
export function responseOf(entry: Json, sessionId: string): Response | null {
  if (entry.type !== 'assistant' || entry.isApiErrorMessage) return null
  const message = entry.message
  if (!isObject(message)) return null
  const { id, model, usage } = message
  if (typeof id !== 'string' || !isObject(usage) || model === '<synthetic>') return null
  const stamp = typeof entry.timestamp === 'string' ? entry.timestamp : ''
  const at = parseSeconds(stamp) ?? 0
  let requestId = entry.requestId
  if (typeof requestId !== 'string' || requestId === '') {
    // Ids from the API ("msg_…") are unique; anything else may repeat and also needs its time.
    requestId = `none:${sessionId}${id.startsWith('msg_') ? '' : `:${stamp}`}`
  }
  const creation = isObject(usage.cache_creation) ? usage.cache_creation : {}
  return {
    messageId: id,
    requestId: requestId as string,
    sessionId,
    sidechain: Boolean(entry.isSidechain),
    at,
    model: typeof model === 'string' ? model : '',
    input: count(usage.input_tokens),
    output: count(usage.output_tokens),
    cacheWrite: count(usage.cache_creation_input_tokens),
    cacheWrite1h: count(creation.ephemeral_1h_input_tokens),
    cacheRead: count(usage.cache_read_input_tokens),
  }
}

// Claude's own name for the session: given (`-n`, `/rename`) or generated.
export function nameOf(entry: Json): { name: string; given: boolean } | null {
  if (entry.type === 'custom-title' && typeof entry.customTitle === 'string') {
    const name = entry.customTitle.trim()
    return name ? { name, given: true } : null
  }
  if (entry.type === 'ai-title' && typeof entry.aiTitle === 'string') {
    const name = entry.aiTitle.trim()
    return name ? { name, given: false } : null
  }
  return null
}

export type SpanKind = 'execution' | 'blocked'

export interface ClosedSpan {
  readonly turn: string
  readonly origin: string
  readonly kind: SpanKind
  readonly start: number
  readonly end: number
}

export interface TurnState {
  origin: string | null
  last: number | null
  // tool_use id → [when it was called, whether the tool asks the human]
  pending: Record<string, [number, boolean]>
  uuid: string | null
  // the file has shown a `turnOrigin`: from then on only those open turns
  marked: boolean
}

export function freshTurn(): TurnState {
  return { origin: null, last: null, pending: {}, uuid: null, marked: false }
}

export function loadTurn(text: string | null): TurnState {
  if (!text) return freshTurn()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return freshTurn()
  }
  if (!isObject(data)) return freshTurn()
  const pending: Record<string, [number, boolean]> = {}
  if (isObject(data.pending)) {
    for (const [id, value] of Object.entries(data.pending)) {
      if (Array.isArray(value) && typeof value[0] === 'number')
        pending[id] = [value[0], Boolean(value[1])]
    }
  }
  return {
    origin: typeof data.origin === 'string' ? data.origin : null,
    last: typeof data.last === 'number' ? data.last : null,
    pending,
    uuid: typeof data.uuid === 'string' ? data.uuid : null,
    marked: Boolean(data.marked),
  }
}

export function dumpTurn(state: TurnState): string {
  return JSON.stringify(state)
}

function open(state: TurnState, entry: Json, origin: string, at: number): void {
  const uuid = entry.uuid
  state.uuid =
    typeof uuid === 'string' && uuid !== ''
      ? uuid
      : `none:${typeof entry.sessionId === 'string' ? entry.sessionId : ''}:${String(entry.timestamp)}`
  state.origin = origin
  state.last = at
  state.pending = {}
}

// Advances the turn being read by one transcript line and returns the spans that line closes.
// Execution is the sum of the gaps between consecutive agent activities (responses and tool
// results), a gap over two hours being idle; a tool call the human decided, or a tool that asks
// the human, is blocked time instead, however long.
export function feed(state: TurnState, entry: Json): ClosedSpan[] {
  const at = parseSeconds(entry.timestamp)
  if (at === null) return []
  const message = isObject(entry.message) ? entry.message : {}
  const blocks = Array.isArray(message.content) ? (message.content as unknown[]) : []
  const isUser = entry.type === 'user'
  const isResult =
    isUser &&
    ((entry.toolUseResult !== undefined && entry.toolUseResult !== null) ||
      blocks.some((b) => isObject(b) && b.type === 'tool_result'))
  if (isUser && typeof entry.turnOrigin === 'string') {
    state.marked = true
    open(state, entry, entry.turnOrigin, at)
    return []
  }
  if (!state.marked && isUser && !isResult && !entry.isMeta && !entry.isSidechain) {
    // Written before Claude Code recorded who started a turn: a prompt opens one, by whom unknown.
    open(state, entry, 'unknown', at)
    return []
  }
  if (state.origin === null || state.last === null || state.uuid === null) return []
  if (entry.type === 'assistant') {
    for (const block of blocks) {
      if (isObject(block) && block.type === 'tool_use' && typeof block.id === 'string') {
        state.pending[block.id] = [at, ASKS_THE_HUMAN.has(String(block.name))]
      }
    }
  } else if (isResult) {
    const decision = entry.permissionDecision
    const humanDecided = isObject(decision) && String(decision.source ?? '').startsWith('user')
    for (const block of blocks) {
      if (!isObject(block) || block.type !== 'tool_result') continue
      const id = String(block.tool_use_id)
      const asked = state.pending[id]
      if (asked === undefined) continue
      delete state.pending[id]
      if (asked[1] || humanDecided) {
        state.last = at
        return [
          { turn: state.uuid, origin: state.origin, kind: 'blocked', start: asked[0], end: at },
        ]
      }
    }
  } else {
    return [] // not an agent activity: meta entries, notes, commands
  }
  const spans: ClosedSpan[] = []
  if (at - state.last <= IDLE_AFTER_SECONDS) {
    spans.push({
      turn: state.uuid,
      origin: state.origin,
      kind: 'execution',
      start: state.last,
      end: at,
    })
  }
  state.last = at
  return spans
}
