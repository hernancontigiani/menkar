import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'

// Task times (decision 1.184): how long tasks spent in each state and on whom they waited, median
// and total, over Today, 7 or 30 days, read from a seeded activity journal on the real app in a
// temporary HOME. Every moment is yesterday or earlier at a fixed local hour, so a run near midnight
// or before 10:00 draws the same; Today holds only what is still open, whose time is the day so far.
// Screenshots land in test-results/usage-tasks/.

const SHOTS = 'test-results/usage-tasks'
const SHOP = 'aaaaaaaaaaa1'
const BLOG = 'aaaaaaaaaaa2'

// Unix seconds, `back` days before today at a local hour.
function localAt(back: number, hour: number, minute = 0): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, hour, minute).getTime() / 1000
}

let ids = 0
function taskState(
  at: number,
  task: number,
  state: string,
  more: { waitKind?: string; waitRef?: string; baseline?: boolean } = {},
) {
  ids += 1
  return { v: 1, id: `seed-${ids}`, at, kind: 'task_state', projectId: SHOP, task, state, ...more }
}

// In Shop, inside the last 7 days: task 1 done after a review by the orchestrator, task 2 dropped
// while waiting on a topic, task 3 open in review on a PR's merge, task 4 known only from its
// baseline (already in progress when recording began), done after a review by the human. Task 5,
// 20 days back, counts only in 30 days.
function journal(): unknown[] {
  return [
    taskState(localAt(2, 10), 1, 'queued'),
    taskState(localAt(2, 10, 30), 1, 'in progress'),
    taskState(localAt(2, 12), 1, 'to review', { waitKind: 'orchestrator' }),
    taskState(localAt(2, 13), 1, 'done'),
    taskState(localAt(3, 9), 2, 'queued'),
    taskState(localAt(3, 9, 20), 2, 'in progress'),
    taskState(localAt(3, 10), 2, 'waiting', { waitKind: 'topic', waitRef: '4' }),
    taskState(localAt(3, 11), 2, 'dropped'),
    taskState(localAt(1, 10), 3, 'queued'),
    taskState(localAt(1, 10, 15), 3, 'in progress'),
    taskState(localAt(1, 11), 3, 'to review', { waitKind: 'pr-merge' }),
    taskState(localAt(4, 10), 4, 'in progress', { baseline: true }),
    taskState(localAt(4, 14), 4, 'to review', { waitKind: 'human' }),
    taskState(localAt(4, 15), 4, 'done'),
    taskState(localAt(20, 10), 5, 'queued'),
    taskState(localAt(20, 10, 30), 5, 'in progress'),
    taskState(localAt(20, 12), 5, 'done'),
  ]
}

// Two projects with a session each, yesterday; the window opens on `current`.
function seed(root: string, home: string, current: string, scheme: 'dark' | 'light'): void {
  const dir = join(home, '.claude', 'projects', '-home-demo-app')
  mkdirSync(dir, { recursive: true })
  const at = (hour: number) => new Date(localAt(1, hour) * 1000).toISOString()
  for (const id of ['shop-1', 'blog-1']) {
    const lines = [
      { type: 'user', uuid: `${id}-u`, timestamp: at(9), turnOrigin: 'human', message: {} },
      {
        type: 'assistant',
        timestamp: at(10),
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
      current,
      projects: [
        { id: SHOP, name: 'Shop', members: ['shop-1'], groups: [] },
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
  const activity = join(root, 'data', 'menkar', 'activity')
  mkdirSync(activity, { recursive: true })
  writeFileSync(
    join(activity, 'journal.jsonl'),
    journal()
      .map((line) => `${JSON.stringify(line)}\n`)
      .join(''),
  )
  // the start adds no baseline of its own
  writeFileSync(join(activity, 'baseline'), '')
}

async function openTaskTimes(app: ElectronApplication, page: Page): Promise<Page> {
  const [usage] = await Promise.all([
    app.waitForEvent('window'),
    page.evaluate(() =>
      (
        window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act({ type: 'openUsage' }),
    ),
  ])
  await usage.waitForLoadState('domcontentloaded')
  // The window opens on Today; Spend's 7 days, picked, carries to Task times, where the seed lies
  await usage.locator('[data-toggles="period"] [data-value="7d"]').click()
  await expect(usage.locator('.usage-row.project').first()).toBeVisible()
  await usage.locator('[data-section="tasks"][role="tab"]').click()
  await expect(usage.locator('[data-toggles="period"] [aria-pressed="true"]')).toHaveText('7 days')
  await expect(usage.locator('[data-key="flow-summary"]')).toBeVisible()
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

const row = (page: Page, state: string, waiter?: string) =>
  page.locator(
    waiter === undefined
      ? `.flow-state[data-state="${state}"]`
      : `.flow-waiter[data-state="${state}"][data-waiter="${waiter}"]`,
  )

async function figures(page: Page, state: string, waiter?: string): Promise<string[]> {
  return row(page, state, waiter)
    .locator('[data-key="tasks"], [data-key="median"], [data-key="total"]')
    .allTextContents()
}

test('decision 1.184: Task times shows the flow per state and per waiter, median and total, over Today, 7 and 30 days', async () => {
  for (const scheme of ['dark', 'light'] as const) {
    const launched = await launchApp({
      prepare: ({ root, home }) => {
        seed(root, home, SHOP, scheme)
        return undefined
      },
    })
    try {
      const usage = await openTaskTimes(launched.app, launched.window)
      const summary = usage.locator('[data-key="flow-summary"] span')
      await expect(summary).toHaveText([
        '4 task(s)',
        '2 done',
        '1 dropped',
        '1 open',
        '◦ 1 from their baseline',
      ])
      // queued: tasks 1, 2 and 3 for 30, 20 and 15 min; task 4 began from its baseline in progress
      expect(await figures(usage, 'queued')).toEqual(['3', '20m', '1.1h'])
      // in progress: 90, 40, 45 and 240 min, the median 67.5 min
      expect(await figures(usage, 'in progress')).toEqual(['4', '1.1h', '6.9h'])
      expect(await figures(usage, 'waiting')).toEqual(['1', '1.0h', '1.0h'])
      expect(await figures(usage, 'waiting', 'topic')).toEqual(['1', '1.0h', '1.0h'])
      expect(await figures(usage, 'waiting', 'session')).toEqual(['0', '—', '—'])
      // to review always lists its four waiters, an empty one dim with "—"
      await expect(usage.locator('.flow-waiter[data-state="to review"]')).toHaveCount(4)
      expect(
        await usage
          .locator('.flow-waiter[data-state="to review"]')
          .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-waiter'))),
      ).toEqual(['orchestrator', 'human', 'pr-approval', 'pr-merge'])
      expect(await figures(usage, 'to review', 'orchestrator')).toEqual(['1', '1.0h', '1.0h'])
      expect(await figures(usage, 'to review', 'human')).toEqual(['1', '1.0h', '1.0h'])
      expect(await figures(usage, 'to review', 'pr-approval')).toEqual(['0', '—', '—'])
      await expect(row(usage, 'to review', 'pr-approval').locator('.name')).toHaveClass(/dim/)
      expect((await figures(usage, 'to review', 'pr-merge'))[0]).toBe('1')
      await expect(row(usage, 'to review', 'pr-merge').locator('.name')).toHaveText('a PR’s merge')
      // the baseline's footnote carries the day it was recorded
      const date = await usage.evaluate(
        (at) =>
          new Intl.DateTimeFormat(navigator.language, { day: 'numeric', month: 'short' }).format(
            new Date(at * 1000),
          ),
        localAt(4, 10),
      )
      await expect(usage.locator('[data-key="baseline-footer"]')).toHaveText(
        `◦ 1 tasks were already open when recording started (${date}): counted from then, not from their creation.`,
      )
      await shot(usage, `${SHOTS}/7d-${scheme}.png`)

      // a fold is kept across periods
      await row(usage, 'waiting').locator('button.arrow').click()
      await expect(usage.locator('.flow-waiter[data-state="waiting"]')).toHaveCount(0)
      await expect(usage.locator('.flow-waiter[data-state="to review"]')).toHaveCount(4)

      await usage.locator('[data-toggles="period"] [data-value="30d"]').click()
      await expect(summary).toHaveText([
        '5 task(s)',
        '3 done',
        '1 dropped',
        '1 open',
        '◦ 1 from their baseline',
      ])
      expect(await figures(usage, 'queued')).toEqual(['4', '25m', '1.6h'])
      await expect(usage.locator('.flow-waiter[data-state="waiting"]')).toHaveCount(0)
      await row(usage, 'waiting').locator('button.arrow').click()
      await expect(usage.locator('.flow-waiter[data-state="waiting"]')).toHaveCount(2)
      await shot(usage, `${SHOTS}/30d-${scheme}.png`)

      // Today: only task 3, still in review on a PR's merge since yesterday; its time is today's so
      // far, so only the counts are fixed
      await usage.locator('[data-toggles="period"] [data-value="today"]').click()
      await expect(usage.locator('[data-toggles="period"] [aria-pressed="true"]')).toHaveText(
        'Today',
      )
      await expect(summary).toHaveText(['1 task(s)', '0 done', '0 dropped', '1 open'])
      expect(await figures(usage, 'queued')).toEqual(['0', '—', '—'])
      expect(await figures(usage, 'in progress')).toEqual(['0', '—', '—'])
      expect(await figures(usage, 'waiting')).toEqual(['0', '—', '—'])
      const [tasks, median, total] = await figures(usage, 'to review')
      expect(tasks).toBe('1')
      expect(median).toBe(total)
      expect(await figures(usage, 'to review', 'pr-merge')).toEqual([tasks, median, total])
      expect(await figures(usage, 'to review', 'orchestrator')).toEqual(['0', '—', '—'])
      await expect(usage.locator('[data-key="baseline-footer"]')).toHaveCount(0)
      await shot(usage, `${SHOTS}/today-${scheme}.png`)
    } finally {
      await launched.close()
    }
  }
})

test('decision 1.184: a project with no tasks shows the empty card and says where tasks come from', async () => {
  for (const scheme of ['dark', 'light'] as const) {
    const launched = await launchApp({
      prepare: ({ root, home }) => {
        seed(root, home, BLOG, scheme)
        return undefined
      },
    })
    try {
      const usage = await openTaskTimes(launched.app, launched.window)
      await expect(usage.locator('[data-key="flow-summary"]')).toHaveText('0 task(s)')
      await expect(usage.locator('[data-key="flow-empty"]')).toHaveText(
        'No tasks in this project in these 7 days.',
      )
      await expect(usage.locator('[data-key="footer"]')).toHaveText(
        'Tasks exist in projects with the orchestration mode on.',
      )
      await expect(usage.locator('.flow-row')).toHaveCount(0)
      await shot(usage, `${SHOTS}/empty-${scheme}.png`)
      await usage.locator('[data-toggles="period"] [data-value="30d"]').click()
      await expect(usage.locator('[data-key="flow-empty"]')).toHaveText(
        'No tasks in this project in these 30 days.',
      )
      await usage.locator('[data-toggles="period"] [data-value="today"]').click()
      await expect(usage.locator('[data-key="flow-empty"]')).toHaveText(
        'No tasks in this project today.',
      )
      await usage.locator('[data-toggles="period"] [data-value="30d"]').click()
      // every project has Shop's tasks
      await usage.locator('[data-key="all-projects"]').click()
      await expect(usage.locator('[data-key="flow-summary"] span').first()).toHaveText('5 task(s)')
    } finally {
      await launched.close()
    }
  }
})
