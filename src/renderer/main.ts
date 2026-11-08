import '@xterm/xterm/css/xterm.css'
import './style.css'
import {
  act,
  buildFrame,
  confirmClose,
  newSessionDialog,
  newWindow,
  render,
  toggleSidebar,
} from './app'
import { loadCatalog, t } from './i18n'
import { setAppKeyFilter } from './terminals'
import { dialogOpen, toast } from './ui'

await loadCatalog()
document.title = t('window.title')
buildFrame()

// Window-level keys, taken before the terminal sees them (for every event type of the key).
function appKey(event: KeyboardEvent): (() => void) | null {
  const key = event.key
  const ctrl = event.ctrlKey && !event.altKey && !event.metaKey
  if (key === 'F9' && !ctrl && !event.shiftKey) return toggleSidebar
  if (!ctrl) return null
  const lower = key.toLowerCase()
  if (event.shiftKey && lower === 't') return () => void newSessionDialog('claude')
  if (event.shiftKey && lower === 'w') {
    return () => {
      const tab = document.querySelector<HTMLElement>('.tab.selected')?.dataset.tab
      if (tab) void act({ type: 'closeTab', tab })
    }
  }
  if (event.shiftKey && lower === 'n') return () => void newWindow()
  if (key === 'Tab') return () => void act({ type: 'stepTab', direction: event.shiftKey ? -1 : 1 })
  if (key === 'PageDown' && !event.shiftKey)
    return () => void act({ type: 'stepTab', direction: 1 })
  if (key === 'PageUp' && !event.shiftKey) return () => void act({ type: 'stepTab', direction: -1 })
  return null
}

setAppKeyFilter((event) => !dialogOpen() && appKey(event) !== null)
document.addEventListener(
  'keydown',
  (event) => {
    if (dialogOpen()) return
    const run = appKey(event)
    if (!run) return
    event.preventDefault()
    event.stopPropagation()
    run()
  },
  true,
)

window.menkar.window.onState(render)
window.menkar.window.onConfirmClose((names) => void confirmClose(names))
const initial = await window.menkar.window.state()
if (initial) render(initial)
else toast(t('window.title'))
