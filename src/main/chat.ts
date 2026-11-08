import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { mcpSections } from '../core/chat/mcp'
import type { Reply } from '../core/chat/model'
import {
  chatOf,
  closeAllChats,
  closeChat,
  cursorTurn,
  ghosttyInstalled,
  installedAgents,
  onChatEvent,
  openInGhostty,
  startChat,
} from '../core/chat/processes'
import { allowLine, denyLine, userLine } from '../core/chat/protocol'
import { t } from '../core/i18n'
import { agentPaths } from '../core/paths'
import { settingsOf, withSetting } from '../core/settings'
import type { ChatInfo, InvokeChannel, InvokeChannels } from '../shared/ipc'
import { sessions } from './sessions'

// Chat tabs on Electron's side: the folder chooser, a chat's events sent to the windows, and the
// IPC the view uses. The processes are src/core/chat/processes.ts.
export { closeAllChats, closeChat, ghosttyInstalled, openInGhostty, startChat }

onChatEvent((chatId, event) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('chat:event', { chatId, event })
  }
})

// "New {agent} chat…": a folder from the system chooser, remembered for the next one.
export async function chooseChatFolder(parent: BrowserWindow): Promise<string | null> {
  const remembered = settingsOf(await sessions.currentState()).new_session_dir
  const result = await dialog.showOpenDialog(parent, {
    title: t('chat.chooseFolder'),
    properties: ['openDirectory'],
    ...(remembered && existsSync(remembered) ? { defaultPath: remembered } : {}),
  })
  const folder = result.canceled ? undefined : result.filePaths[0]
  if (!folder) return null
  await sessions.updateState((state) => withSetting(state, 'new_session_dir', folder))
  return folder
}

function handle<C extends InvokeChannel>(
  channel: C,
  handler: (request: InvokeChannels[C]['request']) => Promise<InvokeChannels[C]['response']>,
): void {
  ipcMain.handle(channel, (_event, request: InvokeChannels[C]['request']) => handler(request))
}

export function registerChatIpc(): void {
  handle('chat:agents', async () => [...installedAgents()])
  handle('chat:info', async ({ chatId }): Promise<ChatInfo | null> => {
    const chat = chatOf(chatId)
    return chat
      ? {
          agent: chat.variant.agent,
          key: chat.variant.key,
          continuing: chat.continuing,
          title: chat.title,
          tooltip: chat.tooltip,
        }
      : null
  })
  handle('chat:send', async ({ chatId, text }) => {
    const chat = chatOf(chatId)
    if (!chat) return undefined
    if (chat.variant.transport === 'stdin-stream') chat.process?.stdin?.write(userLine(text))
    else cursorTurn(chat, text)
    return undefined
  })
  handle('chat:reply', async ({ chatId, reply, declined }) => {
    const r = reply as Reply
    const line = r.allow ? allowLine(r.requestId, r.input) : denyLine(r.requestId, declined)
    chatOf(chatId)?.process?.stdin?.write(line)
    return undefined
  })
  handle('mcp:sections', async () => {
    let text: string | null = null
    try {
      text = await readFile(agentPaths().claudeConfig, 'utf8')
    } catch {
      text = null // no file, or one that cannot be read: nothing configured
    }
    return mcpSections(text)
  })
  handle('chat:stop', async ({ chatId }) => {
    chatOf(chatId)?.process?.kill('SIGINT')
    return undefined
  })
}
