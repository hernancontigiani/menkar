import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { type ITheme, Terminal } from '@xterm/xterm'
import type { Settings } from '../core/settings'
import type { Look } from '../core/theme'
import type { PaneView } from '../shared/workspace'
import { el, icon } from './dom'
import { t } from './i18n'

interface View {
  readonly id: string
  readonly root: HTMLElement
  readonly term: Terminal
  readonly fit: FitAddon
  readonly search: SearchAddon
  findBar: HTMLElement | null
  attached: boolean
}

const views = new Map<string, View>()
let lastSettings: Settings | undefined
let lastLook: Look | undefined

// Keys the window handles: the terminal never sees them, for any event type.
export type AppKeyFilter = (event: KeyboardEvent) => boolean
let isAppKey: AppKeyFilter = () => false
export function setAppKeyFilter(filter: AppKeyFilter): void {
  isAppKey = filter
}

// Without a theme (Classic with Default) the terminal keeps colors close to VTE's defaults.
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
  const font = fontOf(settings.font)
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

window.menkar.panes.onData(({ pane, data }) => {
  const view = views.get(pane)
  // Until attach answers, output is already in the buffer it returns: IPC keeps the order.
  if (view?.attached) view.term.write(data)
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
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeFind(view)
    else if (event.key === 'Enter') previous()
    else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'g') previous()
    else if (event.ctrlKey && event.key.toLowerCase() === 'g') next()
    else return
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

function create(pane: PaneView): View {
  const font = fontOf(lastSettings?.font ?? '')
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
  const host = el('div', { class: 'term' })
  const frame = el(
    'div',
    { class: 'frame' },
    el('span', { class: 'frame-label' }, pane.agent),
    host,
  )
  const root = el('div', { class: 'pane', 'data-pane': pane.id }, frame)
  const view: View = { id: pane.id, root, term, fit, search, findBar: null, attached: false }
  term.open(host)
  term.attachCustomKeyEventHandler((event) => {
    if (isAppKey(event)) return false
    const key = event.key
    if (key === 'Enter' && event.shiftKey && !event.ctrlKey) {
      if (event.type === 'keydown') window.menkar.panes.input(pane.id, '\x1b\r')
      return false
    }
    if (event.ctrlKey && event.shiftKey && !event.altKey) {
      const k = key.toLowerCase()
      if (k === 'c' || k === 'v' || k === 'g') {
        if (event.type === 'keydown') {
          if (k === 'c')
            void window.menkar.window.act({ type: 'copyText', text: term.getSelection() })
          if (k === 'v') void navigator.clipboard.readText().then((text) => term.paste(text))
          if (k === 'g') toggleFind(view)
        }
        return false
      }
    }
    return true
  })
  term.onData((data) => window.menkar.panes.input(pane.id, data))
  term.onResize(({ cols, rows }) => window.menkar.panes.resize(pane.id, cols, rows))
  new ResizeObserver(() => refit(view)).observe(host)
  void window.menkar.panes.attach(pane.id).then((buffer) => {
    term.write(buffer)
    view.attached = true
  })
  views.set(pane.id, view)
  return view
}

// The DOM of a pane, created once and moved between tab bodies as the layout changes.
export function paneElement(pane: PaneView): HTMLElement {
  return (views.get(pane.id) ?? create(pane)).root
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
