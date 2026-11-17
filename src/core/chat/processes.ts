import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename } from 'node:path'
import { descriptorOf } from '../agents/descriptors'
import { AGENT_IDS } from '../agents/ids'
import { kitOf } from '../agents/registry'
import { t, translate } from '../i18n'
import { log } from '../log'
import { withoutSessionEnv } from '../sessionenv'
import { ghosttyArgs } from './ghostty'
import { type Chat, findOnPath } from './session'
import { type ChatAgent, type VariantKey, variantOf } from './variants'

export { type Chat, findOnPath, onChatEvent } from './session'

// Chat tabs' processes; how each agent runs its chat is its kit's. A chat is not a terminal:
// nothing here is typed into one, and closing a tab hangs its process up.

const chats = new Map<string, Chat>()

export function chatOf(chatId: string): Chat | undefined {
  return chats.get(chatId)
}

export function installedAgents(): Set<ChatAgent> {
  return new Set(
    AGENT_IDS.filter(
      (agent) => kitOf(agent).chat !== null && findOnPath(descriptorOf(agent).command) !== null,
    ),
  )
}

export function sendChat(chat: Chat, text: string): void {
  kitOf(chat.variant.agent).chat?.send(chat, text, withoutSessionEnv(process.env))
}

export const cursorTurn = sendChat

export interface StartedChat {
  readonly chatId: string
  readonly title: string
  readonly tooltip: string
}

// A chat in a folder (the home folder when it is gone), new or continuing a session.
export function startChat(
  agent: ChatAgent,
  key: VariantKey,
  options: {
    readonly folder: string
    readonly resume?: { readonly id: string; readonly name: string }
  },
): StartedChat | null {
  const variant = variantOf(agent, key)
  const strategy = kitOf(agent).chat
  if (!variant || strategy === null || findOnPath(descriptorOf(agent).command) === null) return null
  const exists = existsSync(options.folder) && statSync(options.folder).isDirectory()
  const name = translate(descriptorOf(agent).label)
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
  strategy.open(chat, withoutSessionEnv(process.env))
  return { chatId: chat.id, title: chat.title, tooltip: chat.tooltip }
}

// Closing the tab: the process's stdin closed and the process terminated.
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
  const cli = descriptorOf(agent).command
  if (ghostty === null || findOnPath(cli) === null) return false
  const cwd = folder && existsSync(folder) ? folder : homedir()
  const child = spawn(ghostty, ghosttyArgs(cwd, cli, sessionId), {
    env: withoutSessionEnv(process.env),
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
