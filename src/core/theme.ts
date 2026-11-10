// The look's colors. No Node import: the renderer uses this module.

export interface Palette {
  readonly fg: string
  readonly bg: string
  readonly ansi: readonly string[]
}

const p = (fg: string, bg: string, ansi: string): Palette => ({ fg, bg, ansi: ansi.split(' ') })

export const PALETTES: Readonly<Record<string, Palette>> = {
  'Solarized Dark': p(
    '#839496',
    '#002b36',
    '#073642 #dc322f #859900 #b58900 #268bd2 #d33682 #2aa198 #eee8d5 #002b36 #cb4b16 #586e75 #657b83 #839496 #6c71c4 #93a1a1 #fdf6e3',
  ),
  'Solarized Light': p(
    '#657b83',
    '#fdf6e3',
    '#073642 #dc322f #859900 #b58900 #268bd2 #d33682 #2aa198 #eee8d5 #002b36 #cb4b16 #586e75 #657b83 #839496 #6c71c4 #93a1a1 #fdf6e3',
  ),
  'Catppuccin Mocha': p(
    '#cdd6f4',
    '#1e1e2e',
    '#45475a #f38ba8 #a6e3a1 #f9e2af #89b4fa #f5c2e7 #94e2d5 #bac2de #585b70 #f38ba8 #a6e3a1 #f9e2af #89b4fa #f5c2e7 #94e2d5 #a6adc8',
  ),
  'Catppuccin Latte': p(
    '#4c4f69',
    '#eff1f5',
    '#5c5f77 #d20f39 #40a02b #df8e1d #1e66f5 #ea76cb #179299 #acb0be #6c6f85 #d20f39 #40a02b #df8e1d #1e66f5 #ea76cb #179299 #bcc0cc',
  ),
  // VS Code's default dark ("Dark Modern"), VS Code 1.105.1, MIT: the terminal panel's background
  // (`panel.background`, the terminal having none of its own) and `terminal.foreground` from
  // extensions/theme-defaults/themes/dark_modern.json; the 16 colours are the workbench's dark
  // defaults for `terminal.ansi*` (vs/workbench/contrib/terminal, terminalColorRegistry).
  'VS Code Dark': p(
    '#cccccc',
    '#181818',
    '#000000 #cd3131 #0dbc79 #e5e510 #2472c8 #bc3fbc #11a8cd #e5e5e5 #666666 #f14c4c #23d18b #f5f543 #3b8eea #d670d6 #29b8db #e5e5e5',
  ),
  // VS Code's default light ("Light Modern"), the same sources: light_modern.json's panel.background
  // and terminal.foreground, and the workbench's light defaults for `terminal.ansi*`.
  'VS Code Light': p(
    '#3b3b3b',
    '#f8f8f8',
    '#000000 #cd3131 #107c10 #949800 #0451a5 #bc05bc #0598bc #555555 #666666 #cd3131 #14ce14 #b5ba00 #0451a5 #bc05bc #0598bc #a5a5a5',
  ),
}

// The choices. "VS Code" is Dark Modern with a dark scheme and Light Modern with a light one; the
// others are one palette each.
export const THEME_NAMES = [
  'VS Code',
  'Catppuccin Mocha',
  'Catppuccin Latte',
  'Solarized Dark',
  'Solarized Light',
] as const

// What a first start chooses, and what a saved theme the app no longer has reads as.
export const FALLBACK_THEME = 'VS Code'

// The saved name if the app has it, else the fallback (a removed "Default" included).
export function knownTheme(name: string): string {
  return (THEME_NAMES as readonly string[]).includes(name) ? name : FALLBACK_THEME
}

export interface Roles {
  readonly bg: string
  readonly fg: string
  readonly mantle: string
  readonly surface0: string
  readonly surface1: string
  readonly overlay0: string
  readonly subtext0: string
  readonly accent: string
  readonly green: string
  readonly yellow: string
  readonly red: string
}

export interface Look {
  readonly style: 'tui' | 'classic'
  readonly dark: boolean
  // The chrome's colors (the stock palette in Classic).
  readonly roles: Roles
  // The terminals' colors: Ubuntu's, the theme's, or null for the neutral ones the terminal draws
  // itself (close to VTE's defaults, by the scheme).
  readonly terminal: Palette | null
}

// Themes whose chrome colours are their own rather than derived from the terminal palette.
const EXACT_ROLES: Readonly<Record<string, Partial<Roles>>> = {
  // light_modern.json: sideBar.background, widget.border, input.border,
  // editorLineNumber.foreground, tab.inactiveForeground, focusBorder.
  'VS Code Light': {
    mantle: '#f8f8f8',
    surface0: '#e5e5e5',
    surface1: '#cecece',
    overlay0: '#6e7681',
    subtext0: '#868686',
    accent: '#005fb8',
  },
  // dark_modern.json: sideBar.background, input.background, input.border,
  // editorLineNumber.foreground, descriptionForeground, focusBorder.
  'VS Code Dark': {
    mantle: '#181818',
    surface0: '#313131',
    surface1: '#3c3c3c',
    overlay0: '#6e7681',
    subtext0: '#9d9d9d',
    accent: '#0078d4',
  },
  'Catppuccin Mocha': {
    mantle: '#181825',
    surface0: '#313244',
    surface1: '#45475a',
    overlay0: '#6c7086',
    subtext0: '#a6adc8',
    accent: '#cba6f7',
  },
  'Catppuccin Latte': {
    mantle: '#e6e9ef',
    surface0: '#ccd0da',
    surface1: '#bcc0cc',
    overlay0: '#9ca0b0',
    subtext0: '#6c6f85',
    accent: '#8839ef',
  },
}

const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
const hex = (c: readonly number[]) =>
  `#${c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

export function mix(from: string, to: string, t: number): string {
  const a = rgb(from)
  const b = rgb(to)
  return hex(a.map((v, i) => v + ((b[i] ?? v) - v) * t))
}

// HSL lightness and saturation each multiplied by `factor`.
export function shade(color: string, factor: number): string {
  const [r, g, b] = rgb(color).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  const l2 = Math.min(1, l * factor)
  const s2 = Math.min(1, s * factor)
  if (s2 === 0) return hex([l2 * 255, l2 * 255, l2 * 255])
  const q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2
  const p2 = 2 * l2 - q
  const channel = (t0: number) => {
    let t = t0
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p2 + (q - p2) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p2 + (q - p2) * (2 / 3 - t) * 6
    return p2
  }
  return hex([channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255])
}

function rolesOf(name: string, palette: Palette): Roles {
  const exact = EXACT_ROLES[name] ?? {}
  const { bg, fg, ansi } = palette
  return {
    bg,
    fg,
    mantle: exact.mantle ?? shade(bg, 0.85),
    surface0: exact.surface0 ?? mix(bg, fg, 0.12),
    surface1: exact.surface1 ?? mix(bg, fg, 0.2),
    overlay0: exact.overlay0 ?? mix(bg, fg, 0.45),
    subtext0: exact.subtext0 ?? mix(bg, fg, 0.8),
    accent: exact.accent ?? ansi[5] ?? fg,
    green: ansi[2] ?? fg,
    yellow: ansi[3] ?? fg,
    red: ansi[1] ?? fg,
  }
}

// libadwaita 1.5's stock colors, which Classic keeps for the chrome.
const CLASSIC: Readonly<Record<'light' | 'dark', Roles>> = {
  light: {
    bg: '#fafafa',
    fg: '#323232',
    mantle: '#fafafa',
    surface0: '#ffffff',
    surface1: '#d9d9d9',
    overlay0: '#8c8c8c',
    subtext0: '#323232',
    accent: '#3584e4',
    green: '#2ec27e',
    yellow: '#e5a50a',
    red: '#e01b24',
  },
  dark: {
    bg: '#242424',
    fg: '#ffffff',
    mantle: '#242424',
    surface0: '#383838',
    surface1: '#4a4a4a',
    overlay0: '#9a9a9a',
    subtext0: '#ffffff',
    accent: '#3584e4',
    green: '#2ec27e',
    yellow: '#e5a50a',
    red: '#e01b24',
  },
}

export interface LookSettings {
  readonly ui_style: string
  readonly terminal_theme: string
  readonly color_scheme: string
  // Absent: the theme's own terminal colours (the app always passes the saved setting).
  readonly terminal_colors?: string
}

const isLight = (color: string) => {
  const [r, g, b] = rgb(color)
  return 0.299 * r + 0.587 * g + 0.114 * b > 140
}

// WCAG's contrast ratio between two #rrggbb colors.
export function contrast(a: string, b: string): number {
  const luminance = (color: string) => {
    const [r, g, bl] = rgb(color).map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// Text on the accent: Classic's stock white; in Terminal workspace the theme's background or text,
// whichever reads better (a dark accent takes the light text).
export function onAccent(look: Look): string {
  if (look.style === 'classic') return '#ffffff'
  const { bg, fg, accent } = look.roles
  return contrast(bg, accent) >= contrast(fg, accent) ? bg : fg
}

// GNOME Terminal on Ubuntu with the desktop's colours (Yaru-dark): its aubergine and white, and
// GNOME's own 16-colour palette; the same in either scheme, as Ubuntu's terminal is (1.42).
export const UBUNTU_TERMINAL: Palette = p(
  '#ffffff',
  '#300a24',
  '#171421 #c01c28 #26a269 #a2734c #12488b #a347ba #2aa1b3 #d0cfcc #5e5c64 #f66151 #33da7a #e9ad0c #2a7bde #c061cb #33c7de #ffffff',
)

function terminalOf(colors: string | undefined, theme: Palette): Palette | null {
  if (colors === 'ubuntu') return UBUNTU_TERMINAL
  if (colors === 'neutral') return null
  return theme
}

export function resolveLook(settings: LookSettings, systemDark: boolean): Look {
  const style = settings.ui_style === 'tui' ? 'tui' : 'classic'
  const schemeDark =
    settings.color_scheme === 'dark' || (settings.color_scheme !== 'light' && systemDark)
  const named = knownTheme(settings.terminal_theme)
  const themeName = named === 'VS Code' ? (schemeDark ? 'VS Code Dark' : 'VS Code Light') : named
  const palette = PALETTES[themeName] as Palette
  if (style === 'classic') {
    return {
      style,
      dark: schemeDark,
      roles: CLASSIC[schemeDark ? 'dark' : 'light'],
      terminal: terminalOf(settings.terminal_colors, palette),
    }
  }
  return {
    style,
    dark: !isLight(palette.bg),
    roles: rolesOf(themeName, palette),
    terminal: terminalOf(settings.terminal_colors, palette),
  }
}

// What the editor colours in source text. Every theme maps them to its roles; a theme with syntax
// colours of its own sets them here, for a dark and a light editor.
export const SYNTAX_ROLES = [
  'heading',
  'strong',
  'code',
  'link',
  'marker',
  'quote',
  'rule',
  'keyword',
  'control',
  'string',
  'number',
  'comment',
  'property',
  'type',
  'function',
  'invalid',
] as const
export type SyntaxRole = (typeof SYNTAX_ROLES)[number]

// VS Code 1.105.1's Dark+ / Dark Modern token colours (dark_vs.json, dark_plus.json, MIT); links
// take `textLink.foreground` and list markers `punctuation.definition.list.begin.markdown`.
const EXACT_SYNTAX: Readonly<
  Record<string, Readonly<Record<'dark' | 'light', Readonly<Record<SyntaxRole, string>>>>>
> = {
  'VS Code': {
    dark: {
      heading: '#569cd6',
      strong: '#569cd6',
      code: '#ce9178',
      link: '#4daafc',
      marker: '#6796e6',
      quote: '#6a9955',
      rule: '#6e7681',
      keyword: '#569cd6',
      control: '#c586c0',
      string: '#ce9178',
      number: '#b5cea8',
      comment: '#6a9955',
      property: '#9cdcfe',
      type: '#4ec9b0',
      function: '#dcdcaa',
      invalid: '#f44747',
    },
    // light_vs.json and light_plus.json; links take light_modern's `textLink.foreground`.
    light: {
      heading: '#800000',
      strong: '#000080',
      code: '#800000',
      link: '#005fb8',
      marker: '#0451a5',
      quote: '#008000',
      rule: '#6e7681',
      keyword: '#0000ff',
      control: '#af00db',
      string: '#a31515',
      number: '#098658',
      comment: '#008000',
      property: '#e50000',
      type: '#267f99',
      function: '#795e26',
      invalid: '#cd3131',
    },
  },
}

// The colour of each syntax role for this look. `inherit` keeps the text's own colour.
export function syntaxOf(look: Look, theme: string): Readonly<Record<SyntaxRole, string>> {
  const own = EXACT_SYNTAX[theme]?.[look.dark ? 'dark' : 'light']
  if (own) return own
  const r = look.roles
  return {
    heading: r.accent,
    strong: 'inherit',
    code: r.yellow,
    link: r.green,
    marker: r.red,
    quote: r.subtext0,
    rule: r.overlay0,
    keyword: r.accent,
    control: r.accent,
    string: r.green,
    number: r.yellow,
    comment: r.overlay0,
    property: r.red,
    type: r.yellow,
    function: r.accent,
    invalid: r.red,
  }
}
