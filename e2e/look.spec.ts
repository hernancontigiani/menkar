import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, savedCursorTab } from './app'

// The rendered color of an element's property, as #rrggbb: drawn on a canvas so color-mix() and
// every other CSS color form come back in one notation.
async function color(
  page: Page,
  selector: string,
  property: 'background-color' | 'color',
): Promise<string> {
  return page.evaluate(
    ([sel, prop]) => {
      const node = document.querySelector(sel ?? '')
      if (!node) return 'missing'
      const value = getComputedStyle(node).getPropertyValue(prop ?? '')
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d')
      if (!ctx) return 'no canvas'
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`
    },
    [selector, property],
  )
}

// Within one step per channel: the spec's measured values carry its rounding.
function near(actual: string, expected: string): boolean {
  const ch = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const a = ch(actual)
  return ch(expected).every((v, i) => Math.abs((a[i] ?? -9) - v) <= 1)
}

async function look(settings: Record<string, unknown>, shot: string) {
  const launched = await launchApp({ prepare: (dirs) => savedCursorTab(dirs, settings) })
  const page = launched.window
  await expect(page.locator('.tab.selected')).toBeVisible()
  await expect(page.locator('.xterm')).toBeVisible()
  await expect
    .poll(() =>
      launched.app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false,
      ),
    )
    .toBe(true)
  mkdirSync('test-results/look', { recursive: true })
  await page.screenshot({ path: `test-results/look/${shot}.png` })
  const colors = {
    window: await color(page, 'body', 'background-color'),
    sidebar: await color(page, '#sidebar', 'background-color'),
    divider: await color(page, '#divider', 'background-color'),
    selectedTab: await color(page, '.tab.selected', 'background-color'),
    selectedTabText: await color(page, '.tab.selected', 'color'),
  }
  return { launched, colors }
}

test('LOOK-2, LOOK-3, LOOK-23 Default in dark is Catppuccin Mocha: window, sidebar, divider, selected tab', async () => {
  const { launched, colors } = await look({ color_scheme: 'dark' }, 'default-dark')
  try {
    const { divider, ...rest } = colors
    expect(rest).toEqual({
      window: '#1e1e2e',
      sidebar: '#181825',
      selectedTab: '#cba6f7',
      selectedTabText: '#1e1e2e',
    })
    expect(near(divider, '#38394b'), divider).toBe(true)
  } finally {
    await launched.close()
  }
})

test('LOOK-39 Default in light is Catppuccin Latte', async () => {
  const { launched, colors } = await look({ color_scheme: 'light' }, 'default-light')
  try {
    const { divider, ...rest } = colors
    expect(rest).toEqual({
      window: '#eff1f5',
      sidebar: '#e6e9ef',
      selectedTab: '#8839ef',
      selectedTabText: '#eff1f5',
    })
    expect(near(divider, '#d6d9e0'), divider).toBe(true)
  } finally {
    await launched.close()
  }
})

test('LOOK-37 Nord colors the whole window, sidebar and selected tab', async () => {
  const { launched, colors } = await look({ color_scheme: 'light', terminal_theme: 'Nord' }, 'nord')
  try {
    expect([colors.window, colors.sidebar, colors.selectedTab, colors.selectedTabText]).toEqual([
      '#2e3440',
      '#282d35',
      '#b48ead',
      '#2e3440',
    ])
  } finally {
    await launched.close()
  }
})

test('LOOK-6 F9 hides the sidebar and shows it again; the toggle follows', async () => {
  const launched = await launchApp({
    prepare: (dirs) => savedCursorTab(dirs, { color_scheme: 'dark' }),
  })
  const page = launched.window
  try {
    await expect(page.locator('#sidebar')).toBeVisible()
    await page.locator('#content').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('F9')
    await expect(page.locator('#sidebar')).toBeHidden()
    await expect(page.locator('#toggle-sidebar')).toHaveAttribute('aria-pressed', 'false')
    await page.locator('#toggle-sidebar').click()
    await expect(page.locator('#sidebar')).toBeVisible()
    expect(await page.locator('#sidebar').evaluate((n) => n.getBoundingClientRect().width)).toBe(
      300,
    )
  } finally {
    await launched.close()
  }
})
