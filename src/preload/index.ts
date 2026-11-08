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
  window: {
    state: () => ipcRenderer.invoke('window:state'),
    act: (action) => ipcRenderer.invoke('window:action', action),
    onState: (listener) => subscribe('window:state', listener),
    onConfirmClose: (listener) => subscribe('window:confirm-close', listener),
  },
  panes: {
    attach: (pane) => ipcRenderer.invoke('pty:attach', { pane }),
    input: (pane, data) => send('pty:input', { pane, data }),
    resize: (pane, cols, rows) => send('pty:resize', { pane, cols, rows }),
    reveal: (paneId) => send('panes:reveal', { paneId }),
    onData: (listener) => subscribe('pty:data', listener),
  },
  agentState: {
    onChanged: (listener) => subscribe('agentState:changed', listener),
    onToast: (listener) => subscribe('agentState:toast', listener),
  },
  context: {
    onReading: (listener) => subscribe('context:reading', listener),
  },
  classifier: {
    status: () => ipcRenderer.invoke('classifier:status'),
    set: (on) => ipcRenderer.invoke('classifier:set', { on }),
    estimate: (day) => ipcRenderer.invoke('classifier:estimate', { day }),
    classifyEarlier: (day) => ipcRenderer.invoke('classifier:classify-earlier', { day }),
    stop: () => ipcRenderer.invoke('classifier:stop'),
  },
}

contextBridge.exposeInMainWorld('menkar', api)
