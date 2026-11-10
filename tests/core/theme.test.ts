import { describe, expect, test } from 'vitest'
import {
  contrast,
  onAccent,
  resolveLook,
  SYNTAX_ROLES,
  syntaxOf,
  THEME_NAMES,
} from '../../src/core/theme'

// The resolved chrome roles of look.md, per theme: bg, fg, mantle, surface0, surface1, overlay0,
// subtext0, accent, green, yellow, red.
const RESOLVED: Record<string, string[]> = {
  'Tango Dark': [
    '#2e3436',
    '#d3d7cf',
    '#282c2d',
    '#424848',
    '#4f5555',
    '#787d7b',
    '#b2b6b0',
    '#75507b',
    '#4e9a06',
    '#c4a000',
    '#cc0000',
  ],
  'Solarized Dark': [
    '#002b36',
    '#839496',
    '#03232a',
    '#103842',
    '#1a4049',
    '#3b5a61',
    '#697f83',
    '#d33682',
    '#859900',
    '#b58900',
    '#dc322f',
  ],
  'Solarized Light': [
    '#fdf6e3',
    '#657b83',
    '#f2dda6',
    '#ebe7d7',
    '#dfddd0',
    '#b9bfb8',
    '#839496',
    '#d33682',
    '#859900',
    '#b58900',
    '#dc322f',
  ],
  Dracula: [
    '#282a36',
    '#f8f8f2',
    '#23242d',
    '#41434d',
    '#52535c',
    '#86878b',
    '#cecfcc',
    '#bd93f9',
    '#50fa7b',
    '#f1fa8c',
    '#ff5555',
  ],
  'Gruvbox Dark': [
    '#282828',
    '#ebdbb2',
    '#222222',
    '#3f3d39',
    '#4f4c44',
    '#807966',
    '#c4b796',
    '#b16286',
    '#98971a',
    '#d79921',
    '#cc241d',
  ],
  Nord: [
    '#2e3440',
    '#d8dee9',
    '#282d35',
    '#424854',
    '#505662',
    '#7a808c',
    '#b6bcc7',
    '#b48ead',
    '#a3be8c',
    '#ebcb8b',
    '#bf616a',
  ],
  'Catppuccin Mocha': [
    '#1e1e2e',
    '#cdd6f4',
    '#181825',
    '#313244',
    '#45475a',
    '#6c7086',
    '#a6adc8',
    '#cba6f7',
    '#a6e3a1',
    '#f9e2af',
    '#f38ba8',
  ],
  'Tokyo Night': [
    '#1a1b26',
    '#c0caf5',
    '#171820',
    '#2e303f',
    '#3b3e4f',
    '#656a83',
    '#9fa7cc',
    '#bb9af7',
    '#9ece6a',
    '#e0af68',
    '#f7768e',
  ],
  Monokai: [
    '#272822',
    '#f8f8f2',
    '#21221d',
    '#40413b',
    '#51524c',
    '#858680',
    '#cecec8',
    '#ae81ff',
    '#a6e22e',
    '#f4bf75',
    '#f92672',
  ],
  'One Dark': [
    '#282c34',
    '#abb2bf',
    '#23262b',
    '#383c45',
    '#424750',
    '#636873',
    '#9197a3',
    '#c678dd',
    '#98c379',
    '#e5c07b',
    '#e06c75',
  ],
  'Catppuccin Latte': [
    '#eff1f5',
    '#4c4f69',
    '#e6e9ef',
    '#ccd0da',
    '#bcc0cc',
    '#9ca0b0',
    '#6c6f85',
    '#8839ef',
    '#40a02b',
    '#df8e1d',
    '#d20f39',
  ],
}
const ROLES = [
  'bg',
  'fg',
  'mantle',
  'surface0',
  'surface1',
  'overlay0',
  'subtext0',
  'accent',
  'green',
  'yellow',
  'red',
] as const

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))

describe('themes', () => {
  test('the theme names, in the Preferences order', () => {
    expect(THEME_NAMES).toEqual([
      'Default',
      'Tango Dark',
      'Solarized Dark',
      'Solarized Light',
      'Dracula',
      'Gruvbox Dark',
      'Nord',
      'Catppuccin Mocha',
      'Tokyo Night',
      'Monokai',
      'One Dark',
      'Catppuccin Latte',
      'VS Code Dark',
    ])
  })

  test('decision 1.39 VS Code Dark is VS Code 1.105.1’s Dark Modern: its terminal panel and 16 colours in both styles, its own chrome in Terminal workspace', () => {
    const ansi =
      '#000000 #cd3131 #0dbc79 #e5e510 #2472c8 #bc3fbc #11a8cd #e5e5e5 #666666 #f14c4c #23d18b #f5f543 #3b8eea #d670d6 #29b8db #e5e5e5'.split(
        ' ',
      )
    for (const ui_style of ['tui', 'classic']) {
      for (const [scheme, systemDark] of [
        ['dark', false],
        ['light', true],
      ] as const) {
        const look = resolveLook(
          { ui_style, terminal_theme: 'VS Code Dark', color_scheme: scheme },
          systemDark,
        )
        expect(look.terminal, `${ui_style} ${scheme}`).toEqual({
          bg: '#181818',
          fg: '#cccccc',
          ansi,
        })
        if (ui_style === 'tui') expect(look.dark, scheme).toBe(true)
      }
    }
    const tui = resolveLook(
      { ui_style: 'tui', terminal_theme: 'VS Code Dark', color_scheme: 'dark' },
      true,
    )
    expect(tui.roles).toMatchObject({
      bg: '#181818',
      fg: '#cccccc',
      mantle: '#181818',
      surface0: '#313131',
      surface1: '#3c3c3c',
      overlay0: '#6e7681',
      subtext0: '#9d9d9d',
      accent: '#0078d4',
    })
  })

  test('decision 1.39 the editor takes VS Code Dark’s own syntax colours; every other theme maps the syntax to its roles', () => {
    const vscode = resolveLook(
      { ui_style: 'tui', terminal_theme: 'VS Code Dark', color_scheme: 'dark' },
      true,
    )
    expect(syntaxOf(vscode, 'VS Code Dark')).toMatchObject({
      heading: '#569cd6',
      code: '#ce9178',
      keyword: '#569cd6',
      string: '#ce9178',
      number: '#b5cea8',
      comment: '#6a9955',
      link: '#4daafc',
    })
    const mocha = resolveLook(
      { ui_style: 'tui', terminal_theme: 'Catppuccin Mocha', color_scheme: 'dark' },
      true,
    )
    const roles = syntaxOf(mocha, 'Catppuccin Mocha')
    expect(roles).toMatchObject({
      heading: mocha.roles.accent,
      code: mocha.roles.yellow,
      string: mocha.roles.green,
      comment: mocha.roles.overlay0,
      strong: 'inherit',
    })
    expect(Object.keys(roles).sort()).toEqual([...SYNTAX_ROLES].sort())
    // A light editor (Classic, light scheme) keeps the role colours, made for its background.
    const light = resolveLook(
      { ui_style: 'classic', terminal_theme: 'VS Code Dark', color_scheme: 'light' },
      false,
    )
    expect(syntaxOf(light, 'VS Code Dark').heading).toBe(light.roles.accent)
  })

  test('decision 1.40 a saved "Ubuntu" theme, removed, loads as Default in both styles and schemes', () => {
    for (const ui_style of ['tui', 'classic']) {
      for (const color_scheme of ['dark', 'light']) {
        const dark = color_scheme === 'dark'
        expect(
          resolveLook({ ui_style, terminal_theme: 'Ubuntu', color_scheme }, dark),
          `${ui_style} ${color_scheme}`,
        ).toEqual(resolveLook({ ui_style, terminal_theme: 'Default', color_scheme }, dark))
      }
    }
    expect(THEME_NAMES).not.toContain('Ubuntu')
  })

  test.each(Object.entries(RESOLVED))(
    '%s resolves to the chrome roles of the spec, ±1 per channel',
    (name, expected) => {
      const look = resolveLook(
        { ui_style: 'tui', terminal_theme: name, color_scheme: 'dark' },
        true,
      )
      expect(Object.keys(RESOLVED)).toHaveLength(11)
      ROLES.forEach((role, i) => {
        const got = channels(look.roles[role])
        channels(expected[i] ?? '').forEach((want, c) => {
          expect(
            Math.abs((got[c] ?? -9) - want),
            `${name} ${role}: ${look.roles[role]} vs ${expected[i]}`,
          ).toBeLessThanOrEqual(1)
        })
      })
    },
  )

  test('LOOK-38 Dracula’s accent is #bd93f9, not its ANSI 5', () => {
    expect(
      resolveLook({ ui_style: 'tui', terminal_theme: 'Dracula', color_scheme: 'dark' }, true).roles
        .accent,
    ).toBe('#bd93f9')
  })

  test('Default is Mocha in dark and Latte in light, following the scheme (LOOK-39, LOOK-40)', () => {
    expect(
      resolveLook({ ui_style: 'tui', terminal_theme: 'Default', color_scheme: 'dark' }, false).roles
        .bg,
    ).toBe('#1e1e2e')
    expect(
      resolveLook({ ui_style: 'tui', terminal_theme: 'Default', color_scheme: 'light' }, true).roles
        .bg,
    ).toBe('#eff1f5')
    expect(
      resolveLook({ ui_style: 'tui', terminal_theme: 'Default', color_scheme: 'system' }, false)
        .roles.mantle,
    ).toBe('#e6e9ef')
    expect(
      resolveLook({ ui_style: 'tui', terminal_theme: 'Default', color_scheme: 'system' }, true)
        .roles.mantle,
    ).toBe('#181825')
  })

  test('LOOK-41 a named theme is the same in either scheme: Solarized Light stays light with Dark', () => {
    const look = resolveLook(
      { ui_style: 'tui', terminal_theme: 'Solarized Light', color_scheme: 'dark' },
      true,
    )
    expect([look.roles.bg, look.dark]).toEqual(['#fdf6e3', false])
  })

  test('LOOK-44 an unknown theme behaves as Default; an unknown style as Classic', () => {
    expect(
      resolveLook({ ui_style: 'tui', terminal_theme: 'Matrix', color_scheme: 'dark' }, true).roles
        .bg,
    ).toBe('#1e1e2e')
    expect(
      resolveLook({ ui_style: 'neon', terminal_theme: 'Nord', color_scheme: 'dark' }, true).style,
    ).toBe('classic')
  })

  test('Classic with Default leaves the terminal its own colors (LOOK-43); a named theme colors it', () => {
    expect(
      resolveLook({ ui_style: 'classic', terminal_theme: 'Default', color_scheme: 'dark' }, true)
        .terminal,
    ).toBeNull()
    const nord = resolveLook(
      { ui_style: 'classic', terminal_theme: 'Nord', color_scheme: 'light' },
      false,
    )
    expect(nord.terminal?.bg).toBe('#2e3440')
    expect(nord.terminal?.ansi).toHaveLength(16)
  })

  test('LOOK-34 the terminal takes the theme’s colors in Terminal workspace', () => {
    const t = resolveLook(
      { ui_style: 'tui', terminal_theme: 'Default', color_scheme: 'dark' },
      true,
    ).terminal
    expect([t?.bg, t?.fg, t?.ansi[1]]).toEqual(['#1e1e2e', '#cdd6f4', '#f38ba8'])
  })
})

test('the text on the accent reads on it (3:1 or better) in every theme, style and scheme', () => {
  for (const name of THEME_NAMES) {
    for (const ui_style of ['tui', 'classic']) {
      for (const dark of [true, false]) {
        const look = resolveLook(
          { ui_style, terminal_theme: name, color_scheme: dark ? 'dark' : 'light' },
          dark,
        )
        expect(
          contrast(onAccent(look), look.roles.accent),
          `${name} ${ui_style} ${dark}`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  }
})

test('the text on the accent is the theme’s background when that reads better, its text otherwise', () => {
  const mocha = resolveLook(
    { ui_style: 'tui', terminal_theme: 'Catppuccin Mocha', color_scheme: 'dark' },
    true,
  )
  expect(onAccent(mocha)).toBe(mocha.roles.bg)
  const tango = resolveLook(
    { ui_style: 'tui', terminal_theme: 'Tango Dark', color_scheme: 'dark' },
    true,
  )
  expect(onAccent(tango)).toBe(tango.roles.fg)
})
