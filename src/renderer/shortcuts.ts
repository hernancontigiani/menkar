import type { Key } from '../core/i18n'
import { SHORTCUTS, type ShortcutGroup, shownChords } from '../core/shortcuts'
import { el } from './dom'
import { t, translate } from './i18n'

// Settings' Keyboard shortcuts: the table the key handlers read, shown read only, grouped, with a
// filter over the descriptions and the keys.

const GROUPS: readonly [ShortcutGroup, Key][] = [
  ['window', 'shortcutGroup.window'],
  ['file', 'shortcutGroup.file'],
  ['terminal', 'shortcutGroup.terminal'],
  ['find', 'shortcutGroup.find'],
  ['prefix', 'shortcutGroup.prefix'],
  ['switcher', 'shortcutGroup.switcher'],
  ['chat', 'shortcutGroup.chat'],
]

function chordElement(caps: readonly string[]): HTMLElement {
  return el('span', { class: 'chord' }, ...caps.map((cap) => el('kbd', {}, cap)))
}

export function shortcutsSection(): HTMLElement {
  const filter = el('input', {
    type: 'search',
    'data-key': 'shortcut-filter',
    placeholder: t('shortcuts.filter'),
    'aria-label': t('shortcuts.filter'),
  })
  const none = el(
    'p',
    { class: 'dim', 'data-key': 'shortcut-none', hidden: '' },
    t('shortcuts.none'),
  )
  const rows: { row: HTMLElement; text: string }[] = []
  const groups = GROUPS.map(([group, title]) => {
    const own = SHORTCUTS.filter((s) => s.group === group).map((shortcut) => {
      const chords = shownChords(shortcut)
      const description = translate(shortcut.description)
      const row = el(
        'div',
        { class: 'row shortcut', 'data-shortcut': shortcut.id },
        el('div', { class: 'row-text' }, el('div', { class: 'row-title' }, description)),
        el('div', { class: 'chords' }, ...chords.map(chordElement)),
      )
      rows.push({
        row,
        text: `${description} ${chords.map((c) => c.join('+')).join(' ')}`.toLowerCase(),
      })
      return row
    })
    return el(
      'section',
      { class: 'group', 'data-group': group },
      el('div', { class: 'group-head' }, el('div', { class: 'group-title' }, translate(title))),
      el('div', { class: 'card' }, ...own),
    )
  })
  filter.addEventListener('input', () => {
    const words = filter.value.toLowerCase().split(/\s+/).filter(Boolean)
    for (const { row, text } of rows) row.hidden = !words.every((w) => text.includes(w))
    for (const group of groups)
      group.hidden = [...group.querySelectorAll<HTMLElement>('.shortcut')].every((r) => r.hidden)
    none.hidden = rows.some(({ row }) => !row.hidden)
  })
  return el('div', {}, el('div', { class: 'shortcut-filter' }, filter), none, ...groups)
}
