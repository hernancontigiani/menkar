import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, terminalText } from './app'

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
    throw error
  }
}

test("the terminal runs the user's shell, and closing the window ends it", async () => {
  const launched = await launchApp()
  const { window } = launched
  try {
    await expect(window.locator('.xterm')).toBeVisible()
    // The page's own <title> is empty: this text came from main's catalog through the preload.
    await expect(window).toHaveTitle('Menkar')
    await expect.poll(() => terminalText(window)).toMatch(/\$\s*$/m)

    await window.locator('.xterm').click()
    await window.keyboard.type('echo menkar-$((40+2))-ok')
    await window.keyboard.press('Enter')
    await expect.poll(() => terminalText(window)).toContain('menkar-42-ok')

    await window.keyboard.type('echo "pid=$$"')
    await window.keyboard.press('Enter')
    let pid = 0
    await expect
      .poll(async () => {
        pid = Number(/pid=(\d+)/.exec(await terminalText(window))?.[1] ?? 0)
        return pid
      })
      .toBeGreaterThan(0)
    expect(isAlive(pid)).toBe(true)

    await window.screenshot({ path: 'test-results/terminal.png' })

    // Kept running without windows, so a shell that dies only because the app exited does not
    // pass for one the window's close ended.
    await launched.app.evaluate(({ app }) => {
      app.removeAllListeners('window-all-closed')
    })
    await window.close()
    await expect.poll(() => isAlive(pid)).toBe(false)
  } finally {
    await launched.close()
  }
})

test("the app draws on xvfb-run's X display, never on the developer's Wayland screen", async () => {
  const launched = await launchApp()
  try {
    const flags = await launched.app.evaluate(({ app }) => ({
      ozone: app.commandLine.getSwitchValue('ozone-platform'),
      wayland: process.env.WAYLAND_DISPLAY ?? null,
    }))
    expect(flags).toEqual({ ozone: 'x11', wayland: null })
  } finally {
    await launched.close()
  }
})

test("Chromium's data lands in the cache, and the config directory holds none of it", async () => {
  const launched = await launchApp()
  const { root } = launched
  let userData = ''
  try {
    await expect(launched.window.locator('.xterm')).toBeVisible()
    userData = await launched.app.evaluate(({ app }) => app.getPath('userData'))
  } finally {
    await launched.app.close()
  }
  try {
    expect(userData).toBe(join(root, 'cache', 'menkar', 'electron'))
    expect(readdirSync(userData).length).toBeGreaterThan(0)
    // The app's own config directory holds its state files (the first start writes both) and
    // nothing of Chromium's; other programs (the input method's client) may write their own
    // folders beside it under the same XDG_CONFIG_HOME.
    const config = join(root, 'config', 'menkar')
    const entries = existsSync(config) ? readdirSync(config, { recursive: true }).map(String) : []
    expect(entries.sort()).toEqual(['projects.json', 'state.json'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
