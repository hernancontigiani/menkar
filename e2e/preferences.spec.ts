import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp, savedState } from './app'
import { prepare, SESSION } from './fixtures'

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

const savedSettings = (root: string) => savedState(root).settings

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
    await expect(prefs.locator('[data-expander="terminal_theme"] summary')).toContainText('VS Code')
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
    // A first start (no state at all) is on VS Code (decision 1.41), following the system's scheme,
    // which is light under xvfb: Light Modern's #f8f8f8.
    await expect.poll(() => cssVar(launched.window, '--bg')).toBe('#f8f8f8')
    const before = await cssVar(launched.window, '--bg')
    const prefs = await openSettings(launched.app, launched.window)
    const themes = prefs.locator('[data-expander="terminal_theme"] label')
    await expect(prefs.locator('[data-expander="terminal_theme"] summary')).toContainText('VS Code')
    await expect(themes).toHaveText([
      'VS Code',
      'Catppuccin Mocha',
      'Catppuccin Latte',
      'Solarized Dark',
      'Solarized Light',
    ])
    await prefs.locator('[data-expander="terminal_theme"] summary').click()
    await prefs
      .locator('[data-expander="terminal_theme"] label', { hasText: 'Solarized Dark' })
      .click()
    await expect(prefs.locator('[data-expander="terminal_theme"] summary')).toContainText(
      'Solarized Dark',
    )
    await expect.poll(() => savedSettings(root)?.terminal_theme).toBe('Solarized Dark')
    await expect.poll(() => cssVar(launched.window, '--bg')).not.toBe(before)
    expect(await cssVar(prefs, '--bg')).toBe(await cssVar(launched.window, '--bg'))
  } finally {
    await launched.close()
  }
})

test('PRF-15 an unknown saved theme reads as VS Code (decision 1.41)', async () => {
  const launched = await launchApp({
    prepare: ({ root }) => {
      writeState(root, { terminal_theme: 'Solarized Pink' })
      return undefined
    },
  })
  try {
    const prefs = await openSettings(launched.app, launched.window)
    await expect(prefs.locator('[data-expander="terminal_theme"] summary')).toContainText('VS Code')
    await expect(prefs.locator('input[name="terminal_theme"][value="VS Code"]')).toBeChecked()
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

// Decision 2026-11-10: Restart now goes on without asking, even with sessions running; its
// question opened behind Settings and the button seemed to do nothing. The next start stands in
// for the relaunch, on the same directories.
test('PRF-24 Restart now with a session running quits without asking, hangs the agent up, and the next start resumes it in its tab', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return prepare(dirs)
    },
  })
  const page = launched.window
  const trace = join(launched.root, 'relaunch.txt')
  let next: ElectronApplication | undefined
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(() => existsSync(join(home, 'claude-pid.txt'))).toBe(true)
    const agent = Number(readFileSync(join(home, 'claude-pid.txt'), 'utf8'))
    await launched.app.evaluate(({ app }, file) => {
      const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
      app.relaunch = () => fs.appendFileSync(file, 'relaunch\n')
    }, trace)
    const prefs = await openSettings(launched.app, page)
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
    expect(readFileSync(trace, 'utf8')).toBe('relaunch\n')
    await expect.poll(() => existsSync(`/proc/${agent}`)).toBe(false)
    const before = readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n').length
    const executable = process.env.MENKAR_E2E_EXECUTABLE
    next = await _electron.launch(
      executable
        ? { executablePath: executable, args: ['--ozone-platform=x11'], env: { ...launched.env } }
        : { args: ['--ozone-platform=x11', '.'], env: { ...launched.env } },
    )
    const again = await next.firstWindow()
    await expect(again.locator('.tab', { hasText: 'fix the login bug' })).toBeVisible()
    await expect
      .poll(() => readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n'))
      .toHaveLength(before + 1)
    const resumed = readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n').pop()
    expect(resumed).toContain(`--resume ${SESSION}`)
  } finally {
    if (next) {
      for (const w of next.windows()) {
        await w
          .evaluate(() =>
            (
              globalThis as unknown as {
                menkar: { window: { act(a: { type: string }): Promise<unknown> } }
              }
            ).menkar.window.act({ type: 'closeAllTabs' }),
          )
          .catch(() => undefined)
      }
      await next.close().catch(() => undefined)
    }
    await launched.close().catch(() => undefined)
  }
})

// Decision 2026-11-10: unsaved file edits are asked about before Restart now, on the Settings
// window where the button was pressed; running sessions still are not.
test('PRF-24 Restart now with an unsaved file asks in Settings; Cancel keeps the app and the edit; Save writes it and restarts', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      writeFileSync(join(dirs.home, 'notes.md'), 'notes\n')
      return prepare(dirs)
    },
  })
  const page = launched.window
  const notes = join(home, 'notes.md')
  const trace = join(launched.root, 'relaunch.txt')
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(() => existsSync(join(home, 'claude-pid.txt'))).toBe(true)
    await page.evaluate(
      (path) =>
        (
          globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
        ).menkar.window.act({ type: 'openFilePath', path }),
      notes,
    )
    await page.locator('.cm-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type('edited')
    await expect(page.locator('.tab.selected .unsaved-dot')).toHaveCount(1)
    await launched.app.evaluate(({ app }, file) => {
      const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
      app.relaunch = () => fs.appendFileSync(file, 'relaunch\n')
    }, trace)
    const prefs = await openSettings(launched.app, page)
    await section(prefs, 'language')
    await prefs.locator('[data-expander="language"] summary').click()
    await prefs.locator('[data-expander="language"] label', { hasText: 'Español' }).click()
    const restart = prefs.locator('[data-key="restart"]')
    await restart.click()
    const question = prefs.locator('[role="alertdialog"]')
    await expect(question.locator('.heading')).toHaveText('Save changes to notes.md?')
    await expect(question.locator('button')).toHaveText(['Cancel', 'Discard', 'Save'])
    await expect(page.locator('.dialog')).toHaveCount(0)
    mkdirSync('/tmp/menkar-shots', { recursive: true })
    await prefs.screenshot({ path: '/tmp/menkar-shots/restart-unsaved.png' })
    await question.locator('button', { hasText: 'Cancel' }).click()
    await expect(question).toHaveCount(0)
    await page.waitForTimeout(1000)
    expect(launched.app.process().exitCode).toBeNull()
    expect(existsSync(trace)).toBe(false)
    await expect(page.locator('.tab.selected .unsaved-dot')).toHaveCount(1)
    expect(readFileSync(notes, 'utf8')).toBe('notes\n')

    const exited = new Promise<void>((resolve) =>
      launched.app.process().once('exit', () => resolve()),
    )
    await restart.click()
    await question.locator('button', { hasText: 'Save' }).click()
    await exited
    expect(readFileSync(notes, 'utf8')).toBe('notes\nedited')
    expect(readFileSync(trace, 'utf8')).toBe('relaunch\n')
  } finally {
    await launched.close().catch(() => undefined)
  }
})
