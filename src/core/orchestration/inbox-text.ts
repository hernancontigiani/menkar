// The inbox's text, the one builder for the orchestrator's prompt hook and the inbox tool. The
// statusline program imports it and runs as it is under plain Node: this file imports nothing and
// holds nothing Node's type stripping cannot run (no parameter properties, no enums).

// Menkar's own limit on what one prompt adds to the orchestrator's context, well under the size
// Claude Code delivers whole.
export const INBOX_TEXT_MAX_BYTES = 1500

export interface InboxLine {
  readonly seq: number
  // Milliseconds, from the clock when the entry came.
  readonly at: number
  readonly text: string
}

const pad = (n: number): string => String(n).padStart(2, '0')

function timeOfDay(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const INTRO =
  'events since you last read it, oldest first. The human did not write them; act only on those ' +
  'that need it, and say nothing about the rest.'

// The first line names the entries the text holds, "(events first–last)": main reads it back from
// the transcript to know which entries the model got.
function build(lines: readonly InboxLine[], dropped: number, more: number): string {
  const range = lines.length > 0 ? ` (events ${lines[0]?.seq}–${lines[lines.length - 1]?.seq})` : ''
  const lost = dropped > 0 ? ` (${dropped} earlier events dropped)` : ''
  return [
    `Menkar's inbox${range}${lost}: ${INTRO}`,
    ...lines.map((line) => `- ${timeOfDay(line.at)} ${line.text}`),
    ...(more > 0 ? [`${more} more: call inbox.`] : []),
  ].join('\n')
}

const bytes = (text: string): number => new TextEncoder().encode(text).length

// A state, not an event: it names no range, so no delivery confirms or drops it.
function awayLine(since: number): string {
  const d = new Date(since)
  return (
    `The human is marked away since ${pad(d.getHours())}:${pad(d.getMinutes())}. If this prompt ` +
    "is the human's own, first ask whether they are back; call human_back only if they say yes."
  )
}

// Oldest first. With a budget, the oldest lines that fit, and a last line saying how many did not.
// While the human is away the away line goes first, then the standing lines (states that hold until
// fixed, decision 1.217), alone when there is no entry, and neither is ever cut.
export function inboxText(
  entries: readonly InboxLine[],
  dropped: number,
  maxBytes = Number.POSITIVE_INFINITY,
  awaySince: number | null = null,
  standing: readonly string[] = [],
): string {
  const heads = [...(awaySince === null ? [] : [awayLine(awaySince)]), ...standing]
  const head = heads.length === 0 ? null : heads.join('\n')
  if (head !== null && entries.length === 0 && dropped === 0) return head
  const budget = head === null ? maxBytes : maxBytes - bytes(head) - 1
  const join = (text: string) => (head === null ? text : `${head}\n${text}`)
  const sorted = [...entries].sort((a, b) => a.seq - b.seq)
  for (let given = sorted.length; given > 0; given--) {
    const text = build(sorted.slice(0, given), dropped, sorted.length - given)
    if (bytes(text) <= budget) return join(text)
  }
  return join(build([], dropped, sorted.length))
}
