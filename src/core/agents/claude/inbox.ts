import { open, stat } from 'node:fs/promises'

// Which of Menkar's inbox entries the orchestrator's model was given: Claude Code records a prompt
// hook's context in the transcript only when the prompt reached the model, so a hook that ran
// while another one blocked the prompt, or timed out, confirms nothing.

const RANGE = /Menkar's inbox \(events (\d+)–(\d+)\)/

function parsed(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return null // a line being written, or not JSON: not a record of ours
  }
}

function contextTexts(record: unknown): string[] {
  if (typeof record !== 'object' || record === null) return []
  const { type, attachment } = record as { type?: unknown; attachment?: unknown }
  if (type !== 'attachment' || typeof attachment !== 'object' || attachment === null) return []
  const a = attachment as { type?: unknown; hookEvent?: unknown; content?: unknown }
  if (a.type !== 'hook_additional_context' || a.hookEvent !== 'UserPromptSubmit') return []
  const content = Array.isArray(a.content) ? a.content : [a.content]
  return content.filter((x): x is string => typeof x === 'string')
}

// Whom the model messaged with SendMessage, by the name it typed, "x [ref]" as "x". Claude Code
// records no resolved session, so a name is all there is.
function sentTo(record: unknown): string[] {
  if (typeof record !== 'object' || record === null) return []
  const { type, message } = record as { type?: unknown; message?: unknown }
  if (type !== 'assistant' || typeof message !== 'object' || message === null) return []
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) => {
    if (typeof block !== 'object' || block === null) return []
    const b = block as { type?: unknown; name?: unknown; input?: unknown }
    if (b.type !== 'tool_use' || b.name !== 'SendMessage') return []
    const to = (b.input as { to?: unknown } | null)?.to
    if (typeof to !== 'string') return []
    const bare = to.replace(/\s*\[[^\]]*\]\s*$/, '').trim()
    return bare ? [bare] : []
  })
}

// The highest entry the records after `from` name, 0 when none, whom the model sent a message to
// there, and the offset read to: the end of the last whole line, so a record still being written
// is read next time. Never written.
export async function deliveredThrough(
  transcript: string,
  from: number,
): Promise<{
  readonly through: number
  readonly offset: number
  // Absent when it sent none.
  readonly sentTo?: readonly string[]
}> {
  const { size } = await stat(transcript)
  // A file shorter than where the last read ended is not the one read: it confirms nothing.
  if (size <= from) return { through: 0, offset: size }
  const handle = await open(transcript, 'r')
  let data: Buffer
  try {
    data = Buffer.alloc(size - from)
    await handle.read(data, 0, data.length, from)
  } finally {
    await handle.close()
  }
  const complete = data.subarray(0, data.lastIndexOf(0x0a) + 1)
  let through = 0
  const sent: string[] = []
  for (const line of complete.toString('utf8').split('\n')) {
    const record = parsed(line)
    for (const text of contextTexts(record)) {
      const last = Number(RANGE.exec(text)?.[2] ?? 0)
      if (last > through) through = last
    }
    sent.push(...sentTo(record))
  }
  return { through, offset: from + complete.length, ...(sent.length > 0 ? { sentTo: sent } : {}) }
}
