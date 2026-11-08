import { describe, expect, test } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings, settingsOf, withSetting } from '../../src/core/settings'
import { parseState } from '../../src/core/state'

describe('settings', () => {
  test('absent settings are the defaults', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS).toMatchObject({
      ui_style: 'tui',
      terminal_theme: 'Default',
      scrollback: 10_000,
      sidebar_width: 300,
      reopen_tabs: true,
    })
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
})
