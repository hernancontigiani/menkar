import { WebLinksAddon } from '@xterm/addon-web-links'
import type { Terminal } from '@xterm/xterm'
import { webLink } from '../core/links'

// Links in a terminal open in the browser with Ctrl+click, as in GNOME Terminal: a plain click
// still selects. Both kinds: an address printed in the output, joined across the rows it wraps
// over, and an OSC 8 hyperlink. A link is underlined on hover; the hand shows only while Ctrl is
// held, by `ctrl-held` on the terminal under the pointer, and only while a link is under it: the
// rest of the window is never restyled for a Ctrl press.

function open(event: MouseEvent, uri: string): void {
  if (!event.ctrlKey) return
  const url = webLink(uri)
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

let watching = false

export function attachLinks(term: Terminal): void {
  const callbacks = { hover: (event: MouseEvent) => hover(term, event), leave }
  term.loadAddon(new WebLinksAddon(open, callbacks))
  // OSC 8: without a handler of its own xterm asks with window.confirm, which would block the
  // window; other schemes than http(s) are then not links at all.
  term.options.linkHandler = { activate: open, ...callbacks, allowNonHttpProtocols: false }
  if (watching) return
  watching = true
  document.addEventListener('keydown', held, true)
  document.addEventListener('keyup', held, true)
  window.addEventListener('blur', leave)
}
