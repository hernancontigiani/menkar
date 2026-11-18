import { open, stat } from 'node:fs/promises'

// Which of Menkar's inbox entries the orchestrator's model was given: Claude Code records a prompt
// hook's context in the transcript only when the prompt reached the model, so a hook that ran
// while another one blocked the prompt, or timed out, confirms nothing.

const RANGE = /Menkar's inbox \(events (\d+)–(\d+)\)/

function contextTexts(line: string): string[] {
  let record: unknown
  try {
    record = JSON.parse(line)
  } catch {
    return [] // a line being written, or not JSON: not a record of ours
  }
  if (typeof record !== 'object' || record === null) return []
  const { type, attachment } = record as { type?: unknown; attachment?: unknown }
  if (type !== 'attachment' || typeof attachment !== 'object' || attachment === null) return []
  const a = attachment as { type?: unknown; hookEvent?: unknown; content?: unknown }
  if (a.type !== 'hook_additional_context' || a.hookEvent !== 'UserPromptSubmit') return []
  const content = Array.isArray(a.content) ? a.content : [a.content]
  return content.filter((x): x is string => typeof x === 'string')
}

// The highest entry the records after `from` name, 0 when none, and the offset read to: the end of
// the last whole line, so a record still being written is read next time. Never written.
export async function deliveredThrough(
  transcript: string,
  from: number,
): Promise<{ readonly through: number; readonly offset: number }> {
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
  for (const line of complete.toString('utf8').split('\n')) {
    for (const text of contextTexts(line)) {
      const last = Number(RANGE.exec(text)?.[2] ?? 0)
      if (last > through) through = last
    }
  }
  return { through, offset: from + complete.length }
}
