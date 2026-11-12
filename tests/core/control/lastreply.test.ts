// Decision 1.73: last_reply gives the last text a session of the caller's project
// replied, read from the end of its transcript, never the whole file, and never written.
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { REPLY_MAX_CHARS, replyText, sessionOfProject } from '../../../src/core/control/lastreply'
import { lastReply } from '../../../src/core/sessions/lastreply'
import { assistant, jsonl, text, toolResult, toolUse, user } from '../../factories/transcript'

const dir = mkdtempSync(join(tmpdir(), 'menkar-reply-'))

function transcript(name: string, lines: Parameters<typeof jsonl>[0]): string {
  const file = join(dir, name)
  writeFileSync(file, jsonl(lines))
  return file
}

describe('the last reply', () => {
  test('text, a tool call, then text → the last text, however far the file goes back', async () => {
    // Earlier turns well past one read from the end, with a multi-byte character on every line.
    const earlier = Array.from({ length: 3000 }, (_, i) =>
      assistant(`ñandú número ${i} `.repeat(4)),
    )
    const file = transcript('a.jsonl', [
      ...earlier,
      user('do the block'),
      assistant([text('I start.')]),
      assistant([toolUse('Bash', { command: 'npm run ci' })]),
      toolResult(),
      assistant([text('Block 1 is green. Report: ñ')]),
      { type: 'system', subtype: 'turn_duration' },
    ])
    expect(statSync(file).size).toBeGreaterThan(300_000)
    expect(await lastReply(file)).toBe('Block 1 is green. Report: ñ')
  })

  test('a reply longer than a read comes back whole, its multi-byte characters intact', async () => {
    const long = 'é'.repeat(100_000)
    const file = transcript('long.jsonl', [user('q'), assistant([text(long)]), toolResult()])
    expect(await lastReply(file)).toBe(long)
  })

  test('a session that never replied has none', async () => {
    expect(await lastReply(transcript('b.jsonl', [user('hello')]))).toBeNull()
  })

  test('30,000 characters → the first 20,000 and a note', () => {
    const long = 'x'.repeat(30_000)
    const shown = replyText(long)
    expect(shown.startsWith('x'.repeat(REPLY_MAX_CHARS))).toBe(true)
    expect(shown.slice(REPLY_MAX_CHARS)).toMatch(/30,000 characters/)
    expect(replyText('short')).toBe('short')
  })

  test('reading leaves the file’s bytes and mtime as they were', async () => {
    const file = transcript('c.jsonl', [user('q'), assistant('a')])
    const before = [readFileSync(file, 'base64'), statSync(file).mtimeMs]
    await lastReply(file)
    expect([readFileSync(file, 'base64'), statSync(file).mtimeMs]).toEqual(before)
  })

  // Decision 17 (1.74): a session is addressed by its name; an id names nothing once it renews.
  test('only a session of the caller’s project, by its name; an id or another project’s is refused', () => {
    const project = [
      { id: 'o1', name: 'orch' },
      { id: 'a1', name: 'api' },
    ]
    expect(sessionOfProject('api', project)).toEqual({ id: 'a1' })
    for (const named of ['a1', 'elsewhere']) {
      const refused = sessionOfProject(named, project)
      expect(refused).toHaveProperty('refusal')
      expect((refused as { refusal: string }).refusal).toMatch(/^[A-Z].*\.$/)
    }
  })
})
