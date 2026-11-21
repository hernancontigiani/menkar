import type { AgentId } from '../agents/ids'
import { kitOf } from '../agents/registry'
import type { WakeOutcome } from '../orchestration/ask'
import type { ControlAnswer } from './files'
import { bridgedText } from './post'

// A message by name to a session of the caller's project, for the sessions the caller's own
// messaging cannot reach: posted at once through the receiver's agent, so the answer says what
// the post did.

export const MESSAGE_MAX_CHARS = 2000

export interface MessageTarget {
  readonly id: string
  // The caller's own messaging tool when it reaches this session; null when only Menkar does.
  readonly native: string | null
  // The tool the receiver answers with: its own when it reaches the sender, else send_message.
  readonly replyWith: string
}

// How a message from one agent's session to another's goes, by their kits' own messaging.
export function messageRoute(
  sender: AgentId,
  receiver: AgentId | null,
): Pick<MessageTarget, 'native' | 'replyWith'> {
  const own = kitOf(sender).messaging
  const theirs = receiver ? kitOf(receiver).messaging : null
  return {
    native: own && receiver && own.reaches(receiver) ? own.tool : null,
    replyWith: theirs?.reaches(sender) ? theirs.tool : 'send_message',
  }
}

export interface SendInput {
  readonly name: unknown
  readonly text: unknown
  readonly sender: { readonly id: string; readonly name: string; readonly agent: string }
}

export interface SendDeps {
  target(name: string): MessageTarget | { readonly refusal: string }
  post(sessionId: string, text: string): Promise<WakeOutcome>
}

const refuse = (text: string): ControlAnswer => ({ ok: false, text })

export async function sendMessageTool(input: SendInput, deps: SendDeps): Promise<ControlAnswer> {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name === '') return refuse('Name the session to send the message to.')
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  if (text === '') return refuse('Write the message to send.')
  if (text.length > MESSAGE_MAX_CHARS)
    return refuse(
      'A message is at most 2,000 characters: put the details in a file and name its path.',
    )
  const target = deps.target(name)
  if ('refusal' in target) return refuse(target.refusal)
  if (target.id === input.sender.id) return refuse('That is your own session.')
  if (target.native !== null)
    return refuse(
      `Your own messaging reaches ${name}: use ${target.native}. Menkar's send_message is for the sessions it cannot reach.`,
    )
  const outcome = await deps.post(target.id, bridgedText(input.sender, target.replyWith, text))
  switch (outcome) {
    case 'posted':
      return {
        ok: true,
        text: `Sent to ${name}. It reaches it as a message from Menkar naming you; its answer comes back the same way.`,
      }
    case 'no session':
      return refuse(
        `${name} cannot take a message now: its conversation has not started yet, or it is not running. The message was not sent.`,
      )
    case 'no pane':
      return refuse(`${name} is not running in Menkar (no open tab). The message was not sent.`)
    case 'protocol':
      return refuse(
        `${name}'s agent is a version Menkar cannot send messages to. The message was not sent.`,
      )
    case 'error':
      return refuse(`${name} could not be sent the message now. It was not sent.`)
  }
}
