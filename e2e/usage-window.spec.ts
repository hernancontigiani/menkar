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

async function openUsage(app: ElectronApplication, page: Page): Promise<Page> {
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
