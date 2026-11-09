import { spawn } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi } from '../src/shared/ipc'
import { type LaunchedApp, launchApp } from './app'
import { clientWork } from './fixtures'

type PageGlobals = { menkar: MenkarApi }

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) => (globalThis as unknown as PageGlobals).menkar.window.act(a as never),
    action,
  ) as Promise<{ refusal?: string; value?: unknown }>

const shown = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as PageGlobals).menkar.window.state())

const dialog = (page: Page) => page.locator('.dialog')

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
  await expect(launched.window.locator('#session-list .row')).toHaveCount(3)
  return { launched, page: launched.window, home, root }
}

// The chooser answers with this path; what it was asked is kept for the test to read.
async function chooseFile(launched: LaunchedApp, path: string | null) {
  await launched.app.evaluate(({ dialog }, p) => {
    const g = globalThis as unknown as { asked?: unknown }
    dialog.showOpenDialog = (async (...args: unknown[]) => {
      g.asked = args[args.length - 1]
      return p === null ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: [p] }
    }) as never
  }, path)
}
const asked = (launched: LaunchedApp) =>
  launched.app.evaluate(() => (globalThis as unknown as { asked?: Record<string, unknown> }).asked)

async function openSessionFile(page: Page) {
  await page.locator('#main-menu').click()
  await page.locator('.menu-item', { hasText: 'Open session file…' }).click()
}

test('FIL-36 Open session file: a chooser for transcripts in ~/.claude; a named transcript replays in a tab, not started, not a member, gone after a restart', async () => {
  const LOGIN = '3f2a0000-0000-4000-8000-000000000036'
  const { launched, page, home, root } = await launch((dirs) => clientWork(dirs))
  try {
    const file = join(home, 'elsewhere', `${LOGIN}.jsonl`)
    mkdirSync(join(home, 'elsewhere'))
    writeFileSync(
      file,
      `${JSON.stringify({ type: 'custom-title', customTitle: 'Login flow' })}\n${JSON.stringify({ type: 'user', message: { content: 'log me in' } })}\n`,
    )
    await chooseFile(launched, file)
    await openSessionFile(page)
    await expect(page.locator('.tab .title')).toHaveText('Replay — Login flow')
    const options = await asked(launched)
    expect(options?.title).toBe('Open session transcript')
    expect(options?.defaultPath).toBe(join(home, '.claude'))
    expect(options?.filters).toEqual([{ name: 'JSONL', extensions: ['jsonl'] }])
    const state = await shown(page)
    expect(state?.running).toEqual([])
    expect(state?.projects[0]?.members).not.toContain(LOGIN)
    expect(existsSync(join(home, 'claude-args.txt'))).toBe(false)
    await page.waitForTimeout(800)
    const saved = JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
    expect(saved.windows[0]?.tabs ?? {}).toEqual({})
  } finally {
    await launched.close()
  }
})

test('FIL-37, FIL-38 an empty transcript replays as "Nothing to replay yet." with the controls off; one whose first line has a top-level role is read as Cursor', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    const empty = join(home, 'empty.jsonl')
    writeFileSync(empty, '')
    await chooseFile(launched, empty)
    await openSessionFile(page)
    await expect(page.locator('.replay')).toContainText('Nothing to replay yet.')
    await expect(dialog(page)).toHaveCount(0)
    for (const title of ['Previous', 'Play', 'Next'])
      await expect(page.locator(`.replay button[title="${title}"]`)).toBeDisabled()

    const cursor = join(home, 'cursor-chat.jsonl')
    writeFileSync(
      cursor,
      `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: '<user_query>hello cursor</user_query>' }] } })}\n`,
    )
    await chooseFile(launched, cursor)
    await openSessionFile(page)
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('.tab-body:not(.hidden) .replay')).toContainText('hello cursor')
    await expect(page.locator('.tab-body:not(.hidden) .replay')).not.toContainText('<user_query>')
  } finally {
    await launched.close()
  }
})

test('FIL-39 the chosen transcript is gone before it is read: "Could not open transcript" with Menkar’s sentence, and no tab', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    await chooseFile(launched, join(home, 'vanished.jsonl'))
    await openSessionFile(page)
    await expect(dialog(page).locator('.heading')).toHaveText('Could not open transcript')
    await expect(dialog(page).locator('.body')).toHaveText(
      'The file couldn’t be read as a session transcript.',
    )
    await expect(page.locator('.tab')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

const ELECTRON = resolve('node_modules/electron/dist/electron')
function menkarOpen(args: string[], cwd: string, env: Readonly<Record<string, string>>) {
  return spawn(ELECTRON, ['--no-sandbox', '--ozone-platform=x11', resolve('.'), 'open', ...args], {
    cwd,
    env,
    stdio: 'ignore',
  })
}

const visibleEditor = (page: Page) => page.locator('.tab-body:not(.hidden) .cm-content')

async function typeInto(page: Page, text: string) {
  await visibleEditor(page).click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(text)
}

const RESEARCH = { id: 'dddddddddddd', name: 'Research', members: [] as string[] }

test('FIL-7 Browse… starts in the project’s one folder, or the chooser’s own default with two; the choice goes into the entry and opens nothing', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    await chooseFile(launched, join(home, 'work', 'api', 'README.md'))
    await page.locator('#session-list').click()
    await page.keyboard.press('Control+Shift+O')
    await page.locator('.open-file button', { hasText: 'Browse…' }).click()
    await expect(page.locator('.open-file input')).toHaveValue(
      join(home, 'work', 'api', 'README.md'),
    )
    expect((await asked(launched))?.defaultPath).toBeUndefined()
    await expect(page.locator('.tab')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await act(page, { type: 'removeMember', session: '3c3c3c3c-0000-4000-8000-000000000003' })
    await page.keyboard.press('Control+Shift+O')
    await page.locator('.open-file button', { hasText: 'Browse…' }).click()
    await expect
      .poll(async () => (await asked(launched))?.defaultPath)
      .toBe(join(home, 'work', 'api'))
  } finally {
    await launched.close()
  }
})

test('FIL-9, FIL-11 the same file again selects its tab; in another project it is a second tab sharing the text, the mark and the save; switching projects keeps unsaved edits', async () => {
  const { launched, page, home } = await launch((dirs) =>
    clientWork(dirs, { extraProjects: [RESEARCH] }),
  )
  try {
    const file = join(home, 'notes.md')
    writeFileSync(file, '# notes\n')
    await act(page, { type: 'openFilePath', path: file })
    await act(page, { type: 'openFilePath', path: file })
    await expect(page.locator('.tab')).toHaveCount(1)
    await typeInto(page, 'edited in A')
    await expect(page.locator('.tab .title')).toHaveText('notes.md')
    await expect(page.locator('.tab .unsaved-dot')).toHaveCount(1)
    await act(page, { type: 'switchProject', project: RESEARCH.id })
    await expect(page.locator('.tab')).toHaveCount(0)
    await act(page, { type: 'openFilePath', path: file })
    await expect(page.locator('.tab .title')).toHaveText('notes.md')
    await expect(page.locator('.tab .unsaved-dot')).toHaveCount(1)
    await expect(visibleEditor(page)).toContainText('edited in A')
    await typeInto(page, ' and B')
    await act(page, { type: 'switchProject', project: 'cccccccccccc' })
    await expect(page.locator('.tab .title')).toHaveText('notes.md')
    await expect(page.locator('.tab .unsaved-dot')).toHaveCount(1)
    await expect(visibleEditor(page)).toContainText('edited in A and B')
    await visibleEditor(page).click()
    await page.keyboard.press('Control+s')
    await expect(page.locator('.tab .title')).toHaveText('notes.md')
    await expect(page.locator('.tab .unsaved-dot')).toHaveCount(0)
    await expect.poll(() => readFileSync(file, 'utf8')).toBe('# notes\nedited in A and B')
    await act(page, { type: 'switchProject', project: RESEARCH.id })
    await expect(page.locator('.tab .title')).toHaveText('notes.md')
  } finally {
    await launched.close()
  }
})

test('FIL-14 Ctrl+S reaches the terminal in a terminal tab; in a file tab it saves and Ctrl+Shift+V previews, the terminal getting nothing', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs, { tabs: [['login']] }))
  try {
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    const input = () =>
      existsSync(join(home, 'claude-input.txt'))
        ? readFileSync(join(home, 'claude-input.txt'), 'utf8').trim().split('\n')
        : []
    await page.locator('.xterm').click()
    await page.keyboard.press('Control+s')
    await expect.poll(input).toEqual(['13'])
    const file = join(home, 'notes.md')
    writeFileSync(file, '# notes\n')
    await act(page, { type: 'openFilePath', path: file })
    await typeInto(page, 'x')
    await page.keyboard.press('Control+s')
    await expect.poll(() => readFileSync(file, 'utf8')).toBe('# notes\nx')
    await page.keyboard.press('Control+Shift+V')
    await expect(page.locator('.tab', { hasText: 'Preview — notes.md' })).toHaveCount(1)
    expect(input()).toEqual(['13'])
  } finally {
    await launched.close()
  }
})

const activeLine = (page: Page) =>
  page
    .locator('.tab-body:not(.hidden) .cm-line')
    .evaluateAll((ns) => ns.findIndex((n) => n.classList.contains('cm-activeLine')))

test('FIL-16 with no edits, another program’s rewrite shows at once, the cursor on the same line (or the last), and no bar', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    const file = join(home, 'list.txt')
    writeFileSync(file, 'one\ntwo\nthree\nfour\n')
    await act(page, { type: 'openFilePath', path: file })
    await page.locator('.cm-line', { hasText: 'three' }).click()
    expect(await activeLine(page)).toBe(2)
    writeFileSync(file, 'uno\ndos\ntres\ncuatro\ncinco\n')
    await expect(visibleEditor(page)).toContainText('cinco')
    expect(await activeLine(page)).toBe(2)
    await expect(page.locator('.file-bar')).toHaveCount(0)
    writeFileSync(file, 'solo\n')
    await expect(visibleEditor(page)).toHaveText('solo')
    expect(await activeLine(page)).toBe(
      (await page.locator('.tab-body:not(.hidden) .cm-line').count()) - 1,
    )
  } finally {
    await launched.close()
  }
})

test('FIL-17 with edits, a rewrite shows the bar; Reload takes the disk; Keep mine keeps the edits and Ctrl+S overwrites', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    const file = join(home, 'notes.md')
    writeFileSync(file, 'mine\n')
    await act(page, { type: 'openFilePath', path: file })
    await typeInto(page, 'edit')
    writeFileSync(file, 'theirs\n')
    const bar = page.locator('.file-bar')
    await expect(bar.locator('.bar-text')).toHaveText(
      'The file changed on disk, and you have unsaved edits.',
    )
    await bar.locator('button', { hasText: 'Reload' }).click()
    await expect(visibleEditor(page)).toHaveText('theirs')
    await expect(page.locator('.tab .title')).toHaveText('notes.md')
    await expect(bar).toHaveCount(0)

    await typeInto(page, ' plus')
    writeFileSync(file, 'other program\n')
    await bar.locator('button', { hasText: 'Keep mine' }).click()
    await expect(bar).toHaveCount(0)
    await expect(visibleEditor(page)).toContainText('theirs plus')
    await visibleEditor(page).click()
    await page.keyboard.press('Control+s')
    await expect.poll(() => readFileSync(file, 'utf8')).toBe('theirs\n plus')
  } finally {
    await launched.close()
  }
})

test('FIL-18 deleted on disk: the bar with no buttons; Ctrl+S writes the file again and the bar goes', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    const file = join(home, 'notes.md')
    writeFileSync(file, 'keep me\n')
    await act(page, { type: 'openFilePath', path: file })
    await expect(visibleEditor(page)).toHaveText('keep me')
    rmSync(file)
    const bar = page.locator('.file-bar')
    await expect(bar.locator('.bar-text')).toHaveText(
      'The file was deleted on disk; saving writes it again.',
    )
    await expect(bar.locator('button')).toHaveCount(0)
    await visibleEditor(page).click()
    await page.keyboard.press('Control+s')
    await expect.poll(() => existsSync(file) && readFileSync(file, 'utf8')).toBe('keep me\n')
    await expect(bar).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('FIL-19 a save the system refuses: "{name} was not saved" with Menkar’s sentence, and the mark stays', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    const dir = join(home, 'locked')
    mkdirSync(dir)
    const file = join(dir, 'notes.md')
    writeFileSync(file, 'x\n')
    await act(page, { type: 'openFilePath', path: file })
    await typeInto(page, 'y')
    chmodSync(file, 0o444)
    chmodSync(dir, 0o555)
    await page.keyboard.press('Control+s')
    await expect(page.locator('[role="alertdialog"] .heading')).toHaveText('notes.md was not saved')
    await expect(page.locator('[role="alertdialog"] .body')).toHaveText(
      'It could not be written; the edits are still in the tab.',
    )
    await expect(page.locator('.tab .title')).toHaveText('notes.md')
    await expect(page.locator('.tab .unsaved-dot')).toHaveCount(1)
    chmodSync(dir, 0o755)
    chmodSync(file, 0o644)
  } finally {
    await launched.close()
  }
})

test('FIL-21 the same edited file in two projects: closing the first tab asks nothing; closing the last asks', async () => {
  const { launched, page, home } = await launch((dirs) =>
    clientWork(dirs, { extraProjects: [RESEARCH] }),
  )
  try {
    const file = join(home, 'notes.md')
    writeFileSync(file, 'x\n')
    await act(page, { type: 'openFilePath', path: file })
    await act(page, { type: 'switchProject', project: RESEARCH.id })
    await act(page, { type: 'openFilePath', path: file })
    await typeInto(page, 'edit')
    await act(page, { type: 'switchProject', project: 'cccccccccccc' })
    await page.locator('.tab .close').click()
    await expect(page.locator('.tab')).toHaveCount(0)
    await expect(dialog(page)).toHaveCount(0)
    await act(page, { type: 'switchProject', project: RESEARCH.id })
    await page.locator('.tab .close').click()
    await expect(dialog(page).locator('.heading')).toHaveText('Save changes to notes.md?')
  } finally {
    await launched.close()
  }
})

test('FIL-22 closing a window with edited files asks once for all of them, a file also open elsewhere left out; Save saves both and the window closes', async () => {
  const { launched, page, home } = await launch((dirs) =>
    clientWork(dirs, { extraProjects: [RESEARCH] }),
  )
  try {
    const [a, b, c] = ['a.md', 'b.txt', 'c.md'].map((n) => join(home, n)) as [
      string,
      string,
      string,
    ]
    for (const f of [a, b, c]) writeFileSync(f, `${f}\n`)
    const opened = launched.app.waitForEvent('window')
    await act(page, { type: 'newWindow' })
    const other = await opened
    await act(other, { type: 'openFilePath', path: c })
    for (const f of [a, b, c]) {
      await act(page, { type: 'openFilePath', path: f })
      await typeInto(page, '+')
    }
    await launched.app.evaluate(({ app, BrowserWindow }) => {
      app.removeAllListeners('window-all-closed')
      BrowserWindow.getAllWindows()
        .sort((x, y) => x.id - y.id)[0]
        ?.close()
    })
    await expect(dialog(page).locator('.heading')).toHaveText('Save changes to a.md, b.txt?')
    await dialog(page).locator('button', { hasText: 'Save' }).click()
    await expect.poll(() => launched.app.windows().length).toBe(1)
    expect(readFileSync(a, 'utf8')).toBe(`${a}\n+`)
    expect(readFileSync(b, 'utf8')).toBe(`${b}\n+`)
    expect(readFileSync(c, 'utf8')).toBe(`${c}\n`)
    // c.md's edit is still open in the other window, which would ask at the end of the test.
    await launched.app.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) w.destroy()
    })
  } finally {
    await launched.close()
  }
})

async function previewOf(
  page: Page,
  home: string,
  text: string,
  extra: (h: string) => void = () => undefined,
) {
  const file = join(home, 'doc.md')
  writeFileSync(file, text)
  extra(home)
  await act(page, { type: 'openFilePath', path: file })
  await page.locator('.preview-row button:not(.save)').click()
  const frame = page.frameLocator('.tab-body:not(.hidden) iframe.preview-frame')
  return { file, frame }
}

test('FIL-26 the preview updates 300 ms after the last keystroke, once after continuous typing, keeping its scroll', async () => {
  const { launched, page, home } = await launch((dirs) =>
    clientWork(dirs, { extraProjects: [RESEARCH] }),
  )
  try {
    const long = `${Array.from({ length: 200 }, (_, i) => `line ${i}\n`).join('\n')}`
    await previewOf(page, home, long)
    await expect(page.locator('.tab')).toHaveCount(2)
    // The preview tab follows the editor tab's buffer.
    await page.locator('.tab').first().click()
    const frameEl = page.locator('iframe.preview-frame')
    await frameEl.evaluate((f: HTMLIFrameElement) => {
      const g = globalThis as unknown as { updates: number[] }
      g.updates = []
      new MutationObserver(() => g.updates.push(performance.now())).observe(f, {
        attributes: true,
        attributeFilter: ['srcdoc'],
      })
    })
    await page.locator('.tab').nth(1).click()
    await expect(frameEl).toBeVisible()
    await expect
      .poll(() =>
        frameEl.evaluate((f: HTMLIFrameElement) => {
          f.contentWindow?.scrollTo(0, 900)
          return f.contentWindow?.scrollY
        }),
      )
      .toBe(900)
    await page.locator('.tab').first().click()
    const updates = () =>
      page.evaluate(() => (globalThis as unknown as { updates: number[] }).updates.length)
    await visibleEditor(page).click()
    await page.keyboard.press('Control+End')
    const end = Date.now() + 2000
    while (Date.now() < end) await page.keyboard.type('x', { delay: 100 })
    expect(await updates()).toBe(0)
    await page.waitForTimeout(150)
    expect(await updates()).toBe(0)
    await expect.poll(updates, { timeout: 1500 }).toBe(1)
    await page.waitForTimeout(500)
    expect(await updates()).toBe(1)
    await page.locator('.tab').nth(1).click()
    await expect
      .poll(() =>
        frameEl.evaluate(
          (f: HTMLIFrameElement) => f.contentDocument?.scrollingElement?.scrollTop ?? 0,
        ),
      )
      .toBe(900)
  } finally {
    await launched.close()
  }
})

test('FIL-27, FIL-28 the preview: a relative image shows, a remote one is never fetched; links open in the browser, a .md opens a tab, a .txt does nothing, #anchors stay', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    await launched.app.evaluate(({ session, shell }) => {
      const g = globalThis as unknown as { remote: string[]; opened: string[] }
      g.remote = []
      g.opened = []
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        if (details.url.startsWith('http')) g.remote.push(details.url)
        callback({})
      })
      shell.openExternal = (async (url: string) => {
        g.opened.push(url)
      }) as never
    })
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    const { frame } = await previewOf(
      page,
      home,
      '# Doc\n\n![](img/a.png)\n\n![](https://example.com/a.png)\n\n[x](https://example.com)\n\n[d](docs/guide.md)\n\n[t](notes.txt)\n\n[s](#setup)\n\n## Setup\n',
      (h) => {
        mkdirSync(join(h, 'img'))
        writeFileSync(join(h, 'img', 'a.png'), png)
        mkdirSync(join(h, 'docs'))
        writeFileSync(join(h, 'docs', 'guide.md'), '# guide\n')
        writeFileSync(join(h, 'notes.txt'), 'notes\n')
      },
    )
    await expect
      .poll(() =>
        frame
          .locator('img')
          .first()
          .evaluate((i: HTMLImageElement) => i.naturalWidth),
      )
      .toBe(1)
    await frame.locator('a', { hasText: 'x' }).click()
    await expect
      .poll(() =>
        launched.app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened),
      )
      .toEqual(['https://example.com'])
    await expect(frame.locator('h1')).toHaveText('Doc')
    const tabs = await page.locator('.tab').count()
    await frame.locator('a', { hasText: /^t$/ }).click()
    await frame.locator('a', { hasText: /^s$/ }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('.tab')).toHaveCount(tabs)
    await expect(frame.locator('h1')).toHaveText('Doc')
    await frame.locator('a', { hasText: /^d$/ }).click()
    await expect(page.locator('.tab')).toHaveCount(tabs + 1)
    await expect(page.locator('.tab.selected')).toHaveText(/guide\.md/)
    expect(
      await launched.app.evaluate(() => (globalThis as unknown as { remote: string[] }).remote),
    ).toEqual([])
  } finally {
    await launched.close()
  }
})

test('FIL-29 turning the app dark re-renders the preview on #1e1e1e with #e8e8ea text, and darkens the editor', async () => {
  const { launched, page, home } = await launch((dirs) =>
    clientWork(dirs, { settings: { color_scheme: 'light' } }),
  )
  try {
    const { frame } = await previewOf(page, home, '# Doc\n\ntext\n')
    await expect(frame.locator('p')).toHaveText('text')
    await page.evaluate(() =>
      (globalThis as unknown as PageGlobals).menkar.preferences.set('color_scheme', 'dark'),
    )
    await expect
      .poll(() =>
        frame
          .locator('body')
          .evaluate((b) => [getComputedStyle(b).backgroundColor, getComputedStyle(b).color]),
      )
      .toEqual(['rgb(30, 30, 30)', 'rgb(232, 232, 234)'])
    await page.locator('.tab').first().click()
    await expect
      .poll(() =>
        page
          .locator('.tab-body:not(.hidden) .cm-editor')
          .evaluate((n) => getComputedStyle(n).backgroundColor),
      )
      .toBe('rgb(30, 30, 30)')
  } finally {
    await launched.close()
  }
})

test('FIL-33, FIL-35 `menkar open` with two windows asks which; B takes both, Cancel opens none; a binary file is refused while the other opens', async () => {
  const { launched, page, home } = await launch((dirs) =>
    clientWork(dirs, { extraProjects: [RESEARCH] }),
  )
  try {
    const work = join(home, 'work', 'api')
    writeFileSync(join(work, 'a.md'), 'a\n')
    writeFileSync(join(work, 'b.md'), 'b\n')
    writeFileSync(join(work, 'big.bin'), Buffer.from([0, 1, 2, 0, 3]))
    const opened = launched.app.waitForEvent('window')
    await act(page, { type: 'newWindow' })
    const other = await opened
    await expect(other.locator('#project-button .project-name')).toHaveText('Research')
    // A is the window focused last (no window manager here moves the focus itself).
    await launched.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .sort((x, y) => x.id - y.id)[0]
        ?.emit('focus'),
    )

    menkarOpen(['a.md', 'b.md'], work, launched.env)
    await expect(dialog(page).locator('.heading')).toHaveText('Open in which window?')
    await expect(dialog(page).locator('.body')).toHaveText('a.md, b.md')
    await expect(dialog(page).locator('.responses button')).toHaveText([
      'Cancel',
      'Client work',
      'Research',
    ])
    await expect(dialog(page).locator('.responses button.suggested-text')).toHaveText('Client work')
    await dialog(page).locator('button', { hasText: 'Cancel' }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('.tab')).toHaveCount(0)
    await expect(other.locator('.tab')).toHaveCount(0)

    menkarOpen(['a.md', 'b.md'], work, launched.env)
    await dialog(page).locator('button', { hasText: 'Research' }).click()
    await expect(other.locator('.tab')).toHaveCount(2)

    await other.close()
    writeFileSync(join(work, 'ok.md'), 'ok\n')
    menkarOpen(['big.bin', 'ok.md'], work, launched.env)
    await expect(dialog(page).locator('.heading')).toHaveText('The file was not opened')
    await expect(dialog(page).locator('.body')).toContainText('The file looks binary, not text.')
    await expect(page.locator('.tab', { hasText: 'ok.md' })).toHaveCount(1)
  } finally {
    await launched.close()
  }
})

const tabOf = (page: Page, name: string) => page.locator('.tab', { hasText: name })

test('FIL-40 (decision 1.28) an editor tab with unsaved edits shows a dot in the ring’s slot, in every tab of that file in every window; saving clears it; a preview tab never has one', async () => {
  const { launched, page, home } = await launch((dirs) =>
    clientWork(dirs, { extraProjects: [RESEARCH] }),
  )
  try {
    const file = join(home, 'notes.md')
    writeFileSync(file, '# notes\n')
    const opened = launched.app.waitForEvent('window')
    await act(page, { type: 'newWindow' })
    const other = await opened
    await act(other, { type: 'openFilePath', path: file })
    await act(page, { type: 'openFilePath', path: file })
    await page.locator('.preview-row button', { hasText: 'Preview' }).click()
    await expect(page.locator('.tab')).toHaveCount(2)
    const editorTab = page.locator('.tab').first()
    await editorTab.click()
    await expect(page.locator('.tab .unsaved-dot')).toHaveCount(0)
    await expect(other.locator('.tab .unsaved-dot')).toHaveCount(0)

    await typeInto(page, 'edited')
    await expect(editorTab.locator('.unsaved-dot')).toHaveCount(1)
    await expect(editorTab.locator('.title')).toHaveText('notes.md')
    await expect(editorTab.locator('.unsaved-dot')).toHaveAttribute('title', 'Unsaved changes')
    // Between the name and the ×, in the tab's own text color.
    const order = await editorTab.evaluate((n) =>
      [...n.children].map((c) => c.className.toString().split(' ')[0]),
    )
    expect(order.indexOf('unsaved-dot')).toBe(order.indexOf('title') + 1)
    expect(order.indexOf('close')).toBe(order.indexOf('unsaved-dot') + 1)
    const colors = await editorTab.evaluate((n) => [
      getComputedStyle(n.querySelector('.unsaved-dot') as Element).backgroundColor,
      getComputedStyle(n.querySelector('.title') as Element).color,
    ])
    expect(colors[0]).toBe(colors[1])
    await expect(tabOf(page, 'Preview').locator('.unsaved-dot')).toHaveCount(0)
    await expect(other.locator('.tab .unsaved-dot')).toHaveCount(1)

    await visibleEditor(page).click()
    await page.keyboard.press('Control+s')
    await expect(page.locator('.tab .unsaved-dot')).toHaveCount(0)
    await expect(other.locator('.tab .unsaved-dot')).toHaveCount(0)
    await expect.poll(() => readFileSync(file, 'utf8')).toBe('# notes\nedited')

    await typeInto(other, ' again')
    await expect(editorTab.locator('.unsaved-dot')).toHaveCount(1)
    await expect(other.locator('.tab .unsaved-dot')).toHaveCount(1)
    await launched.app.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows()) w.destroy()
    })
  } finally {
    await launched.close()
  }
})

test('FIL-41 (decision 1.28) Save sits left of Preview (where Preview would be in a non-Markdown file): off while there is nothing to save, on after typing, and saves like Ctrl+S; off in a read-only tab, saying why', async () => {
  const { launched, page, home } = await launch((dirs) => clientWork(dirs))
  try {
    const md = join(home, 'notes.md')
    const txt = join(home, 'plain.txt')
    writeFileSync(md, '# notes\n')
    writeFileSync(txt, 'plain\n')
    await act(page, { type: 'openFilePath', path: md })
    const row = page.locator('.tab-body:not(.hidden) .preview-row')
    await expect(row.locator('button')).toHaveText(['Save', 'Preview'])
    const save = row.locator('button', { hasText: 'Save' })
    await expect(save).toBeDisabled()
    await expect(save).toHaveAttribute('title', 'No unsaved changes')
    const preview = await row.locator('button', { hasText: 'Preview' }).evaluate((n) => {
      const s = getComputedStyle(n)
      return [n.className, s.fontSize, s.paddingTop, s.borderRadius]
    })
    expect(
      await save.evaluate((n) => {
        const s = getComputedStyle(n)
        return [n.className.replace(' save', ''), s.fontSize, s.paddingTop, s.borderRadius]
      }),
    ).toEqual(preview)

    await typeInto(page, 'more')
    await expect(save).toBeEnabled()
    await expect(save).toHaveAttribute('title', 'Save (Ctrl+S)')
    await save.click()
    await expect.poll(() => readFileSync(md, 'utf8')).toBe('# notes\nmore')
    await expect(page.locator('.tab .unsaved-dot')).toHaveCount(0)
    await expect(save).toBeDisabled()

    await act(page, { type: 'openFilePath', path: txt })
    const txtRow = page.locator('.tab-body:not(.hidden) .preview-row')
    await expect(txtRow.locator('button')).toHaveText(['Save'])
    const rowBox = await txtRow.boundingBox()
    const saveBox = await txtRow.locator('button').boundingBox()
    // At the row's right end, where Preview sits in a Markdown file.
    expect(
      (rowBox?.x ?? 0) + (rowBox?.width ?? 0) - ((saveBox?.x ?? 0) + (saveBox?.width ?? 0)),
    ).toBe(8)

    const agentFile = join(home, '.claude', 'CLAUDE.md')
    mkdirSync(join(home, '.claude'), { recursive: true })
    writeFileSync(agentFile, '# rules\n')
    await act(page, { type: 'openFilePath', path: agentFile })
    const roSave = page.locator('.tab-body:not(.hidden) .preview-row button', { hasText: 'Save' })
    await expect(roSave).toBeDisabled()
    await expect(roSave).toHaveAttribute(
      'title',
      'This file belongs to Claude Code: Menkar only reads it.',
    )
  } finally {
    await launched.close()
  }
})
