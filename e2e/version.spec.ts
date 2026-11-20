// `menkar --version` and `-v` print the version and end: no window, no single-instance lock, none
// of the app's folders made. An app that started instead would never exit within the timeout.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { ensureDisplay } from './display'
import { e2ePath } from './path'

const PACKAGED = process.env.MENKAR_E2E_EXECUTABLE
const EXECUTABLE = resolve(PACKAGED ?? 'node_modules/electron/dist/electron')
const APP_ARGS = PACKAGED ? [] : [resolve('.')]
const APP_VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
  .version
const escaped = APP_VERSION.replaceAll('.', '\\.')
// A package carries the build's revision (`0.1.0-<commits>.g<hash>`, `.dirty.<time>` after it);
// the app run from the tree has only its own version.
const PRINTED = PACKAGED
  ? new RegExp(`^${escaped}-\\d+\\.g[0-9a-f]{7,}(\\.dirty\\.\\d{14})?\\n$`)
  : new RegExp(`^${escaped}\\n$`)

for (const flag of ['--version', '-v']) {
  test(`\`menkar ${flag}\` prints the version and exits 0 without starting the app`, async () => {
    await ensureDisplay()
    const root = mkdtempSync(join(tmpdir(), 'menkar-e2e-version-'))
    const dirs = {
      HOME: join(root, 'home'),
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_CACHE_HOME: join(root, 'cache'),
      XDG_DATA_HOME: join(root, 'data'),
    }
    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
    Object.assign(env, dirs, { PATH: e2ePath(root) })
    delete env.WAYLAND_DISPLAY
    mkdirSync(dirs.HOME)
    try {
      const result = spawnSync(
        EXECUTABLE,
        ['--no-sandbox', '--ozone-platform=x11', ...APP_ARGS, flag],
        { cwd: root, env, encoding: 'utf8', timeout: 15_000 },
      )
      // A timeout's SIGTERM ends Electron with 0, so the timeout is read from the error.
      expect(result.error).toBeUndefined()
      expect(result.signal).toBeNull()
      expect(result.status).toBe(0)
      expect(result.stdout).toMatch(PRINTED)
      // Chromium's profile is under the cache folder too, so none of the app's folders exists. The
      // toolkit's font cache is the one thing allowed.
      expect(existsSync(dirs.XDG_CONFIG_HOME)).toBe(false)
      expect(existsSync(dirs.XDG_DATA_HOME)).toBe(false)
      const cached = existsSync(dirs.XDG_CACHE_HOME) ? readdirSync(dirs.XDG_CACHE_HOME) : []
      expect(cached.filter((name) => name !== 'fontconfig')).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}
