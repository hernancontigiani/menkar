// Every key Menkar handles, in one table: the handlers find their command here, and Settings and
// the prefix help list it, so what is shown is what the keys do. No Node or DOM import: the
// renderer uses it.
import type { Key } from './i18n'

export type ShortcutGroup = 'window' | 'file' | 'terminal' | 'find' | 'prefix' | 'switcher' | 'chat'

// One key with its modifiers. `key` is compared without case when Ctrl is held (Shift changes it),
// exactly after the prefix (N is not n); `code` names a key by its place, whatever the layout;
// `char` names the key the active layout types that character with, for a key the event does not
// name: on Spanish the ` is a dead key right of P, and with ibus its keydown is key "Process".
export interface Chord {
  readonly key?: string
  readonly code?: string
  readonly char?: string
  readonly ctrl?: boolean
  readonly shift?: boolean
}

interface Row {
  readonly id: string
  readonly group: ShortcutGroup
  readonly chords: readonly Chord[]
  readonly description: Key
  // What the list shows when the chords would read worse one by one (1–9).
  readonly shown?: readonly (readonly string[])[]
}

const ctrl = (key: string, shift = false): Chord => ({ key, ctrl: true, shift })
const after = (...keys: string[]): Chord[] => keys.map((key) => ({ key }))

export const SHORTCUTS = [
  // The window, whatever has the focus but a dialog.
  {
    id: 'newSession',
    group: 'window',
    chords: [ctrl('t', true)],
    description: 'shortcut.newSession',
  },
  {
    id: 'addExisting',
    group: 'window',
    chords: [ctrl('f', true)],
    description: 'shortcut.addExisting',
  },
  { id: 'openFile', group: 'window', chords: [ctrl('o', true)], description: 'shortcut.openFile' },
  { id: 'closeTab', group: 'window', chords: [ctrl('w', true)], description: 'shortcut.closeTab' },
  {
    id: 'nextTab',
    group: 'window',
    chords: [ctrl('Tab'), ctrl('PageDown')],
    description: 'shortcut.nextTab',
  },
  {
    id: 'previousTab',
    group: 'window',
    chords: [ctrl('Tab', true), ctrl('PageUp')],
    description: 'shortcut.previousTab',
  },
  { id: 'settings', group: 'window', chords: [ctrl(',')], description: 'shortcut.settings' },
  { id: 'switcher', group: 'window', chords: [ctrl('k', true)], description: 'shortcut.switcher' },
  {
    id: 'projectSwitcher',
    group: 'window',
    chords: [ctrl('e', true)],
    description: 'shortcut.projectSwitcher',
  },
  { id: 'sidebar', group: 'window', chords: [{ key: 'F9' }], description: 'shortcut.sidebar' },
  {
    id: 'newWindow',
    group: 'window',
    chords: [ctrl('n', true)],
    description: 'shortcut.newWindow',
  },
  {
    id: 'drawer',
    group: 'window',
    chords: [
      { code: 'Backquote', ctrl: true },
      { key: '`', ctrl: true },
      { char: '`', ctrl: true },
    ],
    description: 'shortcut.drawer',
    shown: [['Ctrl', '`']],
  },
  // A file tab shown: the same keys are the terminal's in a terminal tab.
  { id: 'save', group: 'file', chords: [ctrl('s')], description: 'shortcut.save' },
  { id: 'preview', group: 'file', chords: [ctrl('v', true)], description: 'shortcut.preview' },
  // A terminal with the focus.
  {
    id: 'newline',
    group: 'terminal',
    chords: [{ key: 'Enter', shift: true }],
    description: 'shortcut.newline',
  },
  { id: 'copy', group: 'terminal', chords: [ctrl('c', true)], description: 'shortcut.copy' },
  { id: 'paste', group: 'terminal', chords: [ctrl('v', true)], description: 'shortcut.paste' },
  { id: 'find', group: 'terminal', chords: [ctrl('g', true)], description: 'shortcut.find' },
  { id: 'bottom', group: 'terminal', chords: [ctrl('End', true)], description: 'shortcut.bottom' },
  // The terminal's find bar.
  {
    id: 'findPrevious',
    group: 'find',
    chords: [{ key: 'Enter' }, ctrl('g', true)],
    description: 'shortcut.findPrevious',
  },
  { id: 'findNext', group: 'find', chords: [ctrl('g')], description: 'shortcut.findNext' },
  {
    id: 'findClose',
    group: 'find',
    chords: [{ key: 'Escape' }],
    description: 'shortcut.findClose',
  },
  // After Ctrl+B: the next key alone.
  {
    id: 'splitRight',
    group: 'prefix',
    chords: after('v', '%'),
    description: 'shortcut.splitRight',
  },
  { id: 'splitDown', group: 'prefix', chords: after('-', '"'), description: 'shortcut.splitDown' },
  {
    id: 'paneLeft',
    group: 'prefix',
    chords: after('h', 'ArrowLeft'),
    description: 'shortcut.paneLeft',
  },
  {
    id: 'paneDown',
    group: 'prefix',
    chords: after('j', 'ArrowDown'),
    description: 'shortcut.paneDown',
  },
  { id: 'paneUp', group: 'prefix', chords: after('k', 'ArrowUp'), description: 'shortcut.paneUp' },
  {
    id: 'paneRight',
    group: 'prefix',
    chords: after('l', 'ArrowRight'),
    description: 'shortcut.paneRight',
  },
  { id: 'nextPane', group: 'prefix', chords: after('Tab'), description: 'shortcut.nextPane' },
  { id: 'zoom', group: 'prefix', chords: after('z'), description: 'shortcut.zoom' },
  { id: 'closePane', group: 'prefix', chords: after('x'), description: 'shortcut.closePane' },
  {
    id: 'prefixNewSession',
    group: 'prefix',
    chords: after('c'),
    description: 'shortcut.newSession',
  },
  { id: 'prefixNextTab', group: 'prefix', chords: after('n'), description: 'shortcut.nextTab' },
  {
    id: 'prefixPreviousTab',
    group: 'prefix',
    chords: after('p'),
    description: 'shortcut.previousTab',
  },
  {
    id: 'nthTab',
    group: 'prefix',
    chords: after('1', '2', '3', '4', '5', '6', '7', '8', '9'),
    description: 'shortcut.nthTab',
    shown: [['1–9']],
  },
  {
    id: 'prefixAddExisting',
    group: 'prefix',
    chords: after('N'),
    description: 'shortcut.addExisting',
  },
  { id: 'renameTab', group: 'prefix', chords: after('T'), description: 'shortcut.renameTab' },
  { id: 'prefixCloseTab', group: 'prefix', chords: after('X'), description: 'shortcut.closeTab' },
  { id: 'goToAgent', group: 'prefix', chords: after('g'), description: 'shortcut.goToAgent' },
  { id: 'prefixSidebar', group: 'prefix', chords: after('b'), description: 'shortcut.sidebar' },
  { id: 'prefixSettings', group: 'prefix', chords: after('s'), description: 'shortcut.settings' },
  { id: 'help', group: 'prefix', chords: after('?'), description: 'shortcut.help' },
  { id: 'sendCtrlB', group: 'prefix', chords: [ctrl('b')], description: 'shortcut.sendCtrlB' },
  // The quick switcher and Go to agent.
  {
    id: 'switcherMove',
    group: 'switcher',
    chords: after('ArrowDown', 'ArrowUp'),
    description: 'shortcut.switcherMove',
  },
  {
    id: 'switcherOpen',
    group: 'switcher',
    chords: after('Enter'),
    description: 'shortcut.switcherOpen',
  },
  {
    id: 'switcherClose',
    group: 'switcher',
    chords: after('Escape'),
    description: 'shortcut.switcherClose',
  },
  // A chat tab's message field.
  { id: 'chatSend', group: 'chat', chords: after('Enter'), description: 'shortcut.chatSend' },
] as const satisfies readonly Row[]

export type ShortcutId = (typeof SHORTCUTS)[number]['id']
export type ShortcutOf<G extends ShortcutGroup> = Extract<
  (typeof SHORTCUTS)[number],
  { group: G }
>['id']

export interface KeyEventLike {
  readonly key: string
  readonly code: string
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
  // The active layout's character for `code`, unmodified (a dead key gives its own character).
  readonly layout?: string | undefined
}

// Only a key the event leaves unnamed: the layout read may lag a layout switch, and on US the same
// key is Ctrl+[, the terminal's Esc, which arrives named.
const UNNAMED: ReadonlySet<string> = new Set(['Dead', 'Process'])
function typedOnLayout(char: string, event: KeyEventLike): boolean {
  return UNNAMED.has(event.key) && event.layout === char
}

// Ctrl held alone among the command modifiers, as the window has always read it.
const ctrlOf = (event: KeyEventLike) => event.ctrlKey && !event.altKey && !event.metaKey

function matches(group: ShortcutGroup, chord: Chord, event: KeyEventLike): boolean {
  if (chord.char !== undefined) {
    if (!typedOnLayout(chord.char, event)) return false
  } else if (chord.code !== undefined) {
    if (event.code !== chord.code) return false
  } else if (chord.ctrl) {
    if (event.key.toLowerCase() !== chord.key?.toLowerCase()) return false
  } else if (event.key !== chord.key) return false
  // After the prefix a key stands alone: `%` and `N` come with Shift.
  if (group === 'prefix' && !chord.ctrl) return !ctrlOf(event)
  // A switcher's keys work with any modifier held: the project switcher is open while Ctrl+Shift is.
  if (group === 'switcher') return true
  if (group === 'chat') return !event.shiftKey || chord.shift === true
  return (chord.ctrl ?? false) === ctrlOf(event) && (chord.shift ?? false) === event.shiftKey
}

function rowOf(group: ShortcutGroup, event: KeyEventLike): string | null {
  for (const row of SHORTCUTS as readonly Row[]) {
    if (row.group !== group) continue
    if (row.chords.some((chord) => matches(group, chord, event))) return row.id
  }
  return null
}

// The command of a group that this key is, if any.
export function matchShortcut<G extends ShortcutGroup>(
  group: G,
  event: KeyEventLike,
): ShortcutOf<G> | null {
  return rowOf(group, event) as ShortcutOf<G> | null
}

const NAMES: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Escape: 'Esc',
  Backquote: '`',
}

// A chord as the keycaps it is pressed with; after the prefix, Ctrl+B comes first.
export function keycaps(group: ShortcutGroup, chord: Chord): string[] {
  const name = chord.code ?? chord.key ?? chord.char ?? ''
  const cap = NAMES[name] ?? (name.length === 1 ? name.toUpperCase() : name)
  const shown = group === 'prefix' && !chord.ctrl ? (NAMES[name] ?? name) : cap
  return [
    ...(group === 'prefix' ? ['Ctrl', 'B'] : []),
    ...(chord.ctrl ? ['Ctrl'] : []),
    ...(chord.shift ? ['Shift'] : []),
    shown,
  ]
}

// Each row's ways to press it, as keycaps: the list in Settings and the prefix help read these.
export function shownChords(row: (typeof SHORTCUTS)[number]): string[][] {
  const custom = (row as Row).shown
  if (custom)
    return custom.map((caps) => [...(row.group === 'prefix' ? ['Ctrl', 'B'] : []), ...caps])
  return row.chords.map((chord) => keycaps(row.group, chord))
}
