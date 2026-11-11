import { existsSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { type LaunchedApp, launchApp, savedCursorTab, terminalText } from './app'
import { CLIENT, clientWork } from './fixtures'

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
  const launched = await launchApp({ prepare: savedCursorTab })
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
  const launched = await launchApp({ prepare: savedCursorTab })
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

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

const windowState = (page: Page) =>
  page.evaluate(() =>
    (
      globalThis as unknown as {
        menkar: { window: { state(): Promise<{ running: string[]; open: string[] }> } }
      }
    ).menkar.window.state(),
  )

const inputLines = (home: string) =>
  existsSync(join(home, 'claude-input.txt'))
    ? readFileSync(join(home, 'claude-input.txt'), 'utf8').trim().split('\n')
    : []

async function started(
  options: Parameters<typeof clientWork>[1],
  extra: Record<string, string> = {},
  edit?: (home: string) => void,
) {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      const env = { ...clientWork(dirs, options), ...extra }
      edit?.(dirs.home)
      return env
    },
  })
  return { launched, home, page: launched.window }
}

test('TRM-10 no `claude` on the PATH: nothing typed, the warning in bold yellow, then the shell', async () => {
  // The stand-in's folder and the system's only, so the developer's own `claude` is never found;
  // the stand-in goes once the sessions are listed.
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      clientWork(dirs)
      return { PATH: `${join(dirs.root, 'bin')}:/usr/bin:/bin` }
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    const bin = join(launched.root, 'bin')
    rmSync(join(bin, 'claude'))
    await act(page, { type: 'openSession', session: CLIENT.login })
    await expect
      .poll(() => terminalText(page))
      .toContain('[menkar] warning: `claude` not found in PATH — starting a plain shell')
    await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
    expect(await terminalText(page)).not.toContain('--resume')
    expect(existsSync(join(home, 'claude-args.txt'))).toBe(false)
    const tag = page.locator('.xterm-rows span', { hasText: '[menkar]' }).first()
    expect(
      await tag.evaluate((n) => [getComputedStyle(n).fontWeight, getComputedStyle(n).color]),
    ).toEqual(['700', 'rgb(249, 226, 175)'])
  } finally {
    await launched.close()
  }
})

test('TRM-11 a session whose folder is gone starts in HOME, the warning first, then the command', async () => {
  const { launched, home, page } = await started({ tabs: [['long']] }, {}, (h) =>
    rmSync(join(h, 'work', 'web'), { recursive: true }),
  )
  try {
    const gone = `warning: project dir ${join(home, 'work', 'web')} no longer exists, starting in HOME`
    await expect.poll(() => terminalText(page)).toContain('stand-in claude ready')
    const text = await terminalText(page)
    expect(text.indexOf(gone)).toBeGreaterThanOrEqual(0)
    expect(text.indexOf(gone)).toBeLessThan(text.indexOf('--resume'))
    const pid = readFileSync(join(home, 'claude-pid.txt'), 'utf8')
    expect(readlinkSync(`/proc/${pid}/cwd`)).toBe(home)
  } finally {
    await launched.close()
  }
})

test('TRM-12, TRM-14 SHELL unset runs /bin/bash; an agent exiting with 1 leaves the tab at the prompt with its error, not running', async () => {
  const { launched, page } = await started({ tabs: [['login']] }, { SHELL: '' })
  try {
    await expect.poll(() => terminalText(page)).toContain('stand-in claude ready')
    await expect.poll(async () => (await windowState(page)).running).toEqual([CLIENT.login])
    await page.locator('.xterm').click()
    await page.keyboard.type('EXIT1')
    await expect.poll(() => terminalText(page)).toContain('stand-in failed to start')
    await expect.poll(async () => (await windowState(page)).running).toEqual([])
    await expect(page.locator('.tab')).toHaveCount(1)
    await page.keyboard.type('echo shell=$0')
    await page.keyboard.press('Enter')
    await expect.poll(() => terminalText(page)).toMatch(/shell=\/bin\/bash/)
  } finally {
    await launched.close()
  }
})

test('TRM-13 an agent exiting with 0 in a single-pane tab: the shell exits too and the tab closes', async () => {
  const { launched, page } = await started({ tabs: [['login']] })
  try {
    await expect.poll(() => terminalText(page)).toContain('stand-in claude ready')
    await page.locator('.xterm').click()
    await page.keyboard.type('EXIT0')
    await expect(page.locator('.tab')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('TRM-21 Shift+Enter sends 1B 0D, Enter 0D; Ctrl+Shift+Enter is not intercepted', async () => {
  const { launched, home, page } = await started({ tabs: [['login']] })
  try {
    await expect.poll(() => terminalText(page)).toContain('stand-in claude ready')
    await page.locator('.xterm').click()
    await page.keyboard.press('Shift+Enter')
    await expect.poll(() => inputLines(home)).toEqual(['1b0d'])
    await page.keyboard.press('Enter')
    await expect.poll(() => inputLines(home)).toEqual(['1b0d', '0d'])
    await page.keyboard.press('Control+Shift+Enter')
    await expect.poll(() => inputLines(home).length).toBe(3)
    expect(inputLines(home)[2]).not.toBe('1b0d')
  } finally {
    await launched.close()
  }
})

const clipboardText = (launched: LaunchedApp) =>
  launched.app.evaluate(({ clipboard }) => clipboard.readText())

async function shell() {
  const launched = await launchApp({ prepare: savedCursorTab })
  const page = launched.window
  await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
  await page.locator('.xterm').click()
  return { launched, page }
}

async function run(page: Page, command: string, done: string) {
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  await expect.poll(() => terminalText(page)).toContain(done)
}

test('TRM-22 Ctrl+Shift+C copies the selection as plain text; Ctrl+Shift+V pastes the clipboard', async () => {
  const { launched, page } = await shell()
  try {
    await run(page, "printf '\\033[31mcopy-me\\033[0m\\n'", 'copy-me\n')
    const word = page.locator('.xterm-rows span', { hasText: /^copy-me$/ }).first()
    const at = await word.boundingBox()
    if (!at) throw new Error('no word')
    await page.mouse.dblclick(at.x + at.width / 2, at.y + at.height / 2)
    await page.keyboard.press('Control+Shift+C')
    await expect.poll(() => clipboardText(launched)).toBe('copy-me')
    await launched.app.evaluate(({ clipboard }) => clipboard.writeText('echo pasted-$((1+1))'))
    await page.keyboard.press('Control+Shift+V')
    // The paste reads the clipboard first: an Enter pressed at once could arrive before it.
    await expect.poll(() => terminalText(page)).toContain('echo pasted-$((1+1))')
    await page.keyboard.press('Enter')
    await expect.poll(() => terminalText(page)).toContain('pasted-2')
  } finally {
    await launched.close()
  }
})

const selectionTop = (page: Page) =>
  page.evaluate(() => {
    const div = document.querySelector('.xterm-selection div') as HTMLElement | null
    return div ? div.getBoundingClientRect().top : null
  })

test('TRM-23, TRM-24 Ctrl+Shift+G finds case-insensitively and scrolls to it; Esc closes and refocuses; the text is literal', async () => {
  const { launched, page } = await shell()
  try {
    await run(page, "echo 'Error: Timeout'; echo axb; seq 1 60", '\n60\n')
    await expect(page.locator('.xterm-rows')).not.toContainText('Error: Timeout')
    await page.keyboard.press('Control+Shift+G')
    await expect(page.locator('.find-bar input')).toBeFocused()
    await page.keyboard.type('timeout')
    await expect(page.locator('.xterm-rows')).toContainText('Error: Timeout')
    await expect.poll(() => selectionTop(page)).not.toBeNull()
    await page.keyboard.press('Escape')
    await expect(page.locator('.find-bar')).toHaveCount(0)
    await expect(page.locator('.xterm-helper-textarea')).toBeFocused()
    await expect(page.locator('.xterm-decoration-container > *')).toHaveCount(0)

    // Only "axb" is on screen: a.b read as a pattern would match it.
    await page.keyboard.press('Control+Shift+G')
    await page.keyboard.type('a.b')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    expect(await selectionTop(page)).toBeNull()
    await page.keyboard.press('Escape')
  } finally {
    await launched.close()
  }
})

// Quarantined (e2e/FLAKY.md): under the full suite the second down now and then leaves the
// selection on the first match. Not reproduced alone, under parallel load or in a traced full run.
test('TRM-25 after the last match, down wraps to the first', async () => {
  const { launched, page } = await shell()
  try {
    // The command does not contain the text searched for, so exactly the two printed lines match
    // whatever the scrollback holds; the text goes in at once, so no partial search moves the
    // selection after it is read.
    await run(page, "clear; printf 'ma%sk-%s\\n' r A r B", 'mark-B\n')
    await page.keyboard.press('Control+Shift+G')
    await page.locator('.find-bar input').fill('mark-')
    await expect.poll(() => selectionTop(page)).not.toBeNull()
    const last = (await selectionTop(page)) ?? 0
    await page.locator('.find-bar button').nth(1).click()
    await expect.poll(() => selectionTop(page)).toBeLessThan(last)
    await page.locator('.find-bar button').nth(1).click()
    await expect.poll(() => selectionTop(page)).toBe(last)
  } finally {
    await launched.close()
  }
})

// Each tab shown in turn, as a user sees it: xterm does not draw a terminal that is not visible,
// so a hidden tab's rows can lag its buffer until the tab shows.
async function readyOnShow(page: Page): Promise<number[]> {
  const counts: number[] = []
  for (let i = 0; i < (await page.locator('.tab').count()); i += 1) {
    await page.locator('.tab').nth(i).click()
    await page.waitForTimeout(150)
    counts.push(
      await page
        .locator('.tab-body:not(.hidden) .xterm-rows')
        .evaluate((n) => (n.textContent?.match(/stand-in claude ready/g) ?? []).length),
    )
  }
  return counts
}

test('no output shows twice after a pane attaches: three tabs starting at once, each line once', async () => {
  // The buffer and the live chunks race; a few starts make a lost race likely to show.
  for (let round = 0; round < 4; round += 1) {
    const launched = await launchApp({
      prepare: (dirs) => clientWork(dirs, { tabs: [['login'], ['api'], ['long']] }),
    })
    const page = launched.window
    try {
      await expect(page.locator('.tab')).toHaveCount(3)
      await expect.poll(() => readyOnShow(page)).toEqual([1, 1, 1])
      await page.waitForTimeout(500)
      expect(await readyOnShow(page)).toEqual([1, 1, 1])
    } finally {
      await launched.close()
    }
  }
})

test('TRM-27, TRM-29, TRM-30 Ctrl+B with Shift held then N opens Existing; Ctrl+B twice sends 02; in a dialog’s field Ctrl+B is the field’s', async () => {
  const { launched, home, page } = await started({ tabs: [['login']] })
  try {
    await expect.poll(() => terminalText(page)).toContain('stand-in claude ready')
    await page.locator('.xterm').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.down('Shift')
    await page.keyboard.press('N')
    await page.keyboard.up('Shift')
    await expect(page.locator('.add-session .switch.selected')).toHaveText('Existing')
    await expect(page.locator('#prefix-pill')).toBeHidden()

    const search = page.locator('.add-session .search-row input')
    await search.click()
    await page.keyboard.press('Control+b')
    await expect(page.locator('#prefix-pill')).toBeHidden()
    await page.keyboard.type('b')
    await expect(search).toHaveValue('b')
    await expect(page.locator('#sidebar')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.add-session')).toHaveCount(0)

    await page.locator('.xterm').click()
    await page.keyboard.press('Control+b')
    await expect(page.locator('#prefix-pill')).toBeVisible()
    await page.keyboard.press('Control+b')
    await expect(page.locator('#prefix-pill')).toBeHidden()
    await expect.poll(() => inputLines(home)).toEqual(['02'])
  } finally {
    await launched.close()
  }
})

test('TRM-33 on a file tab Ctrl+B v does nothing', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return clientWork(dirs)
    },
  })
  const page = launched.window
  try {
    writeFileSync(join(home, 'notes.txt'), 'notes\n')
    await act(page, { type: 'openFilePath', path: join(home, 'notes.txt') })
    await expect(page.locator('.cm-content')).toBeVisible()
    await page.locator('.cm-content').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('v')
    await page.waitForTimeout(300)
    await expect(page.locator('.pane')).toHaveCount(0)
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect(page.locator('.cm-content')).toHaveText('notes')
  } finally {
    await launched.close()
  }
})

test('TRM-36, TRM-40 zoomed, Ctrl+B l keeps the focus and Ctrl+B x stops the focused pane, the other filling the tab; on one pane Ctrl+B x closes the tab', async () => {
  const launched = await launchApp({ prepare: savedCursorTab })
  const page = launched.window
  try {
    await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
    await page.locator('.xterm').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('v')
    await expect(page.locator('.xterm')).toHaveCount(2)
    await expect
      .poll(() =>
        page.locator('.frame').evaluateAll((ns) => ns.map((n) => n.matches(':focus-within'))),
      )
      .toEqual([false, true])
    await page.keyboard.press('Control+b')
    await page.keyboard.press('h')
    await expect
      .poll(() =>
        page.locator('.frame').evaluateAll((ns) => ns.map((n) => n.matches(':focus-within'))),
      )
      .toEqual([true, false])
    await page.keyboard.press('Control+b')
    await page.keyboard.press('z')
    await expect(page.locator('.pane:visible')).toHaveCount(1)
    await page.keyboard.press('Control+b')
    await page.keyboard.press('l')
    await expect
      .poll(() =>
        page.locator('.frame').evaluateAll((ns) => ns.map((n) => n.matches(':focus-within'))),
      )
      .toEqual([true, false])
    await expect(page.locator('.pane:visible')).toHaveCount(1)
    await page.keyboard.press('Control+b')
    await page.keyboard.press('x')
    await expect(page.locator('.pane')).toHaveCount(1)
    await expect(page.locator('.pane:visible')).toHaveCount(1)
    await expect(page.locator('.pane .frame-label')).toHaveText('shell')
    const tab = await page.locator('#tab-content').boundingBox()
    const pane = await page.locator('.pane').boundingBox()
    expect(pane?.width).toBe(tab?.width)

    await page.locator('.xterm').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('x')
    await expect(page.locator('.tab')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('TRM-47, TRM-48 Stop on one session of a two-pane tab stops only its pane; the other becomes the primary; Stop on a session with no tab does nothing', async () => {
  const { launched, page } = await started({ tabs: [['login', 'api']] })
  try {
    await expect(page.locator('.pane')).toHaveCount(2)
    await expect.poll(async () => (await windowState(page)).running.length).toBe(2)
    await act(page, { type: 'stopSession', session: CLIENT.login })
    await expect(page.locator('.pane')).toHaveCount(1)
    await expect(page.locator('.tab')).toHaveText(/api review/)
    await expect.poll(async () => (await windowState(page)).running).toEqual([CLIENT.api])
    const before = JSON.stringify(await windowState(page))
    await act(page, { type: 'stopSession', session: CLIENT.long })
    await page.waitForTimeout(300)
    expect(JSON.stringify(await windowState(page))).toBe(before)
  } finally {
    await launched.close()
  }
})

test('TRM-50, PRJ-46 a window with nothing running closes without asking', async () => {
  const launched = await launchApp({ prepare: savedCursorTab })
  const page = launched.window
  try {
    await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
    await launched.app.evaluate(({ app, BrowserWindow }) => {
      app.removeAllListeners('window-all-closed')
      BrowserWindow.getAllWindows()[0]?.close()
    })
    await expect
      .poll(() =>
        launched.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      )
      .toBe(0)
  } finally {
    await launched.close()
  }
})

test('TRM-52 a new session not yet joined, running at window close, is listed as Claude Code', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return { ...clientWork(dirs), FAKE_CLAUDE_QUIET: '1' }
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    await act(page, {
      type: 'startNew',
      agent: 'claude',
      folder: join(home, 'work', 'web'),
      name: '',
    })
    await expect.poll(() => terminalText(page)).toContain('stand-in claude ready')
    await launched.app.evaluate(({ app, BrowserWindow }) => {
      app.removeAllListeners('window-all-closed')
      BrowserWindow.getAllWindows()[0]?.close()
    })
    await expect(page.locator('.dialog .heading')).toHaveText('Stop 1 running session(s)?')
    await expect(page.locator('.dialog .body')).toContainText('Claude Code')
    await page.locator('.dialog button', { hasText: 'Stop and close' }).click()
  } finally {
    await launched.close()
  }
})

const menuItems = (page: Page) =>
  page
    .locator('.popover .menu-item')
    .evaluateAll((ns) =>
      ns.map(
        (n) => `${n.textContent?.trim()}${(n as HTMLButtonElement).disabled ? ' (disabled)' : ''}`,
      ),
    )
const hasSelection = (page: Page) =>
  page
    .locator('.tab-body:not(.hidden) .xterm-selection div')
    .count()
    .then((n) => n > 0)

test('TRM-57 (decision 1.20) a right click on a terminal: Copy (disabled with no selection), Paste, Select all, Find…, each with its keys; the selection survives; Esc and a click outside close it', async () => {
  const { launched, page } = await shell()
  try {
    await page.locator('.xterm').click({ button: 'right', position: { x: 300, y: 200 } })
    expect(await menuItems(page)).toEqual([
      'CopyCtrl+Shift+C (disabled)',
      'PasteCtrl+Shift+V',
      'Select all',
      'Find…Ctrl+Shift+G',
    ])
    await page.keyboard.press('Escape')
    await expect(page.locator('.popover')).toHaveCount(0)

    await run(page, 'echo copy-by-menu', 'copy-by-menu\n')
    const word = page.locator('.xterm-rows span', { hasText: /^copy-by-menu$/ }).last()
    const at = await word.boundingBox()
    if (!at) throw new Error('no word')
    await page.mouse.dblclick(at.x + at.width / 2, at.y + at.height / 2)
    // xterm draws the selection on its next frame, which under load comes late.
    await expect.poll(() => hasSelection(page)).toBe(true)
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2, { button: 'right' })
    await expect(page.locator('.popover')).toBeVisible()
    expect(await hasSelection(page)).toBe(true)
    expect((await menuItems(page))[0]).toBe('CopyCtrl+Shift+C')
    await page.locator('.popover .menu-item', { hasText: 'Copy' }).click()
    await expect.poll(() => clipboardText(launched)).toBe('copy-by-menu')

    await page.mouse.click(at.x, at.y, { button: 'right' })
    await expect(page.locator('.popover')).toBeVisible()
    await page.locator('#session-list').click()
    await expect(page.locator('.popover')).toHaveCount(0)

    await launched.app.evaluate(({ clipboard }) => clipboard.writeText('echo pasted-by-$((2+3))'))
    await page.locator('.xterm').click({ button: 'right', position: { x: 300, y: 300 } })
    await page.locator('.popover .menu-item', { hasText: 'Paste' }).click()
    await expect.poll(() => terminalText(page)).toContain('echo pasted-by-$((2+3))')
    await page.keyboard.press('Enter')
    await expect.poll(() => terminalText(page)).toContain('pasted-by-5')

    await page.locator('.xterm').click({ button: 'right', position: { x: 300, y: 300 } })
    await page.locator('.popover .menu-item', { hasText: 'Select all' }).click()
    await page.keyboard.press('Control+Shift+C')
    await expect.poll(() => clipboardText(launched)).toContain('pasted-by-5')
    await page.locator('.xterm').click({ button: 'right', position: { x: 300, y: 300 } })
    await page.locator('.popover .menu-item', { hasText: 'Find…' }).click()
    await expect(page.locator('.find-bar input')).toBeFocused()
  } finally {
    await launched.close()
  }
})

test('TRM-57 (decision 1.20) the terminal menu is on an agent’s pane too', async () => {
  const { launched, page } = await started({ tabs: [['login']] })
  try {
    await expect.poll(() => terminalText(page)).toContain('stand-in claude ready')
    await page.locator('.xterm').click({ button: 'right', position: { x: 300, y: 200 } })
    expect(await menuItems(page)).toHaveLength(4)
  } finally {
    await launched.close()
  }
})

test('the window is told when an agent reaches the foreground, without waiting for another change', async () => {
  // A shell slow to start, as with a real ~/.bashrc: the tab's own push goes out before the agent
  // runs.
  const { launched, page } = await started({}, {}, (home) =>
    writeFileSync(join(home, '.bashrc'), 'sleep 2\n'),
  )
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    await page.evaluate(() => {
      const g = globalThis as unknown as { pushed: string[] }
      g.pushed = []
      ;(
        globalThis as unknown as {
          menkar: { window: { onState(l: (s: { running: string[] }) => void): void } }
        }
      ).menkar.window.onState((s) => {
        g.pushed = s.running
      })
    })
    await act(page, { type: 'openSession', session: CLIENT.login })
    await expect
      .poll(async () => (await windowState(page)).running, { intervals: [100] })
      .toEqual([CLIENT.login])
    // Soon after, not at whatever change comes next.
    await expect
      .poll(() => page.evaluate(() => (globalThis as unknown as { pushed: string[] }).pushed), {
        timeout: 1500,
        intervals: [100],
      })
      .toEqual([CLIENT.login])
  } finally {
    await launched.close()
  }
})

test('a state with no layout change moves nothing in the tab content: a pane under the pointer stays put', async () => {
  const launched = await launchApp({ prepare: savedCursorTab })
  const page = launched.window
  try {
    await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
    await page.evaluate(() => {
      const g = globalThis as unknown as { moves: number }
      g.moves = 0
      const content = document.getElementById('tab-content')
      if (!content) return
      // The content and its tab bodies only: what xterm draws inside a pane is its own.
      new MutationObserver((records) => {
        for (const r of records) {
          const target = r.target as HTMLElement
          if (target === content || target.classList.contains('tab-body'))
            g.moves += r.addedNodes.length + r.removedNodes.length
        }
      }).observe(content, { childList: true, subtree: true })
    })
    const tab = await page.locator('.tab.selected').getAttribute('data-tab')
    for (let i = 0; i < 3; i += 1) await act(page, { type: 'selectTab', tab })
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => (globalThis as unknown as { moves: number }).moves)).toBe(0)
  } finally {
    await launched.close()
  }
})

// Claude Code paints its own colours in 24 bits only when COLORTERM says the terminal can; Menkar
// started from the desktop has no COLORTERM of its own to pass on, so every pty is given it.
// The same for OSC 8 hyperlinks, which Claude Code sends only when FORCE_HYPERLINK (or a terminal
// it knows by name) says the terminal draws them.
test('every pty says truecolor (COLORTERM) and FORCE_HYPERLINK=1, the pane and the drawer alike, even when Menkar started without them', async () => {
  const launched = await launchApp({
    prepare: (dirs) => ({ ...savedCursorTab(dirs), COLORTERM: '', FORCE_HYPERLINK: '' }),
  })
  const page = launched.window
  try {
    await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
    await page.locator('.xterm').click()
    await run(page, 'echo "pane=[$COLORTERM][$FORCE_HYPERLINK]"', 'pane=[truecolor][1]')
    await page.keyboard.press('Control+Backquote')
    const drawer = page.locator('.tab-body:not(.hidden) .pane.drawer .xterm-rows')
    await expect(drawer).toContainText('$', { timeout: 10_000 })
    await page.keyboard.type('echo "drawer=[$COLORTERM]"\n')
    await expect(drawer).toContainText('drawer=[truecolor]')
    await page.keyboard.type('echo "drawer-links=[$FORCE_HYPERLINK]"\n')
    await expect(drawer).toContainText('drawer-links=[1]')
  } finally {
    await launched.close()
  }
})
