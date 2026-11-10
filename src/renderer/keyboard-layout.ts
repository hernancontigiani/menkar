import type { KeyEventLike } from '../core/shortcuts'

// The active keyboard layout's character on each key, so a key the event leaves unnamed (Spanish `
// right of P, a dead key: with ibus its keydown is "Process") can still be a shortcut. Chromium
// answers asynchronously, for the layout of the last key event, so the map is read again when the
// window gets the focus and whenever Ctrl goes down: it is current before the chord's second key.

interface LayoutMap {
  get(code: string): string | undefined
}
interface KeyboardApi {
  getLayoutMap(): Promise<LayoutMap>
}

let map: LayoutMap | null = null

function refresh(): void {
  const keyboard = (navigator as Navigator & { keyboard?: KeyboardApi }).keyboard
  if (!keyboard) return
  keyboard.getLayoutMap().then(
    (read) => {
      map = read
    },
    () => {
      // refused (no focus yet): the next focus or Ctrl reads it again; the code chords still work
    },
  )
}

// A shortcut on a key the input method took ("Process") still starts its composition, a pending
// dead key that would land in the terminal or accent the next vowel. Its events are kept from the
// terminal, and the focus is taken off its element and back, which ends it and resets the input
// method. Armed only briefly: Ctrl+º is "Process" too and starts none.
let dropping: ReturnType<typeof setTimeout> | null = null

function arm(ms: number): void {
  if (dropping) clearTimeout(dropping)
  dropping = setTimeout(() => {
    dropping = null
  }, ms)
}

// For a shortcut just taken: only one on a key the input method holds starts a composition.
export function dropComposition(event: KeyboardEvent): void {
  if (event.key === 'Process') arm(200)
}

function endComposition(element: HTMLElement): void {
  element.blur()
  setTimeout(() => {
    if (document.activeElement === document.body || document.activeElement === null) element.focus()
  }, 30)
}

export function watchKeyboardLayout(): void {
  refresh()
  window.addEventListener('focus', refresh)
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Control') refresh()
    },
    true,
  )
  document.addEventListener(
    'compositionstart',
    (event) => {
      if (!dropping) return
      arm(1000)
      event.stopImmediatePropagation()
      const target = event.target
      if (target instanceof HTMLElement) setTimeout(() => endComposition(target), 0)
    },
    true,
  )
  document.addEventListener(
    'compositionupdate',
    (event) => {
      if (dropping) event.stopImmediatePropagation()
    },
    true,
  )
  document.addEventListener(
    'input',
    (event) => {
      if (dropping && (event as InputEvent).isComposing) event.stopImmediatePropagation()
    },
    true,
  )
  document.addEventListener(
    'compositionend',
    (event) => {
      if (!dropping) return
      event.stopImmediatePropagation()
      if (event.target instanceof HTMLTextAreaElement) event.target.value = ''
      clearTimeout(dropping)
      dropping = null
    },
    true,
  )
}

export function withLayout(event: KeyboardEvent): KeyEventLike {
  return {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    layout: map?.get(event.code),
  }
}
