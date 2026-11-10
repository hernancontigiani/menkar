import { describe, expect, test } from 'vitest'
import { validSetting } from '../../src/core/preferences'
import {
  DEFAULT_SETTINGS,
  parseSettings,
  settingsOf,
  UI_SCALES,
  withSetting,
} from '../../src/core/settings'
import { parseState } from '../../src/core/state'

describe('settings', () => {
  test('absent settings are the defaults', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS).toMatchObject({
      ui_style: 'tui',
      terminal_theme: 'Default',
      scrollback: 10_000,
      sidebar_width: 250,
      reopen_tabs: true,
      last_agent: '',
    })
  })

  test('decision 1.31 the remembered agent is read as a string, anything else as none', () => {
    expect(parseSettings({ last_agent: 'cursor' }).last_agent).toBe('cursor')
    expect(parseSettings({ last_agent: 7 }).last_agent).toBe('')
  })

  test('TRM-56 a scrollback that is not a number keeps 10 000; a wrong-typed value takes its default', () => {
    expect(parseSettings({ scrollback: 'abc', reopen_tabs: 'no', font: 'Mono 12' })).toMatchObject({
      scrollback: 10_000,
      reopen_tabs: true,
      font: 'Mono 12',
    })
  })

  test('LOOK-8 a saved sidebar width is read back; the other settings and keys stay as they were', () => {
    const state = withSetting(
      parseState({ settings: { ui_style: 'classic', zoom: 2 }, x: 1 }),
      'sidebar_width',
      420,
    )
    expect(settingsOf(state)).toMatchObject({ sidebar_width: 420, ui_style: 'classic' })
    expect(state.rest).toEqual({
      settings: { ui_style: 'classic', zoom: 2, sidebar_width: 420 },
      x: 1,
    })
  })

  test("PRF-3 the language is the system's and both notifications are on until set", () => {
    expect(parseSettings({})).toMatchObject({ language: '', notify_idle: true, notify_sound: true })
    expect(parseSettings({ language: 'es', notify_idle: false, notify_sound: 'no' })).toMatchObject(
      {
        language: 'es',
        notify_idle: false,
        notify_sound: true,
      },
    )
  })
})

test('decision 1.22: the ring edges are 60 and 90 by default, kept as a valid pair, else both defaults', () => {
  expect(parseSettings({})).toMatchObject({ ring_warn: 60, ring_full: 90 })
  expect(parseSettings({ ring_warn: 50, ring_full: 70 })).toMatchObject({
    ring_warn: 50,
    ring_full: 70,
  })
  // One edge saved, the other at its default: Preferences saves a row at a time.
  expect(parseSettings({ ring_full: 80 })).toMatchObject({ ring_warn: 60, ring_full: 80 })
  expect(parseSettings({ ring_warn: 30 })).toMatchObject({ ring_warn: 30, ring_full: 90 })
  expect(parseSettings({ ring_full: 50 })).toMatchObject({ ring_warn: 60, ring_full: 90 })
  expect(parseSettings({ ring_warn: 95, ring_full: 90 })).toMatchObject({
    ring_warn: 60,
    ring_full: 90,
  })
  expect(parseSettings({ ring_warn: 50, ring_full: 'red' })).toMatchObject({
    ring_warn: 60,
    ring_full: 90,
  })
})

test('decision 1.36: Interface size is one of its steps, 100 by default and for anything else; Settings saves only a step', () => {
  expect(UI_SCALES).toEqual([90, 100, 110, 125, 150])
  expect(parseSettings({}).ui_scale).toBe(100)
  expect(parseSettings({ ui_scale: 125 }).ui_scale).toBe(125)
  for (const bad of [133, '125', 0, null, 1.25])
    expect(parseSettings({ ui_scale: bad }).ui_scale).toBe(100)
  expect(validSetting('ui_scale', 150)).toBe(150)
  expect(validSetting('ui_scale', 133)).toBeNull()
  expect(validSetting('ui_scale', '110')).toBeNull()
})
