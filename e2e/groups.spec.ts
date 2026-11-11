// Decision 1.54: a group collapses into one row by clicking its heading, saved in projects.json;
// the row counts what the group would list, shows the most urgent state and the fullest ring of
// its running members, and is marked while the selected tab holds a member. A group's leader is
// set from the row's menu, goes first, and wears a star. Nothing expands a group by itself.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi } from '../src/shared/ipc'
import { launchApp } from './app'
import { CLIENT, CLIENT_NAMES, type ClientKey, clientWork, SESSION } from './fixtures'

type PageGlobals = { menkar: MenkarApi }

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate((a) => (globalThis as unknown as PageGlobals).menkar.window.act(a as never), action)

const rows = (page: Page) =>
  page
    .locator('#session-list .row')
    .evaluateAll((ns) => ns.map((n) => n.getAttribute('data-session')))

const heading = (page: Page) => page.locator('#session-list .group-heading').first()

async function rowMenu(page: Page, session: string, item: string) {
  await page.locator(`.row[data-session="${session}"] .more`).click()
  await page.locator('.menu-item', { hasText: item }).last().click()
}

// "Client work" with the group "API" of three (login, api, long) and one loose session.
function groupsWork(
  dirs: { readonly root: string; readonly home: string },
  tabs?: readonly (readonly ClientKey[])[],
) {
  const env = clientWork(dirs, tabs ? { tabs } : {})
  const file = join(dirs.root, 'config', 'menkar', 'projects.json')
  const json = JSON.parse(readFileSync(file, 'utf8'))
  json.projects[0].members = [CLIENT.login, CLIENT.api, CLIENT.long, SESSION]
  json.projects[0].groups = [
    { name: 'API', color: '#5ec4b6', members: [CLIENT.login, CLIENT.api, CLIENT.long] },
  ]
  writeFileSync(file, JSON.stringify(json))
  return env
}

test('a click on the heading collapses the group into one row, the loose row kept; it is still collapsed after a restart; a click brings the rows back', async () => {
  let root = ''
  let launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return groupsWork(dirs)
    },
  })
  try {
    const page = launched.window
    await expect.poll(() => rows(page)).toEqual([CLIENT.login, CLIENT.api, CLIENT.long, SESSION])
    await heading(page).click()
    await expect(page.locator('#session-list .group-heading.collapsed')).toHaveCount(1)
    await expect(heading(page)).toContainText('API · 3')
    await expect.poll(() => rows(page)).toEqual([SESSION])
    // "No group" never collapses: it is not a button.
    const noGroup = page.locator('#session-list .group-heading').nth(1)
    await expect(noGroup).toHaveText('No group')
    expect(await noGroup.evaluate((n) => n.tagName)).toBe('DIV')
    const saved = JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
    expect(saved.projects[0].groups[0].collapsed).toBe(true)

    await launched.app.close()
    launched = await launchApp({
      prepare: (dirs) => {
        const env = groupsWork(dirs)
        cpSync(join(root, 'config'), join(dirs.root, 'config'), { recursive: true })
        return env
      },
    })
    const again = launched.window
    await expect(again.locator('#session-list .group-heading.collapsed')).toHaveCount(1)
    await expect.poll(() => rows(again)).toEqual([SESSION])
    await heading(again).focus()
    await again.keyboard.press('Enter')
    await expect.poll(() => rows(again)).toEqual([CLIENT.login, CLIENT.api, CLIENT.long, SESSION])
    await expect(again.locator('#session-list .group-heading.collapsed')).toHaveCount(0)
  } finally {
    await launched.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('the collapsed row: stopped with no ring while none runs; the fullest ring of its running members; blocked when one is; marked while a member’s tab is selected; never expanded by any of it', async () => {
  const launched = await launchApp({ prepare: (dirs) => groupsWork(dirs) })
  const page = launched.window
  try {
    await expect.poll(() => rows(page)).toHaveLength(4)
    await heading(page).click()
    await expect(heading(page).locator('.dot')).toHaveClass(/stopped/)
    await expect(heading(page).locator('.ring')).toHaveCount(0)

    await act(page, { type: 'openSession', session: CLIENT.api })
    await act(page, { type: 'openSession', session: CLIENT.login })
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('.xterm-rows').last()).toContainText('stand-in claude ready')
    await launched.app.evaluate(
      ({ BrowserWindow }, ids) => {
        const wc = BrowserWindow.getAllWindows()[0]?.webContents
        for (const [sessionId, percentage] of ids)
          wc?.send('context:reading', {
            sessionId,
            reading: { percentage, window: 200000, source: 'statusline' },
          })
      },
      [
        [CLIENT.login, 40],
        [CLIENT.api, 87],
      ] as const,
    )
    await expect(heading(page).locator('.ring')).toHaveAttribute('title', /87%/)
    await expect(heading(page)).toHaveClass(/contains-selected/)

    await page.locator('.pane:visible .xterm').click()
    await page.keyboard.type('ASK')
    await expect(heading(page).locator('.dot')).toHaveClass(/blocked/, { timeout: 10_000 })
    const loginTab = page.locator('.tab').nth(1)
    await page.locator('.tab').first().click()
    await loginTab.click()
    await expect(page.locator('#session-list .group-heading.collapsed')).toHaveCount(1)
    await expect.poll(() => rows(page)).toEqual([SESSION])

    await act(page, { type: 'openSession', session: SESSION })
    await expect(page.locator('.tab')).toHaveCount(3)
    await expect(heading(page)).not.toHaveClass(/contains-selected/)
  } finally {
    await launched.close()
  }
})

test('“Make group leader” puts the member first with a star, named on the collapsed row; “Not the group’s leader” takes the star off and keeps the order', async () => {
  const launched = await launchApp({ prepare: (dirs) => groupsWork(dirs) })
  const page = launched.window
  try {
    await expect.poll(() => rows(page)).toHaveLength(4)
    await page.locator(`.row[data-session="${SESSION}"] .more`).click()
    await expect(page.locator('.menu-item', { hasText: 'group leader' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await rowMenu(page, CLIENT.long, 'Make group leader')
    await expect.poll(() => rows(page)).toEqual([CLIENT.long, CLIENT.login, CLIENT.api, SESSION])
    await expect(page.locator('#session-list .leader-star')).toHaveCount(1)
    await expect(page.locator(`.row[data-session="${CLIENT.long}"] .leader-star`)).toHaveAttribute(
      'title',
      'Group leader',
    )
    await heading(page).click()
    await expect(heading(page)).toContainText(`★ ${CLIENT_NAMES.long}`)
    await heading(page).click()

    await rowMenu(page, CLIENT.long, 'Not the group’s leader')
    await expect(page.locator('#session-list .leader-star')).toHaveCount(0)
    await expect.poll(() => rows(page)).toEqual([CLIENT.long, CLIENT.login, CLIENT.api, SESSION])
  } finally {
    await launched.close()
  }
})
