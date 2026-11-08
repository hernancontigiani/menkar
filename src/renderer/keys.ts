import type { Key } from '../core/i18n'
import { type Direction, focusTarget } from '../core/panes'
import type { TabView } from '../shared/workspace'
import {
  act,
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

const HELP: ReadonlyArray<[string, Key]> = [
  ['v  %', 'help.splitRight'],
  ['-  "', 'help.splitDown'],
  ['h  ←', 'help.left'],
  ['j  ↓', 'help.down'],
  ['k  ↑', 'help.up'],
  ['l  →', 'help.right'],
  ['Tab', 'help.nextPane'],
  ['z', 'help.zoom'],
  ['x', 'help.closePane'],
  ['c', 'help.newSession'],
  ['n', 'help.nextTab'],
  ['p', 'help.previousTab'],
  ['1–9', 'help.goToTab'],
  ['N', 'help.addSession'],
  ['T', 'help.renameTab'],
  ['X', 'help.closeTab'],
  ['g', 'help.goToAgent'],
  ['b', 'help.toggleSidebar'],
  ['s', 'help.preferences'],
  ['?', 'help.help'],
  ['Ctrl+B', 'help.sendCtrlB'],
]

export function helpLines(): string[] {
  return HELP.map(([keys, description]) => `${keys.padEnd(8)} ${translate(description)}`)
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

function runCommand(event: KeyboardEvent): void {
  const key = event.key
  const tab = selectedTab()
  if (event.ctrlKey && key.toLowerCase() === 'b') {
    const pane = tab ? focusedOf(tab) : undefined
    if (pane && tab?.kind !== 'file') window.menkar.panes.input(pane, '\x02')
    return
  }
  if (/^[1-9]$/.test(key)) {
    void act({ type: 'nthTab', n: Number(key) })
    return
  }
  switch (key) {
    case 'v':
    case '%':
      void split('horizontal')
      return
    case '-':
    case '"':
      void split('vertical')
      return
    case 'h':
    case 'ArrowLeft':
      moveFocus('left')
      return
    case 'j':
    case 'ArrowDown':
      moveFocus('down')
      return
    case 'k':
    case 'ArrowUp':
      moveFocus('up')
      return
    case 'l':
    case 'ArrowRight':
      moveFocus('right')
      return
    case 'Tab':
      nextPane()
      return
    case 'z':
      toggleZoom()
      return
    case 'x':
      closePane()
      return
    case 'c':
      handlers?.newSession()
      return
    case 'n':
      void act({ type: 'stepTab', direction: 1 })
      return
    case 'p':
      void act({ type: 'stepTab', direction: -1 })
      return
    case 'N':
      handlers?.addExisting()
      return
    case 'T':
      handlers?.renameTab()
      return
    case 'X':
      if (tab) void act({ type: 'closeTab', tab: tab.id })
      return
    case 'g':
      handlers?.goToAgent()
      return
    case 'b':
      toggleSidebar()
      return
    case 's':
      handlers?.preferences()
      return
    case '?':
      showHelp()
      return
    default:
  }
}
