// What Preferences may write, and how a value from the page is made valid before it is saved. No
// Node import: the page shares these lists.
import { type Settings, UI_SCALES } from './settings'
import { THEME_NAMES } from './theme'

export const SCROLLBACK_MIN = 1000
export const SCROLLBACK_MAX = 1_000_000
export const SCROLLBACK_STEP = 1000

// The keys a row of Preferences writes; the rest of state.json is never touched from there.
export const PREFERENCE_KEYS = [
  'font',
  'scrollback',
  'color_scheme',
  'ui_style',
  'terminal_theme',
  'show_folder_path',
  'language',
  'notify_idle',
  'notify_sound',
  'reopen_tabs',
  'ring_warn',
  'ring_full',
  'ui_scale',
] as const
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number]

export const LANGUAGE_NAMES: Readonly<Record<string, string>> = { en: 'English', es: 'Español' }

// The value to save for a row, or null when it cannot be one of that row's choices.
export function validSetting(key: string, value: unknown): string | number | boolean | null {
  switch (key as PreferenceKey) {
    case 'font':
      return typeof value === 'string' ? value.trim() : null
    case 'scrollback': {
      const n = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(n)) return null
      return Math.min(SCROLLBACK_MAX, Math.max(SCROLLBACK_MIN, Math.round(n)))
    }
    case 'color_scheme':
      return value === 'system' || value === 'light' || value === 'dark' ? value : null
    case 'ui_style':
      return value === 'tui' || value === 'classic' ? value : null
    case 'terminal_theme':
      return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value)
        ? value
        : null
    case 'language':
      return value === '' || (typeof value === 'string' && value in LANGUAGE_NAMES) ? value : null
    case 'ring_warn':
    case 'ring_full':
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100
        ? (value as number)
        : null
    case 'ui_scale':
      return (UI_SCALES as readonly unknown[]).includes(value) ? (value as number) : null
    case 'show_folder_path':
    case 'notify_idle':
    case 'notify_sound':
    case 'reopen_tabs':
      return typeof value === 'boolean' ? value : null
    default:
      return null
  }
}

// A saved theme name the app does not have reads as Default.
export function shownTheme(settings: Pick<Settings, 'terminal_theme'>): string {
  return (THEME_NAMES as readonly string[]).includes(settings.terminal_theme)
    ? settings.terminal_theme
    : 'Default'
}

// fc-list's `family` lines: a family per line, aliases after commas. Emoji and symbol fonts that
// claim to be monospace are left out.
export function monospaceFamilies(fcList: string): string[] {
  const found = new Set<string>()
  for (const line of fcList.split('\n')) {
    const family = line.split(',')[0]?.trim()
    if (family && !/emoji|signwriting|symbol/i.test(family)) found.add(family)
  }
  return [...found].sort((a, b) => a.localeCompare(b))
}

// "DejaVu Sans Mono 14" → family and size; a description with no size keeps the default size.
export function parseFont(description: string): { family: string; size: number | null } {
  const match = /^(.*?)\s+(\d+(?:\.\d+)?)$/.exec(description.trim())
  return match
    ? { family: match[1] ?? '', size: Number(match[2]) }
    : { family: description.trim(), size: null }
}

// The Settings window's sections, in the order its list shows them; a null marks a group's end.
export const SETTINGS_LIST = [
  'appearance',
  'terminal',
  null,
  'sessions',
  'notifications',
  'context',
  null,
  'usage',
  null,
  'statusline',
  'retention',
  'mcp',
  null,
  'language',
  'about',
] as const
export type SettingsSection = NonNullable<(typeof SETTINGS_LIST)[number]>
