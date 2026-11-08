import { join } from 'node:path'
import { app, BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent, ipcMain } from 'electron'
import type {
  EventChannel,
  EventChannels,
  InvokeChannel,
  InvokeChannels,
  SendChannel,
  SendChannels,
} from '../shared/ipc'
import { Terminal } from './terminal'

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

void app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
