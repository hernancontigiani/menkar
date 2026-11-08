// The look's colors. No Node import: the renderer uses this module.

export interface Palette {
  readonly fg: string
  readonly bg: string
  readonly ansi: readonly string[]
}

const p = (fg: string, bg: string, ansi: string): Palette => ({ fg, bg, ansi: ansi.split(' ') })

export const PALETTES: Readonly<Record<string, Palette>> = {
  'Tango Dark': p(
    '#d3d7cf',
    '#2e3436',
    '#2e3436 #cc0000 #4e9a06 #c4a000 #3465a4 #75507b #06989a #d3d7cf #555753 #ef2929 #8ae234 #fce94f #729fcf #ad7fa8 #34e2e2 #eeeeec',
  ),
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
  Dracula: p(
    '#f8f8f2',
    '#282a36',
    '#21222c #ff5555 #50fa7b #f1fa8c #bd93f9 #ff79c6 #8be9fd #f8f8f2 #6272a4 #ff6e6e #69ff94 #ffffa5 #d6acff #ff92df #a4ffff #ffffff',
  ),
  'Gruvbox Dark': p(
    '#ebdbb2',
    '#282828',
    '#282828 #cc241d #98971a #d79921 #458588 #b16286 #689d6a #a89984 #928374 #fb4934 #b8bb26 #fabd2f #83a598 #d3869b #8ec07c #ebdbb2',
  ),
  Nord: p(
    '#d8dee9',
    '#2e3440',
    '#3b4252 #bf616a #a3be8c #ebcb8b #81a1c1 #b48ead #88c0d0 #e5e9f0 #4c566a #bf616a #a3be8c #ebcb8b #81a1c1 #b48ead #8fbcbb #eceff4',
  ),
  'Catppuccin Mocha': p(
    '#cdd6f4',
    '#1e1e2e',
    '#45475a #f38ba8 #a6e3a1 #f9e2af #89b4fa #f5c2e7 #94e2d5 #bac2de #585b70 #f38ba8 #a6e3a1 #f9e2af #89b4fa #f5c2e7 #94e2d5 #a6adc8',
  ),
  'Tokyo Night': p(
    '#c0caf5',
    '#1a1b26',
    '#15161e #f7768e #9ece6a #e0af68 #7aa2f7 #bb9af7 #7dcfff #a9b1d6 #414868 #f7768e #9ece6a #e0af68 #7aa2f7 #bb9af7 #7dcfff #c0caf5',
  ),
  Monokai: p(
    '#f8f8f2',
    '#272822',
    '#272822 #f92672 #a6e22e #f4bf75 #66d9ef #ae81ff #a1efe4 #f8f8f2 #75715e #f92672 #a6e22e #f4bf75 #66d9ef #ae81ff #a1efe4 #f9f8f5',
  ),
  'One Dark': p(
    '#abb2bf',
    '#282c34',
    '#282c34 #e06c75 #98c379 #e5c07b #61afef #c678dd #56b6c2 #abb2bf #5c6370 #e06c75 #98c379 #e5c07b #61afef #c678dd #56b6c2 #ffffff',
  ),
  'Catppuccin Latte': p(
    '#4c4f69',
    '#eff1f5',
    '#5c5f77 #d20f39 #40a02b #df8e1d #1e66f5 #ea76cb #179299 #acb0be #6c6f85 #d20f39 #40a02b #df8e1d #1e66f5 #ea76cb #179299 #bcc0cc',
  ),
}

export const THEME_NAMES = [
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
] as const

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
  // The terminal's colors; null in Classic with Default, where the terminal keeps its own.
  readonly terminal: Palette | null
}

const CATPPUCCIN: Readonly<Record<string, Partial<Roles>>> = {
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
  const exact = CATPPUCCIN[name] ?? {}
  const { bg, fg, ansi } = palette
  return {
    bg,
    fg,
    mantle: exact.mantle ?? shade(bg, 0.85),
    surface0: exact.surface0 ?? mix(bg, fg, 0.12),
    surface1: exact.surface1 ?? mix(bg, fg, 0.2),
    overlay0: exact.overlay0 ?? mix(bg, fg, 0.45),
    subtext0: exact.subtext0 ?? mix(bg, fg, 0.8),
    accent: exact.accent ?? (name === 'Dracula' ? '#bd93f9' : (ansi[5] ?? fg)),
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
}

const isLight = (color: string) => {
  const [r, g, b] = rgb(color)
  return 0.299 * r + 0.587 * g + 0.114 * b > 140
}

export function resolveLook(settings: LookSettings, systemDark: boolean): Look {
  const style = settings.ui_style === 'tui' ? 'tui' : 'classic'
  const schemeDark =
    settings.color_scheme === 'dark' || (settings.color_scheme !== 'light' && systemDark)
  const named = PALETTES[settings.terminal_theme] ? settings.terminal_theme : 'Default'
  const themeName =
    named === 'Default' ? (schemeDark ? 'Catppuccin Mocha' : 'Catppuccin Latte') : named
  const palette = PALETTES[themeName] as Palette
  if (style === 'classic') {
    return {
      style,
      dark: schemeDark,
      roles: CLASSIC[schemeDark ? 'dark' : 'light'],
      terminal: named === 'Default' ? null : palette,
    }
  }
  return {
    style,
    dark: !isLight(palette.bg),
    roles: rolesOf(themeName, palette),
    terminal: palette,
  }
}
