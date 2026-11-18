import type { ChildProcess } from 'node:child_process'
import { statSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import type { ChatVariant } from '../agents/descriptors'
import { type ChatEvent, LineSplitter } from './protocol'

export interface Chat {
  readonly id: string
  readonly variant: ChatVariant
  readonly cwd: string
  readonly continuing: boolean
  readonly title: string
  readonly tooltip: string
  // the agent's session id, from the first `init` line or the session continued
  sessionId: string | null
  // a long-lived process, or the process of the turn running
  process: ChildProcess | null
  closed: boolean
}

export function findOnPath(cli: string, path = process.env.PATH ?? ''): string | null {
  for (const dir of path.split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, cli)
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      // not in this folder
    }
  }
  return null
}

type Sink = (chatId: string, event: ChatEvent | { readonly kind: 'ended' }) => void
let sink: Sink = () => {}

// Where a chat's events go: main sends them to the windows.
export function onChatEvent(next: Sink): void {
  sink = next
}

export function emit(chatId: string, event: ChatEvent | { readonly kind: 'ended' }): void {
  sink(chatId, event)
}

// Stdout and stderr together, line by line, decoded as UTF-8.
export function follow(
  chat: Chat,
  child: ChildProcess,
  parse: (line: string) => ChatEvent[],
): void {
  const lines = new LineSplitter()
  const onData = (chunk: Buffer) => {
    for (const line of lines.push(chunk.toString('utf8'))) {
      for (const event of parse(line)) {
        if (event.kind === 'session') chat.sessionId = event.id
        emit(chat.id, event)
      }
    }
  }
  child.stdout?.on('data', onData)
  child.stderr?.on('data', onData)
}
