// Decision 1.66: a sidebar row's menu moves a session's transcript to the trash or deletes it, only
// for a session with no tab; its earlier conversations go too unless the box is cleared. The
// system's trash is replaced by a move into a folder of the test's own.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { type LaunchedApp, launchApp } from './app'
import { prepare, SESSION } from './fixtures'

const KEY = '6b6b6b6b-0000-4000-8000-0000000000a1'
const EARLY = '6b6b6b6b-0000-4000-8000-0000000000a2'
const EARLIER = '6b6b6b6b-0000-4000-8000-0000000000a3'

interface Saved {
  projects: { members: string[]; earlier?: Record<string, string[]> }[]
}

async function launch(): Promise<{
  launched: LaunchedApp
  page: Page
  saved: () => Saved
  trashed: () => string[]
  claude: string
}> {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      const work = join(dirs.home, 'work')
      const transcripts = join(dirs.home, '.claude', 'projects', work.replace(/[^A-Za-z0-9]/g, '-'))
      const write = (id: string, title: string) =>
        writeFileSync(
          join(transcripts, `${id}.jsonl`),
          `${JSON.stringify({ type: 'custom-title', customTitle: title })}\n${JSON.stringify({ type: 'user', cwd: work, message: { content: title } })}\n`,
        )
      write(KEY, 'the key')
      write(EARLY, 'the early one')
      write(EARLIER, 'the earlier one')
      writeFileSync(
        join(dirs.root, 'config', 'menkar', 'projects.json'),
        JSON.stringify({
          version: 1,
          current: 'aaaaaaaaaaaa',
          projects: [
            {
              id: 'aaaaaaaaaaaa',
              name: 'Client work',
              members: [SESSION, KEY, EARLY, EARLIER],
              groups: [],
              earlier: { [KEY]: [EARLY, EARLIER] },
            },
          ],
          windows: [],
        }),
      )
      mkdirSync(join(dirs.root, 'trash'))
      return env
    },
  })
  const trash = join(root, 'trash')
  await launched.app.evaluate(({ shell }, into) => {
    shell.trashItem = (async (path: string) => {
      const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
      const p = process.getBuiltinModule('node:path') as typeof import('node:path')
      fs.renameSync(path, p.join(into, p.basename(path)))
    }) as never
  }, trash)
  return {
    launched,
    page: launched.window,
    saved: () => JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')),
    trashed: () => readdirSync(trash).sort(),
    claude: join(home, '.claude'),
  }
}

const rowOf = (page: Page, session: string) => page.locator(`.row[data-session="${session}"]`)

async function openMenu(page: Page, session: string): Promise<void> {
  await rowOf(page, session).locator('.more').click()
  await expect(page.locator('.menu-item').first()).toBeVisible()
}

function snapshotTree(dir: string, out = new Map<string, string>()): Map<string, string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) snapshotTree(path, out)
    else out.set(path, `${st.mtimeMs}:${readFileSync(path, 'base64')}`)
  }
  return out
}

test('a stopped session’s menu has Move to Trash and then Delete; a session with a tab has neither', async () => {
  const { launched, page } = await launch()
  try {
    await openMenu(page, KEY)
    const labels = await page.locator('.menu-item').allTextContents()
    const trash = labels.indexOf('Move transcript to trash…')
    expect(trash).toBeGreaterThan(-1)
    expect(labels.indexOf('Delete permanently…')).toBe(trash + 1)
    await page.keyboard.press('Escape')

    await rowOf(page, SESSION).dblclick()
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    await openMenu(page, SESSION)
    await expect(page.locator('.menu-item', { hasText: 'Stop' })).toHaveCount(1)
    await expect(page.locator('.menu-item', { hasText: 'Move transcript to trash…' })).toHaveCount(
      0,
    )
    await expect(page.locator('.menu-item', { hasText: 'Delete permanently…' })).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('Move to Trash with the box checked takes its 2 earlier conversations too; nothing of them stays in projects.json, nothing else under ~/.claude changes', async () => {
  const { launched, page, saved, trashed, claude } = await launch()
  try {
    const before = snapshotTree(claude)
    await openMenu(page, KEY)
    await page.locator('.menu-item', { hasText: 'Move transcript to trash…' }).click()
    const dialog = page.locator('[role="alertdialog"]')
    await expect(dialog.locator('.heading')).toHaveText('Move transcript to trash?')
    await expect(dialog.locator('.check-row')).toHaveText('And its 2 earlier conversation(s)')
    await expect(dialog.locator('[data-key="with-earlier"]')).toBeChecked()
    await dialog.locator('button', { hasText: 'Move to Trash' }).click()
    await expect
      .poll(trashed)
      .toEqual([`${KEY}.jsonl`, `${EARLY}.jsonl`, `${EARLIER}.jsonl`].sort())
    await expect(rowOf(page, KEY)).toHaveCount(0)
    await expect.poll(() => saved().projects[0]?.members).toEqual([SESSION])
    expect(saved().projects[0]?.earlier).toBeUndefined()
    await expect(rowOf(page, EARLY)).toHaveCount(0)
    await expect(rowOf(page, EARLIER)).toHaveCount(0)
    const after = snapshotTree(claude)
    expect([...before.keys()].filter((path) => !after.has(path))).toHaveLength(3)
    for (const [path, value] of after) expect(before.get(path), path).toBe(value)
  } finally {
    await launched.close()
  }
})

test('Move to Trash with the box cleared takes the session alone; its earlier conversations become ordinary rows', async () => {
  const { launched, page, saved, trashed } = await launch()
  try {
    await openMenu(page, KEY)
    await page.locator('.menu-item', { hasText: 'Move transcript to trash…' }).click()
    const dialog = page.locator('[role="alertdialog"]')
    await dialog.locator('[data-key="with-earlier"]').uncheck()
    await dialog.locator('button', { hasText: 'Move to Trash' }).click()
    await expect.poll(trashed).toEqual([`${KEY}.jsonl`])
    await expect(rowOf(page, KEY)).toHaveCount(0)
    await expect(rowOf(page, EARLY)).toHaveCount(1)
    await expect(rowOf(page, EARLIER)).toHaveCount(1)
    await expect.poll(() => saved().projects[0]?.members).toEqual([SESSION, EARLY, EARLIER])
    expect(saved().projects[0]?.earlier).toBeUndefined()
  } finally {
    await launched.close()
  }
})
