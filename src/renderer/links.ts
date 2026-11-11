import { WebLinksAddon } from '@xterm/addon-web-links'
import type { IBufferLine, ILink, ILinkProvider, Terminal } from '@xterm/xterm'
import { now } from '../core/clock'
import { findPaths, linkUrl } from '../core/links'

// Links in a terminal open with Ctrl+click, handed to the system, as in GNOME Terminal: a plain
// click still selects. Three kinds: an address printed in the output, joined across the rows it
// wraps over, an OSC 8 hyperlink of any scheme, and a plain path that is on disk. A link is underlined on hover; the hand shows only while Ctrl is
// held, by `ctrl-held` on the terminal under the pointer, and only while a link is under it: the
// rest of the window is never restyled for a Ctrl press.

function open(event: MouseEvent, uri: string): void {
  if (!event.ctrlKey) return
  const url = linkUrl(uri)
  if (url) void window.menkar.window.act({ type: 'openExternal', url })
}

let over: HTMLElement | null = null

function hover(term: Terminal, event: MouseEvent): void {
  over = term.element ?? null
  over?.classList.toggle('ctrl-held', event.ctrlKey)
}

function leave(): void {
  over?.classList.remove('ctrl-held')
  over = null
}

function held(event: KeyboardEvent): void {
  if (over && over.classList.contains('ctrl-held') !== event.ctrlKey)
    over.classList.toggle('ctrl-held', event.ctrlKey)
}

// Whether a path is on disk, asked of main once per path for a few seconds: xterm asks for a row's
// links again each time the pointer enters it.
const KNOWN_MS = 3000
const known = new Map<string, { readonly exists: boolean; readonly at: number }>()

async function onDisk(paths: readonly string[]): Promise<boolean[]> {
  const at = now()
  for (const [path, entry] of known) if (at - entry.at > KNOWN_MS) known.delete(path)
  const asked = [...new Set(paths.filter((path) => !known.has(path)))]
  if (asked.length > 0) {
    const answers = await window.menkar.panes.pathsExist(asked)
    for (const [i, path] of asked.entries()) known.set(path, { exists: answers[i] === true, at })
  }
  return paths.map((path) => known.get(path)?.exists === true)
}

// A row as text, with the cell each UTF-16 unit of it sits in and that cell's width: a wide
// character takes two cells, an emoji two units.
function rowText(line: IBufferLine): { text: string; cells: number[]; widths: number[] } {
  let text = ''
  const cells: number[] = []
  const widths: number[] = []
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x)
    const width = cell?.getWidth() ?? 1
    if (width === 0) continue
    const chars = cell?.getChars() || ' '
    text += chars
    for (let i = 0; i < chars.length; i++) {
      cells.push(x)
      widths.push(width)
    }
  }
  return { text, cells, widths }
}

function pathLinks(term: Terminal): ILinkProvider {
  return {
    provideLinks(y, callback) {
      const line = term.buffer.active.getLine(y - 1)
      if (!line) return callback(undefined)
      const { text, cells, widths } = rowText(line)
      const found = findPaths(text)
      if (found.length === 0) return callback(undefined)
      onDisk(found.map((f) => f.path)).then(
        (exists) => {
          const links: ILink[] = []
          found.forEach((f, i) => {
            const startX = cells[f.start]
            const endX = cells[f.end - 1]
            if (!exists[i] || startX === undefined || endX === undefined) return
            links.push({
              range: {
                start: { x: startX + 1, y },
                end: { x: endX + (widths[f.end - 1] ?? 1), y },
              },
              text: f.path,
              activate: (event) => {
                if (event.ctrlKey)
                  void window.menkar.window.act({ type: 'openTerminalPath', path: f.path })
              },
              hover: (event) => hover(term, event),
              leave,
            })
          })
          callback(links.length > 0 ? links : undefined)
        },
        // Main answers every path itself; xterm would wait on this row's answer for good.
        (error: unknown) => {
          callback(undefined)
          throw error
        },
      )
    },
  }
}

let watching = false

export function attachLinks(term: Terminal): void {
  const callbacks = { hover: (event: MouseEvent) => hover(term, event), leave }
  term.loadAddon(new WebLinksAddon(open, callbacks))
  // After the addon: where both find a link, xterm takes the provider registered first.
  term.registerLinkProvider(pathLinks(term))
  // OSC 8: without a handler of its own xterm asks with window.confirm, which would block the
  // window. Every scheme is a link, as in GNOME Terminal: the system's handler decides.
  term.options.linkHandler = { activate: open, ...callbacks, allowNonHttpProtocols: true }
  if (watching) return
  watching = true
  document.addEventListener('keydown', held, true)
  document.addEventListener('keyup', held, true)
  window.addEventListener('blur', leave)
}
