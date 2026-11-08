import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi, ProjectsSnapshot } from '../src/shared/ipc'
import { launchApp } from './app'

type PageGlobals = { menkar: MenkarApi }
const SESSION = '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c'

// A stand-in `claude` (never the real one): it records its arguments, writes the transcript a
// new session or a fork would get, with one typed message, and stays in the foreground.
const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path')
const args = process.argv.slice(2)
fs.appendFileSync(path.join(process.env.HOME, 'claude-args.txt'), args.join(' ') + '\\n')
fs.writeFileSync(path.join(process.env.HOME, 'claude-pid.txt'), String(process.pid))
const at = args.indexOf('--session-id')
if (at >= 0) {
  const id = args[at + 1]
  const name = args.includes('-n') ? args[args.indexOf('-n') + 1] : null
  const folder = path.join(process.env.HOME, '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'))
  fs.mkdirSync(folder, { recursive: true })
  const lines = []
  if (name) lines.push({ type: 'custom-title', customTitle: name })
  lines.push({ type: 'user', cwd: process.cwd(), message: { content: 'typed in the stand-in' } })
  fs.writeFileSync(path.join(folder, id + '.jsonl'), lines.map((l) => JSON.stringify(l)).join('\\n') + '\\n')
}
process.stdout.write('stand-in claude ready\\r\\n')
process.stdin.resume()
`

function prepare(dirs: { readonly root: string; readonly home: string }): Record<string, string> {
  const bin = join(dirs.root, 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'claude'), FAKE_CLAUDE)
  chmodSync(join(bin, 'claude'), 0o755)
  const work = join(dirs.home, 'work')
  mkdirSync(work, { recursive: true })
  const transcripts = join(dirs.home, '.claude', 'projects', work.replace(/[^A-Za-z0-9]/g, '-'))
  mkdirSync(transcripts, { recursive: true })
  writeFileSync(
    join(transcripts, `${SESSION}.jsonl`),
    `${JSON.stringify({ type: 'user', cwd: work, message: { content: 'fix the login bug' } })}\n`,
  )
  const config = join(dirs.root, 'config', 'menkar')
  mkdirSync(config, { recursive: true })
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: 'aaaaaaaaaaaa',
      projects: [{ id: 'aaaaaaaaaaaa', name: 'Client work', members: [SESSION], groups: [] }],
      windows: [],
    }),
  )
  writeFileSync(join(config, 'state.json'), JSON.stringify({ settings: { color_scheme: 'dark' } }))
  return { PATH: `${bin}:${process.env.PATH ?? ''}` }
}

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
      .toMatch(new RegExp(`^--resume ${SESSION} --settings \\S+claude-settings\\.json\\n$`))
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
      .toMatch(/^--session-id [0-9a-f-]{36} -n checkout flow --settings \S+\n$/)
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
      },
    ])
  } finally {
    await launched.close()
  }
})
