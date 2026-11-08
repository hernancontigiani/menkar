import type { ShownState } from './shown'

export const AGENT_NAMES: Readonly<Record<string, string>> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
}

// The freedesktop sound theme's files; a system without them gets the system beep.
export const SOUNDS = {
  blocked: '/usr/share/sounds/freedesktop/stereo/dialog-warning.oga',
  done: '/usr/share/sounds/freedesktop/stereo/complete.oga',
} as const

export const TOAST_SECONDS = 6

export interface NotifySettings {
  // "Notify about background agents"
  readonly notifyIdle: boolean
  // "Play a sound"
  readonly notifySound: boolean
}

// state.json's settings as this area reads them; both default to on.
export function notifySettings(rest: Readonly<Record<string, unknown>>): NotifySettings {
  const settings = rest.settings
  const read = (key: string) =>
    typeof settings === 'object' && settings !== null && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)[key] !== false
      : true
  return { notifyIdle: read('notify_idle'), notifySound: read('notify_sound') }
}

export interface NotificationPlan {
  readonly sound: string | null
  // what the user sees: a toast in the focused window, a desktop notification otherwise, or none
  readonly show: 'toast' | 'desktop' | null
  readonly kind: 'blocked' | 'done'
}

// What a notification for a pane that became done or blocked does: the sound is independent of
// the notice; the notice is a toast when the user is in the pane's window, a desktop one otherwise.
export function plan(
  state: Extract<ShownState, 'blocked' | 'done'>,
  windowFocused: boolean,
  settings: NotifySettings,
): NotificationPlan {
  return {
    sound: settings.notifySound ? SOUNDS[state] : null,
    show: settings.notifyIdle ? (windowFocused ? 'toast' : 'desktop') : null,
    kind: state,
  }
}
