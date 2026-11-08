import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { t } from '../core/i18n'

// Preferences, About and the Usage window: each a child window of the main window that asked, with
// its own page. Preferences and About are modal over it, as dialogs are; Usage is not, and there is
// one per main window.

type Page = 'preferences' | 'about' | 'usage' | 'mcp'

const usageWindows = new Map<number, BrowserWindow>()

function open(
  page: Page,
  parent: BrowserWindow,
  options: { width: number; height: number; modal: boolean; title: string; query?: string },
): BrowserWindow {
  const window = new BrowserWindow({
    parent,
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

export function openPreferences(
  parent: BrowserWindow,
  page: 'general' | 'integrations' = 'general',
): void {
  open('preferences', parent, {
    width: 640,
    height: 720,
    modal: true,
    title: t('preferences.title'),
    query: `page=${page}`,
  })
}

export function openAbout(parent: BrowserWindow): void {
  open('about', parent, { width: 420, height: 560, modal: true, title: t('about.title') })
}

// One Usage window per main window: asking again brings it forward.
export function openUsage(parent: BrowserWindow): void {
  const existing = usageWindows.get(parent.id)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return
  }
  const window = open('usage', parent, {
    width: 760,
    height: 600,
    modal: false,
    title: t('usage.title'),
  })
  const parentId = parent.id
  usageWindows.set(parentId, window)
  window.on('closed', () => {
    if (usageWindows.get(parentId) === window) usageWindows.delete(parentId)
  })
}

// The MCP servers browser: read only, ~/.claude.json read once when it opens.
export function openMcpServers(parent: BrowserWindow): void {
  open('mcp', parent, { width: 540, height: 600, modal: true, title: t('mcp.title') })
}
