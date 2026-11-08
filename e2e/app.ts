import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron, type ElectronApplication, type Page } from '@playwright/test'

export interface LaunchedApp {
  readonly app: ElectronApplication
  readonly window: Page
  close(): Promise<void>
}

// The app runs against a throwaway HOME and XDG set, so a run never reads or writes the
// developer's own directories, and its shell starts without their rc files.
export async function launchApp(): Promise<LaunchedApp> {
  const root = mkdtempSync(join(tmpdir(), 'menkar-e2e-'))
  const home = join(root, 'home')
  mkdirSync(home)
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  Object.assign(env, {
    HOME: home,
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
    SHELL: '/bin/bash',
  })
  delete env.ELECTRON_RENDERER_URL
  const app = await _electron.launch({ args: ['.'], env })
  const window = await app.firstWindow()
  return {
    app,
    window,
    async close() {
      await app.close()
      rmSync(root, { recursive: true, force: true })
    },
  }
}

export async function terminalText(window: Page): Promise<string> {
  const rows = await window.locator('.xterm-rows > div').allTextContents()
  return rows.join('\n')
}
