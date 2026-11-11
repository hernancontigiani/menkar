// The Settings window (2026-11-10): one window of its own, a grouped list of sections on the left,
// the chosen section on the right; transcript retention as an integration. Never on the human's
// display or with their HOME.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { SHORTCUTS } from '../src/core/shortcuts'
import { contrast } from '../src/core/theme'
import { launchApp } from './app'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

async function openSettings(
  app: ElectronApplication,
  page: Page,
  action: Record<string, unknown> = { type: 'openSettings' },
): Promise<Page> {
  const [settings] = await Promise.all([app.waitForEvent('window'), act(page, action)])
  await settings.waitForLoadState('domcontentloaded')
  await expect(settings.locator('main[data-section]')).toBeVisible()
  return settings
}

const SECTIONS = [
  'Appearance',
  'Terminal',
  'Sessions',
  'Notifications',
  'Context',
  'Usage & classifier',
  'Files',
  'Status line',
  'Transcript retention',
  'MCP servers',
  'Language',
  'Keyboard shortcuts',
  'About',
]

test('Settings (2026-11-10) is one window of its own: no parent, not modal; asking again focuses it on the asked section', async () => {
  const launched = await launchApp()
  const { app, window: page } = launched
  try {
    const settings = await openSettings(app, page)
    await expect(settings).toHaveTitle('Settings')
    await expect(settings.locator('main[data-section="appearance"] .section-title')).toHaveText(
      'Appearance',
    )
    const shape = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => ({
        parent: w.getParentWindow()?.id ?? null,
        modal: w.isModal(),
      })),
    )
    expect(shape).toEqual([
      { parent: null, modal: false },
      { parent: null, modal: false },
    ])
    // The main window still takes a click while Settings is open.
    await page.locator('#add-session').click()
    await expect(page.locator('.add-session')).toBeVisible()

    await act(page, { type: 'openSettings', section: 'about' })
    await expect(settings.locator('main[data-section="about"]')).toBeVisible()
    await expect(settings.locator('[data-key="name"]')).toHaveText('Menkar')
    expect(app.windows()).toHaveLength(2)
  } finally {
    await launched.close()
  }
})

test('Settings (2026-11-10) lists its sections in five groups under its title, each with an icon; a click or Up/Down shows each one', async () => {
  const launched = await launchApp()
  const { app, window: page } = launched
  try {
    const settings = await openSettings(app, page)
    const items = settings.locator('.section-item')
    await expect(items).toHaveText(SECTIONS)
    // Ubuntu's look: a title over the list, an icon beside every name, in the text color.
    await expect(settings.locator('.settings-side > [data-key="settings-title"]')).toHaveText(
      'Settings',
    )
    await expect(settings.locator('.section-item > svg.icon')).toHaveCount(SECTIONS.length)
    const strokes = await settings.locator('.section-item > svg.icon').evaluateAll((ns) =>
      ns.map((n) => {
        const box = n.getBoundingClientRect()
        const shapes = n.querySelectorAll('*').length
        return `${getComputedStyle(n).stroke === getComputedStyle(n.parentElement as Element).color} ${Math.round(box.width)} ${shapes > 0}`
      }),
    )
    expect(strokes).toEqual(SECTIONS.map(() => 'true 16 true'))
    // A separator between groups: Appearance | Work | Data | Integrations | System.
    const between = await settings
      .locator('.section-list > *')
      .evaluateAll((ns) => ns.map((n) => (n.tagName === 'HR' ? '|' : (n.textContent ?? ''))))
    expect(between.join(',')).toBe(
      'Appearance,Terminal,|,Sessions,Notifications,Context,|,Usage & classifier,Files,|,Status line,Transcript retention,MCP servers,|,Language,Keyboard shortcuts,About',
    )
    const rows: Record<string, string> = {
      appearance: '[data-key="color_scheme"]',
      terminal: '[data-key="scrollback"]',
      sessions: '[data-key="reopen_tabs"]',
      notifications: '[data-key="notify_idle"]',
      context: '[data-key="ring_warn"]',
      usage: '[data-key="classify"]',
      files: '[data-key="files_root"]',
      statusline: '[data-key="statusline"]',
      retention: '[data-key="retention"]',
      mcp: '[data-key="none"]',
      language: '[data-expander="language"]',
      shortcuts: '[data-key="shortcut-filter"]',
      about: '[data-key="version"]',
    }
    for (const [name, row] of Object.entries(rows)) {
      await settings.locator(`.section-item[data-section="${name}"]`).click()
      await expect(settings.locator(`main[data-section="${name}"] ${row}`), name).toBeVisible()
    }
    await settings.locator('.section-item[data-section="terminal"]').click()
    await settings.keyboard.press('ArrowDown')
    await expect(settings.locator('main[data-section="sessions"]')).toBeVisible()
    await expect(settings.locator('.section-item[aria-selected="true"]')).toHaveText('Sessions')
    await settings.keyboard.press('ArrowUp')
    await settings.keyboard.press('ArrowUp')
    await expect(settings.locator('main[data-section="appearance"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('Transcript retention (2026-11-10): the switch raises cleanupPeriodDays to 3650 and turning it off puts 30 back, the other keys untouched', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(
        join(home, '.claude', 'settings.json'),
        '{"model":"opus","cleanupPeriodDays":30}',
      )
      return undefined
    },
  })
  const { app, window: page } = launched
  try {
    const file = join(home, '.claude', 'settings.json')
    const settings = await openSettings(app, page, { type: 'openSettings', section: 'retention' })
    await expect(settings.locator('main[data-section="retention"] .row-title')).toHaveText(
      'Keep transcripts for 10 years',
    )
    await expect(settings.locator('main[data-section="retention"] .row-subtitle')).toContainText(
      'cleanupPeriodDays in ~/.claude/settings.json',
    )
    const shown = settings.locator('[data-key="retention-now"]')
    await expect(shown).toHaveText('Claude Code deletes transcripts older than 30 days')
    const toggle = settings.locator('[data-key="retention"]')
    await expect(toggle).not.toBeChecked()
    await toggle.check()
    await expect(toggle).toBeChecked()
    await expect(shown).toHaveText('Kept for 3650 days (set by Menkar)')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      model: 'opus',
      cleanupPeriodDays: 3650,
    })
    await toggle.uncheck()
    await expect(toggle).not.toBeChecked()
    // The text changes only once main has written the file and read it back.
    await expect(shown).toHaveText('Claude Code deletes transcripts older than 30 days')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ model: 'opus', cleanupPeriodDays: 30 })
    await expect(shown).toHaveText('Claude Code deletes transcripts older than 30 days')
  } finally {
    await launched.close()
  }
})

// What the section says before the user decides: always the file's value, Claude Code's default
// only when the key is absent, and our own sentence for a file it cannot read.
for (const [content, says] of [
  ['{"cleanupPeriodDays":7}', 'Claude Code deletes transcripts older than 7 days'],
  ['{"model":"opus"}', "Not set: Claude Code's default applies, currently 30 days"],
  [
    '{"cleanupPeriodDays":',
    '/settings.json could not be read, so how long Claude Code keeps transcripts is not known.',
  ],
] as const) {
  test(`Transcript retention (2026-11-10) reads ${content} as "${says}"`, async () => {
    let file = ''
    const launched = await launchApp({
      prepare: (dirs) => {
        mkdirSync(join(dirs.home, '.claude'), { recursive: true })
        file = join(dirs.home, '.claude', 'settings.json')
        writeFileSync(file, content)
        return undefined
      },
    })
    try {
      const settings = await openSettings(launched.app, launched.window, {
        type: 'openSettings',
        section: 'retention',
      })
      await expect(settings.locator('[data-key="retention-now"]')).toContainText(says)
      expect(readFileSync(file, 'utf8')).toBe(content)
    } finally {
      await launched.close()
    }
  })
}

for (const style of ['tui', 'classic'] as const) {
  for (const scheme of ['dark', 'light'] as const) {
    test(`Settings (2026-11-10), ${style} ${scheme} (screenshot)`, async () => {
      const launched = await launchApp({
        prepare: ({ root }) => {
          mkdirSync(join(root, 'config', 'menkar'), { recursive: true })
          writeFileSync(
            join(root, 'config', 'menkar', 'state.json'),
            JSON.stringify({ settings: { ui_style: style, color_scheme: scheme } }),
          )
          return undefined
        },
      })
      try {
        const settings = await openSettings(launched.app, launched.window)
        await settings.setViewportSize({ width: 860, height: 640 })
        await settings.locator('[data-expander="ui_style"] summary').click()
        await settings.waitForTimeout(300)
        mkdirSync('/tmp/menkar-shots', { recursive: true })
        await settings.screenshot({ path: `/tmp/menkar-shots/settings-${style}-${scheme}.png` })
        await settings.locator('.section-item[data-section="retention"]').click()
        await settings.locator('[data-key="retention-now"]').waitFor()
        await settings.screenshot({
          path: `/tmp/menkar-shots/settings-${style}-${scheme}-retention.png`,
        })
      } finally {
        await launched.close()
      }
    })
  }
}

// Native dropdown lists are drawn by Chromium, in the page's color-scheme: without one a dark
// page's white option text sat on a white list (2026-11-10). The popup itself does not render
// under xvfb, so its options' own colours and the scheme are what is checked; the look on the
// screen is the human's check.
for (const scheme of ['dark', 'light'] as const) {
  test(`every dropdown's options read on their list, ${scheme} (4.5:1), and the page's color-scheme is ${scheme}`, async () => {
    const launched = await launchApp({
      prepare: ({ root }) => {
        mkdirSync(join(root, 'config', 'menkar'), { recursive: true })
        writeFileSync(
          join(root, 'config', 'menkar', 'state.json'),
          JSON.stringify({
            settings: {
              color_scheme: scheme,
              terminal_theme: scheme === 'light' ? 'Catppuccin Latte' : 'Catppuccin Mocha',
            },
          }),
        )
        return undefined
      },
    })
    try {
      const settings = await openSettings(launched.app, launched.window)
      const found = await settings.evaluate(() => {
        const hex = (rgb: string) => {
          const [r = 255, g = 255, b = 255, a = 1] = (rgb.match(/[\d.]+/g) ?? []).map(Number)
          // A transparent list is the native popup's own white.
          return a === 0
            ? '#ffffff'
            : `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
        }
        return {
          scheme: getComputedStyle(document.documentElement).colorScheme,
          options: [...document.querySelectorAll('select option')].map((o) => {
            const style = getComputedStyle(o)
            return { text: hex(style.color), list: hex(style.backgroundColor) }
          }),
        }
      })
      expect(found.scheme).toBe(scheme)
      expect(found.options.length).toBeGreaterThanOrEqual(8)
      for (const option of found.options)
        expect(contrast(option.text, option.list), JSON.stringify(option)).toBeGreaterThanOrEqual(
          4.5,
        )
    } finally {
      await launched.close()
    }
  })
}

test('decision 1.37: Keyboard shortcuts lists every row of the keys table, as keycaps, and the filter narrows it', async () => {
  const launched = await launchApp()
  try {
    const settings = await openSettings(launched.app, launched.window, {
      type: 'openSettings',
      section: 'shortcuts',
    })
    const listed = await settings
      .locator('[data-shortcut]')
      .evaluateAll((ns) => ns.map((n) => (n as HTMLElement).dataset.shortcut))
    expect(listed).toEqual(SHORTCUTS.map((row) => row.id))
    await expect(settings.locator('[data-shortcut="newSession"] kbd')).toHaveText([
      'Ctrl',
      'Shift',
      'T',
    ])
    await expect(settings.locator('[data-shortcut="projectSwitcher"] kbd')).toHaveText([
      'Ctrl',
      'Shift',
      'E',
    ])
    await expect(settings.locator('[data-shortcut="splitRight"] .chord')).toHaveCount(2)
    await expect(settings.locator('[data-group="prefix"] .group-title')).toHaveText('After Ctrl+B')
    const filter = settings.locator('[data-key="shortcut-filter"]')
    await filter.fill('split')
    await expect(settings.locator('[data-shortcut]:visible')).toHaveCount(2)
    await expect(settings.locator('[data-group="window"]')).toBeHidden()
    await filter.fill('zzzz')
    await expect(settings.locator('[data-key="shortcut-none"]')).toBeVisible()
    await filter.fill('')
    await expect(settings.locator('[data-shortcut]:visible')).toHaveCount(SHORTCUTS.length)
    mkdirSync('/tmp/menkar-shots', { recursive: true })
    // The page is long: shown from its top, once the window has drawn it again.
    await settings.evaluate(() => document.querySelector('.settings > main')?.scrollTo(0, 0))
    await settings.bringToFront()
    await settings.waitForTimeout(300)
    const png = await launched.app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Settings')
      window?.show()
      return window ? (await window.webContents.capturePage()).toPNG().toString('base64') : ''
    })
    writeFileSync('/tmp/menkar-shots/shortcuts.png', Buffer.from(png, 'base64'))
  } finally {
    await launched.close()
  }
})

test('Files (decision 1.60): the Menkar folder and the incoming folder show their defaults; Choose… saves a folder and says nothing was moved; Bring in and the trash days are saved, an out-of-range day count is not', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return {}
    },
  })
  const { app, window: page } = launched
  try {
    const chosen = join(root, 'chosen-root')
    mkdirSync(chosen, { recursive: true })
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as never
    }, chosen)
    const settings = await openSettings(app, page, { type: 'openSettings', section: 'files' })
    const home = await app.evaluate(({ app: a }) => a.getPath('home'))
    await expect(settings.locator('[data-path="files_root"]')).toHaveText(join(home, 'Menkar'))
    await expect(settings.locator('[data-path="files_incoming"]')).toHaveText(
      await app.evaluate(({ app: a }) => a.getPath('downloads')),
    )
    await settings.locator('button[data-key="files_root"]').click()
    await expect(settings.locator('[data-path="files_root"]')).toHaveText(chosen)
    await expect(settings.locator('[data-note="files_root"]')).toHaveText(
      `Nothing was moved: the old folder stays at ${join(home, 'Menkar')}.`,
    )
    await settings.locator('[data-expander="files_bring"] summary').click()
    await settings.locator('input[name="files_bring"][value="newest"]').check()
    const days = settings.locator('input[data-key="files_trash_days"]')
    await days.fill('400')
    await days.press('Enter')
    await expect(days).toHaveValue('30')
    await days.fill('7')
    await days.press('Enter')
    const saved = () =>
      JSON.parse(readFileSync(join(root, 'config', 'menkar', 'state.json'), 'utf8')).settings
    await expect
      .poll(() => {
        const s = saved()
        return [s.files_root, s.files_bring, s.files_trash_days]
      })
      .toEqual([chosen, 'newest', 7])
  } finally {
    await launched.close()
  }
})
