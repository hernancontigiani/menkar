// Plan 23: a terminal scrolled up from its bottom shows a button that jumps back down; so does
// Ctrl+Shift+End, which never reaches the agent.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { launchApp, savedCursorTab } from './app'
import { clientWork } from './fixtures'

const visiblePane = (page: Page) => page.locator('.tab-body:not(.hidden) .pane:not(.drawer)')

async function box(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('not laid out')
  return b
}

// The cursor's row is drawn only while the view shows the end of the buffer.
const atBottom = (pane: Locator) =>
  pane
    .locator('.xterm-rows .xterm-cursor')
    .count()
    .then((n) => n > 0)

async function scrollUp(pane: Locator, page: Page): Promise<void> {
  const b = await box(pane.locator('.xterm'))
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.wheel(0, -2000)
}

test('TRM-58 (plan 23) scrolled up, an agent pane shows a jump button left of its scrollbar; a click or Ctrl+Shift+End goes back to the bottom, and the key never reaches the agent', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return clientWork(dirs, { tabs: [['login']] })
    },
  })
  const page = launched.window
  try {
    const pane = visiblePane(page)
    await expect(pane.locator('.xterm-rows')).toContainText('stand-in claude ready')
    const jump = pane.locator('.jump-bottom')
    await expect(jump).toBeHidden()
    // The stand-in prints a line each time the typed text ends with ASK: enough to scroll.
    await pane.locator('.xterm').click()
    await page.keyboard.type('ASK'.repeat(80))
    await expect.poll(() => pane.locator('.scrollbar.vertical .slider').count()).toBe(1)
    await expect(jump).toBeHidden()
    expect(await atBottom(pane)).toBe(true)

    await scrollUp(pane, page)
    await expect(jump).toBeVisible()
    await expect(jump).toHaveAttribute('title', 'Jump to the bottom (Ctrl+Shift+End)')
    // Never over the scrollbar, its thumb or its track.
    const button = await box(jump)
    const bar = await box(pane.locator('.scrollbar.vertical'))
    expect(button.x + button.width).toBeLessThanOrEqual(bar.x)
    expect(button.y + button.height).toBeLessThanOrEqual(bar.y + bar.height)
    expect(await atBottom(pane)).toBe(false)

    await jump.click()
    await expect.poll(() => atBottom(pane)).toBe(true)
    await expect(jump).toBeHidden()

    await scrollUp(pane, page)
    await expect(jump).toBeVisible()
    const input = join(home, 'claude-input.txt')
    const before = existsSync(input) ? readFileSync(input, 'utf8') : ''
    await page.keyboard.press('Control+Shift+End')
    await expect.poll(() => atBottom(pane)).toBe(true)
    await expect(jump).toBeHidden()
    await page.waitForTimeout(300)
    expect(existsSync(input) ? readFileSync(input, 'utf8') : '').toBe(before)
  } finally {
    await launched.close()
  }
})

test('TRM-59 (plan 23) the drawer and a shell pane have the button too; output arriving while scrolled up keeps the view and marks the button', async () => {
  const launched = await launchApp({ prepare: (dirs) => savedCursorTab(dirs) })
  const page = launched.window
  try {
    const pane = visiblePane(page)
    await expect(pane.locator('.xterm-rows')).toContainText('$', { timeout: 10_000 })
    await pane.locator('.xterm').click()
    await page.keyboard.type('seq 1 300; (sleep 2; seq 5001 5040) &\n')
    await expect(pane.locator('.xterm-rows')).toContainText('300')
    await scrollUp(pane, page)
    const jump = pane.locator('.jump-bottom')
    await expect(jump).toBeVisible()
    await expect(jump).not.toHaveClass(/fresh/)
    const shown = await pane.locator('.xterm-rows').innerText()
    await expect(jump).toHaveClass(/fresh/, { timeout: 5000 })
    expect(await pane.locator('.xterm-rows').innerText()).toBe(shown)
    await jump.click()
    await expect(jump).toBeHidden()
    await expect(pane.locator('.xterm-rows')).toContainText('5040')
    await expect(jump).not.toHaveClass(/fresh/)

    await page.keyboard.press('Control+Backquote')
    const drawer = page.locator('.tab-body:not(.hidden) .pane.drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer.locator('.xterm-rows')).toContainText('$', { timeout: 10_000 })
    await page.keyboard.type('seq 1 300\n')
    await expect(drawer.locator('.xterm-rows')).toContainText('300')
    await scrollUp(drawer, page)
    await expect(drawer.locator('.jump-bottom')).toBeVisible()
    await drawer.locator('.jump-bottom').click()
    await expect(drawer.locator('.jump-bottom')).toBeHidden()
  } finally {
    await launched.close()
  }
})
