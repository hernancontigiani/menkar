import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import type {
  EventChannel,
  EventChannels,
  MenkarApi,
  SendChannel,
  SendChannels,
} from '../shared/ipc'

function send<C extends SendChannel>(channel: C, payload: SendChannels[C]): void {
  ipcRenderer.send(channel, payload)
}

function subscribe<C extends EventChannel>(
  channel: C,
  listener: (payload: EventChannels[C]) => void,
): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: EventChannels[C]) => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.off(channel, wrapped)
}

const api: MenkarApi = {
  i18n: {
    catalog: () => ipcRenderer.invoke('i18n:catalog'),
  },
  projects: {
    get: () => ipcRenderer.invoke('projects:get'),
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    setHidden: (ids, hidden) => ipcRenderer.invoke('sessions:set-hidden', { ids, hidden }),
    onChanged: (listener) => subscribe('sessions:changed', listener),
  },
  terminal: {
    start: (size) => ipcRenderer.invoke('terminal:start', size),
    write: (data) => send('terminal:input', data),
    resize: (size) => send('terminal:resize', size),
    onData: (listener) => subscribe('terminal:data', listener),
    onExit: (listener) => subscribe('terminal:exit', listener),
  },
}

contextBridge.exposeInMainWorld('menkar', api)
