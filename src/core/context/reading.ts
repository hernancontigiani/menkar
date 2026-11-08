import { open, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { t } from '../i18n'
import { parseSeconds } from '../usage/transcript'
import { sessionsDir } from './statusline'
import type { Reading } from './types'

// How full a session's context window is: exact when Menkar's statusline reported it after the
// last assistant message, otherwise estimated from that message.

// The keys of the session file this reader uses; the statusline writes them (a parity test holds
// the two sides together).
export const CONTEXT_READ_KEYS = ['percentage', 'window', 'updated_at'] as const

// The transcript never says the window's size: a session that never reported is estimated over
// this, which is why the ring says "estimate".
export const DEFAULT_WINDOW = 200_000
// The last assistant message is almost always in the last few lines.
const TAIL_BYTES = 256 * 1024

export type { Reading }

export type Level = 'ok' | 'warn' | 'full'

export function level(percentage: number): Level {
  return percentage >= 80 ? 'full' : percentage >= 60 ? 'warn' : 'ok'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJsonObject(path: string): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    return isObject(value) ? value : null
  } catch {
    return null // missing, unreadable or not JSON: no report
  }
}

function tokens(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

function assistantUsage(line: string): { tokens: number; at: number } | null {
  if (!line.includes('"assistant"')) return null
  let entry: unknown
  try {
    entry = JSON.parse(line)
  } catch {
    return null
  }
  if (!isObject(entry) || entry.type !== 'assistant') return null
  const usage = isObject(entry.message) ? entry.message.usage : null
  const at = parseSeconds(entry.timestamp)
  if (!isObject(usage) || at === null) return null
  return {
    tokens:
      tokens(usage.input_tokens) +
      tokens(usage.cache_creation_input_tokens) +
      tokens(usage.cache_read_input_tokens),
    at,
  }
}

// The tokens in the window after the transcript's last assistant message, and when it was written:
// the tail first, the whole file only when the tail has none.
export async function lastAssistantUsage(
  transcript: string,
): Promise<{ tokens: number; at: number } | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(transcript, 'r')
    const size = (await handle.stat()).size
    for (const start of size > TAIL_BYTES ? [size - TAIL_BYTES, 0] : [0]) {
      const buffer = Buffer.alloc(size - start)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
      let lines = buffer.subarray(0, bytesRead).toString('utf8').split(/\r?\n/)
      if (start > 0) lines = lines.slice(1) // the first line of a tail is cut
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const found = assistantUsage(lines[i] ?? '')
        if (found !== null) return found
      }
    }
  } catch {
    return null // an unreadable transcript has no message to estimate from
  } finally {
    await handle?.close()
  }
  return null
}

// Rounded half to even, as agent-tablet's figures were.
function round(value: number, digits: number): number {
  const scaled = value * 10 ** digits
  const floor = Math.floor(scaled)
  const rounded =
    Math.abs(scaled - floor - 0.5) < 1e-9
      ? floor % 2 === 0
        ? floor
        : floor + 1
      : Math.round(scaled)
  return rounded / 10 ** digits
}

export async function readingFor(
  sessionId: string,
  transcript: string,
  dir = sessionsDir(),
): Promise<Reading | null> {
  const reported = (await readJsonObject(join(dir, `${sessionId}.json`))) ?? {}
  const reportedAt = parseSeconds(reported.updated_at)
  const reportedWindow = reported.window
  const window =
    typeof reportedWindow === 'number' && Number.isInteger(reportedWindow) && reportedWindow > 0
      ? reportedWindow
      : DEFAULT_WINDOW
  const last = await lastAssistantUsage(transcript)
  const percentage = reported.percentage
  const fresh = reportedAt !== null && (last === null || reportedAt >= last.at)
  if (typeof percentage === 'number' && Number.isFinite(percentage) && fresh) {
    return { percentage, window, source: 'statusline' }
  }
  if (last === null) return null
  return { percentage: round((100 * last.tokens) / window, 1), window, source: 'estimate' }
}

// The window as the tooltip says it: whole millions, else whole thousands.
export function windowLabel(window: number): string {
  return window >= 1_000_000
    ? `${Math.floor(window / 1_000_000)}M`
    : `${Math.floor(window / 1000)}k`
}

export function tooltip(reading: Reading): string {
  const params = { pct: String(round(reading.percentage, 0)), window: windowLabel(reading.window) }
  return reading.source === 'statusline'
    ? t('context.tooltip.statusline', params)
    : t('context.tooltip.estimate', params)
}

// A tab's ring: the fullest of its sessions' readings, the pane about to run out.
export function fullest(readings: readonly (Reading | null)[]): Reading | null {
  let found: Reading | null = null
  for (const reading of readings) {
    if (reading !== null && (found === null || reading.percentage > found.percentage))
      found = reading
  }
  return found
}

export function sameReading(a: Reading | null, b: Reading | null): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.percentage === b.percentage &&
      a.window === b.window &&
      a.source === b.source)
  )
}
