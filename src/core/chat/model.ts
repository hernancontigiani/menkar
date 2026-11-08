// A chat tab's conversation as data: what the view draws and what answering a permission sends.
// No Node import; nothing here is translated (the view says each item in the UI's language).
import type { ChatEvent } from './protocol'
import type { ChatVariant } from './variants'

export type Item =
  | { readonly kind: 'user'; readonly text: string }
  | { kind: 'assistant'; text: string }
  | { readonly kind: 'tool'; readonly name: string }
  | {
      readonly kind: 'outcome'
      readonly outcome: 'allowed' | 'always' | 'denied' | 'auto'
      readonly tool: string
    }
  | {
      readonly kind: 'card'
      readonly requestId: string
      readonly tool: string
      readonly title: string
      readonly body: string | null
      readonly input: Readonly<Record<string, unknown>>
    }
  | {
      readonly kind: 'notice'
      readonly notice: 'continuing' | 'rateLimited' | 'ended' | 'error'
      readonly text?: string
    }

export type Answer = 'once' | 'always' | 'deny'

// What main must write for a permission: allow with the input unchanged, or deny.
export type Reply =
  | {
      readonly allow: true
      readonly requestId: string
      readonly input: Readonly<Record<string, unknown>>
    }
  | { readonly allow: false; readonly requestId: string }

export class ChatModel {
  readonly items: Item[] = []
  thinking = false
  busy = false
  ended = false
  // the bubble the next text grows; a tool, a turn's end or a card closes it
  private open: { kind: 'assistant'; text: string } | null = null
  // tools this tab allows without asking: never saved, a new chat starts empty
  private readonly always = new Set<string>()

  constructor(
    readonly variant: ChatVariant,
    continuing: boolean,
  ) {
    if (continuing) this.items.push({ kind: 'notice', notice: 'continuing' })
  }

  // The text to send, or null when there is nothing to send. Held while the session has ended.
  send(raw: string): string | null {
    const text = raw.trim()
    if (!text || this.ended) return null
    this.items.push({ kind: 'user', text })
    this.open = null
    this.thinking = true
    this.busy = true
    return text
  }

  // A process event; returns the reply main must write at once (an always-allowed tool), if any.
  apply(event: ChatEvent): Reply | null {
    switch (event.kind) {
      case 'session':
        return null
      case 'text':
        this.thinking = false
        if (this.open === null) {
          this.open = { kind: 'assistant', text: '' }
          this.items.push(this.open)
        }
        this.open.text += event.text
        return null
      case 'tool':
        this.thinking = false
        this.open = null
        this.items.push({ kind: 'tool', name: event.name })
        return null
      case 'permission':
        this.thinking = false
        this.open = null
        if (this.always.has(event.tool)) {
          this.items.push({ kind: 'outcome', outcome: 'auto', tool: event.tool })
          this.thinking = true
          return { allow: true, requestId: event.requestId, input: event.input }
        }
        this.items.push({
          kind: 'card',
          requestId: event.requestId,
          tool: event.tool,
          title: event.title,
          body: event.body,
          input: event.input,
        })
        return null
      case 'rateLimited':
        this.items.push({ kind: 'notice', notice: 'rateLimited' })
        return null
      case 'error':
        this.items.push({ kind: 'notice', notice: 'error', text: event.message })
        return null
      case 'turnEnd':
        this.thinking = false
        this.busy = false
        this.open = null
        return null
    }
  }

  // The user answered a card: it goes, a chip says what was decided, and the agent goes on.
  answer(requestId: string, answer: Answer): Reply | null {
    const index = this.items.findIndex((i) => i.kind === 'card' && i.requestId === requestId)
    const card = this.items[index]
    if (card === undefined || card.kind !== 'card') return null
    this.items.splice(index, 1)
    if (answer === 'always') this.always.add(card.tool)
    const outcome = answer === 'once' ? 'allowed' : answer === 'always' ? 'always' : 'denied'
    this.items.push({ kind: 'outcome', outcome, tool: card.tool })
    this.thinking = true
    return answer === 'deny'
      ? { allow: false, requestId }
      : { allow: true, requestId, input: card.input }
  }

  // The long-lived process exited: said once, and the chat takes no more messages.
  end(): void {
    if (this.ended) return
    this.ended = true
    this.thinking = false
    this.busy = false
    this.items.push({ kind: 'notice', notice: 'ended' })
  }
}
