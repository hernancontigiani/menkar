import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi } from '../src/shared/ipc'
import { launchApp } from './app'
import { CLIENT, clientWork } from './fixtures'

type PageGlobals = { menkar: MenkarApi }

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate((a) => (globalThis as unknown as PageGlobals).menkar.window.act(a as never), action)

const state = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as PageGlobals).menkar.window.state())

const rowDot = (page: Page, session: string) =>
  page.locator(`.row[data-session="${session}"] .dot`).getAttribute('class')

test('AST-18 a shell pane printing a permission question gets no state; the tab’s state comes from the agent pane', async () => {
  const launched = await launchApp({ prepare: (dirs) => clientWork(dirs, { tabs: [['login']] }) })
  const page = launched.window
  try {
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    await page.locator('.xterm').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('v')
    await expect(page.locator('.xterm')).toHaveCount(2)
    await page.waitForTimeout(500)
    await page.keyboard.type("echo 'Do you want to proceed?'; sleep 30")
    await page.keyboard.press('Enter')
    await expect(page.locator('.pane').nth(1).locator('.xterm-rows')).toContainText(
      'Do you want to proceed?',
    )
    await page.waitForTimeout(2500)
    expect(await rowDot(page, CLIENT.login)).not.toContain('blocked')
    await expect(page.locator('.tab .dot.blocked')).toHaveCount(0)

    // The same question from the agent pane does block: the check above is not idle by default.
    await page.locator('.pane').first().locator('.xterm').click()
    await page.keyboard.type('ASK')
    await expect.poll(() => rowDot(page, CLIENT.login), { timeout: 10_000 }).toContain('blocked')
  } finally {
    await launched.close()
  }
})

test('AST-28 revealing a pane whose tab is in another window, in a project not shown there: that window comes forward, shows the project, the tab selected', async () => {
  const launched = await launchApp({
    prepare: (dirs) =>
      clientWork(dirs, {
        extraProjects: [{ id: 'dddddddddddd', name: 'Research', members: [] }],
      }),
  })
  const page = launched.window
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    const opened = launched.app.waitForEvent('window')
    await act(page, { type: 'newWindow' })
    const other = await opened
    await expect(other.locator('#project-button .project-name')).toHaveText('Research')
    await act(other, { type: 'pickSession', session: CLIENT.long })
    await act(other, { type: 'openSession', session: CLIENT.long })
    await expect(other.locator('.tab')).toHaveCount(1)
    const tab = (await state(other))?.tabs[0]
    await act(other, { type: 'createProject', name: 'Third' })
    await expect(other.locator('#project-button .project-name')).toHaveText('Third')
    await expect(other.locator('.tab')).toHaveCount(0)
    await launched.app.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        const focus = win.focus.bind(win)
        win.focus = () => {
          void win.webContents.executeJavaScript('globalThis.broughtForward = true')
          focus()
        }
      }
    })
    await page.evaluate(
      (id) => (globalThis as unknown as PageGlobals).menkar.panes.reveal(id),
      tab?.panes[0]?.id ?? '',
    )
    await expect(other.locator('#project-button .project-name')).toHaveText('Research')
    await expect(other.locator('.tab.selected')).toHaveAttribute('data-tab', tab?.id ?? '')
    const forward = (p: Page) =>
      p.evaluate(
        () => (globalThis as unknown as { broughtForward?: boolean }).broughtForward ?? false,
      )
    await expect.poll(() => forward(other)).toBe(true)
    expect(await forward(page)).toBe(false)
  } finally {
    await launched.close()
  }
})
