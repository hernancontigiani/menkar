import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { en } from '../src/core/i18n/en'
import { PALETTES } from '../src/core/theme'
import { launchApp, savedCursorTab } from './app'
import { clientWork, prepare } from './fixtures'

// The Settings window's rows applied to the real app (docs/spec/preferences.md PRF-5 to PRF-30),
// with a terminal tab open where a row reaches the terminals. Never on the human's display.

async function openPreferences(
  app: ElectronApplication,
  page: Page,
  section = 'appearance',
): Promise<Page> {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  const [prefs] = await Promise.all([
    app.waitForEvent('window'),
    page.keyboard.press('Control+Comma'),
  ])
  await prefs.waitForLoadState('domcontentloaded')
  await prefs.locator(`.section-item[data-section="${section}"]`).click()
  await expect(prefs.locator(`main[data-section="${section}"]`)).toBeVisible()
  return prefs
}

const statePath = (root: string) => join(root, 'config', 'menkar', 'state.json')
const saved = (root: string) => JSON.parse(readFileSync(statePath(root), 'utf8')).settings ?? {}

const cssVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

const terminalBackground = (page: Page) =>
  page
    .locator('.xterm-scrollable-element')
    .first()
    .evaluate((n) => getComputedStyle(n).backgroundColor)

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
const bg = (theme: string) => PALETTES[theme]?.bg ?? 'missing'

async function choose(prefs: Page, expander: string, label: string): Promise<void> {
  await prefs.locator(`[data-expander="${expander}"]`).evaluate((n) => n.setAttribute('open', ''))
  await prefs.locator(`[data-expander="${expander}"] label`, { hasText: label }).click()
}

async function withTerminal(
  settings: Record<string, unknown>,
  run: (launched: Awaited<ReturnType<typeof launchApp>>) => Promise<void>,
): Promise<void> {
  const launched = await launchApp({ prepare: (dirs) => savedCursorTab(dirs, settings) })
  try {
    await expect(launched.window.locator('.xterm')).toBeVisible()
    await run(launched)
  } finally {
    await launched.close()
  }
}

test('PRF-7, PRF-5, PRF-6 opening and closing writes no font; a chosen font reaches the terminal; reset brings the default back', async () => {
  await withTerminal({}, async ({ app, window, root }) => {
    const before = readFileSync(statePath(root))
    const first = await openPreferences(app, window)
    await first.close()
    await window.waitForTimeout(300)
    expect(readFileSync(statePath(root))).toEqual(before)

    const prefs = await openPreferences(app, window, 'appearance')
    const rows = window.locator('.xterm-rows').first()
    await prefs.locator('[data-key="font-family"]').selectOption('DejaVu Sans Mono')
    await prefs.locator('[data-key="font-size"]').fill('14')
    await prefs.locator('[data-key="font-size"]').dispatchEvent('change')
    await expect.poll(() => saved(root).font).toBe('DejaVu Sans Mono 14')
    await expect
      .poll(() => rows.evaluate((n) => getComputedStyle(n).fontFamily))
      .toContain('DejaVu Sans Mono')
    expect(await rows.evaluate((n) => getComputedStyle(n).fontSize)).toMatch(/^18\.66/)

    await prefs.locator('[data-key="font-reset"]').click()
    await expect.poll(() => saved(root).font).toBe('')
    await expect(prefs.locator('[data-key="font-family"]')).toHaveValue('')
    await expect(prefs.locator('[data-key="font-family"] option:checked')).toHaveText(
      'Default monospace',
    )
    await expect
      .poll(() => rows.evaluate((n) => getComputedStyle(n).fontFamily))
      .not.toContain('DejaVu')
  })
})

test('PRF-9 Dark on a light desktop turns the app and its terminals Mocha at once', async () => {
  await withTerminal({}, async ({ app, window, root }) => {
    await window.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => cssVar(window, '--bg')).toBe(bg('Catppuccin Latte'))
    const prefs = await openPreferences(app, window)
    await prefs.locator('[data-key="color_scheme"]').selectOption('dark')
    await expect.poll(() => cssVar(window, '--bg')).toBe(bg('Catppuccin Mocha'))
    await expect.poll(() => terminalBackground(window)).toBe(rgb(bg('Catppuccin Mocha')))
    await expect.poll(() => saved(root).color_scheme).toBe('dark')
  })
})

test('PRF-10, PRF-11 Follow system: a desktop switch recolors every window; a named theme stays', async () => {
  await withTerminal({ color_scheme: 'system' }, async ({ app, window }) => {
    await window.emulateMedia({ colorScheme: 'dark' })
    const prefs = await openPreferences(app, window)
    await prefs.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => terminalBackground(window)).toBe(rgb(bg('Catppuccin Mocha')))
    for (const page of [window, prefs]) {
      await page.emulateMedia({ colorScheme: 'light' })
      await expect.poll(() => cssVar(page, '--bg')).toBe(bg('Catppuccin Latte'))
    }
    await expect.poll(() => terminalBackground(window)).toBe(rgb(bg('Catppuccin Latte')))

    await window.emulateMedia({ colorScheme: 'dark' })
    await choose(prefs, 'terminal_theme', 'Nord')
    await expect.poll(() => terminalBackground(window)).toBe(rgb(bg('Nord')))
    await window.emulateMedia({ colorScheme: 'light' })
    await window.waitForTimeout(300)
    expect(await terminalBackground(window)).toBe(rgb(bg('Nord')))
  })
})

test('PRF-12, PRF-13 Classic: a plain window, no frame labels, default or named terminal colors; back again', async () => {
  await withTerminal({ color_scheme: 'dark' }, async ({ app, window, root }) => {
    const label = window.locator('.frame-label').first()
    await expect(label).toBeVisible()
    const prefs = await openPreferences(app, window)
    await choose(prefs, 'ui_style', 'Classic (Adwaita)')
    await expect.poll(() => saved(root).ui_style).toBe('classic')
    await expect(window.locator('html')).toHaveClass(/\bclassic\b/)
    await expect(label).toBeHidden()
    await expect.poll(() => terminalBackground(window)).toBe('rgb(30, 30, 30)')

    await choose(prefs, 'terminal_theme', 'Dracula')
    await expect.poll(() => terminalBackground(window)).toBe(rgb(bg('Dracula')))
    await expect(window.locator('html')).toHaveClass(/\bclassic\b/)

    await choose(prefs, 'ui_style', 'Terminal workspace')
    await expect.poll(() => saved(root).ui_style).toBe('tui')
    await expect(window.locator('html')).not.toHaveClass(/\bclassic\b/)
    await expect(label).toBeVisible()
    await expect.poll(() => cssVar(window, '--bg')).toBe(bg('Dracula'))
  })
})

test('PRF-18 Show folder path: the next Add session dialog shows each row its folder', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      const env = prepare(dirs)
      const folder = join(dirs.home, 'todo-api')
      mkdirSync(folder)
      const transcripts = join(
        dirs.home,
        '.claude',
        'projects',
        folder.replace(/[^A-Za-z0-9]/g, '-'),
      )
      mkdirSync(transcripts, { recursive: true })
      writeFileSync(
        join(transcripts, '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.jsonl'),
        `${JSON.stringify({ type: 'user', cwd: folder, message: { content: 'loose' } })}\n`,
      )
      return env
    },
  })
  const page = launched.window
  const openAdd = async () => {
    await page.locator('#add-session').click()
    await page.locator('.history-group', { hasText: 'TODO-API' }).click()
    await expect(page.locator('.history-row', { hasText: 'loose' })).toBeVisible()
  }
  try {
    await openAdd()
    await expect(page.locator('.history-row .path')).toHaveCount(0)
    await page.locator(`.add-session button[aria-label="${en['tab.close']}"]`).click()
    await expect(page.locator('.add-session')).toHaveCount(0)
    const prefs = await openPreferences(launched.app, page, 'sessions')
    await prefs.locator('[data-key="show_folder_path"]').check()
    await expect.poll(() => saved(root).show_folder_path).toBe(true)
    await prefs.close()
    await openAdd()
    await expect(page.locator('.history-row', { hasText: 'loose' }).locator('.path')).toHaveText(
      /\/todo-api$/,
    )
  } finally {
    await launched.close()
  }
})

test('PRF-19 the two notification switches are saved off', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return undefined
    },
  })
  try {
    const prefs = await openPreferences(launched.app, launched.window, 'notifications')
    await prefs.locator('[data-key="notify_idle"]').uncheck()
    await prefs.locator('[data-key="notify_sound"]').uncheck()
    await expect.poll(() => saved(root)).toMatchObject({ notify_idle: false, notify_sound: false })
  } finally {
    await launched.close()
  }
})

test('PRF-20 Reopen tabs on start off: saved, and a start with saved tabs opens none', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return savedCursorTab(dirs)
    },
  })
  try {
    await expect(launched.window.locator('.xterm')).toBeVisible()
    const prefs = await openPreferences(launched.app, launched.window, 'sessions')
    await prefs.locator('[data-key="reopen_tabs"]').uncheck()
    await expect.poll(() => saved(root).reopen_tabs).toBe(false)
  } finally {
    await launched.close()
  }
  const again = await launchApp({
    prepare: (dirs) => savedCursorTab(dirs, { reopen_tabs: false }),
  })
  try {
    await expect(again.window.locator('#sidebar')).toBeVisible()
    await again.window.waitForTimeout(500)
    await expect(again.window.locator('.tab')).toHaveCount(0)
    await expect(again.window.locator('.xterm')).toHaveCount(0)
    expect(again.app.windows()).toHaveLength(1)
  } finally {
    await again.close()
  }
})

const ADD_SESSION_EN = en['sidebar.addSession']

const catalogLanguage = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { menkar: { i18n: { catalog(): Promise<{ language: string }> } } }
    ).menkar.i18n
      .catalog()
      .then((c) => c.language),
  )

test('PRF-21, PRF-25 the languages in their own names; Español applies at the next start only', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return undefined
    },
  })
  try {
    const prefs = await openPreferences(launched.app, launched.window, 'language')
    await expect(prefs.locator('[data-expander="language"] label')).toHaveText([
      'System default',
      'English',
      'Español',
    ])
    await choose(prefs, 'language', 'Español')
    await expect.poll(() => saved(root).language).toBe('es')
    await prefs.close()
    expect(await catalogLanguage(launched.window)).toBe('en')
    await expect(launched.window.locator('#add-session')).toContainText(ADD_SESSION_EN)
  } finally {
    await launched.close()
  }
  const next = await launchApp({
    prepare: (dirs) => {
      mkdirSync(join(dirs.root, 'config', 'menkar'), { recursive: true })
      writeFileSync(statePath(dirs.root), JSON.stringify({ settings: { language: 'es' } }))
      return undefined
    },
  })
  try {
    expect(await catalogLanguage(next.window)).toBe('es')
    await expect(next.window.locator('#add-session')).not.toContainText(ADD_SESSION_EN)
  } finally {
    await next.close()
  }
})

test('PRF-29 the sidebar dragged to 420 px is saved after the pause, and a new window opens with it', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return undefined
    },
  })
  const page = launched.window
  try {
    const divider = await page.locator('#divider').boundingBox()
    if (!divider) throw new Error('no divider')
    const y = divider.y + divider.height / 2
    await page.mouse.move(divider.x + divider.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(380, y, { steps: 5 })
    await page.mouse.move(420, y, { steps: 5 })
    await page.mouse.up()
    expect(saved(root).sidebar_width).toBeUndefined()
    await expect.poll(() => saved(root).sidebar_width, { timeout: 3000 }).toBe(420)
    await page.evaluate(() =>
      (
        window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act({ type: 'newWindowWithProject', name: 'Second' }),
    )
    await expect.poll(() => launched.app.windows().length).toBe(2)
    const second = launched.app.windows().find((w) => w !== page)
    if (!second) throw new Error('no second window')
    await expect
      .poll(() => second.locator('#sidebar').evaluate((n) => n.getBoundingClientRect().width))
      .toBe(420)
  } finally {
    await launched.close()
  }
})

test('decision 1.22: "Red from" changes an open window\'s ring at once; a pair with red not above yellow is refused', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return clientWork(dirs, { tabs: [['login']] })
    },
  })
  const { app, window: page } = launched
  try {
    await expect(page.locator('.tab')).toHaveCount(1)
    const pane = await page.evaluate(() =>
      (
        globalThis as unknown as {
          menkar: { window: { state(): Promise<{ tabs: { panes: { sessionId: string }[] }[] }> } }
        }
      ).menkar.window
        .state()
        .then((s) => s.tabs[0]?.panes[0]),
    )
    await app.evaluate(({ BrowserWindow }, sessionId) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('context:reading', {
        sessionId,
        reading: { percentage: 85, window: 200000, source: 'statusline' },
      })
    }, pane?.sessionId)
    const stroke = () => page.locator('.tab .ring circle').first().getAttribute('stroke')
    await expect.poll(stroke).toBe('rgb(242,191,64)')

    const prefs = await openPreferences(app, page, 'context')
    await expect(prefs.locator('[data-key="ring_warn"]')).toHaveValue('60')
    await expect(prefs.locator('[data-key="ring_full"]')).toHaveValue('90')
    const full = prefs.locator('[data-key="ring_full"]')
    await full.fill('80')
    await full.dispatchEvent('change')
    await expect.poll(() => saved(root).ring_full).toBe(80)
    await expect.poll(stroke).toBe('rgb(235,84,84)')

    const before = readFileSync(statePath(root), 'utf8')
    await full.fill('50')
    await full.dispatchEvent('change')
    await expect(prefs.locator('[data-key="ring-error"]')).toHaveText(
      'Yellow must be below red, both whole numbers from 1 to 100. The previous values are kept.',
    )
    await expect(full).toHaveValue('80')
    await page.waitForTimeout(300)
    expect(readFileSync(statePath(root), 'utf8')).toBe(before)
    expect(await stroke()).toBe('rgb(235,84,84)')
  } finally {
    await launched.close()
  }
})

// The size alone, with the family left at the default: the case of anyone who never picked a
// family. It must reach the open terminal at once, its rows growing with it.
test('PRF-5 (2026-11-10) the size alone, with the default family, reaches the open terminal at once', async () => {
  await withTerminal({}, async ({ app, window, root }) => {
    const rows = window.locator('.xterm-rows').first()
    const rowHeight = () => rows.evaluate((n) => (n.firstElementChild as HTMLElement).offsetHeight)
    const before = await rowHeight()
    const prefs = await openPreferences(app, window, 'appearance')
    await expect(prefs.locator('[data-key="font-family"]')).toHaveValue('')
    await prefs.locator('[data-key="font-size"]').fill('16')
    await prefs.locator('[data-key="font-size"]').dispatchEvent('change')
    await expect.poll(() => saved(root).font).toMatch(/ 16$/)
    await expect.poll(() => rows.evaluate((n) => getComputedStyle(n).fontSize)).toMatch(/^21\.33/)
    expect(await rowHeight()).toBeGreaterThan(before)
    // The setting reads back as the default family at that size.
    await prefs.close()
    const again = await openPreferences(app, window, 'appearance')
    await expect(again.locator('[data-key="font-family"]')).toHaveValue('')
    await expect(again.locator('[data-key="font-size"]')).toHaveValue('16')
  })
})

test('PRF-5 (2026-11-10) a tab hidden while the size changes shows it, refitted, once it is selected', async () => {
  const launched = await launchApp({
    prepare: (dirs) => clientWork(dirs, { tabs: [['login'], ['api']] }),
  })
  const { app, window } = launched
  try {
    const shownRows = window.locator('.tab-body:not(.hidden) .xterm-rows')
    await expect(window.locator('.tab')).toHaveCount(2)
    await expect(shownRows).toHaveCount(1)
    const prefs = await openPreferences(app, window, 'appearance')
    await prefs.locator('[data-key="font-size"]').fill('16')
    await prefs.locator('[data-key="font-size"]').dispatchEvent('change')
    await expect
      .poll(() => shownRows.evaluate((n) => getComputedStyle(n).fontSize))
      .toMatch(/^21\.33/)
    const shownTab = await window.locator('.tab.selected').getAttribute('data-tab')
    const other = window.locator('.tab:not(.selected)')
    await other.click()
    await expect(window.locator('.tab.selected')).not.toHaveAttribute('data-tab', shownTab ?? '')
    await expect
      .poll(() => shownRows.evaluate((n) => getComputedStyle(n).fontSize))
      .toMatch(/^21\.33/)
    // Refitted to the new cells: as many rows as the new height fits in its pane, not the old count.
    const fit = () =>
      shownRows.evaluate((n) => {
        const height = (n.firstElementChild as HTMLElement).offsetHeight
        const room = (n.closest('.term') as HTMLElement).clientHeight
        const rows = n.children.length
        return rows * height <= room && rows * height > room - 2 * height
      })
    await expect.poll(fit).toBe(true)
  } finally {
    await launched.close()
  }
})
