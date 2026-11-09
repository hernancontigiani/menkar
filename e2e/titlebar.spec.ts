import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { resolveLook, THEME_NAMES } from '../src/core/theme'
import { type LaunchedApp, launchApp, savedCursorTab, terminalText } from './app'
import { clientWork } from './fixtures'
import { near } from './measure'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

async function client(
  settings: Record<string, unknown> = {},
  tabs: (readonly ('login' | 'api' | 'long')[])[] = [],
) {
  const launched = await launchApp({ prepare: (dirs) => clientWork(dirs, { settings, tabs }) })
  await expect(launched.window.locator('#session-list .row')).toHaveCount(3)
  await expect
    .poll(() =>
      launched.app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false,
      ),
    )
    .toBe(true)
  return launched
}

const overlay = (page: Page) =>
  page.evaluate(() => {
    const wco = (
      navigator as unknown as {
        windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect }
      }
    ).windowControlsOverlay
    return wco
      ? { visible: wco.visible, width: wco.getTitlebarAreaRect().width }
      : { visible: false, width: 0 }
  })

// A pixel of the whole screen, the system's window buttons included (a page capture leaves them out).
async function screenPixel(app: ElectronApplication, x: number, y: number): Promise<string> {
  return app.evaluate(
    async ({ desktopCapturer, screen }, [px, py]) => {
      const size = screen.getPrimaryDisplay().size
      const [source] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size })
      const bitmap = source?.thumbnail.toBitmap()
      const width = source?.thumbnail.getSize().width ?? 0
      if (!bitmap) return 'none'
      const i = ((py ?? 0) * width + (px ?? 0)) * 4
      return `#${[bitmap[i + 2], bitmap[i + 1], bitmap[i]].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`
    },
    [x, y],
  )
}

test('LOOK-55 (2026-11-09) no menu bar anywhere; Ctrl+R and Ctrl+Shift+I reach nothing', async () => {
  const launched = await client()
  const { app, window: page } = launched
  try {
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu())).toBeNull()
    const opened = app.waitForEvent('window')
    await act(page, { type: 'openPreferences' })
    await opened
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map((w) => w.isMenuBarVisible()),
      ),
    ).toEqual([false, false])
    await page.evaluate(() => {
      ;(globalThis as unknown as { stillHere: boolean }).stillHere = true
    })
    await page.locator('#session-list').click()
    await page.keyboard.press('Control+r')
    await page.keyboard.press('Control+Shift+I')
    await page.waitForTimeout(800)
    expect(
      await page.evaluate(() => (globalThis as unknown as { stillHere?: boolean }).stillHere),
    ).toBe(true)
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((w) => w.webContents.isDevToolsOpened()),
      ),
    ).toBe(false)
  } finally {
    await launched.close()
  }
})

test('LOOK-56 (2026-11-09) the main window has no frame: the window buttons sit over the header in its colors, in both styles and schemes; Preferences, Usage, About and MCP keep the system’s', async () => {
  for (const settings of [
    { ui_style: 'tui', color_scheme: 'dark' },
    { ui_style: 'tui', color_scheme: 'light' },
    { ui_style: 'classic', color_scheme: 'dark' },
    { ui_style: 'classic', color_scheme: 'light' },
  ]) {
    const launched = await client(settings)
    const { app, window: page } = launched
    try {
      const o = await overlay(page)
      const bounds = await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0]
        return { outer: w?.getBounds(), content: w?.getContentBounds() }
      })
      expect(bounds.content).toEqual(bounds.outer)
      expect(o.visible).toBe(true)
      expect(o.width).toBeLessThan(bounds.outer?.width ?? 0)
      const header = await page.locator('.content-header').boundingBox()
      const x = (bounds.outer?.x ?? 0) + (bounds.outer?.width ?? 0) - 3
      const y = (bounds.outer?.y ?? 0) + 2
      const hx = (bounds.outer?.x ?? 0) + Math.floor((header?.x ?? 0) + 200)
      await expect
        .poll(async () => near(await screenPixel(app, x, y), await screenPixel(app, hx, y), 2), {
          timeout: 5000,
        })
        .toBe(true)
    } finally {
      await launched.close()
    }
  }
  const launched = await client()
  const { app, window: page } = launched
  try {
    for (const type of ['openPreferences', 'openUsage', 'openAbout', 'openMcpServers']) {
      const opened = app.waitForEvent('window')
      await act(page, { type })
      const child = await opened
      await child.waitForLoadState()
      expect((await overlay(child)).visible, type).toBe(false)
      await child.close()
    }
  } finally {
    await launched.close()
  }
})

test('LOOK-57 (2026-11-09) the headers drag the window, their controls and the tabs do not; nothing sits under the window buttons', async () => {
  const launched = await client({}, [['login']])
  const page = launched.window
  try {
    const region = (selector: string) =>
      page
        .locator(selector)
        .evaluateAll((ns) =>
          ns.map(
            (n) =>
              getComputedStyle(n).getPropertyValue('app-region') ||
              getComputedStyle(n).getPropertyValue('-webkit-app-region'),
          ),
        )
    expect(await region('.sidebar-header, .content-header')).toEqual(['drag', 'drag'])
    const controls = await region('.sidebar-header button, .content-header button, #tab-strip')
    expect(controls.length).toBeGreaterThanOrEqual(6)
    expect(new Set(controls)).toEqual(new Set(['no-drag']))
    const free = (await overlay(page)).width
    await expect(page.locator('#close-all')).toBeHidden()
    await act(page, { type: 'openSession', session: '3c3c3c3c-0000-4000-8000-000000000003' })
    await expect(page.locator('#close-all')).toBeVisible()
    const rights = await page
      .locator('.content-header button:visible, .content-header .title-text')
      .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().right))
    expect(Math.max(...rights)).toBeLessThanOrEqual(free)
  } finally {
    await launched.close()
  }
})

test('LOOK-58 (2026-11-09) a double click on a header’s empty space maximizes and restores; on its buttons it does not', async () => {
  const launched = await client()
  const { app, window: page } = launched
  try {
    await app.evaluate(({ BrowserWindow }) => {
      const g = globalThis as unknown as { toggles: number }
      g.toggles = 0
      const w = BrowserWindow.getAllWindows()[0]
      if (!w) return
      w.maximize = () => {
        g.toggles += 1
      }
    })
    const toggles = () => app.evaluate(() => (globalThis as unknown as { toggles: number }).toggles)
    const header = await page.locator('.content-header').boundingBox()
    if (!header) throw new Error('no header')
    await page.mouse.dblclick(header.x + 200, header.y + header.height / 2)
    await expect.poll(toggles).toBe(1)
    await page.locator('#main-menu').dblclick()
    await page.keyboard.press('Escape')
    await page.locator('#project-button').dblclick()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(800)
    expect(await toggles()).toBe(1)
    const side = await page.locator('.sidebar-header').boundingBox()
    // In its top padding, above the project button (the divider's grip covers its right edge).
    await page.mouse.dblclick((side?.x ?? 0) + 60, (side?.y ?? 0) + 2)
    await expect.poll(toggles).toBe(2)
  } finally {
    await launched.close()
  }
})

test('LOOK-59 (2026-11-09) copy and paste without a menu: Ctrl+C / Ctrl+V in a field and the editor, Ctrl+Shift+C / Ctrl+Shift+V in the terminal', async () => {
  let home = ''
  const launched: LaunchedApp = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return savedCursorTab(dirs, { color_scheme: 'dark' })
    },
  })
  const { app, window: page } = launched
  const clip = () => app.evaluate(({ clipboard }) => clipboard.readText())
  const setClip = (text: string) => app.evaluate(({ clipboard }, t) => clipboard.writeText(t), text)
  try {
    await expect.poll(() => terminalText(page)).toMatch(/\$\s*$/m)
    await page.locator('.xterm').click()
    await page.keyboard.type('echo copy-me-term')
    await page.keyboard.press('Enter')
    const word = page.locator('.xterm-rows span', { hasText: /^copy-me-term$/ }).last()
    await expect(word).toBeVisible()
    const at = await word.boundingBox()
    await page.mouse.dblclick(
      (at?.x ?? 0) + (at?.width ?? 0) / 2,
      (at?.y ?? 0) + (at?.height ?? 0) / 2,
    )
    await page.keyboard.press('Control+Shift+C')
    await expect.poll(clip).toBe('copy-me-term')
    await setClip('echo pasted-in-term')
    await page.keyboard.press('Control+Shift+V')
    await page.keyboard.press('Enter')
    await expect.poll(() => terminalText(page)).toContain('\npasted-in-term')

    await page.keyboard.press('Control+Shift+O')
    const field = page.locator('.open-file input')
    await field.fill('~/field-text')
    await field.press('Control+a')
    await field.press('Control+c')
    await expect.poll(clip).toBe('~/field-text')
    await setClip('/pasted/path')
    await field.press('Control+a')
    await field.press('Control+v')
    await expect(field).toHaveValue('/pasted/path')
    await page.keyboard.press('Escape')

    writeFileSync(join(home, 'note.txt'), 'editor-line\n')
    await act(page, { type: 'openFilePath', path: join(home, 'note.txt') })
    const editor = page.locator('.tab-body:not(.hidden) .cm-content')
    await editor.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+c')
    await expect.poll(clip).toBe('editor-line\n')
    await setClip('from-clipboard')
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Control+v')
    await expect(editor).toContainText('from-clipboard')
  } finally {
    await launched.close()
  }
})

test('LOOK-60 (2026-11-09) no drag region covers a control: every element that drags the window misses every no-drag control’s box, unless it contains that control', async () => {
  const launched = await client({}, [['login'], ['api']])
  const page = launched.window
  try {
    await expect(page.locator('#close-all')).toBeVisible()
    const found = await page.evaluate(() => {
      const region = (n: Element) =>
        getComputedStyle(n).getPropertyValue('app-region') ||
        getComputedStyle(n).getPropertyValue('-webkit-app-region')
      const all = [...document.querySelectorAll('*')].filter((n) => {
        const r = n.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      const drags = all.filter((n) => region(n) === 'drag')
      const controls = all.filter(
        (n) => region(n) === 'no-drag' || n.matches('button, input, select, [role="button"]'),
      )
      const overlaps: string[] = []
      const name = (n: Element) =>
        `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}.${[...n.classList].join('.')}`
      for (const d of drags) {
        const a = d.getBoundingClientRect()
        for (const c of controls) {
          if (d.contains(c)) continue
          const b = c.getBoundingClientRect()
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
            overlaps.push(`${name(d)} over ${name(c)}`)
        }
      }
      return { drags: drags.map(name), controls: controls.length, overlaps }
    })
    expect(found.drags.length).toBeGreaterThanOrEqual(2)
    expect(found.controls).toBeGreaterThanOrEqual(8)
    expect(found.overlaps).toEqual([])
  } finally {
    await launched.close()
  }
})

test('LOOK-62 (2026-11-09) a menu’s button closes the menu it opened: the project selector, ⚙ and New’s ▾, by mouse and by keyboard; Esc and a click outside still close it', async () => {
  const launched = await client()
  const page = launched.window
  try {
    const popovers = page.locator('.popover')
    for (const opener of ['#project-button', '#main-menu', '#new-menu']) {
      const button = page.locator(opener)
      await button.click()
      await expect(popovers, opener).toHaveCount(1)
      await button.click()
      await expect(popovers, opener).toHaveCount(0)
      await button.click()
      await expect(popovers, opener).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(popovers, opener).toHaveCount(0)
      await button.click()
      await expect(popovers, opener).toHaveCount(1)
      await page.locator('#session-list').click({ position: { x: 20, y: 300 } })
      await expect(popovers, opener).toHaveCount(0)
      await button.focus()
      await page.keyboard.press('Enter')
      await expect(popovers, opener).toHaveCount(1)
      await button.focus()
      await page.keyboard.press('Enter')
      await expect(popovers, opener).toHaveCount(0)
    }
    // Another opener while one menu is open opens its own.
    const firstItem = () => popovers.locator('.menu-item').first().textContent()
    await page.locator('#main-menu').click()
    const gearFirst = await firstItem()
    await page.locator('#new-menu').click()
    await expect(popovers).toHaveCount(1)
    expect(await firstItem()).not.toBe(gearFirst)
  } finally {
    await launched.close()
  }
})

// Colors as drawn over the window's background, as #rrggbb.
const drawnColors = (page: Page) =>
  page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    const drawn = (...colors: string[]) => {
      if (!ctx) return ''
      ctx.clearRect(0, 0, 1, 1)
      for (const c of colors) {
        ctx.fillStyle = c
        ctx.fillRect(0, 0, 1, 1)
      }
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`
    }
    const style = (selector: string) =>
      getComputedStyle(document.querySelector(selector) as Element)
    const body = getComputedStyle(document.body).backgroundColor
    const content = style('.content-header')
    const side = style('.sidebar-header')
    return {
      body: drawn(body),
      header: drawn(body, content.backgroundColor),
      sideHeader: drawn(body, side.backgroundColor),
      line: drawn(body, content.borderBottomColor),
      sideLine: drawn(body, side.borderBottomColor),
      lineWidth: content.borderBottomWidth,
      sideLineWidth: side.borderBottomWidth,
    }
  })

const apart = (a: string, b: string) => {
  const ch = (c: string) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16))
  const x = ch(a)
  return Math.max(...ch(b).map((v, i) => Math.abs(v - (x[i] ?? 0))))
}

test('LOOK-63 (2026-11-09) the title bar is its own surface: both headers share a background apart from the content’s and a bottom line, in both styles and schemes and every theme; the window buttons take that background, above the line', async () => {
  for (const settings of [
    { ui_style: 'tui', color_scheme: 'dark' },
    { ui_style: 'tui', color_scheme: 'light' },
    { ui_style: 'classic', color_scheme: 'dark' },
    { ui_style: 'classic', color_scheme: 'light' },
  ]) {
    const launched = await client(settings)
    const { app, window: page } = launched
    try {
      const c = await drawnColors(page)
      const what = JSON.stringify({ settings, c })
      expect(c.sideHeader, what).toBe(c.header)
      expect(c.sideLine, what).toBe(c.line)
      expect([c.lineWidth, c.sideLineWidth], what).toEqual(['1px', '1px'])
      expect(apart(c.header, c.body), what).toBeGreaterThanOrEqual(8)
      expect(apart(c.line, c.header), what).toBeGreaterThanOrEqual(8)
      const content = await page.locator('.content-header').boundingBox()
      const side = await page.locator('.sidebar-header').boundingBox()
      expect((side?.y ?? 0) + (side?.height ?? 0), what).toBe(
        (content?.y ?? 0) + (content?.height ?? 0),
      )
      // Under the window buttons, the header's bottom line still shows: the overlay stops above it.
      const bounds = await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds() ?? null,
      )
      if (!bounds || !content) throw new Error('no window')
      const lineY = bounds.y + Math.round(content.y + content.height) - 1
      await expect
        .poll(
          async () =>
            near(await screenPixel(app, bounds.x + bounds.width - 12, lineY), c.line, 2) &&
            near(await screenPixel(app, bounds.x + bounds.width - 12, lineY - 2), c.header, 2),
          { timeout: 5000 },
        )
        .toBe(true)
    } finally {
      await launched.close()
    }
  }
  const launched = await client()
  const page = launched.window
  try {
    const { body } = await drawnColors(page)
    for (const name of THEME_NAMES) {
      for (const style of ['tui', 'classic']) {
        for (const dark of [true, false]) {
          const look = resolveLook(
            { ui_style: style, terminal_theme: name, color_scheme: dark ? 'dark' : 'light' },
            dark,
          )
          await page.evaluate((r) => {
            const root = document.documentElement
            root.style.setProperty('--bg', r.bg)
            root.style.setProperty('--fg', r.fg)
            document.body.style.background = r.bg
          }, look.roles)
          const c = await drawnColors(page)
          const what = JSON.stringify({ name, style, dark, c })
          expect(apart(c.header, c.body), what).toBeGreaterThanOrEqual(8)
          expect(apart(c.line, c.header), what).toBeGreaterThanOrEqual(8)
        }
      }
    }
    expect(body).not.toBe('')
  } finally {
    await launched.close()
  }
})

test('LOOK-64 (2026-11-09) a window that does not fill the screen shows a hairline edge; maximized or full screen it has none', async () => {
  const launched = await client()
  const { app, window: page } = launched
  try {
    const edge = () =>
      page.evaluate(() => {
        const s = getComputedStyle(document.body, '::after')
        return s.content === 'none' ? 'none' : `${s.borderTopWidth} ${s.position}`
      })
    await expect.poll(edge).toBe('1px fixed')
    // No window manager under xvfb: the window is told it is maximized, as one would tell it.
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      if (!w) return
      w.isMaximized = () => true
      w.emit('maximize')
    })
    await expect.poll(edge).toBe('none')
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      if (!w) return
      w.isMaximized = () => false
      w.emit('unmaximize')
    })
    await expect.poll(edge).toBe('1px fixed')
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      if (!w) return
      w.isFullScreen = () => true
      w.emit('enter-full-screen')
    })
    await expect.poll(edge).toBe('none')
  } finally {
    await launched.close()
  }
})

test('LOOK-66 (2026-11-09) Close all is a text button in the header’s button style, clear of the title, and closes every tab with no question; in Spanish it reads Cerrar todo', async () => {
  for (const [language, label] of [
    ['en', 'Close all'],
    ['es', 'Cerrar todo'],
  ] as const) {
    const launched = await client({ language }, [['login'], ['api']])
    const page = launched.window
    try {
      const button = page.locator('#close-all')
      await expect(button).toBeVisible()
      await expect(button).toHaveText(label)
      await expect(button.locator('svg')).toHaveCount(0)
      expect(await button.getAttribute('title')).toBeTruthy()
      const look = (selector: string) =>
        page.locator(selector).evaluate((n) => {
          const s = getComputedStyle(n)
          return [s.fontSize, s.paddingTop, s.paddingBottom, s.borderRadius]
        })
      expect(await look('#close-all')).toEqual(await look('#new-session'))
      // At rest it is a button, not a word: its fill stands off the header.
      const { header } = await drawnColors(page)
      const resting = await button.evaluate((n, under) => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
        if (!ctx) return ''
        ctx.fillStyle = under
        ctx.fillRect(0, 0, 1, 1)
        ctx.fillStyle = getComputedStyle(n).backgroundColor
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`
      }, header)
      expect(apart(resting, header), `${resting} on ${header}`).toBeGreaterThanOrEqual(8)
      const box = await button.boundingBox()
      const newBox = await page.locator('#new-session').boundingBox()
      const title = await page.locator('.content-header .title').boundingBox()
      expect(box?.height).toBe(newBox?.height)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThan(title?.x ?? 0)
      if (language === 'en') {
        await button.click()
        await expect(page.locator('.tab')).toHaveCount(0)
        await expect(page.locator('.dialog')).toHaveCount(0)
      }
    } finally {
      await launched.close()
    }
  }
})
