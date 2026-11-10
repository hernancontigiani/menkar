import '@xterm/xterm/css/xterm.css'
import './style.css'
import './segmented.css'
import { matchShortcut, type ShortcutOf } from '../core/shortcuts'
import { openAddSession } from './addsession'
import {
  act,
  buildFrame,
  closeTabAsking,
  confirmClose,
  newWindow,
  render,
  saveSelectedFile,
  selectedTabView,
  toggleDrawer,
  toggleSidebar,
} from './app'
import { isMarkdown } from './editor'
import { openFileDialog } from './fileopen'
import { loadCatalog, t } from './i18n'
import { beginPrefix, endPrefix, prefixWaiting, setPrefixHandlers, startsPrefix } from './keys'
import { goToAgent, projectSwitcher, quickSwitcher } from './switcher'
import { setAppKeyFilter } from './terminals'
import { dialogOpen, toast } from './ui'

await loadCatalog()
document.title = t('window.title')
buildFrame()

const WINDOW_ACTIONS: Record<ShortcutOf<'window'>, () => void> = {
  newSession: () => openAddSession('new'),
  addExisting: () => openAddSession('existing'),
  openFile: () => openFileDialog(),
  closeTab: () => {
    const tab = document.querySelector<HTMLElement>('.tab.selected')?.dataset.tab
    if (tab) void closeTabAsking(tab)
  },
  nextTab: () => void act({ type: 'stepTab', direction: 1 }),
  previousTab: () => void act({ type: 'stepTab', direction: -1 }),
  settings: () => void act({ type: 'openSettings' }),
  switcher: () => quickSwitcher(),
  projectSwitcher: () => projectSwitcher(),
  sidebar: toggleSidebar,
  newWindow: () => void newWindow(),
  drawer: toggleDrawer,
}

// Window-level keys, taken before the terminal sees them (for every event type of the key).
function appKey(event: KeyboardEvent): (() => void) | null {
  const id = matchShortcut('window', event)
  if (id) return WINDOW_ACTIONS[id]
  // The file keys act only while a file tab is selected; in a terminal they are the terminal's.
  const tab = selectedTabView()
  const fileTab = tab?.file
  if (!tab || !fileTab) return null
  switch (matchShortcut('file', event)) {
    case 'save':
      return () => void saveSelectedFile()
    case 'preview':
      return () =>
        (fileTab.preview || isMarkdown(fileTab.path)) &&
        void act({ type: 'togglePreview', tab: tab.id })
    default:
      return null
  }
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
  preferences: () => void act({ type: 'openSettings' }),
})

window.menkar.window.onState(render)
window.menkar.window.onConfirmClose((names) => void confirmClose(names))
const initial = await window.menkar.window.state()
if (initial) render(initial)
else toast(t('window.title'))
