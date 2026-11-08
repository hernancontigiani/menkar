import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'

const SITE = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a'
const SECRET = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

// Project "Client work" with "fix the login bug" (folder work), "site" (folder todo-api, first
// message "add auth") and a hidden "secret".
function twoMembers(dirs: {
  readonly root: string
  readonly home: string
}): Record<string, string> {
  const env = prepare(dirs)
  const api = join(dirs.home, 'todo-api')
  mkdirSync(api, { recursive: true })
  const transcripts = join(dirs.home, '.claude', 'projects', api.replace(/[^A-Za-z0-9]/g, '-'))
  mkdirSync(transcripts, { recursive: true })
  const line = (text: string, title: string) =>
    `${JSON.stringify({ type: 'custom-title', customTitle: title })}\n${JSON.stringify({ type: 'user', cwd: api, message: { content: text } })}\n`
  writeFileSync(join(transcripts, `${SITE}.jsonl`), line('add auth', 'site'))
  writeFileSync(join(transcripts, `${SECRET}.jsonl`), line('private', 'secret'))
  const config = join(dirs.root, 'config', 'menkar')
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: 'aaaaaaaaaaaa',
      projects: [
        { id: 'aaaaaaaaaaaa', name: 'Client work', members: [SESSION, SITE, SECRET], groups: [] },
      ],
      windows: [],
    }),
  )
  writeFileSync(
    join(config, 'state.json'),
    JSON.stringify({ hidden: [SECRET], settings: { color_scheme: 'dark' } }),
  )
  return env
}

const rows = (page: Page) => page.locator('.jump-row')

test('AST-32, AST-35 the quick switcher lists the shown project’s visible members; typing filters; Enter opens', async () => {
  const launched = await launchApp({ prepare: twoMembers })
  const page = launched.window
  try {
    await expect(page.locator('.row')).toHaveCount(3)
    await page.keyboard.press('Control+Shift+K')
    await expect(page.locator('.jump .heading')).toHaveText('Switch session')
    await expect(rows(page)).toHaveCount(2)
    await page.locator('.jump input').fill('AUTH')
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first()).toContainText('site')
    await expect(rows(page).first()).toContainText('todo-api · add auth')
    await page.locator('.jump input').press('Enter')
    await expect(page.locator('.jump')).toHaveCount(0)
    await expect(page.locator('.tab.selected')).toHaveText(/site/)
  } finally {
    await launched.close()
  }
})

test('AST-35 with Show hidden sessions checked in the main menu, the hidden member is listed', async () => {
  const launched = await launchApp({ prepare: twoMembers })
  const page = launched.window
  try {
    await expect(page.locator('.row')).toHaveCount(3)
    await page.locator('#main-menu').click()
    await page.locator('.menu-item', { hasText: 'Show hidden sessions' }).click()
    await page.keyboard.press('Control+Shift+K')
    await expect(rows(page)).toHaveCount(3)
  } finally {
    await launched.close()
  }
})

test('AST-34, AST-36, AST-37 part of an id finds it; a second Ctrl+Shift+K opens no second dialog; Esc closes', async () => {
  const launched = await launchApp({ prepare: twoMembers })
  const page = launched.window
  try {
    // The window is ready once its rows are drawn; a key before that reaches no handler yet.
    await expect(page.locator('.row')).toHaveCount(3)
    await page.keyboard.press('Control+Shift+K')
    await page.keyboard.press('Control+Shift+K')
    await expect(page.locator('.jump')).toHaveCount(1)
    await page.locator('.jump input').fill(SITE.slice(0, 8))
    await expect(rows(page)).toHaveCount(1)
    await page.locator('.jump input').press('Escape')
    await expect(page.locator('.jump')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('AST-38, AST-39 Go to agent lists every tab ("{project} · {title}", "{agent} · {state}"); with none, Enter does nothing', async () => {
  const launched = await launchApp({ prepare: twoMembers })
  const page = launched.window
  try {
    await page.locator('#content').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Control+b')
    await page.keyboard.press('g')
    await expect(page.locator('.jump .heading')).toHaveText('Go to agent')
    await expect(rows(page)).toHaveCount(0)
    await page.locator('.jump input').press('Enter')
    await page.locator('.jump input').press('Escape')

    await page.locator('.row', { hasText: 'site' }).dblclick()
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect(page.locator('.tab')).toHaveCount(2)
    await page.locator('.xterm').last().click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('g')
    await expect(rows(page)).toHaveCount(2)
    await expect(rows(page).first()).toContainText('Client work · site')
    await expect(rows(page).first()).toContainText('Claude Code · ')
    await page.locator('.jump input').fill('site')
    await page.locator('.jump input').press('Enter')
    await expect(page.locator('.tab.selected')).toHaveText(/site/)
  } finally {
    await launched.close()
  }
})
