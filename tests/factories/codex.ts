// Codex rollout lines in the shapes codex-cli 0.169.0 writes, for tests that build a rollout at run
// time. Times are seconds since the epoch.
import { mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'

export const THREAD = '019a6000-0000-7000-8000-0000000000aa'

const iso = (seconds: number) => new Date(seconds * 1000).toISOString()
const line = (seconds: number, type: string, payload: object) =>
  JSON.stringify({ timestamp: iso(seconds), type, payload })

export const rolloutName = (thread: string, compressed = false) =>
  `rollout-2026-11-08T09-00-00-${thread}.jsonl${compressed ? '.zst' : ''}`

export function codexHome(name: string): { root: string; sessions: string; day: string } {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', `codex-${name}-`))
  const sessions = join(root, 'sessions')
  const day = join(sessions, '2026', '11', '08')
  mkdirSync(day, { recursive: true })
  return { root, sessions, day }
}

export const tokens = (input: number, cached: number, output: number) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: 0,
  total_tokens: input + output,
})

export const meta = (at: number, thread = THREAD, extra: object = {}) =>
  line(at, 'session_meta', {
    id: thread,
    session_id: thread,
    cwd: '/home/demo/api',
    source: 'cli',
    thread_source: 'user',
    history_mode: 'paginated',
    ...extra,
  })

export const context = (at: number, turn: string, model = 'gpt-6.1-sol') =>
  line(at, 'turn_context', { turn_id: turn, cwd: '/home/demo/api', model })

export const started = (at: number, turn: string) =>
  line(at, 'event_msg', { type: 'task_started', turn_id: turn, model_context_window: 258400 })

export const typed = (at: number, turn: string, text: string, thread = THREAD) =>
  line(at, 'event_msg', {
    type: 'item_completed',
    thread_id: thread,
    turn_id: turn,
    item: { type: 'UserMessage', content: [{ type: 'text', text }] },
  })

export const shell = (at: number, turn: string, command: string[], thread = THREAD) =>
  line(at, 'event_msg', {
    type: 'item_completed',
    thread_id: thread,
    turn_id: turn,
    item: { type: 'CommandExecution', command },
  })

export const record = (
  at: number,
  turn: string,
  response: string,
  usage: ReturnType<typeof tokens>,
  thread = THREAD,
) =>
  line(at, 'token_usage_record', {
    thread_id: thread,
    turn_id: turn,
    session_id: thread,
    root_turn_id: turn,
    response_id: response,
    usage,
  })

export const count = (
  at: number,
  total: ReturnType<typeof tokens>,
  last: ReturnType<typeof tokens>,
  window = 258400,
) =>
  line(at, 'event_msg', {
    type: 'token_count',
    info: { total_token_usage: total, last_token_usage: last, model_context_window: window },
    rate_limits: null,
  })

export const completed = (at: number, turn: string) =>
  line(at, 'event_msg', { type: 'task_complete', turn_id: turn, last_agent_message: 'done' })

export const rollout = (lines: readonly string[]) => `${lines.join('\n')}\n`
