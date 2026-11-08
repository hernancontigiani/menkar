import type { Settings } from '../core/settings'
import { type Look, resolveLook } from '../core/theme'

const dark = window.matchMedia('(prefers-color-scheme: dark)')
let current: Settings | undefined
let listener: ((look: Look) => void) | undefined

// Classic's stock colors that the roles do not carry.
const CLASSIC_DESTRUCTIVE = { light: '#c01c28', dark: '#ff7b63' }

export function applyLook(settings: Settings, onChange?: (look: Look) => void): Look {
  current = settings
  if (onChange) listener = onChange
  const look = resolveLook(settings, dark.matches)
  const root = document.documentElement
  root.classList.toggle('classic', look.style === 'classic')
  root.classList.toggle('tui', look.style === 'tui')
  const r = look.roles
  const vars: Record<string, string> = {
    '--bg': r.bg,
    '--fg': r.fg,
    '--mantle': r.mantle,
    '--surface0': r.surface0,
    '--surface1': r.surface1,
    '--overlay0': r.overlay0,
    '--subtext0': r.subtext0,
    '--accent': r.accent,
    '--on-accent': look.style === 'tui' ? r.bg : '#ffffff',
    '--green': r.green,
    '--yellow': r.yellow,
    '--red': r.red,
    '--destructive':
      look.style === 'tui' ? r.red : CLASSIC_DESTRUCTIVE[look.dark ? 'dark' : 'light'],
    '--scrim': `rgba(0, 0, 0, ${look.dark ? 0.5 : 0.14})`,
  }
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value)
  return look
}

dark.addEventListener('change', () => {
  if (current) listener?.(applyLook(current))
})
