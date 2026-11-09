import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, savedCursorTab } from './app'
import { CLIENT, clientWork } from './fixtures'
import { near as nearBy, pixel, pixelOf, style } from './measure'

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
      250,
    )
  } finally {
    await launched.close()
  }
})

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

async function client(options: Parameters<typeof clientWork>[1] = {}) {
  const launched = await launchApp({ prepare: (dirs) => clientWork(dirs, options) })
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

// Retried: the strip and the rows are rebuilt on each state the window gets, and a box read while
// an element is replaced is null.
const box = async (page: Page, selector: string) => {
  let b: { x: number; y: number; width: number; height: number } | null = null
  await expect
    .poll(async () => {
      b = await page.locator(selector).first().boundingBox()
      return b !== null
    })
    .toBe(true)
  if (!b) throw new Error(`${selector} has no box`)
  return b as { x: number; y: number; width: number; height: number }
}

test('LOOK-1, LOOK-4 a first start: 1280 × 800 titled Menkar, the title centered over the content; the header buttons, Close all only with two tabs', async () => {
  const launched = await client({ tabs: [['login']] })
  const { app, window: page } = launched
  try {
    const size = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return { size: win?.getSize(), title: win?.getTitle() }
    })
    expect([...(size.size ?? []), size.title]).toEqual([1280, 800, 'Menkar'])
    const title = await box(page, '.content-header .title')
    const content = await box(page, '#content')
    await expect(page.locator('.content-header .title')).toHaveText('Menkar')
    expect(
      Math.abs(title.x + title.width / 2 - (content.x + content.width / 2)),
    ).toBeLessThanOrEqual(1)

    await expect(page.locator('#toggle-sidebar')).toHaveAttribute('aria-pressed', 'true')
    expect(nearBy(await pixelOf(app, page, '#toggle-sidebar', 3, 3), '#3b3c4e')).toBe(true)
    const toggle = await box(page, '#toggle-sidebar')
    const split = await box(page, '#new-menu')
    expect(split.x).toBeGreaterThan(toggle.x)
    await expect(page.locator('#new-menu')).toHaveText('New ▾')
    // Close all is in the tab's menu, not the header (plan 24); Usage sits right of the title.
    await expect(page.locator('#close-all')).toHaveCount(0)
    expect((await box(page, '#usage-button')).x).toBeGreaterThan(split.x + split.width - 1)
  } finally {
    await launched.close()
  }
})

test('LOOK-7 Ctrl+B b, F9 and the toggle stay in step', async () => {
  const launched = await client()
  const page = launched.window
  try {
    await page.locator('#content').click({ position: { x: 40, y: 60 } })
    await page.keyboard.press('Control+b')
    await page.keyboard.press('b')
    await expect(page.locator('#sidebar')).toBeHidden()
    await expect(page.locator('#toggle-sidebar')).toHaveAttribute('aria-pressed', 'false')
    await page.locator('#toggle-sidebar').click()
    await expect(page.locator('#sidebar')).toBeVisible()
    await page.locator('#content').click({ position: { x: 40, y: 60 } })
    await page.keyboard.press('F9')
    await expect(page.locator('#sidebar')).toBeHidden()
    await page.locator('#toggle-sidebar').click()
    await expect(page.locator('#sidebar')).toBeVisible()
    await expect(page.locator('#toggle-sidebar')).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await launched.close()
  }
})

async function dragDivider(page: Page, to: number): Promise<void> {
  const d = await box(page, '#divider')
  await page.mouse.move(d.x + d.width / 2, d.y + 200)
  await page.mouse.down()
  await page.mouse.move(to, d.y + 200, { steps: 8 })
  await page.mouse.up()
}

test('LOOK-8, LOOK-9, LOOK-11 the divider: 420 px is saved and restored; it stops at 180; hidden at quit, it comes back shown at the saved width', async () => {
  let root = ''
  let launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return clientWork(dirs)
    },
  })
  try {
    const page = launched.window
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    await dragDivider(page, 40)
    expect((await box(page, '#sidebar')).width).toBe(180)
    await dragDivider(page, 420)
    expect((await box(page, '#sidebar')).width).toBe(420)
    const statePath = join(root, 'config', 'menkar', 'state.json')
    await expect
      .poll(() => JSON.parse(readFileSync(statePath, 'utf8')).settings?.sidebar_width)
      .toBe(420)
    await page.locator('#toggle-sidebar').click()
    await expect(page.locator('#sidebar')).toBeHidden()
    // Keep the HOME for the second start: close the app without the helper's cleanup.
    await launched.app.close()
    launched = await launchApp({
      prepare: (dirs) => {
        const env = clientWork(dirs)
        cpSync(join(root, 'config'), join(dirs.root, 'config'), { recursive: true })
        return env
      },
    })
    const again = launched.window
    await expect(again.locator('#sidebar')).toBeVisible()
    expect((await box(again, '#sidebar')).width).toBe(420)
  } finally {
    await launched.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('LOOK-10 widening the window keeps the sidebar and grows the content', async () => {
  const launched = await client()
  const page = launched.window
  try {
    const before = await box(page, '#content')
    await launched.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const b = win?.getContentBounds()
      if (win && b) win.setContentBounds({ ...b, width: 1600 })
    })
    await expect.poll(async () => (await box(page, '#content')).width).toBe(before.width + 320)
    expect((await box(page, '#sidebar')).width).toBe(250)
  } finally {
    await launched.close()
  }
})

test('LOOK-12 F9 in one of two windows leaves the other’s sidebar shown', async () => {
  const launched = await client({
    extraProjects: [{ id: 'dddddddddddd', name: 'Research', members: [] }],
  })
  const page = launched.window
  try {
    const second = launched.app.waitForEvent('window')
    await act(page, { type: 'newWindow' })
    const other = await second
    await expect(other.locator('#sidebar')).toBeVisible()
    await page.locator('#content').click({ position: { x: 40, y: 60 } })
    await page.keyboard.press('F9')
    await expect(page.locator('#sidebar')).toBeHidden()
    await expect(other.locator('#sidebar')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('LOOK-13 the sidebar header: the stretched project dropdown and ⚙ Settings; Add session 8 px from the sides, 6 px from the bottom, 34 px tall', async () => {
  const launched = await client()
  const { app, window: page } = launched
  try {
    const sidebar = await box(page, '#sidebar')
    const project = await box(page, '#project-button')
    const gear = await box(page, '#settings-button')
    expect(gear.x).toBeGreaterThan(project.x + project.width - 1)
    expect(project.width).toBeGreaterThan(sidebar.width / 2)
    await expect(page.locator('#project-button .project-name')).toHaveText('Client work')
    expect(await style(page, '#project-button .project-name', ['font-weight'])).toEqual({
      'font-weight': '700',
    })
    await expect(page.locator('#project-button svg')).toBeVisible()
    expect(nearBy(await pixelOf(app, page, '#project-button', 3, 3), '#3b3c4e')).toBe(true)
    await expect(page.locator('#sidebar .sidebar-header button')).toHaveCount(2)
    const add = await box(page, '#add-session')
    expect([
      add.x - sidebar.x,
      sidebar.x + sidebar.width - (add.x + add.width),
      sidebar.y + sidebar.height - (add.y + add.height),
      add.height,
    ]).toEqual([8, 8, 6, 34])
  } finally {
    await launched.close()
  }
})

const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('LOOK-14, LOOK-15, LOOK-20 the rows: the group heading, then No group; dot, bold name, folder line, ⋮, no ring without a reading; one folder shows no folder line', async () => {
  const launched = await client()
  const page = launched.window
  try {
    const list = page.locator('#session-list > *')
    expect(
      await list.evaluateAll((ns) =>
        ns.map((n) => (n.querySelector('.name') ?? n).textContent ?? ''),
      ),
    ).toEqual([
      '●api pair',
      'login fix',
      'api review',
      'No group',
      'abcdefghijklmnopqrstuvwxyz0123456789ABCD',
    ])
    expect(
      await style(page, '#session-list .group-heading', ['color', 'font-weight', 'font-size']),
    ).toEqual({ color: rgb('#6c7086'), 'font-weight': '700', 'font-size': '12px' })
    expect(await style(page, '#session-list .group-heading span', ['color'])).toEqual({
      color: rgb('#5ec4b6'),
    })
    expect(await page.locator('#session-list .group-heading').nth(1).locator('span').count()).toBe(
      0,
    )

    const row = `#session-list .row[data-session="${CLIENT.login}"]`
    expect(
      await page.locator(`${row} > *`).evaluateAll((ns) => ns.map((n) => n.className)),
    ).toEqual(['dot stopped', 'text', 'more'])
    const dot = await box(page, `${row} .dot`)
    expect([dot.width, dot.height]).toEqual([8, 8])
    expect(
      await style(page, `${row} .name`, ['font-weight', 'font-size', 'color', 'text-overflow']),
    ).toEqual({
      'font-weight': '700',
      'font-size': '14.6667px',
      color: rgb('#a6adc8'),
      'text-overflow': 'ellipsis',
    })
    await expect(page.locator(`${row} .folder`)).toHaveText('api')
    expect(await style(page, `${row} .folder`, ['font-size', 'color'])).toEqual({
      'font-size': '12px',
      color: rgb('#6c7086'),
    })
    await expect(page.locator('#session-list .ring')).toHaveCount(0)

    await act(page, { type: 'removeMember', session: CLIENT.long })
    await expect(page.locator('#session-list .row')).toHaveCount(2)
    await expect(page.locator('#session-list .folder')).toHaveCount(0)
    await expect(page.locator('#session-list .group-heading')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})

async function dotStyles(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, { bg: string; shadow: string }> = {}
    for (const state of ['stopped', 'idle', 'working', 'done', 'blocked']) {
      const dot = document.createElement('span')
      dot.className = `dot ${state}`
      document.getElementById('session-list')?.append(dot)
      const s = getComputedStyle(dot)
      out[state] = { bg: s.backgroundColor, shadow: s.boxShadow }
      dot.remove()
    }
    return out
  })
}

test('LOOK-16 the status dots in Terminal workspace (Mocha)', async () => {
  const launched = await client()
  try {
    expect(await dotStyles(launched.window)).toEqual({
      stopped: { bg: 'rgba(0, 0, 0, 0)', shadow: `${rgb('#6c7086')} 0px 0px 0px 1.5px inset` },
      idle: { bg: 'rgba(0, 0, 0, 0)', shadow: `${rgb('#a6e3a1')} 0px 0px 0px 1.5px inset` },
      working: { bg: rgb('#f9e2af'), shadow: 'none' },
      done: { bg: rgb('#a6e3a1'), shadow: 'none' },
      blocked: {
        bg: rgb('#f38ba8'),
        shadow: 'color(srgb 0.952941 0.545098 0.658824 / 0.35) 0px 0px 0px 2px',
      },
    })
  } finally {
    await launched.close()
  }
})

test('LOOK-17 the status dots in Classic, dark and light', async () => {
  for (const scheme of ['dark', 'light']) {
    const launched = await client({ settings: { ui_style: 'classic', color_scheme: scheme } })
    try {
      const dots = await dotStyles(launched.window)
      const fg35 =
        scheme === 'dark'
          ? 'color(srgb 1 1 1 / 0.35)'
          : 'color(srgb 0.196078 0.196078 0.196078 / 0.35)'
      expect(dots).toEqual({
        stopped: { bg: 'rgba(0, 0, 0, 0)', shadow: `${fg35} 0px 0px 0px 1.5px inset` },
        idle: { bg: 'rgba(0, 0, 0, 0)', shadow: `${rgb('#2ec27e')} 0px 0px 0px 1.5px inset` },
        working: { bg: rgb('#e5a50a'), shadow: 'none' },
        done: { bg: rgb('#2ec27e'), shadow: 'none' },
        blocked: { bg: rgb('#e01b24'), shadow: 'none' },
      })
    } finally {
      await launched.close()
    }
  }
})

test('LOOK-24, LOOK-26, LOOK-27, LOOK-28 the strip: square surface0 tabs 2 px apart; 28 characters then …; tooltips; the close × at 70 %, 100 % on hover, closing without selecting; the group as a line under the tab', async () => {
  const launched = await client({ tabs: [['login', 'api'], ['long']] })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(2)
    await page.locator('.tab').first().click()
    await expect(page.locator('.tab').first()).toHaveClass(/selected/)
    const unselected = page.locator('.tab').nth(1)
    expect(
      await style(page, '.tab:not(.selected)', [
        'background-color',
        'color',
        'opacity',
        'border-radius',
      ]),
    ).toEqual({
      'background-color': rgb('#313244'),
      color: rgb('#a6adc8'),
      opacity: '1',
      'border-radius': '0px',
    })
    const first = await box(page, '.tab')
    const second = await unselected.boundingBox()
    expect((second?.x ?? 0) - (first.x + first.width)).toBe(2)
    await expect(unselected.locator('.title')).toHaveText(`${'abcdefghijklmnopqrstuvwxyz01'}…`)
    await expect(unselected).toHaveAttribute('title', `web — ${CLIENT.long}`)
    // The human's change (2026-11-08): the group is a line under the tab, not a dot.
    await expect(page.locator('.tab', { hasText: '●' })).toHaveCount(0)
    const line = await box(page, '.tab.selected .group-line')
    expect([line.width, line.height, line.y + line.height]).toEqual([
      first.width,
      3,
      first.y + first.height,
    ])
    expect(await style(page, '.tab.selected .group-line', ['background-color'])).toEqual({
      'background-color': rgb('#5ec4b6'),
    })
    // Drawn, not only laid out: the selected tab's background must not cover it.
    const drawn = await pixelOf(launched.app, page, '.tab.selected .group-line', 4, 1)
    expect(nearBy(drawn, '#5ec4b6'), drawn).toBe(true)
    await expect(unselected.locator('.group-line')).toHaveCount(0)

    expect(await style(page, '.tab:not(.selected) .close', ['opacity'])).toEqual({ opacity: '0.7' })
    await unselected.locator('.close').hover()
    await expect
      .poll(() => style(page, '.tab:not(.selected) .close', ['opacity', 'border-radius']))
      .toEqual({ opacity: '1', 'border-radius': '50%' })
    expect(
      (await style(page, '.tab:not(.selected) .close', ['background-color']))['background-color'],
    ).not.toBe('rgba(0, 0, 0, 0)')
    const selectedBefore = await page.locator('.tab.selected').getAttribute('data-tab')
    await unselected.locator('.close').click()
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect(page.locator('.tab.selected')).toHaveAttribute('data-tab', selectedBefore ?? '')
  } finally {
    await launched.close()
  }
})

test('LOOK-26 a new session’s tab says "new {agent} session — {folder}"; a file tab its path', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      // The stand-in writes no transcript, so the session stays new.
      return { ...clientWork(dirs), FAKE_CLAUDE_QUIET: '1' }
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    const folder = join(home, 'work', 'web')
    await act(page, { type: 'startNew', agent: 'claude', folder, name: '' })
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect(page.locator('.tab')).toHaveAttribute(
      'title',
      `new Claude Code session — ${folder}`,
    )
    const file = join(home, 'notes.txt')
    writeFileSync(file, 'notes\n')
    await act(page, { type: 'openFilePath', path: file })
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('.tab').nth(1)).toHaveAttribute('title', file)
  } finally {
    await launched.close()
  }
})

test('LOOK-25 Classic: the selected tab is #D97757 at 22 %, bold, no accent line; the other flat at 60 %', async () => {
  const launched = await client({
    tabs: [['login', 'api'], ['long']],
    settings: { ui_style: 'classic' },
  })
  const page = launched.window
  try {
    await page.locator('.tab').first().click()
    // The bottom line belongs to the group (2026-11-08): the selected tab is its background and
    // its bold label.
    expect(
      await style(page, '.tab.selected', ['background-color', 'box-shadow', 'font-weight']),
    ).toEqual({
      'background-color': 'color(srgb 0.85098 0.466667 0.341176 / 0.22)',
      'box-shadow': 'none',
      'font-weight': '700',
    })
    expect(await style(page, '.tab:not(.selected)', ['background-color'])).toEqual({
      'background-color': 'rgba(0, 0, 0, 0)',
    })
    expect(await style(page, '.tab:not(.selected) .title', ['opacity'])).toEqual({
      opacity: '0.6',
    })
  } finally {
    await launched.close()
  }
})

test('LOOK-30 PREFIX: bold 0.8 em, #1e1e2e on #cba6f7, 1 px 8 px, square; the next key hides it; Classic white on #3584e4', async () => {
  for (const ui_style of ['tui', 'classic']) {
    const launched = await client({ tabs: [['long']], settings: { ui_style } })
    const page = launched.window
    try {
      await expect(page.locator('.xterm')).toBeVisible()
      await page.locator('.xterm').click()
      await page.keyboard.press('Control+b')
      await expect(page.locator('#prefix-pill')).toBeVisible()
      const pill = await box(page, '#prefix-pill')
      const strip = await box(page, '#tab-strip')
      expect(strip.x + strip.width - (pill.x + pill.width)).toBeLessThanOrEqual(12)
      const s = await style(page, '#prefix-pill', [
        'font-weight',
        'color',
        'background-color',
        'padding',
        'border-radius',
        'font-size',
      ])
      expect(s).toEqual({
        'font-weight': '700',
        color: ui_style === 'tui' ? rgb('#1e1e2e') : rgb('#ffffff'),
        'background-color': ui_style === 'tui' ? rgb('#cba6f7') : rgb('#3584e4'),
        padding: '1px 8px',
        'border-radius': '0px',
        'font-size': '11.7333px',
      })
      await page.keyboard.press('x')
      await expect(page.locator('#prefix-pill')).toBeHidden()
    } finally {
      await launched.close()
    }
  }
})

const prefs = (page: Page, key: string, value: unknown) =>
  page.evaluate(
    ([k, v]) =>
      (
        globalThis as unknown as {
          menkar: { preferences: { set(k: unknown, v: unknown): Promise<unknown> } }
        }
      ).menkar.preferences.set(k, v),
    [key, value] as const,
  )

async function shellTab(settings: Record<string, unknown> = {}) {
  const launched = await launchApp({
    prepare: (dirs) => savedCursorTab(dirs, { color_scheme: 'dark', ...settings }),
  })
  const page = launched.window
  await expect(page.locator('.xterm')).toBeVisible()
  await expect
    .poll(() =>
      launched.app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false,
      ),
    )
    .toBe(true)
  return launched
}

const termColors = (page: Page, nth = 0) =>
  page.evaluate((i) => {
    const term = document.querySelectorAll('.xterm')[i]
    const viewport = term?.querySelector('.xterm-viewport') ?? term
    const rows = term?.querySelector('.xterm-rows')
    return {
      background: viewport ? getComputedStyle(viewport).backgroundColor : 'missing',
      foreground: rows ? getComputedStyle(rows).color : 'missing',
      fontSize: rows ? getComputedStyle(rows).fontSize : 'missing',
      fontFamily: rows ? getComputedStyle(rows).fontFamily : 'missing',
    }
  }, nth)

test('LOOK-31, LOOK-34 the frame: 1 px, 12 px under the strip, 6 px elsewhere, its label in accent on the window background; the text area’s inset and the theme’s colors', async () => {
  const launched = await shellTab()
  const page = launched.window
  try {
    const strip = await box(page, '#tab-strip')
    const pane = await box(page, '.pane')
    const frame = await box(page, '.frame')
    expect(await style(page, '.frame', ['border-top-width', 'border-radius'])).toEqual({
      'border-top-width': '1px',
      'border-radius': '0px',
    })
    expect([
      frame.y - (strip.y + strip.height),
      frame.x - pane.x,
      pane.x + pane.width - (frame.x + frame.width),
      pane.y + pane.height - (frame.y + frame.height),
    ]).toEqual([12, 6, 6, 6])
    await expect(page.locator('.frame-label')).toHaveText('cursor')
    const label = await box(page, '.frame-label')
    expect(label.x - frame.x).toBe(10)
    expect(label.y).toBeLessThan(frame.y)
    expect(label.y + label.height).toBeGreaterThan(frame.y)
    expect(
      await style(page, '.frame-label', [
        'color',
        'background-color',
        'padding-left',
        'padding-right',
      ]),
    ).toEqual({
      color: rgb('#cba6f7'),
      'background-color': rgb('#1e1e2e'),
      'padding-left': '4px',
      'padding-right': '4px',
    })
    const term = await box(page, '.term')
    expect([
      term.y - frame.y - 1,
      term.x - frame.x - 1,
      frame.x + frame.width - 1 - (term.x + term.width),
      frame.y + frame.height - 1 - (term.y + term.height),
    ]).toEqual([2, 6, 6, 2])
    await expect.poll(() => pixelOf(launched.app, page, '.term', 4, -4)).toBe('#1e1e2e')
    expect(await termColors(page)).toMatchObject({ foreground: rgb('#cdd6f4') })
    await page.locator('.xterm').click()
    await page.keyboard.type("printf '\\033[31mRED\\033[0m\\n'")
    await page.keyboard.press('Enter')
    const red = page.locator('.xterm-rows span', { hasText: /^RED$/ }).first()
    await expect(red).toBeVisible()
    expect(await red.evaluate((n) => getComputedStyle(n).color)).toBe(rgb('#f38ba8'))
  } finally {
    await launched.close()
  }
})

test('LOOK-32, LOOK-35 split right: side by side, 1 px between, halves; the focused frame in accent, the other surface1, Ctrl+B l swaps; Ctrl+B z zooms and restores', async () => {
  const launched = await shellTab()
  const page = launched.window
  try {
    await page.locator('.xterm').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('v')
    await expect(page.locator('.pane')).toHaveCount(2)
    await expect(page.locator('.xterm')).toHaveCount(2)
    const [left, right] = [
      await page.locator('.pane').nth(0).boundingBox(),
      await page.locator('.pane').nth(1).boundingBox(),
    ]
    if (!left || !right) throw new Error('no panes')
    expect(Math.abs(left.y - right.y)).toBe(0)
    expect(right.x).toBe(left.x + left.width)
    expect(Math.abs(left.width - (right.width - 1))).toBeLessThanOrEqual(1)
    expect(await style(page, '.pane + .pane', ['border-left-width'])).toEqual({
      'border-left-width': '1px',
    })
    const borders = () =>
      page.locator('.frame').evaluateAll((ns) => ns.map((n) => getComputedStyle(n).borderTopColor))
    await expect.poll(borders).toEqual([rgb('#45475a'), rgb('#cba6f7')])
    await page.keyboard.press('Control+b')
    await page.keyboard.press('h')
    await expect.poll(borders).toEqual([rgb('#cba6f7'), rgb('#45475a')])
    await page.keyboard.press('Control+b')
    await page.keyboard.press('l')
    await expect.poll(borders).toEqual([rgb('#45475a'), rgb('#cba6f7')])
    await page.keyboard.press('Control+b')
    await page.keyboard.press('z')
    await expect(page.locator('.pane:visible')).toHaveCount(1)
    expect((await box(page, '.pane:visible')).width).toBeGreaterThan(left.width * 1.8)
    await page.keyboard.press('Control+b')
    await page.keyboard.press('z')
    await expect(page.locator('.pane:visible')).toHaveCount(2)
  } finally {
    await launched.close()
  }
})

test('LOOK-33, LOOK-43 Classic: no frame line, no label; with Default the terminal keeps its own colors', async () => {
  const launched = await shellTab({ ui_style: 'classic' })
  const page = launched.window
  try {
    expect(await style(page, '.frame', ['border-top-width'])).toEqual({ 'border-top-width': '0px' })
    await expect(page.locator('.frame-label')).toBeHidden()
    expect(await pixelOf(launched.app, page, '.term', 4, -4)).toBe('#1e1e1e')
    expect(await termColors(page)).toMatchObject({ foreground: rgb('#ffffff') })
  } finally {
    await launched.close()
  }
})

test('LOOK-36, TRM-55 an empty font is the system monospace at 10 pt; "Monospace 14" reaches every terminal in every window at once', async () => {
  const launched = await shellTab()
  const page = launched.window
  try {
    expect(await termColors(page)).toMatchObject({ fontSize: '13.3333px' })
    expect((await termColors(page)).fontFamily).toMatch(/monospace/)
    await act(page, { type: 'newWindowWithProject', name: 'Second' })
    await expect.poll(() => launched.app.windows().length).toBe(2)
    const other = launched.app.windows().find((w) => w !== page)
    if (!other) throw new Error('no second window')
    await expect(other.locator('#sidebar')).toBeVisible()
    await act(other, { type: 'startNew', agent: 'cursor', folder: '/tmp', name: '' })
    await expect(other.locator('.xterm')).toBeVisible()
    await prefs(page, 'font', 'Monospace 14')
    await expect.poll(async () => (await termColors(page)).fontSize).toBe('18.6667px')
    await expect.poll(async () => (await termColors(other)).fontSize).toBe('18.6667px')
    expect((await termColors(other)).fontFamily).toMatch(/^"?monospace"?, monospace$/i)
  } finally {
    await launched.close()
  }
})

test('LOOK-40 Follow system: the desktop turning light changes every window to Latte, terminals included, within a second', async () => {
  const launched = await shellTab({ color_scheme: 'system' })
  const { app, window: page } = launched
  try {
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => color(page, 'body', 'background-color')).toBe('#1e1e2e')
    await act(page, { type: 'newWindowWithProject', name: 'Second' })
    await expect.poll(() => app.windows().length).toBe(2)
    const other = app.windows().find((w) => w !== page)
    if (!other) throw new Error('no second window')
    await other.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => color(other, 'body', 'background-color')).toBe('#1e1e2e')
    // The desktop's switch reaches every window's media query at once.
    await Promise.all([page, other].map((w) => w.emulateMedia({ colorScheme: 'light' })))
    await expect
      .poll(() => color(page, 'body', 'background-color'), { timeout: 1000 })
      .toBe('#eff1f5')
    await expect
      .poll(() => color(other, 'body', 'background-color'), { timeout: 1000 })
      .toBe('#eff1f5')
    await expect.poll(() => pixelOf(app, page, '.term', 4, -4), { timeout: 1000 }).toBe('#eff1f5')
  } finally {
    await launched.close()
  }
})

test('LOOK-41 Solarized Light with scheme Dark is light: window #fdf6e3, sidebar #f2dda6', async () => {
  const launched = await shellTab({ terminal_theme: 'Solarized Light' })
  try {
    expect(await color(launched.window, 'body', 'background-color')).toBe('#fdf6e3')
    expect(near(await color(launched.window, '#sidebar', 'background-color'), '#f2dda6')).toBe(true)
  } finally {
    await launched.close()
  }
})

test('LOOK-42 switching to Classic at once: the sans UI font, no frame labels, the sidebar on the window background, the terminal keeps the theme', async () => {
  const launched = await shellTab({ terminal_theme: 'Dracula' })
  const page = launched.window
  try {
    expect((await style(page, 'body', ['font-family']))['font-family']).toBe('monospace')
    await expect.poll(() => pixelOf(launched.app, page, '.term', 4, -4)).toBe('#282a36')
    await prefs(page, 'ui_style', 'classic')
    await expect
      .poll(async () => (await style(page, 'body', ['font-family']))['font-family'])
      .toBe('sans-serif')
    await expect(page.locator('.frame-label')).toBeHidden()
    expect(await pixelOf(launched.app, page, '.term', 4, -4)).toBe('#282a36')
    await prefs(page, 'terminal_theme', 'Default')
    await expect.poll(() => color(page, '#sidebar', 'background-color')).toBe('#242424')
  } finally {
    await launched.close()
  }
})

test('LOOK-44 an unknown terminal_theme starts as Default, and Settings shows Default', async () => {
  const launched = await shellTab({ terminal_theme: 'Matrix' })
  const page = launched.window
  try {
    expect(await color(page, 'body', 'background-color')).toBe('#1e1e2e')
    expect(await color(page, '#sidebar', 'background-color')).toBe('#181825')
    const opened = launched.app.waitForEvent('window')
    await act(page, { type: 'openSettings' })
    const preferences = await opened
    await expect(preferences.locator('[data-expander="terminal_theme"] .row-subtitle')).toHaveText(
      'Default',
    )
    await expect(preferences.locator('input[name="terminal_theme"][value="Default"]')).toBeChecked()
  } finally {
    await launched.close()
  }
})

test('LOOK-45 no tab: the star at 128 px and 55 %, "No session open" at 20 pt / 800, the hint; the strip holds only +', async () => {
  const launched = await client()
  const page = launched.window
  try {
    await expect(page.locator('#empty-content .heading')).toHaveText('No session open')
    await expect(page.locator('#empty-content .body')).toHaveText(
      'Pick a session from the sidebar, or start a new one.',
    )
    const star = await box(page, '#empty-content .logo svg')
    expect([star.width, star.height]).toEqual([128, 128])
    expect(await style(page, '#empty-content .logo', ['opacity'])).toEqual({ opacity: '0.55' })
    expect(await style(page, '#empty-content .heading', ['font-size', 'font-weight'])).toEqual({
      'font-size': '26.6667px',
      'font-weight': '800',
    })
    await expect(page.locator('#tab-strip > :visible')).toHaveText(['+'])
  } finally {
    await launched.close()
  }
})

test('LOOK-46 a project with no session: the star at 96 px, the heading at 18 pt, the hint, the accent pill that opens Add session on Existing', async () => {
  const launched = await client({
    extraProjects: [{ id: 'eeeeeeeeeeee', name: 'Empty', members: [] }],
  })
  const page = launched.window
  try {
    await act(page, { type: 'switchProject', project: 'eeeeeeeeeeee' })
    const page2 = page.locator('#session-list .status-page')
    await expect(page2.locator('.heading')).toHaveText('Empty has no sessions')
    await expect(page2.locator('.body')).toHaveText(
      'Add one Claude already knows, or start a new one in any folder.',
    )
    const star = await box(page, '#session-list .logo svg')
    expect([star.width, star.height]).toEqual([96, 96])
    expect(await style(page, '#session-list .heading', ['font-size'])).toEqual({
      'font-size': '24px',
    })
    expect(
      await style(page, '#session-list .pill', [
        'background-color',
        'color',
        'padding',
        'border-radius',
      ]),
    ).toMatchObject({
      'background-color': rgb('#cba6f7'),
      color: rgb('#1e1e2e'),
      padding: '10px 32px',
    })
    const pill = await box(page, '#session-list .pill')
    expect(
      Number.parseFloat(
        (await style(page, '#session-list .pill', ['border-radius']))['border-radius'] ?? '0',
      ),
    ).toBeGreaterThanOrEqual(pill.height / 2)
    await page.locator('#session-list .pill').click()
    await expect(page.locator('.add-session .switch.selected')).toHaveText('Existing')
  } finally {
    await launched.close()
  }
})

test('LOOK-47 no session anywhere: Existing shows the star, "No sessions found" and the hint', async () => {
  const launched = await launchApp()
  const page = launched.window
  try {
    await page.locator('#add-session').click()
    const empty = page.locator('.add-session .status-page')
    await expect(empty.locator('.heading')).toHaveText('No sessions found')
    await expect(empty.locator('.body')).toHaveText(
      'Run claude in a project directory first — sessions will appear here automatically.',
    )
    await expect(empty.locator('.logo svg')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('LOOK-48, LOOK-49 a dialog dims the window (black at 50 % dark, 14 % light); Add session is 560 × 640, its list mantle, its header the base, the selected switch in the accent', async () => {
  for (const scheme of ['dark', 'light']) {
    const launched = await client({ settings: { color_scheme: scheme } })
    const { app, window: page } = launched
    try {
      const at = await box(page, '#add-session')
      const sample = { x: Math.floor(at.x + 2), y: Math.floor(at.y - 20) }
      await page.locator('#add-session').click()
      await expect(page.locator('.add-session')).toBeVisible()
      await expect
        .poll(async () =>
          nearBy(await pixel(app, sample.x, sample.y), scheme === 'dark' ? '#0c0c12' : '#c6c8cd'),
        )
        .toBe(true)
      if (scheme === 'dark') {
        const dialog = await box(page, '.add-session')
        expect([dialog.width, dialog.height]).toEqual([560, 640])
        const head = await pixelOf(app, page, '.add-session .add-head', 20, 6)
        expect(nearBy(head, '#1e1e2e'), head).toBe(true)
        // Above the foot, which holds the Show hidden switch.
        const body = await pixelOf(app, page, '.add-session .add-body', 20, -60)
        expect(nearBy(body, '#181825'), body).toBe(true)
        const selected = await pixelOf(app, page, '.add-session .switch.selected', 3, 3)
        expect(nearBy(selected, '#cba6f7'), selected).toBe(true)
      }
    } finally {
      await launched.close()
    }
  }
})

test('LOOK-52 a toast is a fully rounded pill of black at 70 %, white text at 90 %, 12 px from the content’s sides and 24 px from its bottom', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = clientWork(dirs)
      writeFileSync(join(dirs.root, 'config', 'menkar', 'projects.json'), '{ not json')
      return env
    },
  })
  const page = launched.window
  try {
    const toast = page.locator('.toast').first()
    await expect(toast).toContainText('The projects file could not be read')
    expect(await style(page, '.toast', ['background-color', 'color', 'border-radius'])).toEqual({
      'background-color': 'rgba(0, 0, 0, 0.7)',
      color: 'rgba(255, 255, 255, 0.9)',
      'border-radius': '999px',
    })
    const toasts = await box(page, '#toasts')
    const content = await box(page, '#content')
    expect([
      toasts.x - content.x,
      content.x + content.width - (toasts.x + toasts.width),
      content.y + content.height - (toasts.y + toasts.height),
    ]).toEqual([12, 12, 24])
  } finally {
    await launched.close()
  }
})

test('LOOK-53 (2026-11-08) the header: the star before "Menkar", 1.15 em within the icons’ box, in its color, the two centered over the content; the settings button is a gear', async () => {
  for (const ui_style of ['tui', 'classic']) {
    const launched = await client({ settings: { ui_style } })
    const page = launched.window
    try {
      const kids = await page
        .locator('.content-header .title > *')
        .evaluateAll((ns) => ns.map((n) => n.className))
      expect(kids).toEqual(['title-star', 'title-text'])
      await expect(page.locator('.content-header .title-text')).toHaveText('Menkar')
      const star = await box(page, '.content-header .title-star svg')
      const text = await box(page, '.content-header .title-text')
      const fontSize = Number.parseFloat(
        (await style(page, '.content-header .title-text', ['font-size']))['font-size'] ?? '0',
      )
      expect(star.x + star.width).toBeLessThanOrEqual(text.x)
      expect(Math.abs(star.height - fontSize * 1.15)).toBeLessThanOrEqual(1.5)
      const iconBox = await box(page, '#toggle-sidebar svg')
      expect(star.height).toBeLessThanOrEqual(iconBox.height)
      expect((await style(page, '.content-header .title-star', ['color'])).color).toBe(
        (await style(page, '.content-header .title-text', ['color'])).color,
      )
      const content = await box(page, '#content')
      const group = { left: star.x, right: text.x + text.width }
      expect(
        Math.abs((group.left + group.right) / 2 - (content.x + content.width / 2)),
      ).toBeLessThanOrEqual(1)
      // A gear: one closed toothed outline around a hole, not a sun's separate rays.
      const gear = await page.locator('#settings-button svg').evaluate((svg) => ({
        paths: [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d') ?? ''),
        circles: svg.querySelectorAll('circle').length,
      }))
      expect(gear.paths).toHaveLength(1)
      expect(gear.paths[0]).toMatch(/[Zz]\s*$/)
      expect((gear.paths[0]?.match(/[Mm]/g) ?? []).length).toBe(1)
      expect(gear.circles).toBe(1)
    } finally {
      await launched.close()
    }
  }
})

test('LOOK-54 (2026-11-08) a tab reads: state dot, name, ring, ×', async () => {
  const launched = await client({ tabs: [['login'], ['long']] })
  const { app, window: page } = launched
  try {
    await expect(page.locator('.tab')).toHaveCount(2)
    const state = await page.evaluate(() =>
      (
        globalThis as unknown as {
          menkar: {
            window: { state(): Promise<{ tabs: { panes: { id: string; sessionId: string }[] }[] }> }
          }
        }
      ).menkar.window.state(),
    )
    const pane = state.tabs[0]?.panes[0]
    await app.evaluate(({ BrowserWindow }, p) => {
      const wc = BrowserWindow.getAllWindows()[0]?.webContents
      wc?.send('agentState:changed', {
        panes: [{ paneId: p?.id, sessionId: p?.sessionId, state: 'working' }],
        blocked: {},
      })
      wc?.send('context:reading', {
        sessionId: p?.sessionId,
        reading: { percentage: 42, window: 200000, source: 'statusline' },
      })
    }, pane)
    const first = page.locator('.tab').first()
    await expect(first.locator('.ring')).toHaveCount(1)
    expect(
      await first.evaluate((n) =>
        [...n.children]
          .filter((c) => !c.classList.contains('group-line'))
          .map((c) => c.className.split(' ')[0]),
      ),
    ).toEqual(['dot', 'title', 'ring', 'close'])
  } finally {
    await launched.close()
  }
})

test('LOOK-61 (decision 1.21) a stopped session’s row has no ring; once it runs, the ring is back', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = clientWork(dirs)
      const cwd = join(dirs.home, 'work', 'api')
      const file = join(
        dirs.home,
        '.claude',
        'projects',
        cwd.replace(/[^A-Za-z0-9]/g, '-'),
        `${CLIENT.login}.jsonl`,
      )
      writeFileSync(
        file,
        `${JSON.stringify({ type: 'assistant', timestamp: '2026-11-09T10:00:00Z', message: { model: 'claude-sonnet-4-5', usage: { input_tokens: 90_000 } } })}\n`,
        { flag: 'a' },
      )
      return env
    },
  })
  const page = launched.window
  const ringed = () =>
    page
      .locator('#session-list .row')
      .evaluateAll((ns) =>
        ns.filter((n) => n.querySelector('.ring')).map((n) => n.getAttribute('data-session')),
      )
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    // The reading is there (the tab shows it once open), but the stopped row shows none.
    await page.waitForTimeout(1500)
    expect(await ringed()).toEqual([])
    await act(page, { type: 'openSession', session: CLIENT.login })
    await expect(page.locator('.tab .ring')).toHaveCount(1)
    await expect.poll(ringed, { timeout: 5000 }).toEqual([CLIENT.login])
    await act(page, { type: 'closeAllTabs' })
    await expect.poll(ringed, { timeout: 5000 }).toEqual([])
  } finally {
    await launched.close()
  }
})

test('LOOK-70 (plan 24) the sidebar starts at 250 px, stops at 180, and a double click on the divider puts it back at 250', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return clientWork(dirs)
    },
  })
  try {
    const page = launched.window
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    expect((await box(page, '#sidebar')).width).toBe(250)
    await dragDivider(page, 40)
    expect((await box(page, '#sidebar')).width).toBe(180)
    const statePath = join(root, 'config', 'menkar', 'state.json')
    await expect
      .poll(() => JSON.parse(readFileSync(statePath, 'utf8')).settings?.sidebar_width)
      .toBe(180)
    await page.locator('#divider').dblclick()
    expect((await box(page, '#sidebar')).width).toBe(250)
    await expect
      .poll(() => JSON.parse(readFileSync(statePath, 'utf8')).settings?.sidebar_width)
      .toBe(250)
  } finally {
    await launched.close()
  }
})
