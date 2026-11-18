import type { ControlAnswer } from '../control/files'
import type { PostOutcome } from '../control/post'
import type { Inbox } from './inbox'
import { inboxText } from './inbox-text'

// A session asks its parent a question, posted at once rather than batched with the parent's other
// wakes, so the answer says what the post did. The answer comes back by the parent's own messaging.

export const ASK_MAX_CHARS = 2000

// What waking a session came to: the post's own outcomes, or no pane that can be woken, or a
// socket that failed.
export type WakeOutcome = PostOutcome | 'no pane' | 'error'

export interface AskParent {
  readonly id: string
  readonly name: string
  // Set only when the parent is the orchestrator of a project in the orchestration mode: a
  // question that could not be posted waits in its inbox.
  readonly toInbox: ((key: string, text: string) => void) | null
}

export interface AskInput {
  readonly question: unknown
  readonly asker: { readonly id: string; readonly name: string; readonly task?: number }
  readonly parent: AskParent | null
}

export interface AskDeps {
  post(parentId: string, text: string): Promise<WakeOutcome>
  // A number per call, so two questions of one session never share an inbox key.
  nextAsk(): number
}

export const askText = (name: string, task: number | undefined, question: string): string =>
  `${name}${task === undefined ? '' : ` (task ${task})`} asks: ${question}`

const refuse = (text: string): ControlAnswer => ({ ok: false, text })

export async function askTool(input: AskInput, deps: AskDeps): Promise<ControlAnswer> {
  const question = typeof input.question === 'string' ? input.question.trim() : ''
  if (question === '') return refuse('Write the question to ask.')
  if (question.length > ASK_MAX_CHARS)
    return refuse(
      'A question is at most 2,000 characters: put the details in a file and name its path.',
    )
  const { parent, asker } = input
  if (!parent)
    return refuse(
      'You have no parent session in Menkar to ask. Send your question to the session that handed you the task.',
    )
  const text = askText(asker.name, asker.task, question)
  if ((await deps.post(parent.id, text)) === 'posted')
    return {
      ok: true,
      text: `Sent to ${parent.name}. Its answer comes as a message from it. Go on with what does not depend on it; if nothing does, set your task waiting on ${parent.name} with task_progress and end your turn.`,
    }
  if (parent.toInbox) {
    parent.toInbox(`ask:${asker.id}:${deps.nextAsk()}`, text)
    return {
      ok: true,
      text: `${parent.name} could not be woken now. Your question is in its inbox and reaches it with its next message. Go on with what does not depend on it; if nothing does, set your task waiting on ${parent.name} and end your turn.`,
    }
  }
  return refuse(
    `${parent.name} cannot be woken now (it is not running). Your question was not sent.`,
  )
}

export interface InboxToolInput {
  readonly modeOn: boolean
  readonly isOrchestrator: boolean
  // Already cut to what the transcript has not confirmed.
  readonly inbox: Inbox | undefined
}

// Everything pending, whole (no budget: a long question is given here, not by the hook), and gone.
export function inboxTool(input: InboxToolInput): ControlAnswer {
  if (!input.modeOn) return refuse('The orchestration mode is off in this project.')
  if (!input.isOrchestrator) return refuse('Only the orchestrator has an inbox.')
  const taken = input.inbox?.take()
  if (!taken || taken.entries.length === 0) return { ok: true, text: 'Your inbox is empty.' }
  return { ok: true, text: inboxText(taken.entries, taken.dropped) }
}
