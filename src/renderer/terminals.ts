import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { type ITheme, Terminal } from '@xterm/xterm'
import { OutputJoin } from '../core/output'
import type { Settings } from '../core/settings'
import { matchShortcut, type ShortcutOf } from '../core/shortcuts'
import type { Look } from '../core/theme'
import type { PaneView } from '../shared/workspace'
import { el, icon } from './dom'
import { t } from './i18n'
import { attachLinks } from './links'
import { showMenu } from './ui'

interface View {
  readonly id: string
  readonly root: HTMLElement
  readonly term: Terminal
  readonly fit: FitAddon
  readonly search: SearchAddon
  findBar: HTMLElement | null
  readonly output: OutputJoin
}

const views = new Map<string, View>()
// Panes whose session reports to the orchestrator: the user's keys, pastes and drops never reach
// xterm there, while xterm's own replies to the agent's queries still go out through onData.
const readOnlyPanes = new Set<string>()
const USER_INPUT_EVENTS = [
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'paste',
  'drop',
] as const
let focusListener: (paneId: string) => void = () => {}
export function onPaneFocus(listener: (paneId: string) => void): void {
  focusListener = listener
}

export function focusPane(id: string): void {
  views.get(id)?.term.focus()
}

export function paneRect(id: string): DOMRect | null {
  const root = views.get(id)?.root
  return root?.isConnected && root.offsetWidth > 0 ? root.getBoundingClientRect() : null
}
let lastSettings: Settings | undefined
let lastLook: Look | undefined

// Keys the window handles: the terminal never sees them, for any event type.
export type AppKeyFilter = (event: KeyboardEvent) => boolean
let isAppKey: AppKeyFilter = () => false
export function setAppKeyFilter(filter: AppKeyFilter): void {
  isAppKey = filter
}

// Without a palette (Terminal colors set to Neutral) the terminal keeps colors close to VTE's.
function themeOf(look: Look | undefined): ITheme {
  const palette = look?.terminal
  if (!palette)
    return look?.dark
      ? { background: '#1e1e1e', foreground: '#ffffff' }
      : { background: '#ffffff', foreground: '#000000', cursor: '#000000' }
  const [
    black,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    white,
    brightBlack,
    brightRed,
    brightGreen,
    brightYellow,
    brightBlue,
    brightMagenta,
    brightCyan,
    brightWhite,
  ] = palette.ansi
  return {
    background: palette.bg,
    foreground: palette.fg,
    cursor: palette.fg,
    ...(black ? { black } : {}),
    ...(red ? { red } : {}),
    ...(green ? { green } : {}),
    ...(yellow ? { yellow } : {}),
    ...(blue ? { blue } : {}),
    ...(magenta ? { magenta } : {}),
    ...(cyan ? { cyan } : {}),
    ...(white ? { white } : {}),
    ...(brightBlack ? { brightBlack } : {}),
    ...(brightRed ? { brightRed } : {}),
    ...(brightGreen ? { brightGreen } : {}),
    ...(brightYellow ? { brightYellow } : {}),
    ...(brightBlue ? { brightBlue } : {}),
    ...(brightMagenta ? { brightMagenta } : {}),
    ...(brightCyan ? { brightCyan } : {}),
    ...(brightWhite ? { brightWhite } : {}),
  }
}

// "Family Size" in points; empty is the system monospace at 10 pt.
function fontOf(setting: string): { family: string; size: number } {
  const match = /^(.*?)\s+(\d+(?:\.\d+)?)$/.exec(setting.trim())
  const family = (match ? match[1] : setting.trim()) || 'monospace'
  const points = match ? Number(match[2]) : 10
  return { family: `${family}, monospace`, size: (points * 4) / 3 }
}

export function applyTerminalLook(settings: Settings, look: Look): void {
  lastSettings = settings
  lastLook = look
  const font = screenFont(settings)
  // The file tabs' editors read the same font through these.
  document.documentElement.style.setProperty('--term-font', font.family)
  document.documentElement.style.setProperty('--term-font-size', `${font.size}px`)
  for (const view of views.values()) {
    view.term.options.theme = themeOf(look)
    view.term.options.fontFamily = font.family
    view.term.options.fontSize = font.size
    view.term.options.scrollback = settings.scrollback
    refit(view)
  }
}

function refit(view: View): void {
  if (!view.root.isConnected || view.root.offsetWidth === 0) return
  view.fit.fit()
}

window.menkar.panes.onData(({ pane, data, end }) => {
  const view = views.get(pane)
  const fresh = view?.output.chunk({ data, end })
  if (fresh) view?.term.write(fresh)
})

function toggleFind(view: View): void {
  if (view.findBar) {
    closeFind(view)
    return
  }
  const input = el('input', { type: 'text', placeholder: t('find.placeholder') })
  const decorations = { matchOverviewRuler: '#888', activeMatchColorOverviewRuler: '#fff' }
  const previous = () =>
    view.search.findPrevious(input.value, { caseSensitive: false, regex: false, decorations })
  const next = () =>
    view.search.findNext(input.value, { caseSensitive: false, regex: false, decorations })
  const up = el('button', { title: t('find.previous') }, icon('up'))
  const down = el('button', { title: t('find.next') }, icon('down'))
  const close = el('button', { 'aria-label': t('tab.close') }, icon('close'))
  up.addEventListener('click', previous)
  down.addEventListener('click', next)
  close.addEventListener('click', () => closeFind(view))
  input.addEventListener('input', () => {
    if (input.value) previous()
    else view.search.clearDecorations()
  })
  const findActions: Record<ShortcutOf<'find'>, () => void> = {
    findPrevious: previous,
    findNext: next,
    findClose: () => closeFind(view),
  }
  input.addEventListener('keydown', (event) => {
    const id = matchShortcut('find', event)
    if (!id) return
    findActions[id]()
    event.preventDefault()
    event.stopPropagation()
  })
  view.findBar = el('div', { class: 'find-bar' }, input, up, down, close)
  view.root.prepend(view.findBar)
  input.focus()
}

function closeFind(view: View): void {
  view.search.clearDecorations()
  view.findBar?.remove()
  view.findBar = null
  view.term.focus()
}

// The Font setting's size on the screen: the page is zoomed by Interface size, which must not
// reach the terminals, so their size is divided by it.
function screenFont(settings: Settings | undefined): { family: string; size: number } {
  const font = fontOf(settings?.font ?? '')
  return { family: font.family, size: font.size / ((settings?.ui_scale ?? 100) / 100) }
}

function create(pane: PaneView, label?: string): View {
  const font = screenFont(lastSettings)
  const term = new Terminal({
    fontFamily: font.family,
    fontSize: font.size,
    scrollback: lastSettings?.scrollback ?? 10_000,
    theme: themeOf(lastLook),
    allowProposedApi: true,
    scrollOnUserInput: true,
  })
  const fit = new FitAddon()
  const search = new SearchAddon()
  term.loadAddon(fit)
  term.loadAddon(search)
  attachLinks(term)
  const host = el('div', { class: 'term' })
  const frame = el(
    'div',
    { class: 'frame' },
    el('span', { class: 'frame-label' }, label ?? pane.agent),
    host,
  )
  const root = el('div', { class: 'pane', 'data-pane': pane.id }, frame)
  // Shown while the view is scrolled up from the end; output arriving meanwhile marks it, and the
  // view stays where the reader left it.
  const jump = el(
    'button',
    { class: 'jump-bottom', title: t('terminal.jumpBottom'), hidden: '' },
    icon('down'),
  )
  frame.append(jump)
  const scrolledUp = () => term.buffer.active.viewportY < term.buffer.active.baseY
  const syncJump = (wrote: boolean) => {
    const up = scrolledUp()
    jump.hidden = !up
    if (!up) jump.classList.remove('fresh')
    else if (wrote) jump.classList.add('fresh')
  }
  term.onScroll(() => syncJump(false))
  term.onWriteParsed(() => syncJump(true))
  jump.addEventListener('click', () => {
    term.scrollToBottom()
    syncJump(false)
    term.focus()
  })
  const view: View = {
    id: pane.id,
    root,
    term,
    fit,
    search,
    findBar: null,
    output: new OutputJoin(),
  }
  term.open(host)
  const terminalActions: Record<ShortcutOf<'terminal'>, () => void> = {
    newline: () => window.menkar.panes.typed(pane.id, '\x1b\r'),
    copy: () => void window.menkar.window.act({ type: 'copyText', text: term.getSelection() }),
    paste: () => pasteClipboard(),
    find: () => toggleFind(view),
    bottom: () => term.scrollToBottom(),
  }
  const pasteClipboard = () => {
    if (readOnlyPanes.has(pane.id)) return
    void navigator.clipboard.readText().then((text) => term.paste(text))
  }
  // Captured on the host, before xterm's own listeners on its textarea see them.
  for (const type of USER_INPUT_EVENTS)
    host.addEventListener(
      type,
      (event) => {
        if (!readOnlyPanes.has(pane.id)) return
        event.preventDefault()
        event.stopImmediatePropagation()
      },
      true,
    )
  term.attachCustomKeyEventHandler((event) => {
    if (isAppKey(event)) return false
    // Every other modified End is the agent's (xterm sends it on); only the table's is the view's.
    const id = matchShortcut('terminal', event)
    // A read-only pane keeps the view's keys (copy, find, the end) and drops the rest, for keydown
    // and keypress alike; Chromium must not type it into xterm's textarea either.
    if (!id && readOnlyPanes.has(pane.id)) {
      event.preventDefault()
      return false
    }
    if (!id) return true
    // Returning false stops only xterm: Chromium would still run its own command for the key, and
    // Ctrl+Shift+V (paste as plain text) pasted the clipboard a second time.
    event.preventDefault()
    if (event.type === 'keydown') terminalActions[id]()
    return false
  })
  // The terminal's own menu, as GNOME Terminal's: each item is the user's action, as its keys are.
  // Opened on contextmenu, after xterm handled the button press, so a selection is kept.
  host.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    const selection = term.getSelection()
    const back = () => term.focus()
    showMenu(
      [
        {
          label: t('terminal.copy'),
          shortcut: 'Ctrl+Shift+C',
          disabled: !term.hasSelection(),
          run: () => {
            void window.menkar.window.act({ type: 'copyText', text: selection })
            back()
          },
        },
        {
          label: t('terminal.paste'),
          shortcut: 'Ctrl+Shift+V',
          disabled: readOnlyPanes.has(pane.id),
          run: () => {
            pasteClipboard()
            back()
          },
        },
        {
          label: t('terminal.selectAll'),
          run: () => {
            term.selectAll()
            back()
          },
        },
        {
          label: t('terminal.find'),
          shortcut: 'Ctrl+Shift+G',
          run: () => {
            if (!view.findBar) toggleFind(view)
            else view.findBar.querySelector('input')?.focus()
          },
        },
      ],
      { x: event.clientX, y: event.clientY },
    )
  })
  term.onData((data) => window.menkar.panes.input(pane.id, data))
  term.textarea?.addEventListener('focus', () => focusListener(pane.id))
  term.onResize(({ cols, rows }) => window.menkar.panes.resize(pane.id, cols, rows))
  new ResizeObserver(() => refit(view)).observe(host)
  void window.menkar.panes.attach(pane.id).then(({ buffer, end }) => {
    term.write(buffer + view.output.attach(end))
  })
  views.set(pane.id, view)
  return view
}

export interface PaneBanner {
  readonly kind: string
  readonly tone: 'warning' | 'info'
  readonly text: string
  readonly button: string
  readonly run: () => void
}

// The bar across the top of a pane (decision 1.101), rebuilt only when its kind changes.
export function setPaneBanner(paneId: string, banner: PaneBanner | null, readOnly: boolean): void {
  if (readOnly) readOnlyPanes.add(paneId)
  else readOnlyPanes.delete(paneId)
  const view = views.get(paneId)
  if (!view) return
  view.root.classList.toggle('read-only', readOnly)
  const shown = view.root.querySelector<HTMLElement>(':scope > .pane-banner')
  if (shown?.dataset.kind === banner?.kind) return
  shown?.remove()
  if (!banner) return
  const button = el('button', {}, banner.button)
  button.addEventListener('click', banner.run)
  view.root.prepend(
    el(
      'div',
      { class: `pane-banner ${banner.tone}`, 'data-kind': banner.kind, role: 'status' },
      el('span', { class: 'bar-text' }, banner.text),
      button,
    ),
  )
}

// The DOM of a pane, created once and moved between tab bodies as the layout changes.
export function paneElement(pane: PaneView, label?: string): HTMLElement {
  return (views.get(pane.id) ?? create(pane, label)).root
}

export function forgetPanesExcept(live: ReadonlySet<string>): void {
  for (const [id, view] of views) {
    if (live.has(id)) continue
    view.term.dispose()
    view.root.remove()
    views.delete(id)
  }
}

export function showPanes(ids: readonly string[], focus: boolean): void {
  for (const id of ids) {
    const view = views.get(id)
    if (!view) continue
    requestAnimationFrame(() => {
      refit(view)
      window.menkar.panes.resize(id, view.term.cols, view.term.rows)
    })
  }
  if (focus && ids[0]) views.get(ids[0])?.term.focus()
}

export function terminalText(id: string): string {
  const view = views.get(id)
  if (!view) return ''
  const buffer = view.term.buffer.active
  const lines: string[] = []
  for (let i = 0; i < buffer.length; i += 1)
    lines.push(buffer.getLine(i)?.translateToString(true) ?? '')
  return lines.join('\n')
}
