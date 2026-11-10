// Decision 2026-11-10: a session row is dragged to another place in its own group, or in "No
// group", as tabs are; a drop never changes its group, and the order is saved.
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { CLIENT, clientWork } from './fixtures'

const rows = (page: Page) =>
  page
    .locator('#session-list .row')
    .evaluateAll((ns) => ns.map((n) => n.getAttribute('data-session')))

const saved = (root: string) =>
  JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')).projects[0]

// From the middle of one row to `y` (a page coordinate), the marker checked on the way.
async function drag(page: Page, session: string, y: (target: DOMRect) => number, over: string) {
  const from = await page.locator(`.row[data-session="${session}"]`).boundingBox()
  const to = await page.locator(`.row[data-session="${over}"]`).boundingBox()
  if (!from || !to) throw new Error('no row')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, y(to as DOMRect), { steps: 10 })
  await expect(page.locator('#session-list .row-marker')).toBeVisible()
}

test('a row dragged below another of its group moves there, with a marker while dragging; the order survives a restart', async () => {
  let root = ''
  let launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return clientWork(dirs)
    },
  })
  try {
    const page = launched.window
    await expect.poll(() => rows(page)).toEqual([CLIENT.login, CLIENT.api, CLIENT.long])
    await drag(page, CLIENT.login, (r) => r.y + r.height - 3, CLIENT.api)
    mkdirSync('/tmp/menkar-shots', { recursive: true })
    await page.screenshot({ path: '/tmp/menkar-shots/row-drag.png' })
    await page.mouse.up()
    await expect.poll(() => rows(page)).toEqual([CLIENT.api, CLIENT.login, CLIENT.long])
    await expect(page.locator('#session-list .row-marker')).toHaveCount(0)
    await expect.poll(() => saved(root).groups[0].members).toEqual([CLIENT.api, CLIENT.login])
    // A drop is not a click: no session was opened.
    await expect(page.locator('.tab')).toHaveCount(0)

    await launched.app.close()
    launched = await launchApp({
      prepare: (dirs) => {
        const env = clientWork(dirs)
        cpSync(join(root, 'config'), join(dirs.root, 'config'), { recursive: true })
        return env
      },
    })
    await expect.poll(() => rows(launched.window)).toEqual([CLIENT.api, CLIENT.login, CLIENT.long])
  } finally {
    await launched.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('a row dragged into another group stays in its own: the group row to its group’s end, the loose row nowhere', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return clientWork(dirs)
    },
  })
  try {
    const page = launched.window
    await expect.poll(() => rows(page)).toEqual([CLIENT.login, CLIENT.api, CLIENT.long])
    // "No group"'s only row, over the group's first row: no other row of its own to drop among.
    const long = await page.locator(`.row[data-session="${CLIENT.long}"]`).boundingBox()
    const login = await page.locator(`.row[data-session="${CLIENT.login}"]`).boundingBox()
    if (!long || !login) throw new Error('no row')
    await page.mouse.move(long.x + long.width / 2, long.y + long.height / 2)
    await page.mouse.down()
    await page.mouse.move(long.x + long.width / 2, login.y + 3, { steps: 10 })
    await expect(page.locator('#session-list .row-marker')).toHaveCount(0)
    await page.mouse.up()
    await page.waitForTimeout(300)
    expect(await rows(page)).toEqual([CLIENT.login, CLIENT.api, CLIENT.long])
    // The group's first row, down over "No group": it stays in the group, at its end.
    await drag(page, CLIENT.login, (r) => r.y + r.height - 3, CLIENT.long)
    await page.mouse.up()
    await expect.poll(() => rows(page)).toEqual([CLIENT.api, CLIENT.login, CLIENT.long])
    await expect.poll(() => saved(root).groups[0].members).toEqual([CLIENT.api, CLIENT.login])
    expect(saved(root).groups).toHaveLength(1)
    await expect(page.locator('#session-list .group-heading')).toHaveText([/api pair/, 'No group'])
  } finally {
    await launched.close()
  }
})
