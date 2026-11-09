import { execFile } from 'node:child_process'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import {
  IntegrationError,
  installRetention,
  installStatusline,
  removeRetention,
  removeStatusline,
  retentionInstalled,
  retentionStatus,
  statuslineInstalled,
} from '../core/context/integrations'
import { thresholdsOf } from '../core/context/levels'
import { log } from '../core/log'
import { LANGUAGE_NAMES, monospaceFamilies, validSetting } from '../core/preferences'
import { type Settings, settingsOf, withSetting } from '../core/settings'
import type { InvokeChannel, InvokeChannels } from '../shared/ipc'
import { statuslineCommand } from './context'
import { sessions } from './sessions'
import { usageView } from './usage'
import { usageOpener } from './windows'
import * as workspace from './workspace'

// The only addresses About opens, and only when the user clicks: the app makes no connection of
// its own.
const LINKS: Readonly<Record<string, string>> = {
  website: 'https://github.com/hernancontigiani/menkar',
  issues: 'https://github.com/hernancontigiani/menkar/issues',
}

// The language the app started in: a change shows only after a restart.
let startLanguage = ''

export function setStartLanguage(language: string): void {
  startLanguage = language
}

function handle<C extends InvokeChannel>(
  channel: C,
  handler: (request: InvokeChannels[C]['request']) => Promise<InvokeChannels[C]['response']>,
): void {
  ipcMain.handle(channel, (_event, request: InvokeChannels[C]['request']) => handler(request))
}

async function currentSettings(): Promise<Settings> {
  return settingsOf(await sessions.currentState())
}

// Every window takes a changed setting at once: the main windows through their state, Menkar's own
// windows (Preferences, About, Usage) through `settings:changed`.
function announce(settings: Settings): void {
  workspace.pushWindowStates()
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('settings:changed', settings)
  }
}

let fonts: Promise<string[]> | null = null

// The installed monospace font families (fontconfig); none when it cannot be asked.
function monospaceFonts(): Promise<string[]> {
  fonts ??= new Promise((resolve) => {
    execFile('fc-list', [':spacing=mono', 'family'], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        log.warn('installed fonts could not be listed', { error })
        resolve([])
      } else resolve(monospaceFamilies(stdout))
    })
  })
  return fonts
}

// Restart now quits the way quitting does — one question for the running sessions, the layout
// saved. The relaunch is registered before the quit starts, because the quit can run to its end
// before quitApp's answer comes back and a relaunch asked for after that never happens; a cancelled
// quit takes it back, so a cancelled restart never relaunches later.
async function restart(): Promise<boolean> {
  const relaunch = () => app.relaunch()
  app.once('will-quit', relaunch)
  const quitting = await workspace.quitApp()
  if (!quitting) app.removeListener('will-quit', relaunch)
  return quitting
}

export function registerPreferencesIpc(): void {
  handle('settings:get', async () => ({
    settings: await currentSettings(),
    startLanguage,
    languages: Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name })),
    fonts: await monospaceFonts(),
    version: app.getVersion(),
  }))
  handle('settings:set', async ({ key, value }) => {
    const valid = validSetting(key, value)
    if (valid === null) return currentSettings()
    if (key === 'ring_warn' || key === 'ring_full') {
      // The two edges are one setting: a value that breaks the pair is not saved.
      const now = await currentSettings()
      const warn = key === 'ring_warn' ? valid : now.ring_warn
      const full = key === 'ring_full' ? valid : now.ring_full
      const kept = thresholdsOf(warn, full)
      if (kept.warn !== warn || kept.full !== full) return now
    }
    await sessions.updateState((state) => withSetting(state, key, valid))
    const settings = await currentSettings()
    announce(settings)
    return settings
  })
  handle('app:restart', () => restart())
  // The opener window's project scopes the figures; a Usage window with no opener has none.
  ipcMain.handle(
    'usage:view',
    (event, { which, allProjects }: InvokeChannels['usage:view']['request']) => {
      const opener = usageOpener(event.sender)
      const projectId = opener ? (workspace.windowState(opener.webContents)?.shown ?? null) : null
      return usageView(which, projectId || null, allProjects)
    },
  )
  handle('app:open-link', async ({ link }) => {
    const url = LINKS[link]
    if (url) await shell.openExternal(url)
    return undefined
  })
  handle('integrations:statusline', async () => ({ on: await statuslineInstalled() }))
  handle('integrations:set-statusline', async ({ on }) => {
    try {
      if (on) await installStatusline(statuslineCommand())
      else await removeStatusline(statuslineCommand())
      return { on: await statuslineInstalled(), error: null }
    } catch (error) {
      if (!(error instanceof IntegrationError)) throw error
      return { on: await statuslineInstalled(), error: error.message }
    }
  })
  handle('integrations:retention', async () => ({
    on: await retentionInstalled(),
    status: await retentionStatus(),
  }))
  handle('integrations:set-retention', async ({ on }) => {
    try {
      if (on) await installRetention()
      else await removeRetention()
      return { on: await retentionInstalled(), error: null }
    } catch (error) {
      if (!(error instanceof IntegrationError)) throw error
      return { on: await retentionInstalled(), error: error.message }
    }
  })
}
