import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, savedCursorTab } from './app'
import { ensureDisplay } from './display'

const ELECTRON = resolve('node_modules/electron/dist/electron')
const APP = resolve('.')

function menkar(args: string[], cwd: string, env: Readonly<Record<string, string>>) {
  return spawnSync(ELECTRON, ['--no-sandbox', '--ozone-platform=x11', APP, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  })
}

test('FIL-31 `menkar open` with no file prints the usage and exits with 2', async () => {
  await ensureDisplay()
  const root = mkdtempSync(join(tmpdir(), 'menkar-e2e-open-'))
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
  Object.assign(env, {
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
  })
  delete env.WAYLAND_DISPLAY
  mkdirSync(join(root, 'home'))
  const result = menkar(['open'], root, env)
  expect(result.status).toBe(2)
  expect(result.stderr).toContain('Usage: menkar open <file> [<file>…]')
})

test('FIL-32 `menkar open README.md` in a folder reaches the running app: a tab in its window, the path made absolute there', async () => {
  let work = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      work = join(dirs.home, 'work', 'api')
      mkdirSync(work, { recursive: true })
      writeFileSync(join(work, 'README.md'), '# api\n')
      return savedCursorTab(dirs, {})
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(1)
    const result = menkar(['open', 'README.md'], work, launched.env)
    expect(result.status).toBe(0)
    await expect(page.locator('.tab.selected')).toHaveText(/README\.md/)
    await expect(page.locator('.tab.selected')).toHaveAttribute('title', join(work, 'README.md'))
  } finally {
    await launched.close()
  }
})
