// Interface size (decision 1.36, 2026-11-10): Menkar's own text and controls grow or shrink in
// every window, live, while the terminals keep their font. Sizes are read in screen pixels (CSS
// pixels × devicePixelRatio), since the scale is the page's zoom.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp, savedCursorTab } from './app'

const onScreen = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((n) => n.getBoundingClientRect().height * window.devicePixelRatio)

const fontOnScreen = (page: Page) =>
  page
    .locator('.xterm-rows')
    .first()
    .evaluate((n) => Number.parseFloat(getComputedStyle(n).fontSize) * window.devicePixelRatio)

async function openSettings(app: ElectronApplication, page: Page): Promise<Page> {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  const [settings] = await Promise.all([
    app.waitForEvent('window'),
    page.keyboard.press('Control+Comma'),
  ])
  await expect(settings.locator('main[data-section="appearance"]')).toBeVisible()
  return settings
}

const choose = (settings: Page, percent: string) =>
  settings.locator('[data-key="ui_scale"]').selectOption(percent)

test('decision 1.36: Interface size grows the header and the Settings window at once, and the terminal keeps its font', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return savedCursorTab(dirs)
    },
  })
  const { app, window: page } = launched
  try {
    await expect(page.locator('.xterm')).toBeVisible()
    const header = await onScreen(page, '.content-header .title')
    const row = await onScreen(page, '.xterm-rows > div')
    const font = await fontOnScreen(page)
    const settings = await openSettings(app, page)
    const item = await onScreen(settings, '.section-item')
    await expect(settings.locator('[data-key="ui_scale"]')).toHaveValue('100')
    await choose(settings, '125')
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(join(root, 'config', 'menkar', 'state.json'), 'utf8')).settings
            .ui_scale,
      )
      .toBe(125)
    await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBeCloseTo(1.25, 2)
    await expect.poll(() => onScreen(page, '.content-header .title')).toBeGreaterThan(header * 1.15)
    await expect.poll(() => onScreen(settings, '.section-item')).toBeGreaterThan(item * 1.15)
    // The terminal keeps its font on the screen: the Font setting's size, not the interface's.
    // Its rows stay within the 2 screen pixels its cell measuring rounds to.
    await expect
      .poll(async () => Math.abs((await fontOnScreen(page)) - font))
      .toBeLessThanOrEqual(0.1)
    expect(Math.abs((await onScreen(page, '.xterm-rows > div')) - row)).toBeLessThan(2.5)
    // The window buttons' strip follows the header, which grew with the interface.
    const strip = () =>
      page.evaluate(() => {
        const wco = (
          navigator as unknown as {
            windowControlsOverlay?: { getTitlebarAreaRect(): DOMRect }
          }
        ).windowControlsOverlay
        const header = document.querySelector('.content-header')?.getBoundingClientRect()
        return Math.abs((wco?.getTitlebarAreaRect().height ?? -99) - (header?.height ?? 0))
      })
    await expect.poll(strip).toBeLessThanOrEqual(1)
    mkdirSync('/tmp/menkar-shots', { recursive: true })
    // The whole window, in its own pixels: a page screenshot clips a zoomed page at its CSS size.
    for (const [title, name] of [
      ['Menkar', 'main'],
      ['Settings', 'appearance'],
    ] as const) {
      const png = await app.evaluate(async ({ BrowserWindow }, wanted) => {
        const window = BrowserWindow.getAllWindows().find((w) => w.getTitle() === wanted)
        return window ? (await window.webContents.capturePage()).toPNG().toString('base64') : ''
      }, title)
      writeFileSync(`/tmp/menkar-shots/ui-size-125-${name}.png`, Buffer.from(png, 'base64'))
    }
    await choose(settings, '100')
    await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBeCloseTo(1, 2)
  } finally {
    await launched.close()
  }
})

test('decision 1.36: a saved Interface size applies from the start, and an unknown one reads as 100 %', async () => {
  for (const [saved, ratio] of [
    [110, 1.1],
    [133, 1],
  ] as const) {
    const launched = await launchApp({
      prepare: (dirs) => {
        mkdirSync(join(dirs.root, 'config', 'menkar'), { recursive: true })
        writeFileSync(
          join(dirs.root, 'config', 'menkar', 'state.json'),
          JSON.stringify({ settings: { ui_scale: saved } }),
        )
        return undefined
      },
    })
    try {
      await expect
        .poll(() => launched.window.evaluate(() => window.devicePixelRatio), {
          message: `${saved}`,
        })
        .toBeCloseTo(ratio, 2)
    } finally {
      await launched.close()
    }
  }
})
