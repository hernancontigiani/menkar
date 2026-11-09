import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi } from '../src/shared/ipc'
import { launchApp } from './app'
import { CLIENT, clientWork, prepare, SESSION } from './fixtures'

type PageGlobals = { menkar: MenkarApi }

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) => (globalThis as unknown as PageGlobals).menkar.window.act(a as never),
    action,
  ) as Promise<{ refusal?: string; value?: unknown }>

const shown = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as PageGlobals).menkar.window.state())

const dialog = (page: Page) => page.locator('.dialog')
const stateFile = (root: string) => join(root, 'config', 'menkar', 'state.json')
const readState = (root: string) => JSON.parse(readFileSync(stateFile(root), 'utf8'))
const transcriptDir = (home: string, cwd: string) =>
  join(home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'))

function write(home: string, cwd: string, id: string, lines: readonly unknown[]): string {
  const dir = transcriptDir(home, cwd)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${id}.jsonl`)
  writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
  return file
}

async function launch(
  prepareDirs: (dirs: { root: string; home: string }) => Record<string, string>,
) {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      return prepareDirs(dirs)
    },
  })
  return { launched, page: launched.window, home, root }
}

async function rowMenu(page: Page, session: string, ...path: string[]) {
  await page.locator(`.row[data-session="${session}"] .more`).click()
  for (const item of path) await page.locator('.menu-item', { hasText: item }).last().click()
}

async function existing(page: Page) {
  await page.locator('#add-session').click()
  await expect(page.locator('.add-session')).toBeVisible()
  await page.locator('.add-session button[title="Expand all groups"]').click()
}

test('SES-2 transcripts but no `claude` on the PATH: no Claude session is listed, and the history says none were found', async () => {
  const { launched, page } = await launch((dirs) => {
    clientWork(dirs)
    return { PATH: '/usr/bin:/bin' }
  })
  try {
    await page.locator('#add-session').click()
    await expect(page.locator('.add-session .status-page .heading')).toHaveText('No sessions found')
    await expect(page.locator('.add-session .history-row')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.locator('#session-list .row')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('SES-13 a first typed message on line 51 gives no preview, and a new session with only that does not join', async () => {
  const LATE = '5e5e5e5e-0000-4000-8000-000000000005'
  const { launched, page, home } = await launch((dirs) => {
    const env = { ...clientWork(dirs), FAKE_CLAUDE_QUIET: '1' }
    const cwd = join(dirs.home, 'work', 'web')
    write(dirs.home, cwd, LATE, [
      ...Array.from({ length: 50 }, (_, i) => ({ type: 'system', cwd, content: `line ${i}` })),
      { type: 'user', cwd, message: { content: 'typed on line 51' } },
    ])
    return env
  })
  try {
    await existing(page)
    const row = page.locator(`.history-row[data-session="${LATE}"]`)
    await expect(row).toBeVisible()
    await expect(row.locator('.preview')).toHaveCount(0)
    await page.keyboard.press('Escape')

    const cwd = join(home, 'work', 'web')
    await act(page, { type: 'startNew', agent: 'claude', folder: cwd, name: 'late' })
    await expect.poll(() => existsSync(join(home, 'claude-args.txt'))).toBe(true)
    const id =
      /--session-id (\S+)/.exec(readFileSync(join(home, 'claude-args.txt'), 'utf8'))?.[1] ?? ''
    write(home, cwd, id, [
      ...Array.from({ length: 50 }, (_, i) => ({ type: 'system', cwd, content: `line ${i}` })),
      { type: 'user', cwd, message: { content: 'typed on line 51' } },
    ])
    await page.waitForTimeout(4000)
    expect((await shown(page))?.projects[0]?.members).not.toContain(id)
  } finally {
    await launched.close()
  }
})

test('SES-16 renaming a session Claude named is refused with "This name comes from Claude"; state.json unchanged', async () => {
  const { launched, page, root } = await launch((dirs) => clientWork(dirs))
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    const before = readFileSync(stateFile(root), 'utf8')
    await rowMenu(page, CLIENT.login, 'Rename…')
    await expect(dialog(page).locator('.heading')).toHaveText('This name comes from Claude')
    await dialog(page).locator('button').first().click()
    await page.waitForTimeout(500)
    expect(readFileSync(stateFile(root), 'utf8')).toBe(before)
  } finally {
    await launched.close()
  }
})

test('SES-17, SES-18 renaming an unnamed session trims the name into names, the row and its tab; the transcript is untouched; an empty name drops it', async () => {
  const { launched, page, home, root } = await launch((dirs) => prepare(dirs))
  try {
    const row = page.locator(`.row[data-session="${SESSION}"]`)
    await expect(row).toBeVisible()
    await act(page, { type: 'openSession', session: SESSION })
    await expect(page.locator('.tab')).toHaveCount(1)
    const file = join(transcriptDir(home, join(home, 'work')), `${SESSION}.jsonl`)
    const bytes = readFileSync(file, 'utf8')
    const mtime = statSync(file).mtimeMs
    await rowMenu(page, SESSION, 'Rename…')
    await dialog(page).locator('input').fill('  Payments  ')
    await dialog(page).locator('button', { hasText: 'Save' }).click()
    await expect(row.locator('.name')).toHaveText('Payments')
    await expect(page.locator('.tab .title')).toHaveText('Payments')
    await expect.poll(() => readState(root).names?.[SESSION]).toBe('Payments')
    expect(readFileSync(file, 'utf8')).toBe(bytes)
    expect(statSync(file).mtimeMs).toBe(mtime)

    await rowMenu(page, SESSION, 'Rename…')
    await dialog(page).locator('input').fill('')
    await dialog(page).locator('button', { hasText: 'Save' }).click()
    await expect.poll(() => SESSION in (readState(root).names ?? {})).toBe(false)
    await expect(row.locator('.name')).toHaveText('fix the login bug')
  } finally {
    await launched.close()
  }
})

test('SES-30 Show folder path: the path line under home reads ~/…; a session without cwd has none', async () => {
  const NOCWD = '6f6f6f6f-0000-4000-8000-000000000006'
  const { launched, page } = await launch((dirs) => {
    const env = clientWork(dirs, { settings: { show_folder_path: true } })
    write(dirs.home, join(dirs.home, 'work', 'web'), NOCWD, [
      { type: 'user', message: { content: 'no folder recorded' } },
    ])
    return env
  })
  try {
    await existing(page)
    await expect(page.locator(`.history-row[data-session="${CLIENT.login}"] .path`)).toHaveText(
      '~/work/api',
    )
    await expect(page.locator(`.history-row[data-session="${NOCWD}"]`)).toBeVisible()
    await expect(page.locator(`.history-row[data-session="${NOCWD}"] .path`)).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('SES-35 New opens on the name step with a remembered folder that exists, and on the folder step when it is gone', async () => {
  const { launched, page, home } = await launch((dirs) =>
    clientWork(dirs, { settings: { new_session_dir: join(dirs.home, 'work', 'api') } }),
  )
  try {
    await page.locator('#strip-plus').click()
    await expect(page.locator('.add-session .switch.selected')).toHaveText('New')
    await expect(page.locator('.add-session')).toContainText('api~/work')
    await expect(page.locator('.add-session .folder-list')).toHaveCount(0)
    await page.keyboard.press('Escape')
    rmSync(join(home, 'work', 'api'), { recursive: true })
    await page.locator('#strip-plus').click()
    await expect(page.locator('.add-session .folder-list')).toBeVisible()
  } finally {
    await launched.close()
  }
})

async function newAt(page: Page, folder: string) {
  await page.locator('#strip-plus').click()
  await page.locator('.add-session .folder-list .another').waitFor()
  await page.locator(`.add-session .folder-row[data-folder="${folder}"]`).click()
}

test('SES-39 Start with a folder deleted after it was chosen: "That folder does not exist."', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    const folder = join(home, 'work', 'web')
    await newAt(page, folder)
    rmSync(folder, { recursive: true })
    await page.locator('.add-session input[placeholder="Name"]').fill('gone')
    await page.locator('.add-session button', { hasText: 'Start session' }).click()
    await expect(page.locator('.add-session .error-line')).toHaveText('That folder does not exist.')
    await expect(page.locator('.tab')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('SES-40, SES-41 Start with the switch on: a tab named as typed, its id in remote_control, the folder remembered; New again has the switch off', async () => {
  const { launched, page, home, root } = await launch((dirs) => clientWork(dirs))
  try {
    const folder = join(home, 'work', 'web')
    await newAt(page, folder)
    await page.locator('.add-session input[placeholder="Name"]').fill('Billing')
    await page.locator('.add-session .remote-row input').check()
    await page.locator('.add-session button', { hasText: 'Start session' }).click()
    await expect(page.locator('.add-session')).toHaveCount(0)
    await expect(page.locator('.tab .title')).toHaveText('Billing')
    await expect.poll(() => existsSync(join(home, 'claude-args.txt'))).toBe(true)
    const id = /--session-id (\S+)/.exec(readFileSync(join(home, 'claude-args.txt'), 'utf8'))?.[1]
    await expect.poll(() => readState(root).remote_control).toEqual([id])
    expect(readState(root).settings.new_session_dir).toBe(folder)
    await page.locator('#strip-plus').click()
    await expect(page.locator('.add-session .remote-row input')).not.toBeChecked()
  } finally {
    await launched.close()
  }
})

test('SES-42 with only Claude, Cursor is greyed out on New; with Cursor chosen there is no Remote control switch, and it is off', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    await newAt(page, join(home, 'work', 'web'))
    await expect(page.locator('.add-session [data-agent="cursor"]')).toBeDisabled()
    await expect(page.locator('.add-session .remote-row')).toBeVisible()
  } finally {
    await launched.close()
  }
  const both = await launch((dirs) => {
    const env = clientWork(dirs)
    writeFileSync(
      join(dirs.root, 'bin', 'cursor-agent'),
      '#!/bin/sh\nexec /bin/bash --norc --noprofile -i\n',
    )
    chmodSync(join(dirs.root, 'bin', 'cursor-agent'), 0o755)
    return env
  })
  try {
    await newAt(both.page, join(both.home, 'work', 'web'))
    await both.page.locator('.add-session .remote-row input').check()
    await both.page.locator('.add-session [data-agent="cursor"]').click()
    await expect(both.page.locator('.add-session .remote-row')).toBeHidden()
    await expect(both.page.locator('.add-session .remote-row input')).not.toBeChecked()
  } finally {
    await both.launched.close()
  }
})

test('SES-43 a session whose transcript holds only its name and /exit does not join; with a typed message it joins its start project', async () => {
  const { launched, page, home } = await launch((dirs) => ({
    ...clientWork(dirs),
    FAKE_CLAUDE_QUIET: '1',
  }))
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    const cwd = join(home, 'work', 'web')
    const lastId = () =>
      /--session-id (\S+)/.exec(
        readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n').pop() ?? '',
      )?.[1] ?? ''
    await act(page, { type: 'startNew', agent: 'claude', folder: cwd, name: 'quits' })
    await expect.poll(() => existsSync(join(home, 'claude-args.txt'))).toBe(true)
    const quits = lastId()
    write(home, cwd, quits, [
      { type: 'custom-title', customTitle: 'quits' },
      {
        type: 'user',
        cwd,
        message: {
          content:
            '<command-name>/exit</command-name>\n<command-message>exit</command-message>\n<command-args></command-args>',
        },
      },
    ])
    await page.waitForTimeout(4000)
    expect((await shown(page))?.projects[0]?.members).not.toContain(quits)
    write(home, cwd, quits, [
      { type: 'custom-title', customTitle: 'quits' },
      { type: 'user', cwd, message: { content: 'now a real message' } },
    ])
    await expect
      .poll(async () => (await shown(page))?.projects[0]?.members, { timeout: 10_000 })
      .toContain(quits)
  } finally {
    await launched.close()
  }
})

test('SES-45 Ctrl+Shift+T, Ctrl+B c and + open New; Add session, Ctrl+B N and Ctrl+Shift+F open Existing with the focus in its search; "New Cursor session…" selects Cursor', async () => {
  const { launched, page } = await launch((dirs) => {
    const env = clientWork(dirs, { tabs: [['login']] })
    writeFileSync(
      join(dirs.root, 'bin', 'cursor-agent'),
      '#!/bin/sh\nexec /bin/bash --norc --noprofile -i\n',
    )
    chmodSync(join(dirs.root, 'bin', 'cursor-agent'), 0o755)
    return env
  })
  try {
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    const opens = async (how: () => Promise<void>, page_: 'New' | 'Existing') => {
      await page.locator('.xterm').click()
      await how()
      await expect(page.locator('.add-session .switch.selected')).toHaveText(page_)
      if (page_ === 'Existing')
        await expect(page.locator('.add-session .search-row input')).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(page.locator('.add-session')).toHaveCount(0)
    }
    await opens(() => page.keyboard.press('Control+Shift+T'), 'New')
    await opens(async () => {
      await page.keyboard.press('Control+b')
      await page.keyboard.press('c')
    }, 'New')
    await opens(() => page.locator('#strip-plus').click(), 'New')
    await opens(() => page.locator('#add-session').click(), 'Existing')
    await opens(async () => {
      await page.keyboard.press('Control+b')
      await page.keyboard.press('Shift+N')
    }, 'Existing')
    await opens(() => page.keyboard.press('Control+Shift+F'), 'Existing')
    await page.locator('#new-menu').click()
    await page.locator('.menu-item', { hasText: 'New session' }).click()
    await expect(page.locator('.add-session .switch.selected')).toHaveText('New')
    await page.locator('.add-session [data-agent="cursor"]').click()
    await page.locator('.add-session .folder-row').first().click()
    await expect(page.locator('.add-session [data-agent="cursor"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  } finally {
    await launched.close()
  }
})

const LOOSE = '7a7a7a7a-0000-4000-8000-000000000007'

test('SES-46 Open on a session in no project makes it a member here and opens a tab', async () => {
  const { launched, page } = await launch((dirs) => {
    const env = clientWork(dirs)
    write(dirs.home, join(dirs.home, 'work', 'web'), LOOSE, [
      { type: 'custom-title', customTitle: 'loose end' },
      { type: 'user', cwd: join(dirs.home, 'work', 'web'), message: { content: 'loose' } },
    ])
    return env
  })
  try {
    await existing(page)
    await page.locator(`.history-row[data-session="${LOOSE}"]`).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: /^Open$/ }).click()
    await expect(page.locator('.tab .title')).toHaveText('loose end')
    expect((await shown(page))?.projects[0]?.members).toContain(LOOSE)
  } finally {
    await launched.close()
  }
})

test('SES-47 Open on a session of a project another window shows: the tab opens there and that window comes forward; this one gets none', async () => {
  const { launched, page } = await launch((dirs) =>
    clientWork(dirs, { extraProjects: [{ id: 'dddddddddddd', name: 'Research', members: [] }] }),
  )
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    const opened = launched.app.waitForEvent('window')
    await act(page, { type: 'switchProject', project: 'dddddddddddd' })
    await act(page, { type: 'newWindow' })
    const other = await opened
    await expect(other.locator('#project-button .project-name')).toHaveText('Client work')
    await launched.app.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        const focus = win.focus.bind(win)
        win.focus = () => {
          void win.webContents.executeJavaScript('globalThis.broughtForward = true')
          focus()
        }
      }
    })
    await page.locator('#add-session').click()
    await page.locator('.add-session button[title="Expand all groups"]').click()
    await page.locator(`.history-row[data-session="${CLIENT.long}"]`).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: /^Open$/ }).click()
    await expect(other.locator('.tab')).toHaveCount(1)
    await expect(page.locator('.tab')).toHaveCount(0)
    await expect
      .poll(() =>
        other.evaluate(
          () => (globalThis as unknown as { broughtForward?: boolean }).broughtForward ?? false,
        ),
      )
      .toBe(true)
  } finally {
    await launched.close()
  }
})

test('SES-50 Details on a 50 MB transcript shows "Reading transcript…" at once, and the window keeps responding', async () => {
  const BIG = '8b8b8b8b-0000-4000-8000-000000000008'
  const { launched, page } = await launch((dirs) => {
    const env = clientWork(dirs)
    const cwd = join(dirs.home, 'work', 'web')
    const line = `${JSON.stringify({ type: 'assistant', cwd, message: { content: [{ type: 'text', text: 'x'.repeat(1000) }] } })}\n`
    const file = write(dirs.home, cwd, BIG, [
      { type: 'custom-title', customTitle: 'big one' },
      { type: 'user', cwd, message: { content: 'start' } },
    ])
    writeFileSync(file, line.repeat(Math.ceil((50 * 1024 * 1024) / line.length)), { flag: 'a' })
    return env
  })
  try {
    await existing(page)
    await page.locator(`.history-row[data-session="${BIG}"]`).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Details…' }).click()
    const details = page.locator('.dialog.details')
    await expect(details).toContainText('Reading transcript…', { timeout: 1000 })
    const started = Date.now()
    await page.evaluate(() => 1)
    expect(Date.now() - started).toBeLessThan(500)
    await expect(details).toContainText('Session ID', { timeout: 30_000 })
  } finally {
    await launched.close()
  }
})

test('SES-55 Export into a folder the user cannot write: "Export failed" with Menkar’s sentence, and no file left', async () => {
  const { launched, page, root } = await launch((dirs) => clientWork(dirs))
  try {
    const locked = join(root, 'locked')
    mkdirSync(locked)
    chmodSync(locked, 0o555)
    await launched.app.evaluate(
      ({ dialog }, f) => {
        dialog.showSaveDialog = (async () => ({ canceled: false, filePath: f })) as never
      },
      join(locked, 'login.md'),
    )
    await rowMenu(page, CLIENT.login, 'Export as Markdown…')
    await expect(dialog(page).locator('.heading')).toHaveText('Export failed')
    await expect(dialog(page).locator('.body')).not.toContainText('EACCES')
    expect(existsSync(join(locked, 'login.md'))).toBe(false)
    chmodSync(locked, 0o755)
  } finally {
    await launched.close()
  }
})

test('SES-57 Replay: Play shows one more turn every 800 ms; at 4 / 4 it stops and Next and Show all are disabled', async () => {
  const FOUR = '9c9c9c9c-0000-4000-8000-000000000009'
  const { launched, page } = await launch((dirs) => {
    const env = clientWork(dirs)
    const cwd = join(dirs.home, 'work', 'web')
    const say = (text: string) => ({
      type: 'assistant',
      cwd,
      message: { content: [{ type: 'text', text }] },
    })
    write(dirs.home, cwd, FOUR, [
      { type: 'custom-title', customTitle: 'four turns' },
      { type: 'user', cwd, message: { content: 'one' } },
      say('two'),
      { type: 'user', cwd, message: { content: 'three' } },
      say('four'),
    ])
    return env
  })
  try {
    await act(page, { type: 'replaySession', session: FOUR })
    const progress = page.locator('.replay .progress')
    await expect(progress).toHaveText('1 / 4')
    await page.locator('.replay button[title="Play"]').click()
    const started = Date.now()
    await expect(progress).toHaveText('2 / 4')
    const first = Date.now() - started
    expect(first).toBeGreaterThan(600)
    expect(first).toBeLessThan(1400)
    await expect(progress).toHaveText('4 / 4', { timeout: 3000 })
    await expect(page.locator('.replay button[title="Next"]')).toBeDisabled()
    await expect(page.locator('.replay button', { hasText: 'Show all' })).toBeDisabled()
    await page.waitForTimeout(1000)
    await expect(progress).toHaveText('4 / 4')
  } finally {
    await launched.close()
  }
})

test('SES-60, SES-61 Copy session ID puts the 36-character id on the clipboard; from the tab of a new session with no transcript yet it leaves the clipboard as it was', async () => {
  const { launched, page, home } = await launch((dirs) => ({
    ...clientWork(dirs),
    FAKE_CLAUDE_QUIET: '1',
  }))
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    await rowMenu(page, CLIENT.login, 'Copy session ID')
    const clip = () => launched.app.evaluate(({ clipboard }) => clipboard.readText())
    await expect.poll(clip).toBe(CLIENT.login)
    expect(CLIENT.login).toHaveLength(36)
    await act(page, {
      type: 'startNew',
      agent: 'claude',
      folder: join(home, 'work', 'web'),
      name: 'fresh',
    })
    await expect(page.locator('.tab')).toHaveCount(1)
    await page.locator('.tab').click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Copy session ID' }).click()
    await page.waitForTimeout(300)
    expect(await clip()).toBe(CLIENT.login)
  } finally {
    await launched.close()
  }
})

test('SES-62, SES-63 Hide leaves the history, not the project; hidden holds it; Show hidden brings it back with Unhide; after a restart the option is off', async () => {
  let root = ''
  let launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return clientWork(dirs)
    },
  })
  try {
    const page = launched.window
    await existing(page)
    await page.locator(`.history-row[data-session="${CLIENT.long}"]`).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Hide session' }).click()
    await expect(page.locator(`.history-row[data-session="${CLIENT.long}"]`)).toHaveCount(0)
    await expect.poll(() => readState(root).hidden).toEqual([CLIENT.long])
    await page.keyboard.press('Escape')
    await expect(page.locator('.add-session')).toHaveCount(0)
    await expect(page.locator(`#session-list .row[data-session="${CLIENT.long}"]`)).toBeVisible()
    await page.locator('#main-menu').click()
    await page.locator('.menu-item', { hasText: 'Show hidden sessions' }).click()
    await existing(page)
    await page.locator(`.history-row[data-session="${CLIENT.long}"]`).click({ button: 'right' })
    await expect(page.locator('.menu-item', { hasText: 'Unhide session' })).toBeVisible()
    await page.keyboard.press('Escape')
    await launched.app.close()
    launched = await launchApp({
      prepare: (dirs) => {
        const env = clientWork(dirs)
        cpSync(join(root, 'config'), join(dirs.root, 'config'), { recursive: true })
        return env
      },
    })
    await launched.window.locator('#main-menu').click()
    await expect(
      launched.window.locator('.menu-item', { hasText: 'Show hidden sessions' }),
    ).toHaveText('Show hidden sessions')
  } finally {
    await launched.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('SES-70 a selected session whose transcript is deleted outside the app drops out of the count after the rescan', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    await existing(page)
    await page.locator('.add-session button[title="Select sessions"]').click()
    await page.locator(`.history-row[data-session="${CLIENT.login}"]`).click()
    await page.locator(`.history-row[data-session="${CLIENT.long}"]`).click()
    await expect(page.locator('.add-session .selected-count')).toHaveText('2 selected')
    rmSync(join(transcriptDir(home, join(home, 'work', 'web')), `${CLIENT.long}.jsonl`))
    await page.locator('.add-session button[title="Refresh session list"]').click()
    await expect(page.locator('.add-session .selected-count')).toHaveText('1 selected')
  } finally {
    await launched.close()
  }
})
