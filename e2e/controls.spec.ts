import { expect, type Page, test } from '@playwright/test'
import { contrast, onAccent, resolveLook, THEME_NAMES } from '../src/core/theme'
import { launchApp } from './app'
import { clientWork } from './fixtures'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

interface Group {
  readonly page: string
  readonly segments: readonly string[]
  // Each segment's text as drawn on it, and the page's full text color drawn on it.
  readonly texts: readonly string[]
  readonly fullTexts: readonly string[]
  readonly chosen: readonly boolean[]
  readonly border: readonly string[]
  readonly dividers: readonly string[]
}

// Every segmented group in the page, with each segment's color as drawn over everything under it
// (the page's own backgrounds, translucent or not) and the page's color under the group.
const groups = (page: Page): Promise<Group[]> =>
  page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    const read = () => {
      const [r, g, b] = ctx?.getImageData(0, 0, 1, 1).data ?? []
      return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`
    }
    const drawnUnder = (node: Element, top?: string) => {
      const chain: Element[] = []
      for (let e: Element | null = node; e; e = e.parentElement) chain.unshift(e)
      if (!ctx) return ''
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 1, 1)
      for (const e of chain) {
        ctx.fillStyle = getComputedStyle(e).backgroundColor
        ctx.fillRect(0, 0, 1, 1)
      }
      if (top) {
        ctx.fillStyle = top
        ctx.fillRect(0, 0, 1, 1)
      }
      return read()
    }
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()
    return [...document.querySelectorAll('.segmented')].map((group) => {
      const style = getComputedStyle(group)
      const buttons = [...group.children] as HTMLElement[]
      return {
        page: drawnUnder(group.parentElement as Element),
        segments: buttons.map((b) => drawnUnder(b)),
        texts: buttons.map((b) => drawnUnder(b, getComputedStyle(b).color)),
        fullTexts: buttons.map((b) => drawnUnder(b, fg)),
        chosen: buttons.map(
          (b) => b.getAttribute('aria-pressed') === 'true' || b.classList.contains('selected'),
        ),
        border: [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ],
        dividers: buttons.slice(1).map((b) => getComputedStyle(b).borderLeftWidth),
      }
    })
  })

const apart = (a: string, b: string) => {
  const ch = (c: string) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16))
  const x = ch(a)
  return Math.max(...ch(b).map((v, i) => Math.abs(v - (x[i] ?? 0))))
}

function expectReadable(found: readonly Group[], what: string, count: number): void {
  expect(found.length, what).toBe(count)
  for (const g of found) {
    const where = `${what} ${JSON.stringify(g)}`
    expect(g.border, where).toEqual(['1px', '1px', '1px', '1px'])
    expect(g.dividers, where).toEqual(g.segments.slice(1).map(() => '1px'))
    expect(g.chosen.filter(Boolean).length, where).toBe(1)
    const c = g.chosen.indexOf(true)
    const chosen = g.segments[c] ?? ''
    const chosenText = g.texts[c] ?? ''
    // The chosen one's text reads on its color.
    expect(contrast(chosenText, chosen), where).toBeGreaterThanOrEqual(3)
    g.segments.forEach((s, i) => {
      if (i === c) return
      const text = g.texts[i] ?? ''
      expect(apart(s, g.page), where).toBeGreaterThanOrEqual(8)
      // One colored, the others grey: well apart in fill and in text.
      expect(apart(chosen, s), where).toBeGreaterThanOrEqual(48)
      expect(apart(chosenText, text), where).toBeGreaterThanOrEqual(48)
      // Dimmed: less contrast on its segment than the full text color would have.
      expect(contrast(text, s), where).toBeLessThan(contrast(g.fullTexts[i] ?? '', s) * 0.8)
    })
  }
}

test('LOOK-65 (2026-11-09) a segmented control reads as one group: a 1 px border, a line between segments, every segment a step off the page and the chosen one clearly apart; in Add session, Usage and Preferences, in every theme, style and scheme', async () => {
  const launched = await launchApp({ prepare: (dirs) => clientWork(dirs) })
  const { app, window: page } = launched
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    await page.locator('#add-session').click()
    await expect(page.locator('.add-session')).toBeVisible()
    expectReadable(await groups(page), 'Add session', 1)
    for (const name of THEME_NAMES) {
      for (const style of ['tui', 'classic']) {
        for (const dark of [true, false]) {
          const look = resolveLook(
            { ui_style: style, terminal_theme: name, color_scheme: dark ? 'dark' : 'light' },
            dark,
          )
          await page.evaluate(
            ([roles, classic, accentText]) => {
              const root = document.documentElement
              root.classList.toggle('classic', classic)
              root.classList.toggle('tui', !classic)
              for (const [key, value] of Object.entries(roles))
                root.style.setProperty(`--${key}`, value)
              root.style.setProperty('--on-accent', accentText)
            },
            [look.roles, style === 'classic', onAccent(look)] as const,
          )
          expectReadable(await groups(page), `Add session ${name} ${style} ${dark}`, 1)
        }
      }
    }

    const [usage] = await Promise.all([
      app.waitForEvent('window'),
      act(page, { type: 'openUsage' }),
    ])
    await usage.waitForLoadState('domcontentloaded')
    await expect(usage.locator('[data-toggles="view"]')).toBeVisible()
    await usage.locator('[data-toggles="view"] [data-value="chart"]').click()
    await expect(usage.locator('[data-toggles="stack"]')).toBeVisible()
    // A hovered segment shows its text whole.
    await usage.mouse.move(1, 1)
    const usageGroups = await usage.locator('[data-toggles]').count()
    expect(usageGroups).toBeGreaterThanOrEqual(4)
    expectReadable(await groups(usage), 'Usage', usageGroups)

    const [prefs] = await Promise.all([
      app.waitForEvent('window'),
      act(page, { type: 'openSettings' }),
    ])
    await prefs.waitForLoadState('domcontentloaded')
    // Settings switches sections with its list (2026-11-10), not a segmented group.
    await expect(prefs.locator('.section-item').first()).toBeVisible()
    expectReadable(await groups(prefs), 'Settings', 0)
  } finally {
    await launched.close()
  }
})

test('LOOK-67 (2026-11-09) buttons, fields and segmented groups have rounded corners in both styles; a group rounds only its outline; tabs keep the style’s own corners', async () => {
  for (const ui_style of ['tui', 'classic']) {
    const launched = await launchApp({
      prepare: (dirs) => clientWork(dirs, { settings: { ui_style }, tabs: [['login'], ['api']] }),
    })
    const { app, window: page } = launched
    try {
      await expect(page.locator('#session-list .row')).toHaveCount(3)
      const radius = (p: Page, selector: string) =>
        p
          .locator(selector)
          .first()
          .evaluate((n) => Number.parseFloat(getComputedStyle(n).borderTopLeftRadius))
      for (const selector of [
        '#toggle-sidebar',
        '#new-menu',
        '#settings-button',
        '#project-button',
        '#usage-button',
        '#add-session',
      ])
        expect(await radius(page, selector), `${ui_style} ${selector}`).toBeGreaterThan(0)
      expect(await radius(page, '.tab'), ui_style).toBe(ui_style === 'tui' ? 0 : 6)
      await page.locator('#add-session').click()
      await expect(page.locator('.add-session')).toBeVisible()
      expect(await radius(page, '.add-session .segmented'), ui_style).toBeGreaterThan(0)
      expect(await radius(page, '.add-session input[type="text"]'), ui_style).toBeGreaterThan(0)
      expect(await radius(page, '.add-session .segmented > button'), ui_style).toBe(0)
      const [prefs] = await Promise.all([
        app.waitForEvent('window'),
        act(page, { type: 'openSettings' }),
      ])
      await expect(prefs.locator('.section-item').first()).toBeVisible()
      expect(await radius(prefs, '.section-item'), ui_style).toBeGreaterThan(0)
      await prefs.locator('.section-item[data-section="terminal"]').click()
      expect(await radius(prefs, 'main button'), ui_style).toBeGreaterThan(0)
    } finally {
      await launched.close()
    }
  }
})
