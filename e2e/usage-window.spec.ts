import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'

// The Usage window on the real app (docs/spec/usage.md, USG-39, USG-44 to USG-53), over synthetic
// transcripts in a temporary HOME. Screenshots land in test-results/usage/ to compare with
// docs/spec/img/usage-*.png.

function transcripts(home: string): void {
  const dir = join(home, '.claude', 'projects', '-home-demo-app')
  mkdirSync(dir, { recursive: true })
  const now = Date.now()
  for (const [session, startMinutesAgo, origin] of [
    ['session-a', 120, 'human'],
    ['session-b', 90, 'peer'],
  ] as const) {
    const at = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
    const lines = [
      {
        type: 'user',
        uuid: `${session}-1`,
        timestamp: at(startMinutesAgo),
        turnOrigin: origin,
        message: { content: 'work' },
      },
      {
        type: 'assistant',
        timestamp: at(startMinutesAgo - 30),
        requestId: `req-${session}`,
        message: { id: `msg_${session}`, model: 'claude-opus-5-5', usage: { output_tokens: 1500 } },
      },
      { type: 'custom-title', customTitle: `name of ${session}` },
    ]
    writeFileSync(
      join(dir, `${session}.jsonl`),
      `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
    )
  }
}

// Usage opens on the opener window's project (decision 1.15); the cases written for every project
// press "All projects" first, the scope's own cases pass `scoped`.
async function openUsage(app: ElectronApplication, page: Page, scoped = false): Promise<Page> {
  const [usage] = await Promise.all([
    app.waitForEvent('window'),
    page.evaluate(() =>
      (
        window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act({
        type: 'openUsage',
      }),
    ),
  ])
  await usage.waitForLoadState('domcontentloaded')
  if (!scoped) {
    const scope = usage.locator('[data-key="all-projects"]')
    await scope.click()
    await expect(scope).toHaveAttribute('aria-pressed', 'true')
  }
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

test('USG-44, USG-52, USG-53, USG-39 Usage opens on 7 days and Totals; the table, its tooltip and collapsing', async () => {
  const launched = await launchApp({
    prepare: ({ home }) => {
      transcripts(home)
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    await expect(usage).toHaveTitle('Usage')
    await expect(pressed(usage, 'period')).toHaveText('7 days')
    await expect(pressed(usage, 'view')).toHaveText('Totals')
    const project = usage.locator('.usage-row.project')
    await expect(project).toHaveCount(1)
    await expect(project.locator('.name')).toHaveText('(no project)')
    const sessions = usage.locator('.usage-row.session')
    await expect(sessions).toHaveCount(2)
    await expect(sessions.first().locator('.w7')).toHaveAttribute(
      'title',
      /^Started by: (human|peer) 30m$/,
    )
    await expect(usage.locator('[data-key="hint"]')).toHaveText(
      'Turn on “Classify turns” in Preferences → Integrations to split each project by category.',
    )
    await shot(usage, 'test-results/usage/totals.png')

    await project.locator('.arrow').click()
    await expect(sessions).toHaveCount(0)
    await expect(project.locator('.arrow')).toHaveText('▸')
    await usage.locator('[data-toggles="view"] [data-value="chart"]').click()
    await expect(usage.locator('[data-chart]')).toBeVisible()
    await shot(usage, 'test-results/usage/by-day.png')
    await usage.locator('[data-toggles="view"] [data-value="totals"]').click()
    await expect(usage.locator('.usage-row.session')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('USG-45, USG-46, USG-47 Today by hour, Month by day with its stepper, All by month', async () => {
  const launched = await launchApp({
    prepare: ({ home }) => {
      transcripts(home)
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    await expect(usage.locator('.usage-row.project')).toHaveCount(1)
    await usage.locator('[data-toggles="view"] [data-value="chart"]').click()
    await usage.locator('[data-toggles="period"] [data-value="today"]').click()
    await expect.poll(() => usage.locator('[data-bar]').count()).toBeGreaterThanOrEqual(23)
    await usage.locator('[data-toggles="period"] [data-value="month"]').click()
    const now = new Date()
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    await expect(usage.locator('[data-bar]')).toHaveCount(days)
    const monthName = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(now)
    await expect(usage.locator('[data-key="month-name"]')).toHaveText(monthName)
    await expect(usage.locator('[data-key="next"]')).toBeDisabled()
    await expect(usage.locator('[data-key="previous"]')).toBeDisabled()
    await shot(usage, 'test-results/usage/month.png')
    await usage.locator('[data-key="all"]').click()
    await expect(usage.locator('[data-key="month-name"]')).toHaveText('All')
    await expect(usage.locator('[data-bar]')).toHaveCount(1)
    await expect(usage.locator('[data-key="next"]')).toBeDisabled()
  } finally {
    await launched.close()
  }
})

test('USG-50 no turns in the period: nothing in the table and 0m blocked', async () => {
  const launched = await launchApp()
  try {
    const usage = await openUsage(launched.app, launched.window)
    await expect(usage.locator('.nothing')).toHaveText('Nothing in this period.')
    await expect(usage.locator('[data-key="footer"]')).toContainText('Blocked waiting on you: 0m')
  } finally {
    await launched.close()
  }
})

// One session per entry: a turn `minutesAgo` back that ran `exec` minutes, in its own file.
function sessions(home: string, list: readonly { id: string; minutesAgo: number; exec: number }[]) {
  const dir = join(home, '.claude', 'projects', '-home-demo-many')
  mkdirSync(dir, { recursive: true })
  const now = Date.now()
  const at = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
  for (const { id, minutesAgo, exec } of list) {
    const lines = [
      {
        type: 'user',
        uuid: `${id}-1`,
        timestamp: at(minutesAgo),
        turnOrigin: 'human',
        message: { content: 'work' },
      },
      {
        type: 'assistant',
        timestamp: at(minutesAgo - exec),
        requestId: `req-${id}`,
        message: { id: `msg_${id}`, model: 'claude-opus-5-5', usage: { output_tokens: 100 } },
      },
    ]
    writeFileSync(join(dir, `${id}.jsonl`), `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
  }
}

test('USG-51 the footer adds the last limits Claude Code reported, rounded', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      transcripts(home)
      mkdirSync(join(root, 'cache', 'menkar'), { recursive: true })
      const at = Date.now() / 1000
      const line = (five: number, seven: number) =>
        JSON.stringify({ at, session_id: 'session-a', five_hour_pct: five, seven_day_pct: seven })
      writeFileSync(
        join(root, 'cache', 'menkar', 'usage.jsonl'),
        `${line(10, 2)}\n${line(41.4, 12.6)}\n`,
      )
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    const footer = usage.locator('[data-key="footer"]')
    await expect(footer).toContainText(
      /^Blocked waiting on you: 0m {3}5-hour limit 41% · 7-day 13%\n/,
    )
    await expect(footer).toContainText('estimate')
    // biome-ignore lint/performance/useDomNodeTextContent: the rendered text is the point: the three spaces apart must survive the layout.
    expect(await footer.innerText()).toMatch(
      /^Blocked waiting on you: 0m {3}5-hour limit 41% · 7-day 13%\n/,
    )
  } finally {
    await launched.close()
  }
})

// The query for one period is held back in main, so the two answers arrive in a chosen order.
async function delayPeriod(app: ElectronApplication, period: string, ms: number): Promise<void> {
  await app.evaluate(
    ({ ipcMain }, { period, ms }) => {
      type Handler = (event: unknown, request: { kind: string; period?: string }) => unknown
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })
        ._invokeHandlers
      const original = handlers.get('usage:view')
      if (!original) throw new Error('no usage:view handler')
      handlers.set('usage:view', async (event, request) => {
        if (request.period === period) await new Promise((r) => setTimeout(r, ms))
        return original(event, request)
      })
    },
    { period, ms },
  )
}

for (const slow of ['30d', 'today'] as const) {
  test(`USG-54 30 days then Today quickly shows only Today's report (${slow} answers last)`, async () => {
    const launched = await launchApp({
      prepare: ({ home }) => {
        sessions(home, [
          { id: 'recent', minutesAgo: 30, exec: 10 },
          { id: 'ten-days-ago', minutesAgo: 10 * 24 * 60, exec: 10 },
        ])
        return undefined
      },
    })
    try {
      const usage = await openUsage(launched.app, launched.window)
      await expect(usage.locator('.usage-row.session')).toHaveCount(1)
      await delayPeriod(launched.app, slow, 1500)
      const shown: number[] = []
      await usage.exposeFunction('sawRows', (n: number) => shown.push(n))
      await usage.evaluate(() => {
        const report = () =>
          (window as unknown as { sawRows(n: number): void }).sawRows(
            document.querySelectorAll('.usage-row.session').length,
          )
        new MutationObserver(report).observe(document.body, { childList: true, subtree: true })
      })
      await usage.locator('[data-toggles="period"] [data-value="30d"]').click()
      await usage.locator('[data-toggles="period"] [data-value="today"]').click()
      await expect(pressed(usage, 'period')).toHaveText('Today')
      await usage.waitForTimeout(2500)
      await expect(usage.locator('.usage-row.session')).toHaveCount(1)
      expect(shown).not.toContain(2)
    } finally {
      await launched.close()
    }
  })
}

test('LOOK-50 By day: the first three projects and "Other" in their fixed colors, dark and light', async () => {
  for (const scheme of ['dark', 'light'] as const) {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const launched = await launchApp({
      prepare: ({ root, home }) => {
        sessions(
          home,
          ids.map((id, i) => ({ id, minutesAgo: 120, exec: 60 - i * 5 })),
        )
        const config = join(root, 'config', 'menkar')
        mkdirSync(config, { recursive: true })
        writeFileSync(
          join(config, 'projects.json'),
          JSON.stringify({
            version: 1,
            current: 'aaaaaaaaaaa1',
            projects: ids.map((id, i) => ({
              id: `aaaaaaaaaaa${i + 1}`,
              name: `Project ${i + 1}`,
              members: [id],
              groups: [],
            })),
            windows: [],
          }),
        )
        writeFileSync(
          join(config, 'state.json'),
          JSON.stringify({ settings: { color_scheme: scheme } }),
        )
        return undefined
      },
    })
    try {
      const usage = await openUsage(launched.app, launched.window)
      await usage.locator('[data-toggles="view"] [data-value="chart"]').click()
      const items = usage.locator('.legend-item')
      await expect(items).toHaveText([
        'Project 1',
        'Project 2',
        'Project 3',
        'Project 4',
        'Project 5',
        'Other',
      ])
      const swatches = await usage
        .locator('.legend-item .swatch-square')
        .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).backgroundColor))
      const expected =
        scheme === 'dark'
          ? ['rgb(57, 135, 229)', 'rgb(217, 89, 38)', 'rgb(25, 158, 112)', 'rgb(143, 142, 138)']
          : ['rgb(42, 120, 214)', 'rgb(235, 104, 52)', 'rgb(27, 175, 122)', 'rgb(138, 137, 134)']
      expect([...swatches.slice(0, 3), swatches[5]]).toEqual(expected)
      const fills = await usage
        .locator('[data-bar] rect[rx]')
        .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).fill))
      for (const color of expected) expect(fills).toContain(color)
    } finally {
      await launched.close()
    }
  }
})

test('LOOK-51 Totals in Mocha: the rows sit on a surface0 card with 12 px corners; rows square', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      transcripts(home)
      const config = join(root, 'config', 'menkar')
      mkdirSync(config, { recursive: true })
      writeFileSync(
        join(config, 'state.json'),
        JSON.stringify({ settings: { color_scheme: 'dark', theme: 'default', ui_style: 'tui' } }),
      )
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    const card = usage.locator('.usage-list')
    await expect(card.locator('.usage-row')).toHaveCount(3)
    const look = await card.evaluate((n) => {
      const s = getComputedStyle(n)
      return { background: s.backgroundColor, radius: s.borderTopLeftRadius }
    })
    expect(look).toEqual({ background: 'rgb(49, 50, 68)', radius: '12px' })
    const rowRadii = await card
      .locator('.usage-row')
      .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).borderTopLeftRadius))
    expect(new Set(rowRadii)).toEqual(new Set(['0px']))
  } finally {
    await launched.close()
  }
})

// The window's size, from main: the content area is what the page lays out in.
async function sizeUsage(app: ElectronApplication, width: number, height: number): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      const usage = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Usage')
      usage?.setContentSize(size.width, size.height)
    },
    { width, height },
  )
}

// How far the lowest visible part of the page stops above the window's bottom edge.
const gapBelow = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const nodes = [...document.querySelectorAll(sel)]
    const bottom = Math.max(...nodes.map((n) => n.getBoundingClientRect().bottom))
    return window.innerHeight - bottom
  }, selector)

test('the Usage views fill the window: By day grows its chart, Totals its card, and both follow a resize', async () => {
  const launched = await launchApp({
    prepare: ({ home }) => {
      sessions(
        home,
        Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, minutesAgo: 60 + i, exec: 5 })),
      )
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    await expect(usage.locator('.usage-row.session')).toHaveCount(30)
    for (const [width, height] of [
      [1400, 900],
      [1000, 700],
    ] as const) {
      await sizeUsage(launched.app, width, height)
      await expect.poll(() => usage.evaluate(() => window.innerHeight)).toBe(height)
      await usage.locator('[data-toggles="view"] [data-value="totals"]').click()
      // The footer sits on the body's 12 px margin, the card reaches the footer and scrolls
      // inside; the page itself does not scroll.
      await expect.poll(() => gapBelow(usage, '.footer')).toBeLessThanOrEqual(16)
      expect(await gapBelow(usage, '.footer')).toBeGreaterThanOrEqual(8)
      expect(
        await usage.evaluate(() => {
          const card = document.querySelector('.usage-list')?.getBoundingClientRect()
          const footer = document.querySelector('.footer')?.getBoundingClientRect()
          return (footer?.top ?? 0) - (card?.bottom ?? 0)
        }),
      ).toBeLessThanOrEqual(14)
      expect(
        await usage.evaluate(() => document.scrollingElement?.scrollHeight ?? 0),
      ).toBeLessThanOrEqual(height)

      await usage.locator('[data-toggles="view"] [data-value="chart"]').click()
      await expect.poll(() => gapBelow(usage, '.footer')).toBeLessThanOrEqual(16)
      expect(await gapBelow(usage, '.footer')).toBeGreaterThanOrEqual(8)
      const chart = await usage.locator('[data-chart]').boundingBox()
      expect(chart?.height ?? 0).toBeGreaterThan(height / 2)
      expect(chart?.width ?? 0).toBeGreaterThan(width - 40)
    }
  } finally {
    await launched.close()
  }
})

// Two projects with a session each, today; the window opens on `current`, or on none.
function twoProjects(root: string, home: string, current: string | null): void {
  sessions(home, [
    { id: 'shop-1', minutesAgo: 120, exec: 30 },
    { id: 'blog-1', minutesAgo: 90, exec: 20 },
  ])
  const config = join(root, 'config', 'menkar')
  mkdirSync(config, { recursive: true })
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      ...(current ? { current } : {}),
      projects: [
        { id: 'aaaaaaaaaaa1', name: 'Shop', members: ['shop-1'], groups: [] },
        { id: 'aaaaaaaaaaa2', name: 'Blog', members: ['blog-1'], groups: [] },
      ],
      windows: [],
    }),
  )
}

test("decision 1.15: Usage shows the opener window's project; All projects shows every one", async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      twoProjects(root, home, 'aaaaaaaaaaa1')
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window, true)
    const projects = usage.locator('.usage-row.project .name')
    await expect(projects).toHaveText(['Shop'])
    await expect(usage.locator('.usage-row.session')).toHaveCount(1)
    const scope = usage.locator('[data-key="all-projects"]')
    await expect(scope).toHaveText('All projects')
    await expect(scope).toHaveAttribute('aria-pressed', 'false')

    await usage.locator('[data-toggles="view"] [data-value="chart"]').click()
    await expect(usage.locator('.legend-item')).toHaveText(['Shop'])
    await expect(usage.locator('[data-toggles="stack"] button')).toHaveText(['Project', 'Model'])

    await scope.click()
    await expect(scope).toHaveAttribute('aria-pressed', 'true')
    await expect(usage.locator('.legend-item')).toHaveText(['Blog', 'Shop'])
    await usage.locator('[data-toggles="view"] [data-value="totals"]').click()
    await expect(projects).toHaveText(['Blog', 'Shop'])
    await usage.locator('[data-toggles="period"] [data-value="30d"]').click()
    await expect(projects).toHaveText(['Blog', 'Shop'])
    await scope.click()
    await expect(projects).toHaveText(['Shop'])
  } finally {
    await launched.close()
  }
})

test('decision 1.15: with classification on, one project stacks by category; Totals keeps its tree', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      twoProjects(root, home, 'aaaaaaaaaaa1')
      writeFileSync(
        join(root, 'config', 'menkar', 'state.json'),
        JSON.stringify({ settings: { classify_since: 1 } }),
      )
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window, true)
    await expect(usage.locator('.usage-row.project .name')).toHaveText(['Shop'])
    await expect(usage.locator('.usage-row.category .name')).toHaveText(['Unclassified'])
    await usage.locator('[data-toggles="view"] [data-value="chart"]').click()
    await expect(usage.locator('.legend-item')).toHaveText(['Unclassified'])
    await expect(usage.locator('[data-toggles="stack"] button')).toHaveText(['Category', 'Model'])
    await usage.locator('[data-key="all-projects"]').click()
    await expect(usage.locator('[data-toggles="stack"] button')).toHaveText([
      'Project',
      'Category',
      'Model',
    ])
    await expect(usage.locator('.legend-item')).toHaveText(['Blog', 'Shop'])
  } finally {
    await launched.close()
  }
})

test('decision 1.15: asked from anywhere but a Usage window, the figures are every project, unscoped', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      twoProjects(root, home, 'aaaaaaaaaaa1')
      return undefined
    },
  })
  try {
    const view = await launched.window.evaluate(() =>
      (
        window as unknown as {
          menkar: {
            usage: {
              view(
                w: unknown,
                all: boolean,
              ): Promise<{
                project: unknown
                scoped: boolean
                totals: { nodes: { label: string }[] }
              }>
            }
          }
        }
      ).menkar.usage.view({ kind: 'period', period: '7d' }, false),
    )
    expect(view.project).toBeNull()
    expect(view.scoped).toBe(false)
    expect(view.totals.nodes.map((n) => n.label)).toEqual(['Blog', 'Shop'])
  } finally {
    await launched.close()
  }
})

// Plan 17: one session whose turn ran on Opus while a subagent ran on Haiku.
function twoModels(home: string): void {
  const dir = join(home, '.claude', 'projects', '-home-demo-models')
  mkdirSync(dir, { recursive: true })
  const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
  const answer = (id: string, model: string, minutes: number, output: number) => ({
    type: 'assistant',
    timestamp: at(minutes),
    requestId: `req-${id}`,
    message: { id, model, usage: { input_tokens: 1000, output_tokens: output } },
  })
  const lines = [
    {
      type: 'user',
      uuid: 'm-1',
      timestamp: at(60),
      turnOrigin: 'human',
      message: { content: 'go' },
    },
    answer('msg_opus', 'claude-opus-4-5', 50, 4000),
    answer('msg_haiku', 'claude-haiku-4-5', 45, 900),
  ]
  writeFileSync(join(dir, 'models.jsonl'), `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
}

test('plan 17: Model stacks tokens and cost, never time; Exec falls back to Project; rows list their models', async () => {
  const launched = await launchApp({
    prepare: ({ home }) => {
      twoModels(home)
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window)
    const tokens = usage.locator('.usage-row.project .w8').nth(1)
    await expect(tokens).toHaveAttribute('title', /^Opus 4\.5: \S+ · ~\$\d+\.\d\d\nHaiku 4\.5: /)

    await usage.locator('[data-toggles="view"] [data-value="chart"]').click()
    const model = usage.locator('[data-toggles="stack"] [data-value="model"]')
    await expect(model).toBeDisabled()
    await expect(model).toHaveAttribute(
      'title',
      'Time is not split by model: one turn can use several at once.',
    )
    await usage.locator('[data-toggles="metric"] [data-value="tokens"]').click()
    await expect(model).toBeEnabled()
    await model.click()
    await expect(pressed(usage, 'stack')).toHaveText('Model')
    await expect(usage.locator('.legend-item')).toHaveText(['Haiku 4.5', 'Opus 4.5'])
    await usage.locator('[data-toggles="metric"] [data-value="cost"]').click()
    await expect(usage.locator('.legend-item')).toHaveText(['Haiku 4.5', 'Opus 4.5'])

    await usage.locator('[data-toggles="metric"] [data-value="exec"]').click()
    await expect(pressed(usage, 'stack')).toHaveText('Project')
    await expect(usage.locator('.legend-item')).toHaveText(['(no project)'])
    await expect(model).toBeDisabled()
    // The fallback is a choice, not a mask: back on Tokens, the chart stays by project.
    await usage.locator('[data-toggles="metric"] [data-value="tokens"]').click()
    await expect(pressed(usage, 'stack')).toHaveText('Project')
  } finally {
    await launched.close()
  }
})

// Decision 1.24: Usage is a window of its own, not a child of the window that opened it.
const usageWindowFacts = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => {
    const usage = BrowserWindow.getAllWindows().filter((w) => w.getTitle() === 'Usage')
    return {
      count: usage.length,
      parents: usage.map((w) => w.getParentWindow()?.id ?? null),
      focused: BrowserWindow.getFocusedWindow()?.getTitle() ?? null,
    }
  })

test('decision 1.24: Usage has no parent; the main window keeps working beside it; asking again focuses the same one', async () => {
  const launched = await launchApp()
  try {
    const page = launched.window
    await openUsage(launched.app, page, true)
    expect(await usageWindowFacts(launched.app)).toMatchObject({ count: 1, parents: [null] })

    // The main window takes focus and clicks while Usage is open. (Under xvfb no window manager
    // attaches windows to each other; the desktop's own behaviour is a check by hand.)
    await launched.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.getTitle() !== 'Usage')
        ?.focus()
    })
    const sidebar = page.locator('#toggle-sidebar')
    const before = await sidebar.getAttribute('aria-pressed')
    await sidebar.click()
    await expect(sidebar).not.toHaveAttribute('aria-pressed', before ?? '')

    await page.evaluate(() =>
      (
        window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act({ type: 'openUsage' }),
    )
    await expect
      .poll(() => usageWindowFacts(launched.app))
      .toMatchObject({
        count: 1,
        focused: 'Usage',
      })
  } finally {
    await launched.close()
  }
})

test('decision 1.24: closing the window Usage was opened from leaves Usage open, now showing every project', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      twoProjects(root, home, 'aaaaaaaaaaa1')
      return undefined
    },
  })
  try {
    const usage = await openUsage(launched.app, launched.window, true)
    await expect(usage.locator('.usage-row.project .name')).toHaveText(['Shop'])
    await expect(usage.locator('[data-key="all-projects"]')).toBeVisible()
    // A second main window, so closing the first does not end the app.
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
    await expect.poll(() => usageWindowFacts(launched.app)).toMatchObject({ count: 1 })
    await expect(usage.locator('[data-key="all-projects"]')).toHaveCount(0, { timeout: 10_000 })
    await expect(usage.locator('.usage-row.project .name')).toHaveText(['Blog', 'Shop'])
  } finally {
    await launched.close()
  }
})
