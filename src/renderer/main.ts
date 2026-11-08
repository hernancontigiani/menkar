import '@xterm/xterm/css/xterm.css'
import './style.css'
import { openAddSession } from './addsession'
import { act, buildFrame, confirmClose, newWindow, render, toggleSidebar } from './app'
import { loadCatalog, t } from './i18n'
import { beginPrefix, endPrefix, prefixWaiting, setPrefixHandlers, startsPrefix } from './keys'
import { goToAgent, quickSwitcher } from './switcher'
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
  if (event.shiftKey && lower === 't') return () => openAddSession('new')
  if (event.shiftKey && lower === 'f') return () => openAddSession('existing')
  if (event.shiftKey && lower === 'w') {
    return () => {
      const tab = document.querySelector<HTMLElement>('.tab.selected')?.dataset.tab
      if (tab) void act({ type: 'closeTab', tab })
    }
  }
  if (event.shiftKey && lower === 'n') return () => void newWindow()
  if (event.shiftKey && lower === 'k') return () => quickSwitcher()
  if (key === 'Tab') return () => void act({ type: 'stepTab', direction: event.shiftKey ? -1 : 1 })
  if (key === 'PageDown' && !event.shiftKey)
    return () => void act({ type: 'stepTab', direction: 1 })
  if (key === 'PageUp' && !event.shiftKey) return () => void act({ type: 'stepTab', direction: -1 })
  return null
}

// The key that ended the prefix also arrives as a keypress after its keydown; it is swallowed too,
// until the key goes up, so the terminal never sees it.
let swallow = false
document.addEventListener(
  'keyup',
  () => {
    swallow = false
  },
  true,
)

setAppKeyFilter((event) => {
  if (swallow || prefixWaiting()) return true
  if (startsPrefix(event)) return true
  return !dialogOpen() && appKey(event) !== null
})
document.addEventListener(
  'keydown',
  (event) => {
    if (endPrefix(event)) {
      swallow = true
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (startsPrefix(event)) {
      beginPrefix()
      swallow = true
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (dialogOpen()) return
    const run = appKey(event)
    if (!run) return
    event.preventDefault()
    event.stopPropagation()
    run()
  },
  true,
)

setPrefixHandlers({
  newSession: () => openAddSession('new'),
  addExisting: () => openAddSession('existing'),
  goToAgent: () => void goToAgent(),
  renameTab: () => undefined,
  preferences: () => undefined,
})

window.menkar.window.onState(render)
window.menkar.window.onConfirmClose((names) => void confirmClose(names))
const initial = await window.menkar.window.state()
if (initial) render(initial)
else toast(t('window.title'))
