// The one table of Menkar's keys (decision 1.37): each row's chords find that row and no other in
// its group, and the list shows them as keycaps.
import { expect, test } from 'vitest'
import { en } from '../../src/core/i18n/en'
import { es } from '../../src/core/i18n/es'
import {
  type Chord,
  type KeyEventLike,
  keycaps,
  matchShortcut,
  SHORTCUTS,
  type ShortcutGroup,
  shownChords,
} from '../../src/core/shortcuts'

const press = (chord: Chord): KeyEventLike => {
  const key = chord.key ?? (chord.code === 'Backquote' ? '`' : '')
  return {
    key: chord.ctrl && chord.shift && key.length === 1 ? key.toUpperCase() : key,
    code: chord.code ?? '',
    ctrlKey: chord.ctrl ?? false,
    shiftKey: chord.shift ?? false,
    altKey: false,
    metaKey: false,
  }
}

test('every chord of the table finds its own row in its group, and no two rows share one', () => {
  expect(SHORTCUTS.length).toBeGreaterThanOrEqual(45)
  for (const row of SHORTCUTS)
    for (const chord of row.chords)
      expect(matchShortcut(row.group, press(chord)), `${row.id} ${JSON.stringify(chord)}`).toBe(
        row.id,
      )
  const ids = SHORTCUTS.map((row) => row.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('a key with other modifiers is not the row: Ctrl+S is not Ctrl+Shift+S, Ctrl+Alt+T is nothing', () => {
  const event = (key: string, mods: Partial<KeyEventLike>): KeyEventLike => ({
    key,
    code: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
  })
  expect(matchShortcut('file', event('S', { ctrlKey: true, shiftKey: true }))).toBeNull()
  expect(
    matchShortcut('window', event('T', { ctrlKey: true, shiftKey: true, altKey: true })),
  ).toBeNull()
  expect(matchShortcut('window', event('t', { ctrlKey: true }))).toBeNull()
  // After the prefix the key alone counts, Shift included: N and % are their own.
  expect(matchShortcut('prefix', event('N', { shiftKey: true }))).toBe('prefixAddExisting')
  expect(matchShortcut('prefix', event('n', {}))).toBe('prefixNextTab')
  expect(matchShortcut('prefix', event('%', { shiftKey: true }))).toBe('splitRight')
  // Ctrl+` by its place, on any layout.
  expect(matchShortcut('window', { ...event('º', { ctrlKey: true }), code: 'Backquote' })).toBe(
    'drawer',
  )
})

test('every row has its description in English and Spanish', () => {
  for (const row of SHORTCUTS) {
    expect(en[row.description], row.id).toBeTruthy()
    expect(es[row.description], row.id).toBeTruthy()
  }
})

test('the list shows keycaps: Ctrl+Shift+T, F9, Ctrl+B then %, Ctrl+B then 1–9', () => {
  const caps = (id: string) => {
    const row = SHORTCUTS.find((r) => r.id === id)
    return row ? shownChords(row) : []
  }
  expect(caps('newSession')).toEqual([['Ctrl', 'Shift', 'T']])
  expect(caps('sidebar')).toEqual([['F9']])
  expect(caps('splitRight')).toEqual([
    ['Ctrl', 'B', 'v'],
    ['Ctrl', 'B', '%'],
  ])
  expect(caps('nthTab')).toEqual([['Ctrl', 'B', '1–9']])
  expect(caps('drawer')).toEqual([['Ctrl', '`']])
  expect(keycaps('window' as ShortcutGroup, { key: 'PageDown', ctrl: true })).toEqual([
    'Ctrl',
    'PgDn',
  ])
})

test('a switcher key works with Ctrl+Shift still held, as in the held project switcher', () => {
  const held = (key: string): KeyEventLike => ({
    key,
    code: '',
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
  })
  expect(matchShortcut('switcher', held('Escape'))).toBe('switcherClose')
  expect(matchShortcut('switcher', held('ArrowDown'))).toBe('switcherMove')
  expect(matchShortcut('chat', { ...held('Enter'), ctrlKey: false })).toBeNull()
})
