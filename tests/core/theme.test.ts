import { describe, expect, test } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings } from '../../src/core/settings'
import {
  contrast,
  onAccent,
  resolveLook,
  SYNTAX_ROLES,
  syntaxOf,
  THEME_NAMES,
  UBUNTU_TERMINAL,
} from '../../src/core/theme'

// The resolved chrome roles of look.md, per theme: bg, fg, mantle, surface0, surface1, overlay0,
// subtext0, accent, green, yellow, red.
const RESOLVED: Record<string, string[]> = {
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
      'VS Code',
      'Catppuccin Mocha',
      'Catppuccin Latte',
      'Solarized Dark',
      'Solarized Light',
    ])
  })

  test('decision 1.41 VS Code is VS Code 1.105.1’s Dark Modern with a dark scheme and Light Modern with a light one: the terminal panel and 16 colours in both styles, its own chrome in Terminal workspace', () => {
    const palettes = {
      dark: {
        bg: '#181818',
        fg: '#cccccc',
        ansi: '#000000 #cd3131 #0dbc79 #e5e510 #2472c8 #bc3fbc #11a8cd #e5e5e5 #666666 #f14c4c #23d18b #f5f543 #3b8eea #d670d6 #29b8db #e5e5e5'.split(
          ' ',
        ),
      },
      light: {
        bg: '#f8f8f8',
        fg: '#3b3b3b',
        ansi: '#000000 #cd3131 #107c10 #949800 #0451a5 #bc05bc #0598bc #555555 #666666 #cd3131 #14ce14 #b5ba00 #0451a5 #bc05bc #0598bc #a5a5a5'.split(
          ' ',
        ),
      },
    }
    for (const ui_style of ['tui', 'classic']) {
      for (const [scheme, systemDark] of [
        ['dark', false],
        ['light', true],
      ] as const) {
        const look = resolveLook(
          { ui_style, terminal_theme: 'VS Code', color_scheme: scheme },
          systemDark,
        )
        expect(look.terminal, `${ui_style} ${scheme}`).toEqual(palettes[scheme])
        expect(look.dark, `${ui_style} ${scheme}`).toBe(scheme === 'dark')
      }
    }
    const tui = (scheme: 'dark' | 'light') =>
      resolveLook({ ui_style: 'tui', terminal_theme: 'VS Code', color_scheme: scheme }, false).roles
    expect(tui('dark')).toMatchObject({
      bg: '#181818',
      fg: '#cccccc',
      mantle: '#181818',
      surface0: '#313131',
      surface1: '#3c3c3c',
      overlay0: '#6e7681',
      subtext0: '#9d9d9d',
      accent: '#0078d4',
    })
    expect(tui('light')).toMatchObject({
      bg: '#f8f8f8',
      fg: '#3b3b3b',
      mantle: '#f8f8f8',
      surface0: '#e5e5e5',
      surface1: '#cecece',
      overlay0: '#6e7681',
      subtext0: '#868686',
      accent: '#005fb8',
    })
  })

  test('decision 1.41 the editor takes VS Code’s own syntax colours, Dark+ with a dark editor and Light+ with a light one; every other theme maps the syntax to its roles', () => {
    for (const ui_style of ['tui', 'classic']) {
      const dark = resolveLook({ ui_style, terminal_theme: 'VS Code', color_scheme: 'dark' }, true)
      expect(syntaxOf(dark, 'VS Code'), ui_style).toMatchObject({
        heading: '#569cd6',
        code: '#ce9178',
        keyword: '#569cd6',
        string: '#ce9178',
        number: '#b5cea8',
        comment: '#6a9955',
        link: '#4daafc',
      })
      const light = resolveLook(
        { ui_style, terminal_theme: 'VS Code', color_scheme: 'light' },
        false,
      )
      expect(syntaxOf(light, 'VS Code'), ui_style).toMatchObject({
        heading: '#800000',
        code: '#800000',
        keyword: '#0000ff',
        string: '#a31515',
        number: '#098658',
        comment: '#008000',
        link: '#005fb8',
      })
    }
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
  })

  test('decision 1.40 a saved "Ubuntu" theme, removed, loads as the fallback theme (VS Code since 1.41) in both styles and schemes', () => {
    for (const ui_style of ['tui', 'classic']) {
      for (const color_scheme of ['dark', 'light']) {
        const dark = color_scheme === 'dark'
        expect(
          resolveLook({ ui_style, terminal_theme: 'Ubuntu', color_scheme }, dark),
          `${ui_style} ${color_scheme}`,
        ).toEqual(resolveLook({ ui_style, terminal_theme: 'VS Code', color_scheme }, dark))
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
      expect(Object.keys(RESOLVED)).toHaveLength(4)
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

  test('VS Code follows the scheme, Dark Modern in dark and Light Modern in light (LOOK-39, LOOK-40)', () => {
    const vscode = (color_scheme: string, systemDark: boolean) =>
      resolveLook({ ui_style: 'tui', terminal_theme: 'VS Code', color_scheme }, systemDark).roles
    expect(vscode('dark', false).bg).toBe('#181818')
    expect(vscode('light', true).bg).toBe('#f8f8f8')
    expect(vscode('system', false).bg).toBe('#f8f8f8')
    expect(vscode('system', true).bg).toBe('#181818')
  })

  test('LOOK-41 a named theme is the same in either scheme: Solarized Light stays light with Dark', () => {
    const look = resolveLook(
      { ui_style: 'tui', terminal_theme: 'Solarized Light', color_scheme: 'dark' },
      true,
    )
    expect([look.roles.bg, look.dark]).toEqual(['#fdf6e3', false])
  })

  test('LOOK-44 an unknown theme behaves as VS Code (decision 1.41); an unknown style as Classic', () => {
    expect(
      resolveLook({ ui_style: 'tui', terminal_theme: 'Matrix', color_scheme: 'dark' }, true).roles
        .bg,
    ).toBe('#181818')
    expect(
      resolveLook(
        { ui_style: 'neon', terminal_theme: 'Solarized Dark', color_scheme: 'dark' },
        true,
      ).style,
    ).toBe('classic')
  })

  test('LOOK-43 (decision 1.41) Classic colours the terminal with the chosen theme, VS Code included', () => {
    expect(
      resolveLook({ ui_style: 'classic', terminal_theme: 'VS Code', color_scheme: 'dark' }, true)
        .terminal?.bg,
    ).toBe('#181818')
    const solarized = resolveLook(
      { ui_style: 'classic', terminal_theme: 'Solarized Dark', color_scheme: 'light' },
      false,
    )
    expect(solarized.terminal?.bg).toBe('#002b36')
    expect(solarized.terminal?.ansi).toHaveLength(16)
  })

  test('LOOK-34 the terminal takes the theme’s colors in Terminal workspace', () => {
    const t = resolveLook(
      { ui_style: 'tui', terminal_theme: 'Catppuccin Mocha', color_scheme: 'dark' },
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
  // No remaining theme has a dark accent on a dark background; Tango's colours, as a made-up look.
  const darkAccent = {
    ...mocha,
    roles: { ...mocha.roles, bg: '#2e3436', fg: '#d3d7cf', accent: '#75507b' },
  }
  expect(onAccent(darkAccent)).toBe(darkAccent.roles.fg)
})

describe('decision 1.41: five themes, VS Code by default', () => {
  const vscode = (ui_style: string, dark: boolean) =>
    resolveLook(
      { ui_style, terminal_theme: 'VS Code', color_scheme: dark ? 'dark' : 'light' },
      dark,
    )

  test('a fresh state chooses VS Code: #181818 with a dark scheme, Light Modern’s #f8f8f8 with a light one', () => {
    expect(parseSettings(undefined).terminal_theme).toBe('VS Code')
    expect(resolveLook({ ...DEFAULT_SETTINGS, color_scheme: 'dark' }, false).roles.bg).toBe(
      '#181818',
    )
    expect(resolveLook({ ...DEFAULT_SETTINGS, color_scheme: 'light' }, true).roles.bg).toBe(
      '#f8f8f8',
    )
  })

  test('a saved theme the app no longer has (Default, VS Code Dark, Nord, Ubuntu, anything unknown) loads as VS Code', () => {
    for (const gone of ['Default', 'VS Code Dark', 'Nord', 'Tango Dark', 'Ubuntu', 'Matrix'])
      for (const ui_style of ['tui', 'classic'])
        for (const dark of [true, false])
          expect(
            resolveLook(
              { ui_style, terminal_theme: gone, color_scheme: dark ? 'dark' : 'light' },
              dark,
            ),
            `${gone} ${ui_style} ${dark}`,
          ).toEqual(vscode(ui_style, dark))
  })
})

describe('decision 1.42: the terminals’ own colours', () => {
  const look = (terminal_colors: string, ui_style: string, dark: boolean) =>
    resolveLook(
      {
        ui_style,
        terminal_theme: 'VS Code',
        color_scheme: dark ? 'dark' : 'light',
        terminal_colors,
      },
      dark,
    )

  test('Ubuntu terminal is the default: #300a24, white and GNOME’s palette, the same in both styles and schemes, whatever the theme', () => {
    expect(parseSettings(undefined).terminal_colors).toBe('ubuntu')
    expect(UBUNTU_TERMINAL.bg).toBe('#300a24')
    expect(UBUNTU_TERMINAL.fg).toBe('#ffffff')
    expect(UBUNTU_TERMINAL.ansi).toEqual(
      '#171421 #c01c28 #26a269 #a2734c #12488b #a347ba #2aa1b3 #d0cfcc #5e5c64 #f66151 #33da7a #e9ad0c #2a7bde #c061cb #33c7de #ffffff'.split(
        ' ',
      ),
    )
    for (const ui_style of ['tui', 'classic'])
      for (const dark of [true, false]) {
        const l = resolveLook(
          { ...DEFAULT_SETTINGS, ui_style, color_scheme: dark ? 'dark' : 'light' },
          dark,
        )
        expect(l.terminal, `${ui_style} ${dark}`).toEqual(UBUNTU_TERMINAL)
      }
  })

  test('Same as theme gives VS Code’s terminal (#181818 dark, #f8f8f8 light); Neutral leaves the terminal its own colours; the rest stays the theme’s', () => {
    for (const ui_style of ['tui', 'classic']) {
      expect(look('theme', ui_style, true).terminal?.bg).toBe('#181818')
      expect(look('theme', ui_style, false).terminal?.bg).toBe('#f8f8f8')
      expect(look('neutral', ui_style, true).terminal).toBeNull()
      expect(look('neutral', ui_style, true).roles).toEqual(look('theme', ui_style, true).roles)
      expect(look('ubuntu', ui_style, false).roles).toEqual(look('theme', ui_style, false).roles)
    }
  })

  test('a saved value that is not one of the three reads as Ubuntu terminal', () => {
    for (const bad of ['', 'Ubuntu', 'vte', 3, null])
      expect(parseSettings({ terminal_colors: bad }).terminal_colors, String(bad)).toBe('ubuntu')
    expect(parseSettings({ terminal_colors: 'neutral' }).terminal_colors).toBe('neutral')
  })
})
