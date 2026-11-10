import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare } from './fixtures'

// Preferences on the real app (docs/spec/preferences.md, PRF-1 to PRF-24), never on the human's
// display or with their HOME. They live in the Settings window's sections (2026-11-10).

async function openSettings(
  app: ElectronApplication,
  page: Page,
  keys = 'Control+Comma',
): Promise<Page> {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  const [prefs] = await Promise.all([app.waitForEvent('window'), page.keyboard.press(keys)])
  await prefs.waitForLoadState('domcontentloaded')
  await expect(prefs.locator('main[data-section="appearance"]')).toBeVisible()
  return prefs
}

async function section(prefs: Page, name: string): Promise<void> {
  await prefs.locator(`.section-item[data-section="${name}"]`).click()
  await expect(prefs.locator(`main[data-section="${name}"]`)).toBeVisible()
}

function writeState(root: string, settings: Record<string, unknown>): void {
  const dir = join(root, 'config', 'menkar')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ settings }))
}

const savedSettings = (root: string) =>
  JSON.parse(readFileSync(join(root, 'config', 'menkar', 'state.json'), 'utf8')).settings

const cssVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

test('PRF-1, PRF-3 Ctrl+, opens Settings on Appearance, every row at its default', async () => {
  const launched = await launchApp()
  try {
    const prefs = await openSettings(launched.app, launched.window)
    await expect(prefs).toHaveTitle('Settings')
    // The font is visual, in Appearance; Terminal keeps the behaviour (decision 1.36).
    await section(prefs, 'appearance')
    await expect(prefs.locator('[data-key="font-family"]')).toHaveValue('')
    await section(prefs, 'terminal')
    await expect(prefs.locator('[data-key="scrollback"]')).toHaveValue('10000')
    await section(prefs, 'appearance')
    await expect(prefs.locator('[data-key="color_scheme"]')).toHaveValue('system')
    await expect(prefs.locator('[data-expander="ui_style"] summary')).toContainText(
      'Terminal workspace',
    )
    await expect(prefs.locator('[data-expander="terminal_theme"] summary')).toContainText('Default')
    await section(prefs, 'language')
    await expect(prefs.locator('[data-expander="language"] summary')).toContainText(
      'System default',
    )
    for (const key of ['notify_idle', 'notify_sound', 'reopen_tabs']) {
      await section(prefs, key === 'reopen_tabs' ? 'sessions' : 'notifications')
      await expect(prefs.locator(`[data-key="${key}"]`)).toBeChecked()
    }
    await expect(prefs.locator('[data-key="show_folder_path"]')).not.toBeChecked()
  } finally {
    await launched.close()
  }
})

test('PRF-2 Ctrl+B then s opens the same window', async () => {
  const launched = await launchApp()
  try {
    await launched.window.locator('body').click({ position: { x: 5, y: 5 } })
    const [prefs] = await Promise.all([
      launched.app.waitForEvent('window'),
      (async () => {
        await launched.window.keyboard.press('Control+b')
        await launched.window.keyboard.press('s')
      })(),
    ])
    await expect(prefs).toHaveTitle('Settings')
  } finally {
    await launched.close()
  }
})

test('PRF-4, PRF-8 a saved scrollback is shown, kept in range, and unknown keys survive', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base }) => {
      root = base
      writeState(base, { scrollback: 5000, zoom: 2 })
      return undefined
    },
  })
  try {
    const prefs = await openSettings(launched.app, launched.window)
    await section(prefs, 'terminal')
    const scrollback = prefs.locator('[data-key="scrollback"]')
    await expect(scrollback).toHaveValue('5000')
    await scrollback.fill('999')
    await scrollback.press('Tab')
    await expect(scrollback).toHaveValue('1000')
    await expect.poll(() => savedSettings(root)).toMatchObject({ scrollback: 1000, zoom: 2 })
    await scrollback.fill('2000000')
    await scrollback.press('Tab')
    await expect(scrollback).toHaveValue('1000000')
  } finally {
    await launched.close()
  }
})

test('PRF-14, PRF-16, PRF-17 a theme is saved and recolors every window at once', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base }) => {
      root = base
      return undefined
    },
  })
  try {
    const before = await cssVar(launched.window, '--bg')
    const prefs = await openSettings(launched.app, launched.window)
    const themes = prefs.locator('[data-expander="terminal_theme"] label')
    await expect(themes).toHaveText([
      'Default',
      'Tango Dark',
      'Solarized Dark',
      'Solarized Light',
      'Dracula',
      'Gruvbox Dark',
      'Nord',
      'Catppuccin Mocha',
      'Tokyo Night',
      'Monokai',
      'One Dark',
      'Catppuccin Latte',
      'Ubuntu',
    ])
    await prefs.locator('[data-expander="terminal_theme"] summary').click()
    await prefs
      .locator('[data-expander="terminal_theme"] label', { hasText: 'Tokyo Night' })
      .click()
    await expect(prefs.locator('[data-expander="terminal_theme"] summary')).toContainText(
      'Tokyo Night',
    )
    await expect.poll(() => savedSettings(root)?.terminal_theme).toBe('Tokyo Night')
    await expect.poll(() => cssVar(launched.window, '--bg')).not.toBe(before)
    expect(await cssVar(prefs, '--bg')).toBe(await cssVar(launched.window, '--bg'))
  } finally {
    await launched.close()
  }
})

test('PRF-15 an unknown saved theme reads as Default', async () => {
  const launched = await launchApp({
    prepare: ({ root }) => {
      writeState(root, { terminal_theme: 'Solarized Pink' })
      return undefined
    },
  })
  try {
    const prefs = await openSettings(launched.app, launched.window)
    await expect(prefs.locator('[data-expander="terminal_theme"] summary')).toContainText('Default')
    await expect(prefs.locator('input[name="terminal_theme"][value="Default"]')).toBeChecked()
  } finally {
    await launched.close()
  }
})

test('PRF-22, PRF-23 choosing another language shows Restart now; going back hides it', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base }) => {
      root = base
      return undefined
    },
  })
  try {
    const prefs = await openSettings(launched.app, launched.window)
    await section(prefs, 'language')
    const restart = prefs.locator('[data-key="restart"]')
    await expect(restart).toBeHidden()
    await prefs.locator('[data-expander="language"] summary').click()
    await prefs.locator('[data-expander="language"] label', { hasText: 'Español' }).click()
    await expect(restart).toBeVisible()
    await expect(prefs.locator('[data-expander="language"] summary')).toContainText('Español')
    await expect(prefs.locator('.section-item').first()).toHaveText('Appearance')
    await expect.poll(() => savedSettings(root)?.language).toBe('es')
    await prefs.locator('[data-expander="language"] label', { hasText: 'System default' }).click()
    await expect(restart).toBeHidden()
    await expect.poll(() => savedSettings(root)?.language).toBe('')
  } finally {
    await launched.close()
  }
})

// The relaunched app is a process of its own: found by the temporary HOME in its environment and
// stopped by its PID, never by a name pattern.
function processesOf(root: string): number[] {
  // The packaged build (package:smoke) runs as `menkar`, not as Electron's own binary.
  const executable = process.env.MENKAR_E2E_EXECUTABLE ?? 'electron'
  const found: number[] = []
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    try {
      const env = readFileSync(`/proc/${entry}/environ`, 'utf8')
      const cmd = readFileSync(`/proc/${entry}/cmdline`, 'utf8')
      if (env.includes(`HOME=${join(root, 'home')}\0`) && cmd.includes(executable))
        found.push(Number(entry))
    } catch {
      // gone, or not ours to read
    }
  }
  return found
}

// A real relaunch cannot be seen from here: the copy app.relaunch() starts carries Playwright's
// loader and never reaches Menkar's code. What the app controls is checked instead: the relaunch
// is asked for while the quit runs (on will-quit), once. Asked for only after the quit's answer
// came back, it never happened, since the quit could finish first. The real relaunch is a hand
// check on the desktop.
test('PRF-24 Restart now with nothing running quits at once, asking for the relaunch once while the quit runs', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base }) => {
      root = base
      writeState(base, { language: 'es' })
      return undefined
    },
  })
  const trace = join(root, 'relaunch.txt')
  try {
    await launched.app.evaluate(({ app }, file) => {
      const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
      let phase = 'running'
      app.on('will-quit', () => {
        phase = 'will-quit'
      })
      app.on('quit', () => {
        phase = 'quit'
      })
      app.relaunch = () => fs.appendFileSync(file, `${phase}\n`)
    }, trace)
    const prefs = await openSettings(launched.app, launched.window)
    const exited = new Promise<void>((resolve) =>
      launched.app.process().once('exit', () => resolve()),
    )
    await prefs.evaluate(
      () =>
        void (
          window as unknown as { menkar: { preferences: { restart(): Promise<boolean> } } }
        ).menkar.preferences.restart(),
    )
    await exited
    const asked = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n') : []
    expect(asked).toEqual(['will-quit'])
  } finally {
    await launched.close().catch(() => undefined)
  }
})

test('PRF-24 Restart now with a session running asks; Cancel keeps the app and does not relaunch', async () => {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      return prepare(dirs)
    },
  })
  const page = launched.window
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(() => existsSync(join(home, 'claude-pid.txt'))).toBe(true)
    const prefs = await openSettings(launched.app, page)
    const restarting = prefs.evaluate(() =>
      (
        window as unknown as { menkar: { preferences: { restart(): Promise<boolean> } } }
      ).menkar.preferences.restart(),
    )
    await expect(page.locator('.dialog .heading')).toHaveText('Stop 1 running session(s)?')
    await page.locator('.dialog button', { hasText: 'Cancel' }).click()
    expect(await restarting).toBe(false)
    await page.waitForTimeout(1000)
    expect(launched.app.process().exitCode).toBeNull()
    // Electron's own exit, which would run a relaunch left registered by the cancelled restart.
    const exited = new Promise<void>((resolve) =>
      launched.app.process().once('exit', () => resolve()),
    )
    await launched.app.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await exited
  } finally {
    await launched.close().catch(() => undefined)
  }
  // A cancelled restart left no relaunch behind for a later quit.
  await new Promise((resolve) => setTimeout(resolve, 3000))
  expect(processesOf(root)).toEqual([])
})
