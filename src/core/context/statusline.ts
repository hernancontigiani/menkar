// Claude Code's statusline command for the sessions Menkar knows about. Claude Code runs it after
// each assistant message with the session's state as one JSON object on stdin, and shows what it
// prints as the bar. On the way it leaves the session's latest context reading and one usage line
// for the app.
//
// It runs inside Claude Code's process tree, whether or not Menkar is running: its imports are
// limited to Node's own modules and two of Menkar's that import nothing else, so the file also runs
// as it is under Node (the tests do so). It never fails: a statusline that errors shows an error
// in every Claude session, so a bad payload still exits 0 with a bar.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { now } from '../clock.ts'
import { appDirs } from '../paths.ts'

export const FALLBACK = 'menkar'
// Claude Code cancels a statusline run when the next trigger comes.
export const CHAINED_TIMEOUT_MS = 2000

// The keys of the session file, in the order written; the app's reader takes its names from here.
export const SESSION_KEYS = [
  'session_id',
  'session_name',
  'transcript_path',
  'cwd',
  'model',
  'percentage',
  'window',
  'input_tokens',
  'updated_at',
] as const

// The keys of one usage line; the usage report reads some of them.
export const USAGE_KEYS = [
  'at',
  'session_id',
  'cwd',
  'model',
  'cost_usd',
  'lines_added',
  'lines_removed',
  'five_hour_pct',
  'seven_day_pct',
] as const

export const sessionsDir = (): string => join(appDirs().cache, 'sessions')
export const usageLogFile = (): string => join(appDirs().cache, 'usage.jsonl')
export const chainedStatuslineFile = (): string => join(appDirs().config, 'chained-statusline.json')

type Payload = Record<string, unknown>

function isObject(value: unknown): value is Payload {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// A nested key whose parent is missing or not an object reads as null.
function get(payload: Payload, ...keys: string[]): unknown {
  let value: unknown = payload
  for (const key of keys) {
    if (!isObject(value)) return null
    value = value[key]
  }
  return value ?? null
}

export function sessionRecord(
  payload: Payload,
  stamp: string,
): Record<(typeof SESSION_KEYS)[number], unknown> {
  return {
    session_id: get(payload, 'session_id'),
    session_name: get(payload, 'session_name'),
    transcript_path: get(payload, 'transcript_path'),
    cwd: get(payload, 'cwd'),
    model: get(payload, 'model', 'id'),
    percentage: get(payload, 'context_window', 'used_percentage'),
    window: get(payload, 'context_window', 'context_window_size'),
    input_tokens: get(payload, 'context_window', 'total_input_tokens'),
    updated_at: stamp,
  }
}

export function usageRecord(
  payload: Payload,
  stamp: string,
): Record<(typeof USAGE_KEYS)[number], unknown> {
  return {
    at: stamp,
    session_id: get(payload, 'session_id'),
    cwd: get(payload, 'cwd'),
    model: get(payload, 'model', 'id'),
    cost_usd: get(payload, 'cost', 'total_cost_usd'),
    lines_added: get(payload, 'cost', 'total_lines_added'),
    lines_removed: get(payload, 'cost', 'total_lines_removed'),
    five_hour_pct: get(payload, 'rate_limits', 'five_hour', 'used_percentage'),
    seven_day_pct: get(payload, 'rate_limits', 'seven_day', 'used_percentage'),
  }
}

// Rounded half to even, as agent-tablet's bar printed.
function fixed(value: number, digits: number): string {
  const scaled = value * 10 ** digits
  const floor = Math.floor(scaled)
  const rounded =
    Math.abs(scaled - floor - 0.5) < 1e-9
      ? floor % 2 === 0
        ? floor
        : floor + 1
      : Math.round(scaled)
  return (rounded / 10 ** digits).toFixed(digits)
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

// Menkar's own bar: the session's name, else the start of its id; its context and its cost.
export function bar(payload: Payload): string {
  const name = get(payload, 'session_name')
  const id = get(payload, 'session_id')
  const parts = [
    typeof name === 'string' && name !== ''
      ? name
      : typeof id === 'string' && id !== ''
        ? id.slice(0, 8)
        : FALLBACK,
  ]
  const percentage = get(payload, 'context_window', 'used_percentage')
  if (isNumber(percentage)) parts.push(`${fixed(percentage, 0)}%`)
  const cost = get(payload, 'cost', 'total_cost_usd')
  if (isNumber(cost)) parts.push(`$${fixed(cost, 2)}`)
  return parts.join(' · ')
}

// UTC with its offset and microseconds, as agent-tablet wrote it: 2026-11-08T14:03:21.512000+00:00.
function stamp(): string {
  return new Date(now()).toISOString().replace('Z', '000+00:00')
}

function writeAtomically(path: string, dir: string, text: string): void {
  mkdirSync(dir, { recursive: true })
  const temporary = join(dir, `.tmp-${randomBytes(6).toString('hex')}`)
  try {
    writeFileSync(temporary, text)
    renameSync(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

export function record(payload: Payload): void {
  const sessionId = payload.session_id
  // A path separator in the id would escape the sessions directory.
  if (typeof sessionId !== 'string' || sessionId === '' || sessionId.includes('/')) return
  const at = stamp()
  const dir = sessionsDir()
  writeAtomically(join(dir, `${sessionId}.json`), dir, JSON.stringify(sessionRecord(payload, at)))
  mkdirSync(appDirs().cache, { recursive: true })
  // One line in one write, appended: concurrent sessions never interleave inside a line.
  appendFileSync(usageLogFile(), `${JSON.stringify(usageRecord(payload, at))}\n`)
}

function chainedCommand(): string | null {
  try {
    const data: unknown = JSON.parse(readFileSync(chainedStatuslineFile(), 'utf8'))
    const command = isObject(data) ? data.command : null
    return typeof command === 'string' && command.trim() !== '' ? command : null
  } catch {
    return null // no file, or not one the app wrote: nothing to chain
  }
}

// The user's own statusline, run with the same stdin; its output is the bar when it succeeded.
export function chainedBar(stdin: string, timeoutMs = CHAINED_TIMEOUT_MS): string | null {
  const command = chainedCommand()
  if (command === null) return null
  const result = spawnSync('/bin/sh', ['-c', command], {
    input: stdin,
    encoding: 'utf8',
    timeout: timeoutMs,
  })
  if (result.error || result.status !== 0) return null
  const output = (result.stdout ?? '').replace(/\n+$/, '')
  return output.trim() === '' ? null : output
}

export function runStatusline(stdin: string, chainedTimeoutMs = CHAINED_TIMEOUT_MS): string {
  let payload: unknown
  try {
    payload = JSON.parse(stdin)
  } catch {
    return FALLBACK
  }
  if (!isObject(payload)) return FALLBACK
  try {
    record(payload)
  } catch {
    // A full disk or a read-only cache costs the app a reading, never the bar.
  }
  return chainedBar(stdin, chainedTimeoutMs) ?? bar(payload)
}

function readStdin(): string {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return '' // no stdin at all: the fallback bar
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${runStatusline(readStdin())}\n`)
}
