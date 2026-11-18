// Decision 1.178: an inbox entry leaves only once the orchestrator's transcript shows its model was
// given it — a hook_additional_context record naming its number — since the hook can run while
// the model sees nothing. The transcript is read from where the last read ended, and never written.
import { appendFileSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { deliveredThrough } from '../../../../src/core/agents/claude/inbox'
import { assistant, hookContext, jsonl, user } from '../../../factories/transcript'

const dir = mkdtempSync(join(tmpdir(), 'menkar-inbox-'))
const inbox = (a: number, b: number) =>
  `Menkar's inbox (events ${a}–${b}): events since you last read it, oldest first.\n- 14:02:11 x`

describe('the entries the model was given', () => {
  test('two records name 1–3 and 4–4, a hook_success does not count → through 4', async () => {
    const file = join(dir, 'a.jsonl')
    writeFileSync(
      file,
      jsonl([
        user('hello'),
        hookContext(inbox(1, 3)),
        assistant('ok'),
        { type: 'attachment', attachment: { type: 'hook_success', content: inbox(1, 9) } },
        hookContext(inbox(4, 4)),
        hookContext(inbox(5, 8), 'SessionStart'),
      ]),
    )
    const before = { bytes: readFileSync(file), mtime: statSync(file).mtimeMs }
    const first = await deliveredThrough(file, 0)
    expect(first).toEqual({ through: 4, offset: statSync(file).size })
    expect(await deliveredThrough(file, first.offset)).toEqual({
      through: 0,
      offset: first.offset,
    })
    expect(readFileSync(file)).toEqual(before.bytes)
    expect(statSync(file).mtimeMs).toBe(before.mtime)
  })

  test('a record before the offset is ignored; one after it counts', async () => {
    const file = join(dir, 'b.jsonl')
    writeFileSync(file, jsonl([hookContext(inbox(1, 6))]))
    const start = statSync(file).size
    appendFileSync(file, jsonl([user('next'), hookContext(inbox(7, 7))]))
    expect((await deliveredThrough(file, start)).through).toBe(7)
  })

  test('a last line still being written waits for the next read', async () => {
    const file = join(dir, 'c.jsonl')
    const whole = jsonl([user('a')])
    const half = JSON.stringify(hookContext(inbox(1, 2))).slice(0, 40)
    writeFileSync(file, whole + half)
    expect(await deliveredThrough(file, 0)).toEqual({ through: 0, offset: whole.length })
  })
})
