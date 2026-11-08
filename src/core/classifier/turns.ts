import { closeSync, openSync, readSync, statSync } from 'node:fs'
import type { UsageCache } from '../usage/cache'
import type { UsageHistory } from '../usage/history'
import type { TurnText } from './input'
import { BATCH, READY_AFTER_SECONDS, TRIES } from './prompt'

function readLines(cache: UsageCache, uuid: string): Record<string, unknown>[] {
  const extent = cache.extent(uuid)
  if (extent === null) return []
  let data: Buffer
  try {
    const size = statSync(extent.file).size
    const end = extent.end === null ? size : Math.min(extent.end, size)
    const length = Math.max(0, end - extent.start)
    data = Buffer.alloc(length)
    const fd = openSync(extent.file, 'r')
    try {
      readSync(fd, data, 0, length, extent.start)
    } finally {
      closeSync(fd)
    }
  } catch {
    return [] // the transcript is gone: the turn's text cannot be read
  }
  const found: Record<string, unknown>[] = []
  for (const line of data.toString('utf8').split('\n')) {
    try {
      const entry: unknown = JSON.parse(line)
      if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
        found.push(entry as Record<string, unknown>)
      }
    } catch {
      // a line that is not JSON is not part of what is sent
    }
  }
  return found
}

function textOf(entry: Record<string, unknown> | undefined): string {
  const message = entry?.message
  const content =
    typeof message === 'object' && message !== null
      ? (message as Record<string, unknown>).content
      : null
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is Record<string, unknown> =>
          typeof b === 'object' && b !== null && b.type === 'text',
      )
      .map((b) => (typeof b.text === 'string' ? b.text : ''))
      .join('\n')
  }
  return ''
}

// A turn's prompt, the human's previous prompt and the tools the agent called, read from its
// transcript at the byte the cache recorded; null when the transcript no longer holds it there.
export function readTurn(cache: UsageCache, uuid: string): TurnText | null {
  const lines = readLines(cache, uuid)
  if (lines.length === 0 || lines[0]?.uuid !== uuid) return null
  const tools: Record<string, unknown>[] = []
  for (const entry of lines.slice(1)) {
    if (entry.type !== 'assistant') continue
    const message = entry.message
    const content =
      typeof message === 'object' && message !== null
        ? (message as Record<string, unknown>).content
        : null
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (typeof block === 'object' && block !== null && block.type === 'tool_use')
        tools.push(block)
    }
  }
  const before = cache.previousHuman(uuid)
  const previous = before === null ? undefined : readLines(cache, before)[0]
  return { prompt: textOf(lines[0]), previous: textOf(previous), tools }
}

// The turns to send, oldest first: their tools are known once the session went on, or an hour after
// they opened.
export function readyTurns(
  history: UsageHistory,
  since: number,
  nowSeconds: number,
  origins: readonly string[],
): string[] {
  return history
    .unclassified(since, TRIES, origins)
    .filter((t) => t.later || nowSeconds - t.opened > READY_AFTER_SECONDS)
    .map((t) => t.uuid)
}

// The earlier turns whose transcript may still hold them, and how many it surely no longer does.
// Only the file's size is looked at: reading thousands of turns made the dialog wait.
export function earlierTurns(
  history: UsageHistory,
  cache: UsageCache,
  since: number,
  nowSeconds: number,
  origins: readonly string[],
): { found: string[]; missing: number } {
  const sizes = new Map<string, number>()
  const found: string[] = []
  let missing = 0
  for (const uuid of readyTurns(history, since, nowSeconds, origins)) {
    const extent = cache.extent(uuid)
    if (extent !== null && !sizes.has(extent.file)) {
      try {
        sizes.set(extent.file, statSync(extent.file).size)
      } catch {
        sizes.set(extent.file, -1)
      }
    }
    if (extent === null || (sizes.get(extent.file) ?? -1) <= extent.start) missing += 1
    else found.push(uuid)
  }
  return { found, missing }
}

export function callsFor(turns: number): number {
  return Math.ceil(turns / BATCH)
}
