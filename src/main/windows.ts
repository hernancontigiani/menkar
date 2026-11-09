import { join } from 'node:path'
import { BrowserWindow, type WebContents } from 'electron'
import { t } from '../core/i18n'
import type { SettingsSection } from '../core/preferences'

// Settings and Usage are windows of their own, never children of a main window: a desktop like
// GNOME keeps a child window attached to its parent, and the parent then takes no clicks while it
// is open. There is one Settings for the app, and one Usage per main window, scoped to that
// window's project while the window exists.

type Page = 'settings' | 'usage'

let settingsWindow: BrowserWindow | null = null

const usageWindows = new Map<number, BrowserWindow>()

function open(
  page: Page,
  parent: BrowserWindow | null,
  options: { width: number; height: number; modal: boolean; title: string; query?: string },
): BrowserWindow {
  const window = new BrowserWindow({
    ...(parent ? { parent } : {}),
    modal: options.modal,
    width: options.width,
    height: options.height,
    title: options.title,
    backgroundColor: '#1e1e2e',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.once('ready-to-show', () => window.show())
  const query = options.query ? `?${options.query}` : ''
  const devServer = process.env.ELECTRON_RENDERER_URL
  if (devServer) void window.loadURL(`${devServer}/${page}.html${query}`)
  else {
    void window.loadFile(join(import.meta.dirname, `../renderer/${page}.html`), {
      ...(options.query ? { search: options.query } : {}),
    })
  }
  return window
}

// Asking again brings the open one forward, on the asked section.
export function openSettings(section?: SettingsSection): void {
  const existing = settingsWindow
  if (existing && !existing.isDestroyed()) {
    if (section) existing.webContents.send('settings:section', section)
    existing.show()
    existing.focus()
    return
  }
  const window = open('settings', null, {
    width: 860,
    height: 640,
    modal: false,
    title: t('settings.title'),
    ...(section ? { query: `section=${section}` } : {}),
  })
  settingsWindow = window
  window.on('closed', () => {
    if (settingsWindow === window) settingsWindow = null
  })
}

// The main window a Usage window was opened from.
export function usageOpener(contents: WebContents): BrowserWindow | null {
  for (const [parentId, usage] of usageWindows) {
    if (!usage.isDestroyed() && usage.webContents === contents)
      return BrowserWindow.fromId(parentId) ?? null
  }
  return null
}

// One Usage window per main window: asking again brings it forward. Closing the opener leaves it
// open; it reloads, and with no opener left it shows every project.
export function openUsage(opener: BrowserWindow): void {
  const existing = usageWindows.get(opener.id)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return
  }
  const window = open('usage', null, {
    width: 760,
    height: 600,
    modal: false,
    title: t('usage.title'),
  })
  const openerId = opener.id
  usageWindows.set(openerId, window)
  const rescope = () => {
    if (!window.isDestroyed()) window.webContents.reload()
  }
  opener.once('closed', rescope)
  window.on('closed', () => {
    if (usageWindows.get(openerId) === window) usageWindows.delete(openerId)
    if (!opener.isDestroyed()) opener.removeListener('closed', rescope)
  })
}
