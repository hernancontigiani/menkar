// D2 (decision 1.143): send_message bridges what an agent's own messaging cannot reach. Claude
// keeps SendMessage, so a Claude→Claude call is refused naming it; every other pair goes through
// the receiver's waker with Menkar's frame, which names the sender and the tool to answer with.
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { AgentId } from '../../../src/core/agents/ids'
import { bridgedText } from '../../../src/core/control/post'
import {
  MESSAGE_MAX_CHARS,
  type MessageTarget,
  messageRoute,
  sendMessageTool,
} from '../../../src/core/control/send'
import type { WakeOutcome } from '../../../src/core/orchestration/ask'

afterEach(() => vi.useRealTimers())

const SENDER = { id: 's-1', name: 'orchestrator', agent: 'Claude Code' }

function run(
  args: { name?: unknown; text?: unknown },
  target: MessageTarget | { refusal: string },
  outcome: WakeOutcome = 'posted',
) {
  const posts: { id: string; text: string }[] = []
  const answer = sendMessageTool(
    { name: args.name, text: args.text, sender: SENDER },
    {
      target: () => target,
      post: async (id, text) => {
        posts.push({ id, text })
        return outcome
      },
    },
  )
  return { answer, posts }
}

const CODEX_WORKER: MessageTarget = { id: 'w-1', native: null, replyWith: 'send_message' }

describe('the route between two agents, from their kits', () => {
  test.each<[AgentId, AgentId | null, string | null, string]>([
    // [sender, receiver, the sender's own tool that reaches it, the tool the receiver answers with]
    ['claude', 'claude', 'SendMessage', 'SendMessage'],
    ['claude', 'codex', null, 'send_message'],
    ['codex', 'claude', null, 'send_message'],
    ['codex', 'codex', null, 'send_message'],
    ['claude', 'cursor', null, 'send_message'],
    ['claude', null, null, 'send_message'],
  ])('%s → %s: native %s, reply with %s', (sender, receiver, native, replyWith) => {
    expect(messageRoute(sender, receiver)).toEqual({ native, replyWith })
  })
})

describe('send_message', () => {
  test('a Claude→Claude call is refused, naming SendMessage, and nothing is posted', async () => {
    const { answer, posts } = run(
      { name: 'reviewer', text: 'hello' },
      { id: 'c-2', ...messageRoute('claude', 'claude') },
    )
    expect(await answer).toEqual({
      ok: false,
      text: "Your own messaging reaches reviewer: use SendMessage. Menkar's send_message is for the sessions it cannot reach.",
    })
    expect(posts).toEqual([])
  })

  test("a message to a Codex session goes to it with Menkar's frame: the sender, its agent, the tool to answer with", async () => {
    const { answer, posts } = run(
      { name: 'cx', text: '  look at line 4\nthen report  ' },
      CODEX_WORKER,
    )
    expect(await answer).toEqual({
      ok: true,
      text: 'Sent to cx. It reaches it as a message from Menkar naming you; its answer comes back the same way.',
    })
    expect(posts).toEqual([
      {
        id: 'w-1',
        text: 'from orchestrator (Claude Code); reply with send_message: look at line 4\nthen report',
      },
    ])
  })

  test.each<[WakeOutcome, string]>([
    [
      'no session',
      'cx cannot take a message now: its conversation has not started yet, or it is not running. The message was not sent.',
    ],
    ['no pane', 'cx is not running in Menkar (no open tab). The message was not sent.'],
    [
      'protocol',
      "cx's agent is a version Menkar cannot send messages to. The message was not sent.",
    ],
    ['error', 'cx could not be sent the message now. It was not sent.'],
  ])('a post that came to %s is refused with its sentence', async (outcome, text) => {
    const { answer, posts } = run({ name: 'cx', text: 'hi' }, CODEX_WORKER, outcome)
    expect(await answer).toEqual({ ok: false, text })
    expect(posts).toHaveLength(1)
  })

  test.each<[{ name?: unknown; text?: unknown }, string]>([
    [{ text: 'hi' }, 'Name the session to send the message to.'],
    [{ name: '  ', text: 'hi' }, 'Name the session to send the message to.'],
    [{ name: 'cx' }, 'Write the message to send.'],
    [{ name: 'cx', text: 7 }, 'Write the message to send.'],
    [
      { name: 'cx', text: 'x'.repeat(MESSAGE_MAX_CHARS + 1) },
      'A message is at most 2,000 characters: put the details in a file and name its path.',
    ],
  ])('%j is refused before anything is posted', async (args, text) => {
    const { answer, posts } = run(args, CODEX_WORKER)
    expect(await answer).toEqual({ ok: false, text })
    expect(posts).toEqual([])
  })

  test('a message of exactly 2,000 characters goes', async () => {
    const { answer } = run({ name: 'cx', text: 'x'.repeat(MESSAGE_MAX_CHARS) }, CODEX_WORKER)
    expect((await answer).ok).toBe(true)
    expect(MESSAGE_MAX_CHARS).toBe(2000)
  })

  test('a name not in the project, and the sender itself, are refused', async () => {
    const unknown = run(
      { name: 'ghost', text: 'hi' },
      { refusal: 'No session of your project is called "ghost".' },
    )
    expect(await unknown.answer).toEqual({
      ok: false,
      text: 'No session of your project is called "ghost".',
    })
    const self = run({ name: 'orchestrator', text: 'hi' }, { ...CODEX_WORKER, id: SENDER.id })
    expect(await self.answer).toEqual({ ok: false, text: 'That is your own session.' })
    expect([...unknown.posts, ...self.posts]).toEqual([])
  })
})

describe("the bridged frame's text", () => {
  test('names the sender, its agent and the tool to answer with, then the message as given', () => {
    expect(bridgedText({ name: 'cx', agent: 'Codex' }, 'send_message', 'done: see a.txt')).toBe(
      'from cx (Codex); reply with send_message: done: see a.txt',
    )
  })
})
