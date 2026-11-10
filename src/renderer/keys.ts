import { type Direction, focusTarget } from '../core/panes'
import { matchShortcut, SHORTCUTS, type ShortcutOf, shownChords } from '../core/shortcuts'
import type { TabView } from '../shared/workspace'
import {
  act,
  closeTabAsking,
  currentState,
  focusedPane,
  render,
  setPrefixPill,
  toggleSidebar,
  zoomedTabs,
} from './app'
import { t, translate } from './i18n'
import { focusPane, onPaneFocus, paneRect } from './terminals'
import { dialogOpen, showDialog, toast } from './ui'

// The commands the prefix runs that live elsewhere: dialogs this module does not own.
export interface PrefixHandlers {
  newSession(): void
  addExisting(): void
  goToAgent(): void
  renameTab(): void
  preferences(): void
}

let handlers: PrefixHandlers | undefined
export function setPrefixHandlers(h: PrefixHandlers): void {
  handlers = h
}

onPaneFocus((paneId) => {
  const tab = currentState()?.tabs.find((tb) => tb.panes.some((p) => p.id === paneId))
  if (tab) focusedPane.set(tab.id, paneId)
})

let waiting = false
export const prefixWaiting = () => waiting

const MODIFIERS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'AltGraph',
  'CapsLock',
  'OS',
  'Super',
  'Hyper',
])

// Ctrl+B starts the prefix unless the focus is in a text field or a dialog, which keep their own.
export function startsPrefix(event: KeyboardEvent): boolean {
  if (waiting || dialogOpen()) return false
  if (!event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'b')
    return false
  const active = document.activeElement
  const textField =
    active instanceof HTMLInputElement ||
    (active instanceof HTMLTextAreaElement && !active.classList.contains('xterm-helper-textarea'))
  return !textField
}

export function beginPrefix(): void {
  waiting = true
  setPrefixPill(true)
}

// The key after the prefix: run its command, or nothing; a modifier alone keeps waiting.
export function endPrefix(event: KeyboardEvent): boolean {
  if (!waiting) return false
  if (MODIFIERS.has(event.key)) return true
  waiting = false
  setPrefixPill(false)
  runCommand(event)
  return true
}

function selectedTab(): TabView | undefined {
  const s = currentState()
  return s?.tabs.find((tb) => tb.id === s.selectedTab && tb.project === s.shown)
}

function focusedOf(tab: TabView): string | undefined {
  const remembered = focusedPane.get(tab.id)
  return tab.panes.some((p) => p.id === remembered) ? remembered : tab.panes[0]?.id
}

function terminalTab(): TabView | undefined {
  const tab = selectedTab()
  return tab && tab.kind !== 'file' && tab.panes.length > 0 ? tab : undefined
}

async function split(orientation: 'horizontal' | 'vertical'): Promise<void> {
  const tab = terminalTab()
  if (!tab) return
  if (tab.panes.length >= 2) {
    toast(t('layout.twoPanesMax'))
    return
  }
  zoomedTabs.delete(tab.id)
  const { value } = await act({ type: 'splitPane', tab: tab.id, orientation })
  if (typeof value === 'string') {
    focusedPane.set(tab.id, value)
    requestAnimationFrame(() => focusPane(value))
  }
}

function moveFocus(direction: Direction): void {
  const tab = terminalTab()
  if (!tab) return
  const visible = tab.panes.filter((p) => paneRect(p.id) !== null)
  const rects = visible.map((p) => paneRect(p.id) as DOMRect)
  const from = visible.findIndex((p) => p.id === focusedOf(tab))
  if (from < 0) return
  const target = visible[focusTarget(rects, from, direction)]
  if (target) {
    focusedPane.set(tab.id, target.id)
    focusPane(target.id)
  }
}

function nextPane(): void {
  const tab = terminalTab()
  if (!tab || tab.panes.length < 2) return
  const index = tab.panes.findIndex((p) => p.id === focusedOf(tab))
  const next = tab.panes[(index + 1) % tab.panes.length]
  if (next) {
    focusedPane.set(tab.id, next.id)
    focusPane(next.id)
  }
}

function toggleZoom(): void {
  const tab = terminalTab()
  const state = currentState()
  if (!tab || tab.panes.length < 2 || !state) return
  if (zoomedTabs.has(tab.id)) zoomedTabs.delete(tab.id)
  else zoomedTabs.add(tab.id)
  render(state)
}

function closePane(): void {
  const tab = terminalTab()
  const pane = tab ? focusedOf(tab) : undefined
  if (tab && pane) {
    zoomedTabs.delete(tab.id)
    void act({ type: 'closePane', pane })
  }
}

// The prefix's rows of the shortcuts table, as `keys  what` lines.
export function helpLines(): string[] {
  return SHORTCUTS.filter((row) => row.group === 'prefix').map((row) => {
    const keys =
      row.id === 'sendCtrlB'
        ? 'Ctrl+B'
        : shownChords(row)
            .map((caps) => caps.slice(2).join('+'))
            .join('  ')
    const text = translate(row.description)
    return `${keys.padEnd(8)} ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  })
}

function showHelp(): void {
  void showDialog({
    heading: t('help.heading'),
    body: helpLines().join('\n'),
    monospace: true,
    buttons: [{ label: t('dialog.ok'), value: 'ok' }],
    defaultValue: 'ok',
  })
}

const PREFIX_ACTIONS: Record<ShortcutOf<'prefix'>, (event: KeyboardEvent) => void> = {
  splitRight: () => void split('horizontal'),
  splitDown: () => void split('vertical'),
  paneLeft: () => moveFocus('left'),
  paneDown: () => moveFocus('down'),
  paneUp: () => moveFocus('up'),
  paneRight: () => moveFocus('right'),
  nextPane,
  zoom: toggleZoom,
  closePane,
  prefixNewSession: () => handlers?.newSession(),
  prefixNextTab: () => void act({ type: 'stepTab', direction: 1 }),
  prefixPreviousTab: () => void act({ type: 'stepTab', direction: -1 }),
  nthTab: (event) => void act({ type: 'nthTab', n: Number(event.key) }),
  prefixAddExisting: () => handlers?.addExisting(),
  renameTab: () => handlers?.renameTab(),
  prefixCloseTab: () => {
    const tab = selectedTab()
    if (tab) void closeTabAsking(tab.id)
  },
  goToAgent: () => handlers?.goToAgent(),
  prefixSidebar: toggleSidebar,
  prefixSettings: () => handlers?.preferences(),
  help: showHelp,
  sendCtrlB: () => {
    const tab = selectedTab()
    const pane = tab ? focusedOf(tab) : undefined
    if (pane && tab?.kind !== 'file') window.menkar.panes.input(pane, '\x02')
  },
}

function runCommand(event: KeyboardEvent): void {
  const id = matchShortcut('prefix', event)
  if (id) PREFIX_ACTIONS[id](event)
}
