// No Node import: the renderer reads Settings through the IPC types.

import { DEFAULT_THRESHOLDS, thresholdsOf } from './context/levels'

interface WithRest {
  readonly rest: Readonly<Record<string, unknown>>
}

// The settings the areas built so far read, from state.json's `settings`, each with its default
// when absent or of the wrong type.
export interface Settings {
  readonly ui_style: string
  readonly terminal_theme: string
  readonly color_scheme: string
  readonly font: string
  readonly scrollback: number
  readonly sidebar_width: number
  readonly reopen_tabs: boolean
  readonly new_session_dir: string
  readonly show_folder_path: boolean
  // a language code; '' = the system's
  readonly language: string
  readonly notify_idle: boolean
  readonly notify_sound: boolean
  // The context ring: yellow from, red from (%); green below yellow.
  readonly ring_warn: number
  readonly ring_full: number
  // The agent of the last session started from Add session → New; '' before any.
  readonly last_agent: string
}

export const DEFAULT_SETTINGS: Settings = {
  ui_style: 'tui',
  terminal_theme: 'Default',
  color_scheme: 'system',
  font: '',
  scrollback: 10_000,
  sidebar_width: 250,
  reopen_tabs: true,
  new_session_dir: '',
  show_folder_path: false,
  language: '',
  notify_idle: true,
  notify_sound: true,
  ring_warn: DEFAULT_THRESHOLDS.warn,
  ring_full: DEFAULT_THRESHOLDS.full,
  last_agent: '',
}

export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_SAVE_MIN_WIDTH = 150

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseSettings(value: unknown): Settings {
  const raw = isObject(value) ? value : {}
  // An edge not saved is its default; Preferences saves one row at a time.
  const ring = thresholdsOf(
    raw.ring_warn ?? DEFAULT_THRESHOLDS.warn,
    raw.ring_full ?? DEFAULT_THRESHOLDS.full,
  )
  const str = (key: keyof Settings, fallback: string) =>
    typeof raw[key] === 'string' ? (raw[key] as string) : fallback
  const int = (key: keyof Settings, fallback: number) =>
    Number.isInteger(raw[key]) ? (raw[key] as number) : fallback
  return {
    ui_style: str('ui_style', DEFAULT_SETTINGS.ui_style),
    terminal_theme: str('terminal_theme', DEFAULT_SETTINGS.terminal_theme),
    color_scheme: str('color_scheme', DEFAULT_SETTINGS.color_scheme),
    font: str('font', DEFAULT_SETTINGS.font),
    scrollback: int('scrollback', DEFAULT_SETTINGS.scrollback),
    sidebar_width: int('sidebar_width', DEFAULT_SETTINGS.sidebar_width),
    reopen_tabs:
      typeof raw.reopen_tabs === 'boolean' ? raw.reopen_tabs : DEFAULT_SETTINGS.reopen_tabs,
    new_session_dir: str('new_session_dir', DEFAULT_SETTINGS.new_session_dir),
    show_folder_path: raw.show_folder_path === true,
    language: str('language', DEFAULT_SETTINGS.language),
    notify_idle: raw.notify_idle !== false,
    notify_sound: raw.notify_sound !== false,
    ring_warn: ring.warn,
    ring_full: ring.full,
    last_agent: str('last_agent', DEFAULT_SETTINGS.last_agent),
  }
}

export function settingsOf(state: WithRest): Settings {
  return parseSettings(state.rest.settings)
}

// One key changed, every other setting (and unknown key) left as the file had it.
export function withSetting<S extends WithRest>(
  state: S,
  key: keyof Settings,
  value: string | number | boolean,
): S {
  const settings = isObject(state.rest.settings) ? state.rest.settings : {}
  return { ...state, rest: { ...state.rest, settings: { ...settings, [key]: value } } }
}
