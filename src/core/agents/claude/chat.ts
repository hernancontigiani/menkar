import { spawn } from 'node:child_process'
import { claudeArgs, claudeEvents, userLine } from '../../chat/protocol'
import { emit, findOnPath, follow } from '../../chat/session'
import { t } from '../../i18n'
import { log } from '../../log'
import type { ChatStrategy } from '../types'
import { descriptor } from './descriptor'

// One long-lived `claude -p` per tab, fed over stdin, its tool permissions routed to the tab.
export const chat: ChatStrategy = {
  open(chat, env) {
    const cli = findOnPath(descriptor.command)
    if (cli === null) {
      emit(chat.id, { kind: 'error', message: t('chat.cliMissing', { cli: descriptor.command }) })
      emit(chat.id, { kind: 'ended' })
      return
    }
    const child = spawn(cli, claudeArgs(chat.continuing ? chat.sessionId : null), {
      cwd: chat.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    chat.process = child
    follow(chat, child, claudeEvents)
    // A write to a process that has exited is dropped.
    child.stdin?.on('error', () => undefined)
    child.on('error', (error) => {
      log.warn('chat process could not be started', { chat: chat.id, error })
      emit(chat.id, { kind: 'error', message: t('chat.cliFailed', { cli: descriptor.command }) })
    })
    child.on('exit', () => {
      chat.process = null
      if (!chat.closed) emit(chat.id, { kind: 'ended' })
    })
  },
  send(chat, text) {
    chat.process?.stdin?.write(userLine(text))
  },
}
