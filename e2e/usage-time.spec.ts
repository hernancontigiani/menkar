import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'

// Your time (decision 1.184): the day by the hour and the week as strips, drawn from a history
// seeded yesterday and earlier at fixed local hours, on the real app in a temporary HOME.
// Screenshots land in test-results/usage-time/.

const SHOTS = 'test-results/usage-time'
const SHOP = 'aaaaaaaaaaa1'
const BLOG = 'aaaaaaaaaaa2'

// A local moment `daysBack` days ago at hh:mm, in Unix seconds.
function local(daysBack: number, hour: number, minute: number): number {
  const d = new Date()
  return (
    new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBack, hour, minute).getTime() / 1000
  )
}

function dayKey(daysBack: number): string {
  const d = new Date(local(daysBack, 12, 0) * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString()

// Yesterday, in Shop: messages at 10:05–10:52 (six in hour 10), 13:05 and 14:09; in Blog at 11:10
// and 13:40; presence marks every few minutes between them, away 12:00–12:20, two prompts
// answered, and one lone mark at 18:30. Away ends a burst: 10:05–11:58 and 12:21–14:09, then a
// tick. Three days ago, one message, so the history starts then and the day after is empty.
function seed(root: string, home: string, scheme: 'dark' | 'light'): void {
  const dir = join(home, '.claude', 'projects', '-home-demo-app')
  mkdirSync(dir, { recursive: true })
  const turns = (id: string, moments: readonly number[]) =>
    moments
      .flatMap((at, n) => [
        { type: 'user', uuid: `${id}-u${n}`, timestamp: iso(at), turnOrigin: 'human', message: {} },
        {
          type: 'assistant',
          timestamp: iso(at + 30),
          requestId: `req-${id}-${n}`,
          message: {
            id: `msg_${id}_${n}`,
            model: 'claude-opus-5-5',
            usage: { output_tokens: 100 },
          },
        },
      ])
      .map((line) => JSON.stringify(line))
      .join('\n')
  const shop = [
    local(3, 9, 0),
    ...[5, 12, 20, 31, 40, 52].map((m) => local(1, 10, m)),
    local(1, 13, 5),
    local(1, 14, 9),
  ]
  writeFileSync(join(dir, 'shop-1.jsonl'), `${turns('shop-1', shop)}\n`)
  writeFileSync(
    join(dir, 'blog-1.jsonl'),
    `${turns('blog-1', [local(1, 11, 10), local(1, 13, 40)])}\n`,
  )
  const events: Record<string, unknown>[] = []
  const event = (kind: string, at: number, extra: Record<string, unknown> = {}) =>
    events.push({ v: 1, id: `e${events.length}`, at, kind, ...extra })
  for (const [from, to] of [
    [local(1, 10, 5), local(1, 11, 58)],
    [local(1, 12, 21), local(1, 14, 9)],
  ] as const) {
    for (let at = from; at <= to; at += 7 * 60) event('present', at, { projectId: SHOP })
    event('present', to, { projectId: SHOP })
  }
  event('away', local(1, 12, 0))
  event('back', local(1, 12, 20))
  event('prompt_answered', local(1, 11, 15), {
    projectId: SHOP,
    sessionId: 'shop-1',
    blockedSeconds: 20,
    next: 'working',
  })
  event('prompt_answered', local(1, 13, 20), {
    projectId: SHOP,
    sessionId: 'shop-1',
    blockedSeconds: 8,
    next: 'working',
  })
  event('present', local(1, 18, 30), { projectId: SHOP })
  const activity = join(root, 'data', 'menkar', 'activity')
  mkdirSync(activity, { recursive: true })
  writeFileSync(
    join(activity, 'journal.jsonl'),
    `${events.map((e) => JSON.stringify(e)).join('\n')}\n`,
  )
  const config = join(root, 'config', 'menkar')
  mkdirSync(config, { recursive: true })
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: SHOP,
      projects: [
        {
          id: SHOP,
          name: 'Shop',
          members: ['shop-1'],
          groups: [],
          orchestration: { on: true, orchestrator: 'shop-1' },
        },
        { id: BLOG, name: 'Blog', members: ['blog-1'], groups: [] },
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
  // Spend opens on Today, which may hold no turn of the seed's
  await expect(usage.locator('[data-toggles="period"] [aria-pressed="true"]')).toHaveText('Today')
  return usage
}

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

async function settled(page: Page): Promise<void> {
  await expect(page.locator('[data-key="loading"]')).toHaveCount(0)
}

// The page's own clock text for a moment, so the case holds in any locale the run has.
const clock = (page: Page, seconds: number) =>
  page.evaluate(
    (at) =>
      new Intl.DateTimeFormat(navigator.language, { hour: '2-digit', minute: '2-digit' }).format(
        new Date(at * 1000),
      ),
    seconds,
  )

const dayName = (page: Page, seconds: number) =>
  page.evaluate(
    (at) =>
      new Intl.DateTimeFormat(navigator.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        ...(new Date(at * 1000).getFullYear() === new Date().getFullYear()
          ? {}
          : { year: 'numeric' }),
      }).format(new Date(at * 1000)),
    seconds,
  )

test('decision 1.184: Your time draws the day by the hour — bursts, away, the hours, the hover — and the week as strips that open a day', async () => {
  for (const scheme of ['dark', 'light'] as const) {
    const launched = await launchApp({
      prepare: ({ root, home }) => {
        seed(root, home, scheme)
        return undefined
      },
    })
    try {
      const usage = await openUsage(launched.app, launched.window)
      await usage.locator('[data-section="time"][role="tab"]').click()
      await settled(usage)
      // it opens on today; a Day stepped away from today reads Day
      await expect(pressed(usage, 'period')).toHaveText('Today')
      await usage.locator('[data-toggles="period"] [data-value="week"]').click()
      await settled(usage)

      // The week: seven days, today's last, and a Total
      await expect(pressed(usage, 'period')).toHaveText('Week')
      const rows = usage.locator('[data-day]')
      await expect(rows).toHaveCount(7)
      await expect(rows.last()).toHaveAttribute('data-day', dayKey(0))
      await expect(usage.locator('[data-key="week-total"]')).toContainText('Total')
      const yesterday = usage.locator(`[data-day="${dayKey(1)}"]`)
      await expect(yesterday.locator('[data-burst]')).toHaveCount(3)
      await expect(yesterday.locator('[data-away]')).toHaveCount(1)
      await expect(yesterday.locator('.w-messages')).toHaveText('8')
      await expect(usage.locator('[data-key="next"]')).toBeDisabled()
      // Focus (decision 1.203): Shop's messages all went to shop-1, its orchestrator
      await expect(usage.locator('.week-heading')).toContainText('Switches/h')
      await expect(yesterday.locator('.w-switches')).toHaveText('0.0')
      await expect(usage.locator(`[data-day="${dayKey(2)}"] .w-switches`)).toHaveText('—')
      const focus = usage.locator('[data-key="week-focus"]')
      await expect(focus).toHaveText(
        'This week: 0.0 switches/h · 100% to the orchestrator; the week before: no data',
      )
      await expect(
        usage.getByText('Switches/h: how often your next message, in this project'),
      ).toHaveCount(1)
      await yesterday.hover()
      await shot(usage, `${SHOTS}/week-${scheme}.png`)

      // All projects: Shop → Blog → Shop inside yesterday's two bursts is 1 + 2 switches over
      // 1h53 + 1h48 of Active, and there is no orchestrator to name
      await usage.locator('[data-key="all-projects"]').click()
      await settled(usage)
      await expect(yesterday.locator('.w-switches')).toHaveText('0.8')
      await expect(usage.locator('[data-key="week-total"] .w-switches')).toHaveText('0.8')
      await expect(focus).toHaveText('This week: 0.8 switches/h; the week before: no data')
      await shot(usage, `${SHOTS}/week-all-${scheme}.png`)
      await usage.locator('[data-key="this-project"]').click()
      await settled(usage)

      // A click on a day opens it by the hour
      await yesterday.click()
      await settled(usage)
      await expect(pressed(usage, 'period')).toHaveText('Day')
      await expect(usage.locator('[data-key="day-name"]')).toHaveText(
        await dayName(usage, local(1, 12, 0)),
      )
      const summary = usage.locator('[data-key="time-summary"]')
      await expect(summary).toContainText('3 burst(s)')
      await expect(summary).toContainText('8 messages sent')
      await expect(summary).toContainText('2 prompts answered')
      const bursts = usage.locator('[data-chart="day"] [data-burst]')
      await expect(bursts).toHaveCount(3)
      await expect(usage.locator('[data-chart="day"] [data-burst][data-tick]')).toHaveCount(1)
      await expect(usage.locator('[data-chart="day"] [data-away]')).toHaveCount(1)
      await expect(usage.locator('[data-hour="10"]')).toHaveAttribute('data-messages', '6')
      await expect(usage.locator('[data-hour="11"]')).toHaveAttribute('data-prompts', '1')
      await expect(usage.locator('[data-chart="day"] [data-key="now"]')).toHaveCount(0)
      await expect(usage.locator('[data-chart="day"] [data-hour]')).toHaveCount(24)

      // The hover on the first band: its whole span and length, its counts; this project only
      const tip = usage.locator('[data-key="burst-tip"]')
      await expect(tip).toBeHidden()
      await bursts.first().hover()
      await expect(tip).toBeVisible()
      const start = await clock(usage, local(1, 10, 5))
      const end = await clock(usage, local(1, 11, 58))
      await expect(tip).toContainText(`${start} – ${end} · 1.9h`)
      await expect(tip).toContainText('6 messages sent · 1 prompts answered')
      await expect(tip).not.toContainText('Shop')
      await shot(usage, `${SHOTS}/day-hover-${scheme}.png`)
      await usage.mouse.move(2, 2)
      await expect(tip).toBeHidden()
      await shot(usage, `${SHOTS}/day-${scheme}.png`)

      // All projects: Blog's messages count, and the hover says whose they were
      await usage.locator('[data-key="all-projects"]').click()
      await settled(usage)
      await expect(summary).toContainText('10 messages sent')
      await bursts.first().hover()
      await expect(tip).toContainText('7 messages sent · 1 prompts answered')
      await expect(tip).toContainText('Shop 6 · Blog 1')
      await shot(usage, `${SHOTS}/day-all-hover-${scheme}.png`)
      await usage.locator('[data-key="this-project"]').click()
      await settled(usage)

      // A day back is empty; the history's first day stops ‹
      await usage.locator('[data-key="previous"]').click()
      await settled(usage)
      await expect(usage.locator('[data-key="time-empty"]')).toHaveText('No activity on this day.')
      await expect(summary).toContainText('0 burst(s)')
      await expect(usage.locator('[data-chart="day"] [data-burst]')).toHaveCount(0)
      await shot(usage, `${SHOTS}/day-empty-${scheme}.png`)
      await usage.locator('[data-key="previous"]').click()
      await settled(usage)
      await expect(usage.locator('[data-key="previous"]')).toBeDisabled()
      await expect(usage.locator('[data-chart="day"] [data-burst]')).toHaveCount(1)

      // Today, reached with ›, draws the "now" line, and › stops there
      for (let n = 0; n < 3; n += 1) {
        await usage.locator('[data-key="next"]').click()
        await settled(usage)
      }
      await expect(usage.locator('[data-key="next"]')).toBeDisabled()
      await expect(usage.locator('[data-chart="day"] [data-key="now"]')).toHaveCount(1)
    } finally {
      await launched.close()
    }
  }
})
