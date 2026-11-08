import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, delimiter, join } from 'node:path'
import { t } from '../i18n'
import { log } from '../log'
import { ghosttyArgs } from './ghostty'
import {
  type ChatEvent,
  claudeArgs,
  claudeEvents,
  cursorArgs,
  cursorEvents,
  LineSplitter,
} from './protocol'
import {
  AGENT_CLIS,
  AGENT_NAMES,
  type ChatAgent,
  type ChatVariant,
  type VariantKey,
  variantOf,
} from './variants'

// Chat tabs' processes. Claude: one long-lived `claude -p` per tab, fed over stdin, its tool
// permissions routed to the tab. Cursor: one `cursor-agent -p` per message, resuming the session.
// A chat is not a terminal: nothing here is typed into one, and closing a tab hangs its process up.

export interface Chat {
  readonly id: string
  readonly variant: ChatVariant
  readonly cwd: string
  readonly continuing: boolean
  readonly title: string
  readonly tooltip: string
  // the agent's session id, from the first `init` line or the session continued
  sessionId: string | null
  // Claude's long-lived process; Cursor's process for the turn running
  process: ChildProcess | null
  closed: boolean
}

const chats = new Map<string, Chat>()

export function chatOf(chatId: string): Chat | undefined {
  return chats.get(chatId)
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

export function installedAgents(): Set<ChatAgent> {
  return new Set(
    (['claude', 'cursor'] as const).filter((agent) => findOnPath(AGENT_CLIS[agent]) !== null),
  )
}

type Sink = (chatId: string, event: ChatEvent | { readonly kind: 'ended' }) => void
let sink: Sink = () => {}

// Where a chat's events go: main sends them to the windows.
export function onChatEvent(next: Sink): void {
  sink = next
}

function emit(chatId: string, event: ChatEvent | { readonly kind: 'ended' }): void {
  sink(chatId, event)
}

// Stdout and stderr together, line by line, decoded as UTF-8.
function follow(chat: Chat, child: ChildProcess, parse: (line: string) => ChatEvent[]): void {
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

function startClaude(chat: Chat): void {
  const cli = findOnPath(AGENT_CLIS.claude)
  if (cli === null) {
    emit(chat.id, { kind: 'error', message: t('chat.cliMissing', { cli: AGENT_CLIS.claude }) })
    emit(chat.id, { kind: 'ended' })
    return
  }
  const child = spawn(cli, claudeArgs(chat.continuing ? chat.sessionId : null), {
    cwd: chat.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  chat.process = child
  follow(chat, child, claudeEvents)
  // A write to a process that has exited is dropped.
  child.stdin?.on('error', () => undefined)
  child.on('error', (error) => {
    log.warn('chat process could not be started', { chat: chat.id, error })
    emit(chat.id, { kind: 'error', message: t('chat.cliFailed', { cli: AGENT_CLIS.claude }) })
  })
  child.on('exit', () => {
    chat.process = null
    if (!chat.closed) emit(chat.id, { kind: 'ended' })
  })
}

export function cursorTurn(chat: Chat, text: string): void {
  const cli = findOnPath(AGENT_CLIS.cursor)
  if (cli === null) {
    emit(chat.id, { kind: 'error', message: t('chat.cliMissing', { cli: AGENT_CLIS.cursor }) })
    emit(chat.id, { kind: 'turnEnd' })
    return
  }
  const child = spawn(cli, cursorArgs(chat.variant, chat.sessionId, text), {
    cwd: chat.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  chat.process = child
  follow(chat, child, cursorEvents)
  let ended = false
  child.stdout?.on('data', (chunk: Buffer) => {
    if (chunk.toString('utf8').includes('"type":"result"')) ended = true
  })
  child.on('error', (error) => {
    log.warn('chat turn could not be started', { chat: chat.id, error })
    emit(chat.id, { kind: 'error', message: t('chat.cliFailed', { cli: AGENT_CLIS.cursor }) })
  })
  // A turn that ends without its result line (stopped, crashed) unblocks the input quietly.
  child.on('exit', () => {
    if (chat.process === child) chat.process = null
    if (!ended && !chat.closed) emit(chat.id, { kind: 'turnEnd' })
  })
}

export interface StartedChat {
  readonly chatId: string
  readonly title: string
  readonly tooltip: string
}

// A chat in a folder (the home folder when it is gone), new or continuing a session. Claude's
// process starts at once; Cursor's runs only when a message is sent.
export function startChat(
  agent: ChatAgent,
  key: VariantKey,
  options: {
    readonly folder: string
    readonly resume?: { readonly id: string; readonly name: string }
  },
): StartedChat | null {
  const variant = variantOf(agent, key)
  if (!variant || findOnPath(AGENT_CLIS[agent]) === null) return null
  const exists = existsSync(options.folder) && statSync(options.folder).isDirectory()
  const name = AGENT_NAMES[agent]
  const chat: Chat = {
    id: randomUUID(),
    variant,
    cwd: exists ? options.folder : homedir(),
    continuing: options.resume !== undefined,
    title: t('chat.tabTitle', {
      name: options.resume ? options.resume.name : basename(options.folder),
    }),
    tooltip: t('chat.tabTooltip', {
      agent: name,
      detail: options.resume ? options.resume.id : options.folder,
    }),
    sessionId: options.resume?.id ?? null,
    process: null,
    closed: false,
  }
  chats.set(chat.id, chat)
  if (variant.transport === 'stdin-stream') startClaude(chat)
  return { chatId: chat.id, title: chat.title, tooltip: chat.tooltip }
}

// Closing the tab: Claude's stdin closed and the process terminated; Cursor's turn terminated.
export function closeChat(chatId: string): void {
  const chat = chats.get(chatId)
  if (!chat) return
  chat.closed = true
  chats.delete(chatId)
  chat.process?.stdin?.end()
  chat.process?.kill('SIGTERM')
}

export function closeAllChats(): void {
  for (const id of [...chats.keys()]) closeChat(id)
}

// Open in Ghostty: the session resumed in its folder (the home folder when gone), detached, outliving
// the app, untracked. Nothing when Ghostty or the agent's CLI is not installed.
export function openInGhostty(agent: ChatAgent, sessionId: string, folder: string | null): boolean {
  const ghostty = findOnPath('ghostty')
  if (ghostty === null || findOnPath(AGENT_CLIS[agent]) === null) return false
  const cwd = folder && existsSync(folder) ? folder : homedir()
  const child = spawn(ghostty, ghosttyArgs(cwd, AGENT_CLIS[agent], sessionId), {
    detached: true,
    stdio: 'ignore',
  })
  child.on('error', (error) => log.warn('Ghostty could not be started', { error }))
  child.unref()
  return true
}

export function ghosttyInstalled(): boolean {
  return findOnPath('ghostty') !== null
}
