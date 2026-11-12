import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi, ProjectsSnapshot } from '../src/shared/ipc'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'

type PageGlobals = { menkar: MenkarApi }

const snapshot = (page: Page): Promise<ProjectsSnapshot> =>
  page.evaluate(() => (globalThis as unknown as PageGlobals).menkar.projects.get())
const args = (home: string) =>
  existsSync(join(home, 'claude-args.txt'))
    ? readFileSync(join(home, 'claude-args.txt'), 'utf8')
    : ''

test('PRJ-11, PRJ-13, PRJ-14 the project dropdown creates, refuses and renames projects', async () => {
  const launched = await launchApp({ prepare })
  const page = launched.window
  try {
    await page.locator('#project-button').click()
    await page.locator('.popover input').press('Enter')
    await expect(page.locator('.popover .error-line')).toHaveText('A project needs a name.')
    await page.locator('.popover input').fill('Infra')
    await page.locator('.popover input').press('Enter')
    await expect(page.locator('#project-button .project-name')).toHaveText('Infra')
    await expect(page.locator('#session-list')).toContainText('Infra has no sessions')
    const after = await snapshot(page)
    expect(after.projects.map((p) => p.name)).toEqual(['Client work', 'Infra'])
    expect(after.current).toBe(after.projects[1]?.id)

    await page.locator('#project-button').click()
    await page.locator('.project-row', { hasText: 'Infra' }).locator('button').first().click()
    await page.locator('.dialog input').fill('client WORK')
    await page.locator('.dialog input').press('Enter')
    await expect(page.locator('.dialog .heading')).toHaveText('The project was not renamed')
    await page.locator('.dialog button', { hasText: 'OK' }).click()
    await expect(page.locator('.dialog')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('TRM-2, PRJ-27, TRM-53 opening a member resumes it once; opening it again selects its tab', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return prepare(dirs)
    },
  })
  const page = launched.window
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect(page.locator('.tab.selected')).toHaveText(/fix the login bug/)
    await expect
      .poll(() => args(home))
      .toMatch(
        new RegExp(
          `^--resume ${SESSION} --add-dir \\S+/Menkar/Client work/files --mcp-config \\{.+\\} --plugin-dir \\S+/plugin --settings \\S+claude-settings\\.json\\n$`,
        ),
      )
    // Plan 33: the plugin folder exists and holds Menkar's four skills.
    const plugin = /--plugin-dir (\S+)/.exec(args(home))?.[1] ?? ''
    expect(readdirSync(join(plugin, 'skills')).sort()).toEqual([
      'distill',
      'orchestrator',
      'specialize',
      'worker',
    ])
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect(page.locator('.tab')).toHaveCount(1)
    await page.waitForTimeout(500)
    expect(args(home).trim().split('\n')).toHaveLength(1)
  } finally {
    await launched.close()
  }
})

test('TRM-1, 1.16 a new session starts with its id and name, and joins the project once it has a typed message', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return prepare(dirs)
    },
  })
  const page = launched.window
  try {
    await page.evaluate(
      (folder) =>
        (globalThis as unknown as PageGlobals).menkar.window.act({
          type: 'startNew',
          agent: 'claude',
          folder,
          name: 'checkout flow',
        }),
      join(home, 'work'),
    )
    await expect(page.locator('.tab.selected')).toHaveText(/checkout flow/)
    await expect
      .poll(() => args(home))
      .toMatch(
        /^--session-id [0-9a-f-]{36} -n checkout flow --add-dir \S+\/Menkar\/Client work\/files --mcp-config \{.+\} --plugin-dir \S+\/plugin --settings \S+\n$/,
      )
    await expect
      .poll(async () => (await snapshot(page)).projects[0]?.members.length, { timeout: 15_000 })
      .toBe(2)
    await expect(page.locator('.row', { hasText: 'checkout flow' })).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('TRM-49, PRJ-45 closing a window with a running session asks; Stop and close hangs it up and keeps the layout', async () => {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      return prepare(dirs)
    },
  })
  const page = launched.window
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(() => existsSync(join(home, 'claude-pid.txt'))).toBe(true)
    const pid = Number(readFileSync(join(home, 'claude-pid.txt'), 'utf8'))
    await launched.app.evaluate(({ app, BrowserWindow }) => {
      app.removeAllListeners('window-all-closed')
      BrowserWindow.getAllWindows()[0]?.close()
    })
    await expect(page.locator('.dialog .heading')).toHaveText('Stop 1 running session(s)?')
    await expect(page.locator('.dialog .body')).toContainText('fix the login bug')
    await page.locator('.dialog button', { hasText: 'Stop and close' }).click()
    await expect
      .poll(() => {
        try {
          process.kill(pid, 0)
          return true
        } catch {
          return false
        }
      })
      .toBe(false)
    const saved = JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
    expect(saved.windows).toEqual([
      {
        current: 'aaaaaaaaaaaa',
        tabs: { aaaaaaaaaaaa: [{ panes: [SESSION], orientation: 'horizontal' }] },
        maximized: false,
      },
    ])
  } finally {
    await launched.close()
  }
})

test('decision 1.98: the last window closed maximized is saved so, and the next start maximizes its window once shown', async () => {
  let root = ''
  const first = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return prepare(dirs)
    },
  })
  const savedWindows = () =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')).windows
  try {
    // No window manager under xvfb: the window is told it is maximized, as one would tell it.
    await first.app.evaluate(({ app, BrowserWindow }) => {
      app.removeAllListeners('window-all-closed')
      const w = BrowserWindow.getAllWindows()[0]
      if (!w) return
      w.isMaximized = () => true
      w.emit('maximize')
      w.close()
    })
    await expect.poll(() => first.app.windows().length).toBe(0)
    expect(savedWindows()).toEqual([{ current: 'aaaaaaaaaaaa', tabs: {}, maximized: true }])
  } finally {
    await first.close()
  }

  // Nor will maximize() take there: main's log says what it asked of the window, and when.
  let log = ''
  const second = await launchApp({
    prepare: (dirs) => {
      log = join(dirs.root, 'cache', 'menkar', 'menkar.log')
      const env = prepare(dirs)
      const file = join(dirs.root, 'config', 'menkar', 'projects.json')
      const saved = JSON.parse(readFileSync(file, 'utf8'))
      saved.windows = [{ current: 'aaaaaaaaaaaa', tabs: {}, maximized: true }]
      writeFileSync(file, JSON.stringify(saved))
      return { ...env, MENKAR_LOG: 'info' }
    },
  })
  try {
    await expect
      .poll(() => (existsSync(log) ? readFileSync(log, 'utf8') : ''))
      .toContain('window maximized as it was saved')
  } finally {
    await second.close()
  }
})
