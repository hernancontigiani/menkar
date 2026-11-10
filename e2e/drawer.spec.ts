// Decision 1.29: Ctrl+` opens a shell under the selected tab, in its agent's folder, and hides it
// again; it is never a tab, a pane of the layout or a session.
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { CURSOR_SESSION, launchApp, savedCursorTab } from './app'

interface Shown {
  sessions: { id: string }[]
  tabs: {
    id: string
    panes: { id: string }[]
    drawer?: { id: string; shown: boolean; label: string }
  }[]
}

const state = (page: Page) =>
  page.evaluate(() =>
    (
      globalThis as unknown as { menkar: { window: { state(): Promise<unknown> } } }
    ).menkar.window.state(),
  ) as Promise<Shown>

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

const drawer = (page: Page) => page.locator('.tab-body:not(.hidden) .pane.drawer')
const agentPane = (page: Page) => page.locator('.tab-body:not(.hidden) .pane:not(.drawer)')
const drawerText = (page: Page) => drawer(page).locator('.xterm-rows').innerText()
const focusIn = (page: Page) =>
  page.evaluate(() => {
    const pane = document.activeElement?.closest('.pane')
    return pane ? (pane.classList.contains('drawer') ? 'drawer' : 'pane') : 'none'
  })

async function launch(settings: Record<string, unknown> = {}) {
  let folder = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      folder = join(dirs.home, 'workapp')
      return savedCursorTab(dirs, settings, folder)
    },
  })
  const page = launched.window
  await expect(agentPane(page).locator('.xterm')).toHaveCount(1)
  await agentPane(page).locator('.xterm').click()
  await expect(agentPane(page).locator('.xterm-rows')).toContainText('$', { timeout: 10_000 })
  return { launched, page, folder }
}

test("decision 1.29: Ctrl+` opens a shell under the tab in its agent's folder, hides it, and keeps it until exit", async () => {
  const { launched, page, folder } = await launch()
  try {
    await page.keyboard.press('Control+Backquote')
    await expect(drawer(page)).toBeVisible()
    await expect(drawer(page).locator('.frame-label')).toHaveText('shell · workapp')
    await expect.poll(() => focusIn(page)).toBe('drawer')
    // Under every pane, full width.
    const [pane, under] = await Promise.all([
      agentPane(page).boundingBox(),
      drawer(page).boundingBox(),
    ])
    expect((under?.y ?? 0) >= (pane?.y ?? 0) + (pane?.height ?? 0) - 1).toBe(true)
    expect(Math.round(under?.width ?? 0)).toBe(Math.round(pane?.width ?? -1))
    await page.keyboard.type('pwd; echo marker-$((40+2))\n')
    await expect.poll(() => drawerText(page)).toContain(folder)
    await expect.poll(() => drawerText(page)).toContain('marker-42')

    // Not a tab, not a pane of the layout, not a session; not in the saved layout.
    const s = await state(page)
    await expect(page.locator('.tab')).toHaveCount(1)
    expect(s.tabs[0]?.panes).toHaveLength(1)
    expect(s.sessions.map((x) => x.id)).toEqual([CURSOR_SESSION])
    const drawerId = s.tabs[0]?.drawer?.id ?? ''
    expect(drawerId).not.toBe('')
    await page.waitForTimeout(1500)
    const saved = readFileSync(join(launched.root, 'config', 'menkar', 'projects.json'), 'utf8')
    expect(saved).not.toContain(drawerId)
    expect(saved).toContain(CURSOR_SESSION)

    // Ctrl+` hides it and gives the focus back; it never reached the shell.
    await page.keyboard.press('Control+Backquote')
    await expect(drawer(page)).toBeHidden()
    await expect.poll(() => focusIn(page)).toBe('pane')
    await page.keyboard.press('Control+Backquote')
    await expect(drawer(page)).toBeVisible()
    await expect.poll(() => focusIn(page)).toBe('drawer')
    expect(await drawerText(page)).toContain('marker-42')
    expect(await drawerText(page)).not.toContain('`')

    // exit closes it for real; the next Ctrl+` starts a fresh shell.
    await page.keyboard.type('exit\n')
    await expect(drawer(page)).toHaveCount(0)
    await expect.poll(() => focusIn(page)).toBe('pane')
    await page.keyboard.press('Control+Backquote')
    await expect(drawer(page)).toBeVisible()
    await expect.poll(() => drawerText(page)).toContain('$')
    expect(await drawerText(page)).not.toContain('marker-42')
    expect((await state(page)).tabs[0]?.drawer?.id).not.toBe(drawerId)
  } finally {
    await launched.close()
  }
})

test("decision 1.29: closing the tab hangs up its drawer's shell", async () => {
  const { launched, page } = await launch()
  try {
    await page.keyboard.press('Control+Backquote')
    await expect.poll(() => focusIn(page)).toBe('drawer')
    await page.keyboard.type('echo PID=$$\n')
    await expect.poll(() => drawerText(page)).toMatch(/PID=\d+/)
    const pid = Number(/PID=(\d+)/.exec(await drawerText(page))?.[1])
    expect(existsSync(`/proc/${pid}`)).toBe(true)
    const tab = (await state(page)).tabs[0]?.id
    await act(page, { type: 'closeTab', tab, force: true })
    await expect.poll(() => existsSync(`/proc/${pid}`), { timeout: 10_000 }).toBe(false)
    expect((await state(page)).tabs).toHaveLength(0)
  } finally {
    await launched.close()
  }
})

for (const style of ['tui', 'classic'] as const) {
  test(`decision 1.29 (2026-11-09): the drawer's hide button, ${style}, hides it as Ctrl+\` does and keeps the shell`, async () => {
    const { launched, page } = await launch({ ui_style: style })
    try {
      await page.keyboard.press('Control+Backquote')
      await expect.poll(() => focusIn(page)).toBe('drawer')
      await page.keyboard.type('echo kept-$((6*7))\n')
      await expect.poll(() => drawerText(page)).toContain('kept-42')
      const hide = drawer(page).locator('.drawer-hide')
      await expect(hide).toHaveAttribute('title', 'Hide the shell (Ctrl+`)')
      // Its top-right corner, inside the drawer.
      const [box, under] = await Promise.all([hide.boundingBox(), drawer(page).boundingBox()])
      expect((box?.y ?? -1) >= (under?.y ?? 0) - 9).toBe(true)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(
        (under?.x ?? 0) + (under?.width ?? 0) - 60,
      )
      await hide.click()
      await expect(drawer(page)).toBeHidden()
      await expect.poll(() => focusIn(page)).toBe('pane')
      await page.keyboard.press('Control+Backquote')
      await expect(drawer(page)).toBeVisible()
      expect(await drawerText(page)).toContain('kept-42')
    } finally {
      await launched.close()
    }
  })
}

for (const style of ['tui', 'classic'] as const) {
  test(`decision 1.29: the drawer's look, ${style} dark (screenshot)`, async () => {
    const { launched, page } = await launch({ ui_style: style, color_scheme: 'dark' })
    try {
      await page.keyboard.press('Control+Backquote')
      await expect.poll(() => focusIn(page)).toBe('drawer')
      await page.keyboard.type('ls -a\n')
      await page.waitForTimeout(500)
      mkdirSync('/tmp/menkar-shots', { recursive: true })
      await page.screenshot({ path: `/tmp/menkar-shots/drawer-${style}-dark.png` })
    } finally {
      await launched.close()
    }
  })
}

// On a layout where ` is a dead key (Spanish, right of P) the shortcut is found through the layout
// map, and with ibus the keydown is "Process" and starts a composition: replayed here as observed
// on the human's desktop, the map put to Spanish's, since the test display's layout is US.
test("Ctrl+` by the layout: Spanish's dead ` (Process, then a composition) toggles the shell and types nothing; US Ctrl+[ does not", async () => {
  const { launched, page } = await launch()
  try {
    const read = await page.evaluate(async () => {
      const keyboard = (
        navigator as unknown as {
          keyboard: { getLayoutMap(): Promise<{ get(code: string): string | undefined }> }
        }
      ).keyboard
      const map = await keyboard.getLayoutMap()
      return [map.get('Backquote'), map.get('BracketLeft')]
    })
    expect(read).toEqual(['`', '['])
    await page.keyboard.press('Control+BracketLeft')
    await page.waitForTimeout(300)
    await expect(drawer(page)).toHaveCount(0)

    await page.evaluate(() => {
      Object.defineProperty(
        (navigator as unknown as { keyboard: object }).keyboard,
        'getLayoutMap',
        {
          value: async () =>
            new Map([
              ['BracketLeft', '`'],
              ['Backquote', 'º'],
            ]),
        },
      )
    })
    const cdp = await page.context().newCDPSession(page)
    const key = (type: 'rawKeyDown' | 'keyUp', k: string, code: string, vk: number) =>
      cdp.send('Input.dispatchKeyEvent', {
        type,
        key: k,
        code,
        windowsVirtualKeyCode: vk,
        modifiers: 2,
      })
    await key('rawKeyDown', 'Control', 'ControlLeft', 17)
    await page.waitForTimeout(100)
    await key('rawKeyDown', 'Process', 'BracketLeft', 229)
    await cdp.send('Input.imeSetComposition', { text: '`', selectionStart: 1, selectionEnd: 1 })
    await key('keyUp', 'Dead', 'BracketLeft', 219)
    await key('keyUp', 'Control', 'ControlLeft', 17)
    await expect(drawer(page)).toBeVisible()
    await expect.poll(() => focusIn(page)).toBe('drawer')
    await expect.poll(() => drawerText(page)).toContain('$')
    await page.keyboard.type('echo a')
    await expect.poll(() => drawerText(page)).toContain('echo a')
    expect(await drawerText(page)).not.toContain('`')
    expect(await agentPane(page).locator('.xterm-rows').textContent()).not.toContain('`')
  } finally {
    await launched.close()
  }
})
