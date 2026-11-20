import type { ReadRange } from '../shared/jsonl'

// A compaction's line, told by its start: its payload carries the whole replacement history, so
// the line is never parsed.
const COMPACTED = /^\{"timestamp":"[^"]*","type":"compacted"/
const HEAD = 64
const CHUNK = 1024 * 1024

// The compactions among the whole lines of [from, to), `from` a line's start, and where the first
// line not yet whole starts.
export async function compactionsIn(
  read: ReadRange,
  file: string,
  from: number,
  to: number,
): Promise<{ readonly count: number; readonly next: number }> {
  let count = 0
  let next = from
  let pos = from
  let head = ''
  while (pos < to) {
    const chunk = await read(file, pos, Math.min(to, pos + CHUNK))
    if (chunk.length === 0) break
    let i = 0
    while (i < chunk.length) {
      const nl = chunk.indexOf(10, i)
      const stop = nl < 0 ? chunk.length : nl
      if (head.length < HEAD)
        head += chunk.subarray(i, Math.min(stop, i + HEAD - head.length)).toString('latin1')
      if (nl < 0) break
      if (COMPACTED.test(head)) count++
      head = ''
      i = nl + 1
      next = pos + i
    }
    pos += chunk.length
  }
  return { count, next }
}
