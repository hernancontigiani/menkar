import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'

// The Usage window's left bar (decision 1.184): Spend, Your time and Task times, the scope at its
// foot, and the period carried from one section to another, on the real app in a temporary HOME.
// Screenshots land in test-results/usage-sections/.

const SHOTS = 'test-results/usage-sections'

// Two projects with a session each, an hour ago; the window opens on Shop.
function twoProjects(root: string, home: string, scheme: 'dark' | 'light' = 'dark'): void {
  const dir = join(home, '.claude', 'projects', '-home-demo-app')
  mkdirSync(dir, { recursive: true })
  const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
  for (const id of ['shop-1', 'blog-1']) {
    const lines = [
      { type: 'user', uuid: `${id}-u`, timestamp: at(60), turnOrigin: 'human', message: {} },
      {
        type: 'assistant',
        timestamp: at(50),
        requestId: `req-${id}`,
        message: { id: `msg_${id}`, model: 'claude-opus-5-5', usage: { output_tokens: 100 } },
      },
    ]
    writeFileSync(join(dir, `${id}.jsonl`), `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
  }
  const config = join(root, 'config', 'menkar')
  mkdirSync(config, { recursive: true })
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: 'aaaaaaaaaaa1',
      projects: [
        { id: 'aaaaaaaaaaa1', name: 'Shop', members: ['shop-1'], groups: [] },
        { id: 'aaaaaaaaaaa2', name: 'Blog', members: ['blog-1'], groups: [] },
      ],
      windows: [],
    }),
  )
  writeFileSync(
    join(config, 'state.json'),
    JSON.stringify({
      settings: {
        color_scheme: scheme,
        terminal_theme: scheme === 'light' ? 'Catppuccin Latte' : 'Catppuccin Mocha',
      },
    }),
  )
}

async function openUsage(app: ElectronApplication, page: Page): Promise<Page> {
  const [usage] = await Promise.all([
    app.waitForEvent('window'),
    page.evaluate(() =>
      (
        window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act({ type: 'openUsage' }),
    ),
  ])
  await usage.waitForLoadState('domcontentloaded')
  await expect(usage.locator('.usage-row.project').first()).toBeVisible()
  return usage
}

// A window just shown may not be capturable at once: one retry after a short pause.
async function shot(page: Page, path: string): Promise<void> {
  try {
    await page.screenshot({ path })
  } catch {
    await page.waitForTimeout(500)
    await page.screenshot({ path })
  }
}

const pressed = (page: Page, group: string) =>
  page.locator(`[data-toggles="${group}"] [aria-pressed="true"]`)
const section = (page: Page, name: string) => page.locator(`[data-section="${name}"][role="tab"]`)

interface Ask {
  readonly channel: string
  readonly request: {
    readonly allProjects: boolean
    readonly which?: { kind: string; day?: unknown; first?: unknown }
    readonly period?: string
  }
}

// Every ask of the three sections is recorded in main; `hold` keeps a channel's answers back.
async function record(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    type Handler = (event: unknown, request: unknown) => unknown
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })
      ._invokeHandlers
    const g = globalThis as unknown as {
      asks: { channel: string; request: unknown }[]
      hold: Record<string, number>
    }
    g.asks = []
    g.hold = {}
    for (const channel of ['usage:view', 'usage:activity', 'usage:flow']) {
      const original = handlers.get(channel)
      if (!original) throw new Error(`no ${channel} handler`)
      handlers.set(channel, async (event, request) => {
        g.asks.push({ channel, request })
        const ms = g.hold[channel] ?? 0
        if (ms > 0) await new Promise((r) => setTimeout(r, ms))
        return original(event, request)
      })
    }
  })
}

async function hold(app: ElectronApplication, channel: string, ms: number): Promise<void> {
  await app.evaluate(
    (_electron, { channel, ms }) => {
      ;(globalThis as unknown as { hold: Record<string, number> }).hold[channel] = ms
    },
    { channel, ms },
  )
}

const asks = (app: ElectronApplication): Promise<Ask[]> =>
  app.evaluate(() => (globalThis as unknown as { asks: Ask[] }).asks)

const lastAsk = async (app: ElectronApplication, channel: string): Promise<Ask | undefined> =>
  (await asks(app)).filter((a) => a.channel === channel).at(-1)

function localToday(): { year: number; month: number; day: number } {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

function sixDaysAgo(): { year: number; month: number; day: number } {
  const d = new Date()
  const back = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6)
  return { year: back.getFullYear(), month: back.getMonth() + 1, day: back.getDate() }
}

test('decisions 1.184, 1.200: the window opens on Spend, Today; the left bar is 180 px; each section has its own period', async () => {
  for (const scheme of ['dark', 'light'] as const) {
    const launched = await launchApp({
      prepare: ({ root, home }) => {
        twoProjects(root, home, scheme)
        return undefined
      },
    })
    try {
      const usage = await openUsage(launched.app, launched.window)
      await expect(section(usage, 'spend')).toHaveAttribute('aria-selected', 'true')
      await expect(section(usage, 'time')).toHaveAttribute('aria-selected', 'false')
      await expect(usage.locator('[role="tab"]')).toHaveText(['Spend', 'Your time', 'Task times'])
      await expect(usage.locator('[data-key="usage-title"]')).toHaveText('Usage')
      await expect(pressed(usage, 'period')).toHaveText('Today')
      const side = await usage.locator('.settings-side').boundingBox()
      expect(side?.width).toBe(180)
      await shot(usage, `${SHOTS}/spend-${scheme}.png`)

      await section(usage, 'time').click()
      await expect(section(usage, 'time')).toHaveAttribute('aria-selected', 'true')
      await expect(usage.locator('[data-toggles="period"] button')).toHaveText(['Today', 'Week'])
      await expect(pressed(usage, 'period')).toHaveText('Today')
      await expect(usage.locator('[data-key="loading"]')).toHaveCount(0)
      await shot(usage, `${SHOTS}/time-${scheme}.png`)

      // Up and Down move through the bar, as in Settings
      await section(usage, 'time').focus()
      await usage.keyboard.press('ArrowDown')
      await expect(section(usage, 'tasks')).toHaveAttribute('aria-selected', 'true')
      await expect(section(usage, 'tasks')).toBeFocused()
      await expect(usage.locator('[data-toggles="period"] button')).toHaveText([
        'Today',
        '7 days',
        '30 days',
      ])
      await expect(pressed(usage, 'period')).toHaveText('Today')
      await expect(usage.locator('[data-key="loading"]')).toHaveCount(0)
      await shot(usage, `${SHOTS}/tasks-${scheme}.png`)
      await usage.keyboard.press('ArrowUp')
      await usage.keyboard.press('ArrowUp')
      await expect(section(usage, 'spend')).toHaveAttribute('aria-selected', 'true')
      await expect(usage.locator('.usage-row.project')).toHaveCount(1)
    } finally {
      await launched.close()
    }
  }
})

test('decision 1.184: the scope sits at the foot of the left bar and is carried to every section', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      twoProjects(root, home)
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    await record(launched.app)
    const foot = usage.locator('.settings-side [data-key="scope"]')
    await expect(foot).toContainText('Projects')
    await expect(foot.locator('button')).toHaveText(['Shop', 'All projects'])
    const mine = foot.locator('[data-key="this-project"]')
    const all = foot.locator('[data-key="all-projects"]')
    await expect(mine).toHaveAttribute('aria-pressed', 'true')
    await expect(all).toHaveAttribute('aria-pressed', 'false')
    await expect(usage.locator('.usage-row.project .name')).toHaveText(['Shop'])

    await all.click()
    await expect(all).toHaveAttribute('aria-pressed', 'true')
    await expect(mine).toHaveAttribute('aria-pressed', 'false')
    await expect(usage.locator('.usage-row.project .name')).toHaveText(['Blog', 'Shop'])
    await shot(usage, `${SHOTS}/scope-all-dark.png`)

    await section(usage, 'time').click()
    await expect
      .poll(async () => (await lastAsk(launched.app, 'usage:activity'))?.request)
      .toEqual(expect.objectContaining({ allProjects: true }))
    await expect(all).toHaveAttribute('aria-pressed', 'true')
    await section(usage, 'tasks').click()
    await expect
      .poll(async () => (await lastAsk(launched.app, 'usage:flow'))?.request)
      .toEqual(expect.objectContaining({ allProjects: true }))
    await expect(all).toHaveAttribute('aria-pressed', 'true')

    await mine.click()
    await expect(mine).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () => (await lastAsk(launched.app, 'usage:flow'))?.request)
      .toEqual(expect.objectContaining({ allProjects: false }))
    await section(usage, 'spend').click()
    await expect(usage.locator('.usage-row.project .name')).toHaveText(['Shop'])
  } finally {
    await launched.close()
  }
})

test('decision 1.184: with no opener left, Usage shows every project and has no foot', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      twoProjects(root, home)
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    await expect(usage.locator('[data-key="scope"]')).toBeVisible()
    await launched.window.evaluate(() =>
      (
        window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act({ type: 'newWindowWithProject', name: 'Second' }),
    )
    await expect.poll(() => launched.app.windows().length).toBe(3)
    await launched.app.evaluate(({ BrowserWindow }) => {
      const mains = BrowserWindow.getAllWindows().filter((w) => w.getTitle() !== 'Usage')
      mains.sort((a, b) => a.id - b.id)[0]?.destroy()
    })
    await expect(usage.locator('[data-key="scope"]')).toHaveCount(0, { timeout: 10_000 })
    await expect(usage.locator('.usage-row.project .name')).toHaveText(['Blog', 'Shop'])
    await section(usage, 'tasks').click()
    await expect(usage.locator('[data-key="loading"]')).toHaveCount(0)
    await expect(usage.locator('[data-key="scope"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('decision 1.184: a chosen period is carried where the other section has it; one merely shown is not', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      twoProjects(root, home)
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    await record(launched.app)
    const period = (value: string) =>
      usage.locator(`[data-toggles="period"] [data-value="${value}"]`)

    // Spend 30 days, chosen → Task times takes it
    await period('30d').click()
    await expect(pressed(usage, 'period')).toHaveText('30 days')
    await section(usage, 'tasks').click()
    await expect(pressed(usage, 'period')).toHaveText('30 days')
    await expect
      .poll(async () => (await lastAsk(launched.app, 'usage:flow'))?.request.period)
      .toBe('30d')
    // → Your time has no 30 days: it keeps its own day, today
    await section(usage, 'time').click()
    await expect(pressed(usage, 'period')).toHaveText('Today')

    // Spend Month (chosen) → Task times keeps its own 30 days → back to Spend: still Month
    await section(usage, 'spend').click()
    await period('month').click()
    await expect(usage.locator('[data-key="month-name"]')).toBeVisible()
    await section(usage, 'tasks').click()
    await expect(pressed(usage, 'period')).toHaveText('30 days')
    await section(usage, 'spend').click()
    await expect(pressed(usage, 'period')).toHaveText('Month')
    await expect(usage.locator('[data-key="month-name"]')).toBeVisible()

    // Spend Today (chosen) → Your time opens today's Day
    await period('today').click()
    await expect(pressed(usage, 'period')).toHaveText('Today')
    await section(usage, 'time').click()
    await expect(pressed(usage, 'period')).toHaveText('Today')
    await expect
      .poll(async () => (await lastAsk(launched.app, 'usage:activity'))?.request.which)
      .toEqual({ kind: 'day', day: localToday() })
    // Your time on today's Day (carried) → Task times Today → Spend Today → Your time today's Day
    await section(usage, 'tasks').click()
    await expect(pressed(usage, 'period')).toHaveText('Today')
    await expect
      .poll(async () => (await lastAsk(launched.app, 'usage:flow'))?.request.period)
      .toBe('today')
    await section(usage, 'spend').click()
    await expect(pressed(usage, 'period')).toHaveText('Today')
    await section(usage, 'time').click()
    await expect(pressed(usage, 'period')).toHaveText('Today')

    // Your time Week (chosen, the current one) → Spend 7 days and Task times 7 days
    await period('week').click()
    await expect
      .poll(async () => (await lastAsk(launched.app, 'usage:activity'))?.request.which)
      .toEqual({ kind: 'week', first: sixDaysAgo() })
    await section(usage, 'spend').click()
    await expect(pressed(usage, 'period')).toHaveText('7 days')
    await section(usage, 'tasks').click()
    await expect(pressed(usage, 'period')).toHaveText('7 days')
    await shot(usage, `${SHOTS}/carried-dark.png`)
  } finally {
    await launched.close()
  }
})

test('decision 1.131: a late answer to an older section is dropped; the star shows, the bars stay usable', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      twoProjects(root, home)
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    await record(launched.app)
    const star = usage.locator('[data-key="loading"]')

    // Your time's answer held back: the star turns, the left bar and the foot still answer
    await hold(launched.app, 'usage:activity', 1500)
    await section(usage, 'time').click()
    await expect(star).toBeVisible()
    await expect(pressed(usage, 'period')).toHaveText('Today')
    await expect(usage.locator('[data-key="all-projects"]')).toBeEnabled()
    await expect(star).toHaveCSS('opacity', '1')
    await shot(usage, `${SHOTS}/loading-dark.png`)
    // Spend at once: Your time's answer, when it comes, is never drawn
    await usage.evaluate(() => {
      const g = window as unknown as { drawnTime: boolean }
      g.drawnTime = false
      new MutationObserver(() => {
        if (document.querySelector('main.usage-body[data-section="time"]')) g.drawnTime = true
      }).observe(document.body, { childList: true, subtree: true })
    })
    await section(usage, 'spend').click()
    await expect(section(usage, 'spend')).toHaveAttribute('aria-selected', 'true')
    await expect(usage.locator('.usage-row.project')).toHaveCount(1)
    await expect
      .poll(async () => (await asks(launched.app)).filter((a) => a.channel === 'usage:activity'))
      .toHaveLength(1)
    await usage.waitForTimeout(2000)
    expect(
      await usage.evaluate(() => (window as unknown as { drawnTime: boolean }).drawnTime),
    ).toBe(false)
    await expect(section(usage, 'spend')).toHaveAttribute('aria-selected', 'true')

    // The other order: Spend's answer is the slower one. Task times' answer arriving first does
    // not end Spend's wait.
    await hold(launched.app, 'usage:activity', 0)
    await hold(launched.app, 'usage:flow', 800)
    await hold(launched.app, 'usage:view', 3000)
    await section(usage, 'tasks').click()
    await section(usage, 'spend').click()
    await expect(star).toBeVisible()
    await usage.waitForTimeout(1500)
    await expect(star).toBeVisible()
    await expect(usage.locator('.usage-table')).toHaveCount(0)
    await expect(star).toHaveCount(0, { timeout: 5000 })
    await expect(usage.locator('.usage-row.project')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})
