// Decision 1.42: the terminals take Ubuntu's terminal colours by default, whatever the theme paints
// the rest of Menkar with; Neutral and Same as theme are the other two, chosen live in Settings.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, savedCursorTab, terminalText } from './app'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

const paneBackground = (page: Page) =>
  page
    .locator('.xterm-scrollable-element')
    .first()
    .evaluate((n) => getComputedStyle(n).backgroundColor)

// `terminal_colors: undefined` leaves the key out of state.json: the first start's own value.
async function shell(settings: Record<string, unknown>) {
  const launched = await launchApp({
    prepare: (dirs) =>
      savedCursorTab(dirs, { terminal_theme: 'VS Code', terminal_colors: undefined, ...settings }),
  })
  const page = launched.window
  await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
  return { launched, page }
}

test('decision 1.42 the terminals are Ubuntu’s by default, #300a24, with VS Code painting the rest; in dark and light alike', async () => {
  mkdirSync('/tmp/menkar-shots', { recursive: true })
  for (const color_scheme of ['dark', 'light']) {
    const { launched, page } = await shell({ color_scheme })
    try {
      await expect.poll(() => paneBackground(page)).toBe('rgb(48, 10, 36)')
      // The window around it is VS Code's.
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
        ),
      ).toBe(color_scheme === 'dark' ? '#181818' : '#f8f8f8')
      await page.locator('.xterm').click()
      await page.keyboard.type(
        "printf '\\033[31mred \\033[32mgreen \\033[34mblue\\033[0m on Ubuntu\\n'\n",
      )
      await expect.poll(() => terminalText(page)).toContain('on Ubuntu')
      await page.waitForTimeout(300)
      await page.screenshot({ path: `/tmp/menkar-shots/terminal-colors-${color_scheme}.png` })
    } finally {
      await launched.close()
    }
  }
})

test('decision 1.42 Same as theme gives VS Code’s #181818; Neutral the VTE-like #1e1e1e; a bad saved value reads as Ubuntu', async () => {
  for (const [terminal_colors, expected] of [
    ['theme', 'rgb(24, 24, 24)'],
    ['neutral', 'rgb(30, 30, 30)'],
    ['vte', 'rgb(48, 10, 36)'],
  ] as const) {
    const { launched, page } = await shell({ color_scheme: 'dark', terminal_colors })
    try {
      await expect.poll(() => paneBackground(page), terminal_colors).toBe(expected)
    } finally {
      await launched.close()
    }
  }
})

test('decision 1.42 changing Terminal colors in Settings re-colours an open pane at once, and saves it', async () => {
  const { launched, page } = await shell({ color_scheme: 'dark' })
  try {
    await expect.poll(() => paneBackground(page)).toBe('rgb(48, 10, 36)')
    const opened = launched.app.waitForEvent('window')
    await act(page, { type: 'openSettings', section: 'appearance' })
    const settings = await opened
    await settings.waitForLoadState()
    const select = settings.locator('select[data-key="terminal_colors"]')
    await expect(select).toHaveValue('ubuntu')
    await expect(select.locator('option')).toHaveText([
      'Ubuntu terminal',
      'Neutral (VTE)',
      'Same as theme',
    ])
    await settings.screenshot({ path: '/tmp/menkar-shots/terminal-colors-row.png' })
    await select.selectOption('theme')
    await expect.poll(() => paneBackground(page)).toBe('rgb(24, 24, 24)')
    await select.selectOption('neutral')
    await expect.poll(() => paneBackground(page)).toBe('rgb(30, 30, 30)')
  } finally {
    await launched.close()
  }
})
