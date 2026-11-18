// Decision 1.178: a session asks its parent with `ask`, posted at once and answered from what the
// post did; the orchestrator reads what waits for it with `inbox`.
import { describe, expect, test } from 'vitest'
import {
  ASK_MAX_CHARS,
  type AskParent,
  askText,
  askTool,
  inboxTool,
  type WakeOutcome,
} from '../../../src/core/orchestration/ask'
import { Inbox, sequence } from '../../../src/core/orchestration/inbox'

const asker = { id: 'w-id', name: 'menkar-t5', task: 12 }

function parent(toInbox: boolean): { parent: AskParent; added: [string, string][] } {
  const added: [string, string][] = []
  return {
    added,
    parent: {
      id: 'o-id',
      name: 'set',
      toInbox: toInbox ? (key, text) => added.push([key, text]) : null,
    },
  }
}

function deps(outcome: WakeOutcome) {
  const posts: [string, string][] = []
  let n = 0
  return {
    posts,
    deps: {
      post: async (id: string, text: string) => {
        posts.push([id, text])
        return outcome
      },
      nextAsk: () => {
        n += 1
        return n
      },
    },
  }
}

describe('ask', () => {
  test('the wake names the asker and its task, and leaves the task out when it has none', () => {
    expect(askText('menkar-t5', 12, 'Which port?')).toBe('menkar-t5 (task 12) asks: Which port?')
    expect(askText('menkar-t5', undefined, 'Which port?')).toBe('menkar-t5 asks: Which port?')
  })

  test('posted: the question went to the parent now, and the asker is told to go on or wait', async () => {
    const p = parent(true)
    const d = deps('posted')
    const answer = await askTool({ question: 'Which port?', asker, parent: p.parent }, d.deps)
    expect(d.posts).toEqual([['o-id', 'menkar-t5 (task 12) asks: Which port?']])
    expect(p.added).toEqual([])
    expect(answer).toEqual({
      ok: true,
      text: 'Sent to set. Its answer comes as a message from it. Go on with what does not depend on it; if nothing does, set your task waiting on set with task_progress and end your turn.',
    })
  })

  test("not posted to a mode-on orchestrator: the question waits in its inbox, under the asker's own key per call", async () => {
    const p = parent(true)
    const d = deps('no session')
    const first = await askTool({ question: 'Which port?', asker, parent: p.parent }, d.deps)
    await askTool({ question: 'Which host?', asker, parent: p.parent }, d.deps)
    expect(p.added).toEqual([
      ['ask:w-id:1', 'menkar-t5 (task 12) asks: Which port?'],
      ['ask:w-id:2', 'menkar-t5 (task 12) asks: Which host?'],
    ])
    expect(first).toEqual({
      ok: true,
      text: 'set could not be woken now. Your question is in its inbox and reaches it with its next message. Go on with what does not depend on it; if nothing does, set your task waiting on set and end your turn.',
    })
  })

  test.each<WakeOutcome>(['no session', 'protocol', 'no pane', 'error'])(
    'not posted to any other parent (%s): not sent, and said so',
    async (outcome) => {
      const answer = await askTool(
        { question: 'Which port?', asker, parent: parent(false).parent },
        deps(outcome).deps,
      )
      expect(answer).toEqual({
        ok: false,
        text: 'set cannot be woken now (it is not running). Your question was not sent.',
      })
    },
  )

  test('no parent: refused, and told whom to ask instead', async () => {
    const d = deps('posted')
    const answer = await askTool({ question: 'Which port?', asker, parent: null }, d.deps)
    expect(d.posts).toEqual([])
    expect(answer).toEqual({
      ok: false,
      text: 'You have no parent session in Menkar to ask. Send your question to the session that handed you the task.',
    })
  })

  test.each<unknown>(['', '   ', undefined, 42])(
    'an empty question (%j) is refused and nothing is posted',
    async (question) => {
      const d = deps('posted')
      const answer = await askTool({ question, asker, parent: parent(true).parent }, d.deps)
      expect(d.posts).toEqual([])
      expect(answer).toEqual({ ok: false, text: 'Write the question to ask.' })
    },
  )

  test('a question is at most 2,000 characters: 2,000 goes, 2,001 is refused', async () => {
    expect(ASK_MAX_CHARS).toBe(2000)
    const d = deps('posted')
    const ok = await askTool(
      { question: 'x'.repeat(2000), asker, parent: parent(true).parent },
      d.deps,
    )
    expect(ok.ok).toBe(true)
    const long = await askTool(
      { question: 'x'.repeat(2001), asker, parent: parent(true).parent },
      d.deps,
    )
    expect(d.posts).toHaveLength(1)
    expect(long).toEqual({
      ok: false,
      text: 'A question is at most 2,000 characters: put the details in a file and name its path.',
    })
  })
})

describe('inbox', () => {
  const box = () => new Inbox(sequence(), () => new Date(2026, 10, 18, 14, 2, 11).getTime())

  test('the mode off: "The orchestration mode is off in this project."', () => {
    expect(inboxTool({ modeOn: false, isOrchestrator: true, inbox: box() })).toEqual({
      ok: false,
      text: 'The orchestration mode is off in this project.',
    })
  })

  test('not the orchestrator: "Only the orchestrator has an inbox."', () => {
    expect(inboxTool({ modeOn: true, isOrchestrator: false, inbox: box() })).toEqual({
      ok: false,
      text: 'Only the orchestrator has an inbox.',
    })
  })

  test('nothing pending: "Your inbox is empty."', () => {
    expect(inboxTool({ modeOn: true, isOrchestrator: true, inbox: undefined })).toEqual({
      ok: true,
      text: 'Your inbox is empty.',
    })
    expect(inboxTool({ modeOn: true, isOrchestrator: true, inbox: box() }).text).toBe(
      'Your inbox is empty.',
    )
  })

  test('three entries: the inbox text, all of it, and then the inbox is empty', () => {
    const b = box()
    b.add('control:a', 'The human took control of menkar-t5')
    b.add('turn:b', 'menkar-t6 ended its turn without a report')
    b.add('ask:c:1', `menkar-t7 asks: ${'x'.repeat(1900)}`)
    const expected = b.text()
    const answer = inboxTool({ modeOn: true, isOrchestrator: true, inbox: b })
    expect(answer).toEqual({ ok: true, text: expected })
    expect(answer.text.split('\n')).toHaveLength(4)
    expect(answer.text).toContain("Menkar's inbox (events 1–3)")
    expect(inboxTool({ modeOn: true, isOrchestrator: true, inbox: b }).text).toBe(
      'Your inbox is empty.',
    )
  })

  test('an entry a transcript record confirmed is not given again', () => {
    const b = box()
    b.add('control:a', 'The human took control of menkar-t5')
    b.add('turn:b', 'menkar-t6 ended its turn without a report')
    b.deliveredThrough(1)
    const answer = inboxTool({ modeOn: true, isOrchestrator: true, inbox: b })
    expect(answer.text).toContain("Menkar's inbox (events 2–2)")
    expect(answer.text).not.toContain('took control')
  })
})
