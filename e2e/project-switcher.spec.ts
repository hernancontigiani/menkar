// The project switcher (decision 1.38): Ctrl+Shift+E lists the projects in use, the most recent
// first, starting on the previous one; held like Alt+Tab, each E moves down and letting Ctrl go
// jumps. Never on the human's display.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { CLIENT, clientWork } from './fixtures'

type Saved = Record<string, (keyof typeof CLIENT)[]>

// Projects A (Client work), B (Beta), C (Gamma), D (Delta); `windows` gives each window its shown
// project and its tabs, each tab one session.
function setup(windows: readonly { current: string; tabs: Saved }[]) {
  return (dirs: { root: string; home: string }) => {
    const env = clientWork(dirs, {
      extraProjects: [
        { id: 'bbbbbbbbbbbb', name: 'Beta', members: [CLIENT.long] },
        { id: 'gggggggggggg', name: 'Gamma', members: [] },
        { id: 'dddddddddddd', name: 'Delta', members: [CLIENT.api] },
      ],
    })
    const file = join(dirs.root, 'config', 'menkar', 'projects.json')
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    saved.projects[0].members = [CLIENT.login]
    saved.windows = windows.map((w) => ({
      current: w.current,
      tabs: Object.fromEntries(
        Object.entries(w.tabs).map(([project, keys]) => [
          project,
          keys.map((k) => ({ panes: [CLIENT[k]], orientation: 'horizontal' })),
        ]),
      ),
    }))
    writeFileSync(file, JSON.stringify(saved))
    return env
  }
}

const A = 'cccccccccccc'
const B = 'bbbbbbbbbbbb'
const D = 'dddddddddddd'

const shown = (page: Page) =>
  page.evaluate(() =>
    (
      globalThis as unknown as { menkar: { window: { state(): Promise<{ shown: string }> } } }
    ).menkar.window
      .state()
      .then((s) => s.shown),
  )

const rows = (page: Page) => page.locator('.jump-row .name')
const selected = (page: Page) => page.locator('.jump-row.selected .name')

async function ready(page: Page) {
  await expect(page.locator('#sidebar')).toBeVisible()
  await page.locator('#session-list').click({ position: { x: 10, y: 300 } })
}

async function hold(page: Page) {
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
}

async function letGo(page: Page) {
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
}

test('decision 1.38: only projects with tabs, the most recent first, on the previous one; letting Ctrl go jumps; Esc cancels', async () => {
  const launched = await launchApp({
    prepare: setup([{ current: A, tabs: { [A]: ['login'], [B]: ['long'] } }]),
  })
  const page = launched.window
  try {
    await ready(page)
    await hold(page)
    await page.keyboard.press('E')
    await expect(rows(page)).toHaveText(['Client work', 'Beta'])
    await expect(selected(page)).toHaveText('Beta')
    await letGo(page)
    await expect(page.locator('.jump-row')).toHaveCount(0)
    await expect.poll(() => shown(page)).toBe(B)
    // Beta is now the most recent; the previous one is Client work.
    await hold(page)
    await page.keyboard.press('E')
    await expect(rows(page)).toHaveText(['Beta', 'Client work'])
    await expect(selected(page)).toHaveText('Client work')
    await page.keyboard.press('Escape')
    await expect(page.locator('.jump-row')).toHaveCount(0)
    await letGo(page)
    await page.waitForTimeout(300)
    expect(await shown(page)).toBe(B)
  } finally {
    await launched.close()
  }
})

test('decision 1.38: held, each E moves one down and round; a quick press goes back to the previous project; ↑, ↓ and Enter work while held', async () => {
  const launched = await launchApp({
    prepare: setup([{ current: A, tabs: { [A]: ['login'], [B]: ['long'], [D]: ['api'] } }]),
  })
  const page = launched.window
  try {
    await ready(page)
    await hold(page)
    await page.keyboard.press('E')
    await expect(rows(page)).toHaveText(['Client work', 'Beta', 'Delta'])
    await expect(selected(page)).toHaveText('Beta')
    mkdirSync('/tmp/menkar-shots', { recursive: true })
    await page.screenshot({ path: '/tmp/menkar-shots/project-switcher.png' })
    await page.keyboard.press('E')
    await expect(selected(page)).toHaveText('Delta')
    await page.keyboard.press('E')
    await expect(selected(page)).toHaveText('Client work')
    await page.keyboard.press('E')
    await page.keyboard.press('E')
    await expect(selected(page)).toHaveText('Delta')
    await letGo(page)
    await expect.poll(() => shown(page)).toBe(D)
    // A quick press is a hold let go at once: straight back to the previous project.
    await page.keyboard.press('Control+Shift+E')
    await expect.poll(() => shown(page)).toBe(A)
    // While held, ↑ and ↓ move and Enter chooses, as in the other switchers.
    await hold(page)
    await page.keyboard.press('E')
    await expect(rows(page)).toHaveText(['Client work', 'Delta', 'Beta'])
    await page.keyboard.press('ArrowDown')
    await expect(selected(page)).toHaveText('Beta')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await expect(selected(page)).toHaveText('Client work')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect.poll(() => shown(page)).toBe(B)
    await letGo(page)
  } finally {
    await launched.close()
  }
})

test('decision 1.38: a project another window holds brings that window forward instead', async () => {
  const launched = await launchApp({
    prepare: setup([
      { current: A, tabs: { [A]: ['login'] } },
      { current: B, tabs: { [B]: ['long'] } },
    ]),
  })
  const { app } = launched
  try {
    await expect.poll(() => app.windows().length).toBe(2)
    const first = (
      await Promise.all(app.windows().map(async (w) => [w, await shown(w)] as const))
    ).find(([, project]) => project === A)?.[0]
    if (!first) throw new Error('no window showing Client work')
    await first.bringToFront()
    await ready(first)
    await hold(first)
    await first.keyboard.press('E')
    await expect(rows(first)).toHaveText(['Client work', 'Beta'])
    await expect(first.locator('.jump-row.selected .dim')).toContainText('in another window')
    await expect(first.locator('.jump-row.selected .dim')).toHaveText('1 tab · in another window')
    await letGo(first)
    const focusedShows = () =>
      app.evaluate(async ({ BrowserWindow }) => {
        const focused = BrowserWindow.getFocusedWindow()
        return focused
          ? await focused.webContents.executeJavaScript(
              'window.menkar.window.state().then((s) => s.shown)',
            )
          : null
      })
    await expect.poll(focusedShows).toBe(B)
    expect(await shown(first)).toBe(A)
  } finally {
    await launched.close()
  }
})

test('decision 1.38: with no other project in use it says so, dimmed, and Enter does nothing', async () => {
  const launched = await launchApp({ prepare: setup([{ current: A, tabs: { [A]: ['login'] } }]) })
  const page = launched.window
  try {
    await ready(page)
    await page.keyboard.press('Control+Shift+E')
    await expect(page.locator('.jump-empty')).toHaveText('No other project has open tabs')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect(page.locator('.jump-empty')).toHaveCount(0)
    expect(await shown(page)).toBe(A)
  } finally {
    await launched.close()
  }
})
