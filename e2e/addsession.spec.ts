import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi, ProjectsSnapshot } from '../src/shared/ipc'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'

type PageGlobals = { menkar: MenkarApi }
const SITE = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a'
const FREE = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

let home = ''

// "Client work" holds "fix the login bug" (folder work); "Research" holds "site" (folder
// todo-api); "loose" (todo-api too) is in no project.
function threeSessions(dirs: {
  readonly root: string
  readonly home: string
}): Record<string, string> {
  home = dirs.home
  const env = prepare(dirs)
  const api = join(dirs.home, 'todo-api')
  mkdirSync(api, { recursive: true })
  const transcripts = join(dirs.home, '.claude', 'projects', api.replace(/[^A-Za-z0-9]/g, '-'))
  mkdirSync(transcripts, { recursive: true })
  const write = (id: string, title: string, text: string) =>
    writeFileSync(
      join(transcripts, `${id}.jsonl`),
      `${JSON.stringify({ type: 'custom-title', customTitle: title })}\n${JSON.stringify({ type: 'user', cwd: api, message: { content: text } })}\n`,
    )
  write(SITE, 'site', 'add auth')
  write(FREE, 'loose', 'a loose end')
  mkdirSync(join(transcripts, SITE, 'subagents'), { recursive: true })
  writeFileSync(join(transcripts, SITE, 'subagents', 'agent-a1.jsonl'), '{}\n')
  writeFileSync(
    join(dirs.root, 'config', 'menkar', 'projects.json'),
    JSON.stringify({
      version: 1,
      current: 'aaaaaaaaaaaa',
      projects: [
        { id: 'aaaaaaaaaaaa', name: 'Client work', members: [SESSION], groups: [] },
        { id: 'bbbbbbbbbbbb', name: 'Research', members: [SITE], groups: [] },
      ],
      windows: [],
    }),
  )
  return env
}

const snapshot = (page: Page): Promise<ProjectsSnapshot> =>
  page.evaluate(() => (globalThis as unknown as PageGlobals).menkar.projects.get())
const membersOf = async (page: Page, name: string) =>
  (await snapshot(page)).projects.find((p) => p.name === name)?.members ?? []

async function openExisting(page: Page): Promise<void> {
  await page.locator('#add-session').click()
  await expect(page.locator('.add-session .heading')).toHaveText('Add a session to Client work')
}

test('SES-23, SES-24, SES-28, SES-31 groups collapsed at first; Add makes it Added and keeps the dialog open; the count line', async () => {
  const launched = await launchApp({ prepare: threeSessions })
  const page = launched.window
  try {
    await openExisting(page)
    await expect(page.locator('.history-group')).toHaveCount(2)
    await expect(page.locator('.history-row')).toHaveCount(0)
    await expect(page.locator('.history-group').first()).toContainText('TODO-API')
    await expect(page.locator('.count-line')).toHaveText(/^3 sessions · 2 projects · \d+ B$/)
    await page.locator('.history-group', { hasText: 'TODO-API' }).click()
    const loose = page.locator('.history-row', { hasText: 'loose' })
    await expect(loose.locator('.pick')).toHaveText('Add')
    await loose.locator('.pick').click()
    await expect(loose.locator('.pick')).toHaveText('Added')
    await expect(loose.locator('.pick')).toBeDisabled()
    await expect(page.locator('.add-session')).toBeVisible()
    expect(await membersOf(page, 'Client work')).toEqual([SESSION, FREE])
    await expect(page.locator('.tab')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('SES-32 Move from Research takes the session into this project only', async () => {
  const launched = await launchApp({ prepare: threeSessions })
  const page = launched.window
  try {
    await openExisting(page)
    await page.locator('.history-group', { hasText: 'TODO-API' }).click()
    const site = page.locator('.history-row', { hasText: 'site' })
    await expect(site.locator('.pick')).toHaveText('Move from Research')
    await site.locator('.pick').click()
    await expect(site.locator('.pick')).toHaveText('Added')
    expect(await membersOf(page, 'Research')).toEqual([])
    expect(await membersOf(page, 'Client work')).toEqual([SESSION, SITE])
  } finally {
    await launched.close()
  }
})

test('SES-36, SES-37, SES-38, TRM-1 New: the folders, Enter takes the first, an empty name is refused, Start opens the tab', async () => {
  const launched = await launchApp({ prepare: threeSessions })
  const page = launched.window
  try {
    await page.locator('#strip-plus').click()
    await expect(page.locator('.folder-row')).toHaveCount(3)
    await expect(page.locator('.folder-row').last()).toHaveText('Another folder…')
    await page.locator('.add-session input').first().fill('work')
    await page.locator('.add-session input').first().press('Enter')
    await expect(page.locator('.add-session .form-row.folder')).toContainText('work')
    await page.locator('.add-session .pill').click()
    await expect(page.locator('.add-session .error-line')).toHaveText(
      'Give the session a name: sessions find each other by it.',
    )
    await page.locator('.add-session .form-row input').fill('api')
    await page.locator('.add-session .form-row input').press('Enter')
    await expect(page.locator('.add-session')).toHaveCount(0)
    await expect(page.locator('.tab.selected')).toHaveText(/api/)
    await expect
      .poll(() =>
        existsSync(join(home, 'claude-args.txt'))
          ? readFileSync(join(home, 'claude-args.txt'), 'utf8')
          : '',
      )
      .toMatch(/-n api /)
  } finally {
    await launched.close()
  }
})

test('SES-48-like details from the history menu', async () => {
  const launched = await launchApp({ prepare: threeSessions })
  const page = launched.window
  try {
    await openExisting(page)
    await page.locator('.history-group', { hasText: 'TODO-API' }).click()
    await page.locator('.history-row', { hasText: 'site' }).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Details…' }).click()
    await expect(page.locator('.details-body')).toContainText('1 user · 0 assistant')
    await page.locator('.details .responses button').click()
  } finally {
    await launched.close()
  }
})

function snapshotTree(dir: string, out = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) snapshotTree(path, out)
    else out.set(path, `${st.mtimeMs}:${readFileSync(path, 'base64')}`)
  }
  return out
}

test('SES-65 Delete permanently, confirmed, removes only that .jsonl; nothing else under ~/.claude changes', async () => {
  const launched = await launchApp({ prepare: threeSessions })
  const page = launched.window
  try {
    const claude = join(home, '.claude')
    const before = snapshotTree(claude)
    expect(before.size).toBeGreaterThan(3)
    await openExisting(page)
    await page.locator('.history-group', { hasText: 'TODO-API' }).click()
    await page.locator('.history-row', { hasText: 'site' }).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Delete permanently…' }).click()
    await expect(page.locator('[role="alertdialog"] .heading')).toHaveText(
      'Delete session permanently?',
    )
    await page.locator('[role="alertdialog"] button', { hasText: 'Delete permanently' }).click()
    await expect(page.locator('.history-row', { hasText: 'site' })).toHaveCount(0)
    const after = snapshotTree(claude)
    const removed = [...before.keys()].filter((path) => !after.has(path))
    expect(removed.map((p) => p.split('/').pop())).toEqual([`${SITE}.jsonl`])
    for (const [path, value] of after) expect(before.get(path), path).toBe(value)
    expect(await membersOf(page, 'Research')).toEqual([SITE])
  } finally {
    await launched.close()
  }
})

test('SES-67, SES-69 select mode: All checks the rows shown; leaving clears the selection', async () => {
  const launched = await launchApp({ prepare: threeSessions })
  const page = launched.window
  try {
    await openExisting(page)
    await page.locator('.history-group', { hasText: 'TODO-API' }).click()
    await page.locator('.search-row button[title="Select sessions"]').click()
    await page.locator('.select-bar button', { hasText: 'All' }).click()
    await expect(page.locator('.selected-count')).toHaveText('2 selected')
    await page.locator('.search-row button[title="Select sessions"]').click()
    await page.locator('.search-row button[title="Select sessions"]').click()
    await expect(page.locator('.selected-count')).toHaveText('0 selected')
  } finally {
    await launched.close()
  }
})
