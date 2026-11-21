import { stat } from 'node:fs/promises'
import type { Reading } from '../../context/types'
import { field, parseLine, type ReadRange, readRange, TAIL_BYTES } from '../shared/jsonl'
import type { ContextSource } from '../types'

// What Codex's own footer counts out of the window: the first tokens of every prompt are its own,
// so a fresh session reads 0% used, as Codex shows it.
export const BASELINE_TOKENS = 12_000
// How far back the last token count is looked for, each window wider than the last.
const WINDOWS = [TAIL_BYTES, 1024 * 1024, 8 * 1024 * 1024]

// Used, in whole percent, as 100 less the "% context left" Codex's footer shows: the last
// request's prompt and output over the window, both less the baseline.
export function usedPercent(used: number, window: number): number {
  if (window <= BASELINE_TOKENS) return 100
  const effective = window - BASELINE_TOKENS
  const counted = Math.max(used - BASELINE_TOKENS, 0)
  const left = Math.round(Math.min(Math.max((effective - counted) / effective, 0), 1) * 100)
  return 100 - left
}

// The last token count that carries a window and a request, in the text's lines.
function lastCount(text: string): Reading | null {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const raw = lines[i] ?? ''
    if (!raw.includes('"token_count"')) continue
    const line = parseLine(raw)
    if (line?.type !== 'event_msg' || field(line.payload, 'type') !== 'token_count') continue
    const info = field(line.payload, 'info')
    const window = field(info, 'model_context_window')
    const used = field(field(info, 'last_token_usage'), 'total_tokens')
    if (typeof window !== 'number' || !Number.isInteger(window) || window <= 0) continue
    if (typeof used !== 'number' || !Number.isFinite(used)) continue
    return { percentage: usedPercent(used, window), window, source: 'statusline' }
  }
  return null
}

// A compressed rollout is a thread untouched for a week: it shows no reading.
export async function readContext(
  rollout: string,
  read: ReadRange = readRange,
): Promise<Reading | null> {
  if (rollout.endsWith('.zst')) return null
  let size: number
  try {
    size = (await stat(rollout)).size
  } catch {
    return null // the rollout is gone
  }
  for (const window of WINDOWS) {
    const start = Math.max(0, size - window)
    let text = (await read(rollout, start, size)).toString('utf8')
    if (start > 0) text = text.slice(text.indexOf('\n') + 1) // the first line of a tail is cut
    const found = lastCount(text)
    if (found !== null || start === 0) return found
  }
  return null
}

export const context: ContextSource = {
  read: (_sessionId, rollout) => readContext(rollout),
}
