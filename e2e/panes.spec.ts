import { expect, type Page, test } from '@playwright/test'
import { launchApp, savedCursorTab } from './app'

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.xterm')).toHaveCount(1)
  await page.locator('.xterm').first().click()
}

async function prefix(page: Page, key: string): Promise<void> {
  await page.keyboard.press('Control+b')
  await expect(page.locator('#prefix-pill')).toBeVisible()
  await page.keyboard.press(key)
}

test('TRM-26, TRM-54 Ctrl+B shows PREFIX; v opens a shell pane on the right, labelled shell, with nothing typed into it', async () => {
  const launched = await launchApp({
    prepare: (dirs) => savedCursorTab(dirs, { color_scheme: 'dark' }),
  })
  const page = launched.window
  try {
    await ready(page)
    await prefix(page, 'v')
    await expect(page.locator('#prefix-pill')).toBeHidden()
    await expect(page.locator('.tab-body:not(.hidden) .pane')).toHaveCount(2)
    await expect(
      page.locator('.tab-body:not(.hidden) .pane').nth(1).locator('.frame-label'),
    ).toHaveText('shell')
    const boxes = await page
      .locator('.tab-body:not(.hidden) .pane')
      .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().x))
    expect((boxes[1] ?? 0) > (boxes[0] ?? 0)).toBe(true)
    await page.waitForTimeout(800)
    const text = await page
      .locator('.tab-body:not(.hidden) .pane')
      .nth(1)
      .locator('.xterm-rows')
      .innerText()
    expect(text).not.toContain('syntax error')
    expect(text).not.toContain('&& exit')
  } finally {
    await launched.close()
  }
})

test('TRM-28 a key with no command ends the prefix and reaches nothing', async () => {
  const launched = await launchApp({ prepare: (dirs) => savedCursorTab(dirs, {}) })
  const page = launched.window
  try {
    await ready(page)
    await page.waitForTimeout(500)
    await prefix(page, 'q')
    await expect(page.locator('#prefix-pill')).toBeHidden()
    await page.waitForTimeout(300)
    const lastLine =
      (await page.locator('.xterm-rows').innerText()).trimEnd().split('\n').pop() ?? ''
    expect(lastLine.endsWith('q')).toBe(false)
  } finally {
    await launched.close()
  }
})

test('TRM-31 Ctrl+B ? shows the 21 help lines in order, and OK', async () => {
  const launched = await launchApp({ prepare: (dirs) => savedCursorTab(dirs, {}) })
  const page = launched.window
  try {
    await ready(page)
    await page.keyboard.press('Control+b')
    await page.keyboard.press('Shift+?')
    await expect(page.locator('.dialog .heading')).toHaveText('Ctrl+B, then…')
    const lines = (await page.locator('.dialog .mono-block').innerText()).split('\n')
    expect(lines).toHaveLength(21)
    expect(lines[0]).toBe('v  %     split right (a shell)')
    expect(lines[20]).toBe('Ctrl+B   send Ctrl+B to the terminal')
    await page.locator('.dialog button', { hasText: 'OK' }).click()
  } finally {
    await launched.close()
  }
})

test('TRM-32, TRM-35, TRM-37, TRM-38 two panes at most; zoom; swap; closing the shell pane', async () => {
  const launched = await launchApp({ prepare: (dirs) => savedCursorTab(dirs, {}) })
  const page = launched.window
  const panes = page.locator('.tab-body:not(.hidden) .pane')
  try {
    await ready(page)
    await prefix(page, 'v')
    await expect(panes).toHaveCount(2)
    await prefix(page, '-')
    await expect(page.locator('.toast')).toContainText('A tab holds two panes at most')
    await expect(panes).toHaveCount(2)

    await prefix(page, 'z')
    await expect(page.locator('.tab-body:not(.hidden) .pane:not(.hidden)')).toHaveCount(1)
    await prefix(page, 'z')
    await expect(page.locator('.tab-body:not(.hidden) .pane:not(.hidden)')).toHaveCount(2)

    await page.locator('.tab.selected').click({ button: 'right' })
    await page.locator('.menu-item', { hasText: "Swap the split's orientation" }).click()
    await expect(page.locator('.tab-body:not(.hidden)')).toHaveClass(/vertical/)

    await panes.nth(1).locator('.xterm').click()
    await prefix(page, 'x')
    await expect(panes).toHaveCount(1)
    await expect(panes.first().locator('.frame-label')).toHaveText('cursor')
  } finally {
    await launched.close()
  }
})
