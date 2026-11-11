// Decisions 1.51, 1.58, 1.60, 1.61: each project has a files folder under the Menkar folder, listed
// at the foot of the sidebar; ⬇ brings a shared file in (moved, with Undo), a row drags out, 📂 and
// Ctrl+B f open the folder, Ctrl+B o and "Open folder" open a pane's or a session's folder, the
// sessions it starts get the folder, and old files go to the trash. Never the human's folders:
// the root and the incoming folder are temporary, and opening, trashing and dragging are recorded.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import type { MenkarApi } from '../src/shared/ipc'
import { launchApp } from './app'
import { CLIENT, clientWork } from './fixtures'

type PageGlobals = { menkar: MenkarApi }
type MainGlobals = { opened?: string[]; trashed?: string[]; dragged?: string[] }

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate((a) => (globalThis as unknown as PageGlobals).menkar.window.act(a as never), action)

const PROJECT = 'Client work'

interface Dirs {
  root: string
  home: string
  filesRoot: string
  incoming: string
  folder: string
}

function setUp(
  dirs: { readonly root: string; readonly home: string },
  extra: Record<string, unknown> = {},
  tabs?: readonly (readonly ('login' | 'api' | 'long')[])[],
): { env: Record<string, string>; d: Dirs } {
  const filesRoot = join(dirs.root, 'menkar-files')
  const incoming = join(dirs.root, 'incoming')
  mkdirSync(incoming, { recursive: true })
  const env = clientWork(dirs, {
    settings: { files_root: filesRoot, files_incoming: incoming, files_bring: 'newest', ...extra },
    ...(tabs ? { tabs } : {}),
  })
  return {
    env,
    d: { ...dirs, filesRoot, incoming, folder: join(filesRoot, PROJECT, 'files') },
  }
}

// Recorders instead of the file manager, the trash and the drag.
async function record(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell, BrowserWindow }) => {
    const g = globalThis as unknown as MainGlobals
    g.opened = []
    g.trashed = []
    g.dragged = []
    shell.openPath = (async (path: string) => {
      g.opened?.push(path)
      return ''
    }) as typeof shell.openPath
    shell.trashItem = (async (path: string) => {
      g.trashed?.push(path)
    }) as typeof shell.trashItem
    for (const w of BrowserWindow.getAllWindows())
      w.webContents.startDrag = ((item: { file: string }) => {
        g.dragged?.push(item.file)
      }) as typeof w.webContents.startDrag
  })
}

const recorded = (app: ElectronApplication, key: keyof MainGlobals) =>
  app.evaluate((_e, k) => (globalThis as unknown as MainGlobals)[k as keyof MainGlobals] ?? [], key)

const fileRows = (page: Page) =>
  page
    .locator('#files-section .file-row .file-name')
    .evaluateAll((ns) => ns.map((n) => n.textContent))

test('⬇ lists the incoming folder’s newest files, newest first; one chosen is moved into the project’s folder and listed; Undo moves it back; the section collapses to its heading and stays so after a restart', async () => {
  let d: Dirs | undefined
  let launched = await launchApp({
    prepare: (dirs) => {
      const set = setUp(dirs)
      d = set.d
      writeFileSync(join(set.d.incoming, 'old.pdf'), 'old')
      utimesSync(join(set.d.incoming, 'old.pdf'), new Date(2026, 0, 1), new Date(2026, 0, 1))
      writeFileSync(join(set.d.incoming, 'new.png'), 'new')
      return set.env
    },
  })
  if (!d) throw new Error('no dirs')
  const dirs = d
  try {
    const page = launched.window
    const heading = page.locator('#files-section .files-heading')
    await expect(heading).toContainText('Files · 0')
    await page.locator('#files-section [data-key="files-bring"]').click()
    await expect(page.locator('.menu-item')).toHaveText([/^new\.png/, /^old\.pdf/])
    await page.locator('.menu-item', { hasText: 'old.pdf' }).click()
    await expect.poll(() => existsSync(join(dirs.folder, 'old.pdf'))).toBe(true)
    expect(existsSync(join(dirs.incoming, 'old.pdf'))).toBe(false)
    await expect.poll(() => fileRows(page)).toEqual(['old.pdf'])
    await expect(heading).toContainText('Files · 1')
    const toast = page.locator('.toast', { hasText: `old.pdf → ${PROJECT}` })
    await toast.locator('.toast-action', { hasText: 'Undo' }).click()
    await expect.poll(() => existsSync(join(dirs.incoming, 'old.pdf'))).toBe(true)
    expect(existsSync(join(dirs.folder, 'old.pdf'))).toBe(false)
    await expect.poll(() => fileRows(page)).toEqual([])

    writeFileSync(join(dirs.folder, 'kept.txt'), 'x')
    await expect.poll(() => fileRows(page)).toEqual(['kept.txt'])
    await page.locator('#files-section .files-heading .files-toggle').click()
    await expect(page.locator('#files-section .files-heading.collapsed')).toHaveCount(1)
    await expect(page.locator('#files-section .file-row')).toHaveCount(0)

    await launched.app.close()
    launched = await launchApp({
      prepare: (next) => {
        const set = setUp(next)
        cpSync(join(dirs.root, 'config'), join(next.root, 'config'), { recursive: true })
        return set.env
      },
    })
    await expect(launched.window.locator('#files-section .files-heading.collapsed')).toHaveCount(1)
  } finally {
    await launched.close()
    rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('dragging a file row hands main the project and the file’s name, and main drags that file; a crafted request for ../x is refused', async () => {
  let d: Dirs | undefined
  const launched = await launchApp({
    prepare: (dirs) => {
      const set = setUp(dirs)
      d = set.d
      return set.env
    },
  })
  if (!d) throw new Error('no dirs')
  const dirs = d
  try {
    const { app, window: page } = launched
    await record(app)
    await act(page, { type: 'openFilesFolder' })
    writeFileSync(join(dirs.folder, 'report.pdf'), 'r')
    await expect.poll(() => fileRows(page)).toEqual(['report.pdf'])
    await page.locator('#files-section .file-row').first().dispatchEvent('dragstart')
    await expect.poll(() => recorded(app, 'dragged')).toEqual([join(dirs.folder, 'report.pdf')])
    writeFileSync(join(dirs.root, 'x'), 'secret')
    await act(page, { type: 'dragProjectFile', name: '../x' })
    await act(page, { type: 'dragProjectFile', name: join(dirs.root, 'x') })
    expect(await recorded(app, 'dragged')).toHaveLength(1)
  } finally {
    await launched.close()
  }
})

test('a file not modified for 40 days, with 30 days set, goes to the trash after the start; a recent one stays', async () => {
  let d: Dirs | undefined
  const launched = await launchApp({
    prepare: (dirs) => {
      const set = setUp(dirs, { files_trash_days: 30 })
      d = set.d
      mkdirSync(set.d.folder, { recursive: true })
      const old = join(set.d.folder, 'old.log')
      writeFileSync(old, 'o')
      const when = new Date(Date.now() - 40 * 24 * 3600 * 1000)
      utimesSync(old, when, when)
      writeFileSync(join(set.d.folder, 'new.log'), 'n')
      // The folder's name was saved when it was made.
      const file = join(dirs.root, 'config', 'menkar', 'projects.json')
      const json = JSON.parse(readFileSync(file, 'utf8'))
      json.projects[0].files_folder = PROJECT
      writeFileSync(file, JSON.stringify(json))
      return set.env
    },
  })
  if (!d) throw new Error('no dirs')
  const dirs = d
  try {
    await record(launched.app)
    await expect
      .poll(() => recorded(launched.app, 'trashed'), { timeout: 15_000 })
      .toEqual([join(dirs.folder, 'old.log')])
  } finally {
    await launched.close()
  }
})

test('a Claude session started in a project gets --add-dir and MENKAR_FILES naming the project’s folder, which exists', async () => {
  let d: Dirs | undefined
  const launched = await launchApp({
    prepare: (dirs) => {
      const set = setUp(dirs)
      d = set.d
      // A stand-in that prints what it was given and stays in the foreground.
      writeFileSync(
        join(dirs.root, 'bin', 'claude'),
        `#!/usr/bin/env node
process.stdout.write('FILES=' + process.env.MENKAR_FILES + '\\r\\nARGS=' + process.argv.slice(2).join(' ') + '\\r\\n')
setInterval(() => {}, 1000)
`,
      )
      return set.env
    },
  })
  if (!d) throw new Error('no dirs')
  const dirs = d
  try {
    const page = launched.window
    await act(page, { type: 'openSession', session: CLIENT.login })
    const rows = page.locator('.xterm-rows')
    await expect(rows).toContainText(`FILES=${dirs.folder}`)
    await expect(rows).toContainText(`--add-dir ${dirs.folder}`)
    expect(existsSync(dirs.folder)).toBe(true)
  } finally {
    await launched.close()
  }
})

test('Ctrl+B f and 📂 open the project’s folder, made first; Ctrl+B o opens the focused agent’s folder; “Open folder” on a row opens its session’s; a session whose folder is gone gets a toast and nothing opens', async () => {
  let d: Dirs | undefined
  const launched = await launchApp({
    prepare: (dirs) => {
      const set = setUp(dirs, {}, [['login']])
      d = set.d
      return set.env
    },
  })
  if (!d) throw new Error('no dirs')
  const dirs = d
  try {
    const { app, window: page } = launched
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    await record(app)
    await page.locator('#session-list').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('Control+b')
    await page.keyboard.press('f')
    await expect.poll(() => recorded(app, 'opened')).toEqual([dirs.folder])
    expect(existsSync(dirs.folder)).toBe(true)
    await page.locator('#files-section [data-key="files-open"]').click()
    await expect.poll(() => recorded(app, 'opened')).toHaveLength(2)

    await page.locator('.xterm').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('o')
    const api = join(dirs.home, 'work', 'api')
    await expect.poll(async () => (await recorded(app, 'opened'))[2]).toBe(api)

    await page.locator(`.row[data-session="${CLIENT.api}"] .more`).click()
    await page.locator('.menu-item', { hasText: 'Open folder' }).click()
    await expect.poll(async () => (await recorded(app, 'opened'))[3]).toBe(api)

    rmSync(join(dirs.home, 'work', 'web'), { recursive: true, force: true })
    await page.locator(`.row[data-session="${CLIENT.long}"] .more`).click()
    await page.locator('.menu-item', { hasText: 'Open folder' }).click()
    await expect(page.locator('.toast', { hasText: 'That folder no longer exists.' })).toBeVisible()
    expect(await recorded(app, 'opened')).toHaveLength(4)
  } finally {
    await launched.close()
  }
})

test('decision 1.62: with 7 files the section shows the 5 newest and "2 more…", which opens the folder; the heading counts all 7; the bring-in button reads "Add"', async () => {
  let d: Dirs | undefined
  const launched = await launchApp({
    prepare: (dirs) => {
      const set = setUp(dirs)
      d = set.d
      mkdirSync(set.d.folder, { recursive: true })
      for (let i = 1; i <= 7; i++) {
        const path = join(set.d.folder, `f${i}.txt`)
        writeFileSync(path, String(i))
        const when = new Date(2026, 10, i)
        utimesSync(path, when, when)
      }
      const file = join(dirs.root, 'config', 'menkar', 'projects.json')
      const json = JSON.parse(readFileSync(file, 'utf8'))
      json.projects[0].files_folder = PROJECT
      writeFileSync(file, JSON.stringify(json))
      return set.env
    },
  })
  if (!d) throw new Error('no dirs')
  const dirs = d
  try {
    const { app, window: page } = launched
    await expect
      .poll(() => fileRows(page))
      .toEqual(['f7.txt', 'f6.txt', 'f5.txt', 'f4.txt', 'f3.txt'])
    await expect(page.locator('#files-section .files-heading')).toContainText('Files · 7')
    await expect(
      page.locator('#files-section').getByRole('button', { name: 'Add', exact: true }),
    ).toHaveAttribute('title', 'Bring a shared file into this project')
    await record(app)
    const more = page.locator('#files-section [data-key="files-more"]')
    await expect(more).toHaveText('2 more…')
    await more.click()
    await expect.poll(() => recorded(app, 'opened')).toEqual([dirs.folder])
  } finally {
    await launched.close()
  }
})
