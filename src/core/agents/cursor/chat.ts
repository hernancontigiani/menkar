import { spawn } from 'node:child_process'
import { cursorArgs, cursorEvents } from '../../chat/protocol'
import { emit, findOnPath, follow } from '../../chat/session'
import { t } from '../../i18n'
import { log } from '../../log'
import type { ChatStrategy } from '../types'
import { descriptor } from './descriptor'

// One `cursor-agent -p` per message, resuming the session: nothing runs until a message is sent.
export const chat: ChatStrategy = {
  open() {},
  send(chat, text, env) {
    const cli = findOnPath(descriptor.command)
    if (cli === null) {
      emit(chat.id, { kind: 'error', message: t('chat.cliMissing', { cli: descriptor.command }) })
      emit(chat.id, { kind: 'turnEnd' })
      return
    }
    const child = spawn(cli, cursorArgs(chat.variant, chat.sessionId, text), {
      cwd: chat.cwd,
      env,
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
      emit(chat.id, { kind: 'error', message: t('chat.cliFailed', { cli: descriptor.command }) })
    })
    // A turn that ends without its result line (stopped, crashed) unblocks the input quietly.
    child.on('exit', () => {
      if (chat.process === child) chat.process = null
      if (!ended && !chat.closed) emit(chat.id, { kind: 'turnEnd' })
    })
  },
}
