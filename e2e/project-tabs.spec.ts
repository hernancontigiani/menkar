// Plan 25 part 2, decision 1.32: a window keeps every project's tabs across a restart, and a
// project's saved tabs start the first time the window shows it.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { type LaunchedApp, launchApp } from './app'
import { CLIENT, clientWork } from './fixtures'

const A = 'cccccccccccc'
const B = 'dddddddddddd'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

// One window with a tab in A ("login fix") and one in B (the long name), showing B.
function twoProjects(dirs: { readonly root: string; readonly home: string }) {
  const env = clientWork(dirs)
  writeFileSync(
    join(dirs.root, 'config', 'menkar', 'projects.json'),
    JSON.stringify({
      version: 1,
      current: B,
      projects: [
        { id: A, name: 'Alpha', members: [CLIENT.login, CLIENT.api], groups: [] },
        { id: B, name: 'Beta', members: [CLIENT.long], groups: [] },
      ],
      windows: [
        {
          current: B,
          tabs: {
            [A]: [{ panes: [CLIENT.login], orientation: 'horizontal' }],
            [B]: [{ panes: [CLIENT.long], orientation: 'horizontal' }],
          },
        },
      ],
    }),
  )
  return env
}

const args = (home: string) =>
  existsSync(join(home, 'claude-args.txt'))
    ? readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n')
    : []
const savedTabs = (root: string) =>
  JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')).windows?.[0]
    ?.tabs ?? {}

async function launch(prepare = twoProjects) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      return prepare(dirs)
    },
  })
  await expect(launched.window.locator('.tab')).toHaveCount(1)
  return { launched, page: launched.window, root, home }
}

test('PRJ-66 (plan 25) each project keeps its tabs: after a restart, switching back to the other project shows its tab', async () => {
  const first = await launch()
  let root = first.root
  let second: LaunchedApp | null = null
  let saved = ''
  try {
    await expect(first.page.locator('.tab')).toContainText('abcdefghij')
    await act(first.page, { type: 'switchProject', project: A })
    await expect(first.page.locator('.tab')).toHaveText(/login fix/)
    await act(first.page, { type: 'switchProject', project: B })
    await expect(first.page.locator('.tab')).toContainText('abcdefghij')
    root = first.root
    // Saved as the layout changes: the second start reads what the first one wrote.
    await expect.poll(() => Object.keys(savedTabs(root)).sort()).toEqual([A, B].sort())
    saved = mkdtempSync(join(tmpdir(), 'menkar-prj66-'))
    const config = join(saved, 'config')
    cpSync(join(root, 'config'), config, { recursive: true })
    await first.launched.close()
    second = await launchApp({
      prepare: (dirs) => {
        const env = clientWork(dirs)
        cpSync(config, join(dirs.root, 'config'), { recursive: true })
        return env
      },
    })
    const page = second.window
    await expect(page.locator('.tab')).toContainText('abcdefghij')
    await act(page, { type: 'switchProject', project: A })
    await expect(page.locator('.tab')).toHaveText(/login fix/)
  } finally {
    await second?.close()
    await first.launched.close().catch(() => undefined)
    if (saved) rmSync(saved, { force: true, recursive: true })
  }
})

test('PRJ-67 (decision 1.32) only the shown project’s tabs start; another project’s start when it is first shown and keep running after; a project never shown keeps its saved tabs', async () => {
  const { launched, page, root, home } = await launch()
  try {
    await expect.poll(() => args(home).length).toBe(1)
    expect(args(home)[0]).toContain(`--resume ${CLIENT.long}`)
    await page.waitForTimeout(1000)
    expect(args(home)).toHaveLength(1)

    await act(page, { type: 'switchProject', project: A })
    await expect.poll(() => args(home).length).toBe(2)
    expect(args(home)[1]).toContain(`--resume ${CLIENT.login}`)
    const pid = readFileSync(join(home, 'claude-pid.txt'), 'utf8').trim()
    await act(page, { type: 'switchProject', project: B })
    await page.waitForTimeout(800)
    expect(existsSync(`/proc/${pid}`)).toBe(true)
    expect(args(home)).toHaveLength(2)
  } finally {
    await launched.close()
  }
  expect(root).not.toBe('')

  const never = await launch()
  try {
    // The start saves the layout: A's never-started tab is in it.
    await never.page.waitForTimeout(1500)
    const tabs = savedTabs(never.root)
    expect(tabs[A]).toEqual([{ panes: [CLIENT.login], orientation: 'horizontal' }])
    expect(tabs[B]).toEqual([{ panes: [CLIENT.long], orientation: 'horizontal' }])
  } finally {
    await never.launched.close()
  }
})

test('PRJ-68 (decision 1.32) Close all tabs also takes a project’s tabs that never started, with nothing left for it', async () => {
  const { launched, page, root, home } = await launch()
  try {
    await page.locator('.tab').click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Close all tabs' }).click()
    await expect(page.locator('.tab')).toHaveCount(0)
    await act(page, { type: 'switchProject', project: A })
    await page.waitForTimeout(800)
    await expect(page.locator('.tab')).toHaveCount(0)
    expect(args(home).some((line) => line.includes(CLIENT.login))).toBe(false)
    await expect.poll(() => savedTabs(root)[A] ?? []).toEqual([])
  } finally {
    await launched.close()
  }
})
