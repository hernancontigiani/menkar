import { app, type IpcMainEvent, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { catalog, chooseLanguage, setLanguage } from '../core/i18n'
import { addSink, log, openFileSink } from '../core/log'
import { electronUserData, logFile } from '../core/paths'
import { NO_MEMBERSHIPS } from '../core/usage/history'
import type { InvokeChannel, InvokeChannels, SendChannel, SendChannels } from '../shared/ipc'
import { startAgentState } from './agentstate'
import { classifyAfterUsagePass, registerClassifierIpc } from './classifier'
import { startContextReadings } from './context'
import { projectsSnapshot, startProjects } from './projects'
import { broadcastSessions, sessions } from './sessions'
import { cliArguments, runUsageCommand, startUsagePasses } from './usage'
import {
  openFirstWindowIfNone,
  paneBuffer,
  paneInput,
  paneResize,
  revealPane,
  runAction,
  startWorkspace,
  windowState,
} from './workspace'

const LOG_FILE_MAX_BYTES = 1024 * 1024

function handle<C extends InvokeChannel>(
  channel: C,
  handler: (
    event: IpcMainInvokeEvent,
    request: InvokeChannels[C]['request'],
  ) => Promise<InvokeChannels[C]['response']> | InvokeChannels[C]['response'],
): void {
  ipcMain.handle(channel, handler)
}

function on<C extends SendChannel>(
  channel: C,
  listener: (event: IpcMainEvent, payload: SendChannels[C]) => void,
): void {
  ipcMain.on(channel, listener)
}

handle('window:state', (event) => windowState(event.sender) ?? null)
handle('window:action', (event, action) => runAction(event.sender, action))
handle('pty:attach', (_event, { pane }) => paneBuffer(pane))
on('pty:input', (_event, { pane, data }) => paneInput(pane, data))
on('pty:resize', (_event, { pane, cols, rows }) => paneResize(pane, cols, rows))
on('panes:reveal', (_event, { paneId }) => revealPane(paneId))

let language = chooseLanguage(undefined, [])

handle('i18n:catalog', () => ({ language, messages: catalog(language) }))
handle('sessions:list', () => sessions.list())
handle('sessions:set-hidden', async (_event, { ids, hidden }) => {
  await sessions.setHidden(ids, hidden)
  return undefined
})
handle('projects:get', () => projectsSnapshot())

// Before `ready`: Chromium opens its profile at startup. Windows and macOS keep Electron's default,
// already a per-app folder of the platform.
if (process.platform === 'linux') app.setPath('userData', electronUserData())

async function start(): Promise<void> {
  await app.whenReady()
  language = chooseLanguage(undefined, app.getPreferredSystemLanguages())
  setLanguage(language)
  try {
    const file = await openFileSink(logFile(), LOG_FILE_MAX_BYTES)
    addSink(file.sink)
    app.on('will-quit', () => void file.close())
  } catch (error) {
    log.error('log file could not be opened; logging to stderr only', { path: logFile(), error })
  }
  await startProjects()
  broadcastSessions()
  void sessions
    .start()
    .catch((error: unknown) => log.error('the first sessions scan failed', { error }))
  app.on('will-quit', () => sessions.stop())
  // Projects do not exist yet: every turn is written with none and takes its session's project
  // once one does.
  registerClassifierIpc()
  const usage = startUsagePasses(() => NO_MEMBERSHIPS, classifyAfterUsagePass)
  app.on('will-quit', () => usage.stop())
  // Agent state and context (plan 09): the panes' states and the statusline's readings.
  const stopAgentState = startAgentState()
  const stopContext = startContextReadings()
  app.on('will-quit', () => {
    stopAgentState()
    stopContext()
  })
  await startWorkspace()
  openFirstWindowIfNone()
}

const command = cliArguments(process.argv, app.isPackaged)
if (command[0] === 'usage') app.exit(runUsageCommand(command.slice(1)))
else void start()

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => openFirstWindowIfNone())
