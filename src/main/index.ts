import { join } from 'node:path'
import { app, BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { catalog, chooseLanguage, setLanguage, t } from '../core/i18n'
import { addSink, log, openFileSink } from '../core/log'
import { electronUserData, logFile } from '../core/paths'
import type {
  EventChannel,
  EventChannels,
  InvokeChannel,
  InvokeChannels,
  SendChannel,
  SendChannels,
} from '../shared/ipc'
import { broadcastSessions, sessions } from './sessions'
import { Terminal } from './terminal'

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

function emit<C extends EventChannel>(
  window: BrowserWindow,
  channel: C,
  payload: EventChannels[C],
): void {
  if (!window.isDestroyed()) window.webContents.send(channel, payload)
}

const terminals = new Map<number, Terminal>()

function terminalOf(event: IpcMainEvent): Terminal | undefined {
  return terminals.get(event.sender.id)
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    title: t('window.title'),
    backgroundColor: '#1e1e1e',
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  const id = window.webContents.id
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    terminals.get(id)?.kill()
    terminals.delete(id)
  })

  const devServer = process.env.ELECTRON_RENDERER_URL
  if (devServer) void window.loadURL(devServer)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
}

handle('terminal:start', (event, size) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || terminals.has(event.sender.id)) return undefined
  const terminal = new Terminal(size, app.getPath('home'), {
    data: (data) => emit(window, 'terminal:data', data),
    exit: (exitCode) => emit(window, 'terminal:exit', { exitCode }),
  })
  terminals.set(event.sender.id, terminal)
  return undefined
})
on('terminal:input', (event, data) => terminalOf(event)?.write(data))
on('terminal:resize', (event, size) => terminalOf(event)?.resize(size))

let language = chooseLanguage(undefined, [])

handle('i18n:catalog', () => ({ language, messages: catalog(language) }))
handle('sessions:list', () => sessions.list())
handle('sessions:set-hidden', async (_event, { ids, hidden }) => {
  await sessions.setHidden(ids, hidden)
  return undefined
})

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
  broadcastSessions()
  void sessions
    .start()
    .catch((error: unknown) => log.error('the first sessions scan failed', { error }))
  app.on('will-quit', () => sessions.stop())
  createWindow()
}

void start()

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
