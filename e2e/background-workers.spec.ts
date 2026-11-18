// Decision 1.176: in the orchestration mode the orchestrator's workers run without a tab in the
// strip. A click on a worker's row shows it in its project's one peek tab, last; closing a worker's
// tab only sends it back to the background, its process running; only Stop ends it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { endSessions, type LaunchedApp, launchApp, terminalText } from './app'
import { catppuccin, prepare, SESSION } from './fixtures'

const CLIENT_WORK = 'aaaaaaaaaaaa'
// A worker of the orchestrator's that is not running: no tab at all.
const HELPER = 'd4e5f6a7-1111-4222-8333-444455556666'

interface TabState {
  readonly id: string
  readonly title: string
  readonly place?: string | undefined
  readonly panes: readonly { readonly sessionId: string | null }[]
}

async function open(options: { readonly helper?: boolean } = {}): Promise<{
  launched: LaunchedApp
  page: Page
  home: string
  argLines: () => string[]
}> {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      const env = prepare(dirs)
      const work = join(dirs.home, 'work')
      const transcript = (id: string, name: string) =>
        writeFileSync(
          join(dirs.home, '.claude', 'projects', work.replace(/[^A-Za-z0-9]/g, '-'), `${id}.jsonl`),
          `${[
            { type: 'custom-title', customTitle: name },
            { type: 'user', cwd: work, message: { content: 'fix the login bug' } },
          ]
            .map((l) => JSON.stringify(l))
            .join('\n')}\n`,
        )
      transcript(SESSION, 'api')
      if (options.helper) transcript(HELPER, 'helper')
      writeFileSync(
        join(dirs.root, 'config', 'menkar', 'projects.json'),
        JSON.stringify({
          version: 1,
          current: CLIENT_WORK,
          projects: [
            {
              id: CLIENT_WORK,
              name: 'Client work',
              members: options.helper ? [SESSION, HELPER] : [SESSION],
              groups: [{ name: 'pair', color: '#5ec4b6', members: [SESSION] }],
              ...(options.helper ? { parents: { [HELPER]: SESSION } } : {}),
              orchestration: { on: true, orchestrator: SESSION },
              orchestrator_open: true,
            },
          ],
          windows: [],
        }),
      )
      return env
    },
  })
  const page = launched.window
  await page.locator('.row', { hasText: 'api' }).dblclick()
  await expect.poll(() => existsSync(join(home, 'claude-pid.txt'))).toBe(true)
  await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
  await page.locator('.xterm').click()
  const argLines = (): string[] =>
    existsSync(join(home, 'claude-args.txt'))
      ? readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n')
      : []
  return { launched, page, home, argLines }
}

const said = (page: Page, text: string) =>
  expect.poll(() => terminalText(page), { timeout: 15_000 }).toContain(text)

// A process that ended may linger as a zombie until it is reaped: that is not running.
function alive(pid: number): boolean {
  try {
    return readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]?.[0] !== 'Z'
  } catch {
    return false
  }
}

const tabsOf = (page: Page): Promise<TabState[]> =>
  page.evaluate(async () => {
    const s = await (
      globalThis as unknown as {
        menkar: { window: { state(): Promise<{ tabs: TabState[] }> } }
      }
    ).menkar.window.state()
    return s.tabs.map((t) => ({ id: t.id, title: t.title, place: t.place, panes: t.panes }))
  })

const placeOf = async (page: Page, session: string) =>
  (await tabsOf(page)).find((t) => t.panes.some((p) => p.sessionId === session))?.place ??
  'ordinary'

const strip = (page: Page) => page.locator('#tab-strip .tab')

// SPAWN1: the orchestrator starts "worker"; its id and the pid of its process.
async function startWorker(
  page: Page,
  home: string,
  argLines: () => string[],
): Promise<{ worker: string; pid: number }> {
  const orchestratorPid = readFileSync(join(home, 'claude-pid.txt'), 'utf8')
  await page.keyboard.type('SPAWN1')
  await said(page, 'TOOL start_session: Started "worker"')
  await expect.poll(() => argLines().length).toBe(2)
  const worker = /--session-id (\S+) -n worker/.exec(argLines()[1] ?? '')?.[1] ?? ''
  await expect
    .poll(() => readFileSync(join(home, 'claude-pid.txt'), 'utf8'))
    .not.toBe(orchestratorPid)
  const pid = Number(readFileSync(join(home, 'claude-pid.txt'), 'utf8'))
  return { worker, pid }
}

test('a started worker runs with no tab; a click on its row shows it last; ×, Ctrl+B x and Close all hide it running; ⋮ Open pins it; ⋮ Stop ends it (screenshots)', async () => {
  const { launched, page, home, argLines } = await open()
  const files = process.env.MENKAR_FILES
  try {
    const callerTab = await page.locator('.tab.selected').getAttribute('data-tab')
    const { worker, pid } = await startWorker(page, home, argLines)
    const row = page.locator(`.row[data-session="${worker}"]`)
    await expect(row).toHaveCount(1)
    await expect(strip(page)).toHaveCount(1)
    await expect(page.locator('.tab.selected')).toHaveAttribute('data-tab', callerTab ?? '')
    expect(await placeOf(page, worker)).toBe('background')
    expect(alive(pid)).toBe(true)
    if (files) await page.screenshot({ path: join(files, 'menkar-t84-41-b3-background.png') })

    // A click on its row: the peek, last, selected, its screen there.
    await row.click()
    await expect(strip(page)).toHaveCount(2)
    await expect(strip(page).last()).toHaveText(/worker/)
    await expect(strip(page).last()).toHaveClass(/selected/)
    expect(await placeOf(page, worker)).toBe('peek')
    await expect(page.locator('.xterm-rows:visible')).toContainText('stand-in claude ready')
    if (files) await page.screenshot({ path: join(files, 'menkar-t84-41-b3-peek.png') })

    // × on it: back to the background, the orchestrator's tab selected, the process running.
    await strip(page).last().locator('.close').click()
    await expect(strip(page)).toHaveCount(1)
    await expect(page.locator('.tab.selected')).toHaveAttribute('data-tab', callerTab ?? '')
    expect(await placeOf(page, worker)).toBe('background')
    expect(alive(pid)).toBe(true)

    // Ctrl+B x on its only pane does the same.
    await row.click()
    await expect(strip(page)).toHaveCount(2)
    await page.locator('.xterm:visible').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('x')
    await expect(strip(page)).toHaveCount(1)
    expect(await placeOf(page, worker)).toBe('background')
    expect(alive(pid)).toBe(true)

    // ⋮ Open on a background worker (decision D3): an ordinary tab, selected.
    await row.locator('.more').click()
    await page
      .locator('.menu-item')
      .filter({ hasText: /^Open$/ })
      .click()
    await expect(strip(page)).toHaveCount(2)
    await expect(strip(page).last()).toHaveClass(/selected/)
    expect(await placeOf(page, worker)).toBe('ordinary')

    // A pinned worker's × and Close all hide it too; the orchestrator's own process goes.
    await strip(page).last().locator('.close').click()
    await expect(strip(page)).toHaveCount(1)
    expect(await placeOf(page, worker)).toBe('background')
    await row.click()
    await expect(strip(page)).toHaveCount(2)
    await strip(page).first().click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Close all tabs' }).click()
    await expect(strip(page)).toHaveCount(0)
    expect(await placeOf(page, worker)).toBe('background')
    expect(alive(pid)).toBe(true)

    // ⋮ Stop: the only way it ends.
    await row.locator('.more').click()
    await page
      .locator('.menu-item')
      .filter({ hasText: /^Stop$/ })
      .click()
    await expect.poll(() => alive(pid)).toBe(false)
    expect((await tabsOf(page)).some((t) => t.panes.some((p) => p.sessionId === worker))).toBe(
      false,
    )
  } finally {
    await launched.close()
  }
})

test('a relaunch reopens a background worker in the background, running with its conversation', async () => {
  const { launched, page, home, argLines } = await open()
  let next: ElectronApplication | undefined
  try {
    const { worker } = await startWorker(page, home, argLines)
    const saved = () =>
      JSON.parse(readFileSync(join(launched.root, 'config', 'menkar', 'projects.json'), 'utf8'))
    await expect.poll(() => JSON.stringify(saved().windows)).toContain('"place":"background"')
    await launched.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
    await page.locator('.dialog button', { hasText: 'Stop and close' }).click()
    await expect.poll(() => launched.app.windows().length).toBe(0)
    await launched.app.close()
    const before = argLines().length
    const executable = process.env.MENKAR_E2E_EXECUTABLE
    next = await _electron.launch(
      executable
        ? { executablePath: executable, args: ['--ozone-platform=x11'], env: { ...launched.env } }
        : { args: ['--ozone-platform=x11', '.'], env: { ...launched.env } },
    )
    const again = await next.firstWindow()
    await expect
      .poll(() => argLines().slice(before), { timeout: 15_000 })
      .toContainEqual(expect.stringContaining(`--resume ${worker}`))
    await expect(again.locator('#tab-strip .tab')).toHaveCount(1)
    expect(await placeOf(again, worker)).toBe('background')
  } finally {
    if (next) {
      await endSessions(next)
      await next.close().catch(() => undefined)
    }
    await launched.close().catch(() => undefined)
  }
})

const setScheme = async (page: Page, scheme: 'dark' | 'light') => {
  await page.evaluate(
    async ([s, theme]) => {
      const prefs = (
        globalThis as unknown as {
          menkar: { preferences: { set(k: string, v: string): Promise<unknown> } }
        }
      ).menkar.preferences
      await prefs.set('color_scheme', s)
      await prefs.set('terminal_theme', theme)
    },
    [scheme, catppuccin(scheme)] as const,
  )
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe(scheme)
}

// Each state in both schemes, into the project's files folder when the run has one.
async function shots(page: Page, name: string): Promise<void> {
  const files = process.env.MENKAR_FILES
  if (!files) return
  for (const scheme of ['dark', 'light'] as const) {
    await setScheme(page, scheme)
    await page.screenshot({ path: join(files, `menkar-t95-41-b5-${name}-${scheme}.png`) })
  }
  await setScheme(page, 'dark')
}

// How a row's name or a tab's title is drawn: its weight and whether it is italic.
const looks = (node: ReturnType<Page['locator']>) =>
  node.evaluate((n) => {
    const style = getComputedStyle(n)
    return `${style.fontWeight === '700' ? 'bold' : 'regular'}${style.fontStyle === 'italic' ? ' italic' : ''}`
  })

test('the looks (decision 1.176): rows by weight, the italic peek with its pin, the toast once, the permission pill, and a worker that stops being backgroundable (screenshots)', async () => {
  const { launched, page, home, argLines } = await open({ helper: true })
  try {
    const { worker } = await startWorker(page, home, argLines)
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('TASKADD')
    await said(page, 'TOOL task_add: Task 1 added.')
    await page.keyboard.type('WORKT')
    await said(page, 'TOOL start_session: Started "client-work-t1"')
    await expect.poll(() => argLines().length).toBe(3)
    const second = /--session-id (\S+)/.exec(argLines()[2] ?? '')?.[1] ?? ''
    const nameOf = (id: string) => page.locator(`.row[data-session="${id}"] .name`)
    const rowOf = (id: string) => page.locator(`.row[data-session="${id}"]`)
    const peek = () => strip(page).last()

    // Every worker regular: two in the background, one with no tab; the orchestrator as before.
    await expect.poll(() => placeOf(page, second)).toBe('background')
    await expect.poll(() => looks(nameOf(worker))).toBe('regular')
    expect(await looks(nameOf(second))).toBe('regular')
    // A worker with no tab is among the orchestrator's earlier children.
    await page.locator('.earlier-row').click()
    expect(await looks(nameOf(HELPER))).toBe('regular')
    expect(await looks(nameOf(SESSION))).toBe('bold')
    await expect(page.locator('.row .pin-mark')).toHaveCount(0)
    await shots(page, 'background')

    // A click: the peek, italic in the strip and in the list, with its pin button.
    await rowOf(worker).click()
    await expect(strip(page)).toHaveCount(2)
    await expect(peek()).toHaveClass(/peek/)
    expect(await looks(peek().locator('.title'))).toBe('regular italic')
    await expect(peek().locator('.pin')).toHaveAttribute('title', 'Pin tab (or double-click it)')
    await expect.poll(() => looks(nameOf(worker))).toBe('regular italic')
    await shots(page, 'peek')

    // A click on another worker replaces the peek; the first goes back to the background.
    await rowOf(second).click()
    await expect(strip(page)).toHaveCount(2)
    await expect(peek()).toHaveText(/client-work-t1/)
    expect(await placeOf(page, worker)).toBe('background')
    await expect.poll(() => looks(nameOf(worker))).toBe('regular')
    expect(await looks(nameOf(second))).toBe('regular italic')

    // The pin button: an ordinary tab, bold, no pin button; its row bold with the pin.
    await peek().locator('.pin').click()
    await expect.poll(() => placeOf(page, second)).toBe('ordinary')
    await expect(peek()).not.toHaveClass(/peek/)
    await expect(peek().locator('.pin')).toHaveCount(0)
    expect(await looks(peek().locator('.title'))).toBe('bold')
    await expect.poll(() => looks(nameOf(second))).toBe('bold')
    await expect(rowOf(second).locator('.pin-mark')).toHaveAttribute('title', 'Pinned tab')

    // A click on the other worker: the peek after the pinned tab; a double-click on it pins it.
    await rowOf(worker).click()
    await expect(strip(page)).toHaveCount(3)
    await expect(peek()).toHaveClass(/peek/)
    await shots(page, 'pinned-and-peek')
    await peek().dblclick()
    await expect.poll(() => placeOf(page, worker)).toBe('ordinary')
    await expect(rowOf(worker).locator('.pin-mark')).toHaveCount(1)

    // The first close into the background: a toast whose Show peeks it; the second, none.
    await peek().locator('.close').click()
    const toast = page.locator('.toast', { hasText: 'worker keeps running in the background' })
    await expect(toast).toHaveCount(1)
    await shots(page, 'toast')
    await toast.locator('.toast-action', { hasText: 'Show' }).click()
    await expect.poll(() => placeOf(page, worker)).toBe('peek')
    await expect(toast).toHaveCount(0)
    await peek().locator('.close').click()
    await expect.poll(() => placeOf(page, worker)).toBe('background')
    // Counted once, not polled: a toast leaves by itself after a few seconds.
    await page.waitForTimeout(500)
    expect(await page.locator('.toast', { hasText: 'keeps running' }).count()).toBe(0)

    // Take control in the peek: still selected, an ordinary tab, no longer italic.
    await rowOf(worker).click()
    await expect.poll(() => placeOf(page, worker)).toBe('peek')
    await page
      .locator('.tab-body:not(.hidden) .pane-banner button', { hasText: 'Take control' })
      .click()
    await expect.poll(() => placeOf(page, worker)).toBe('ordinary')
    await expect(peek()).toHaveClass(/selected/)
    expect(await looks(peek().locator('.title'))).toBe('bold')

    // At a permission prompt in the background: its pill, which opens it in the peek.
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('ASK')
    await expect(page.locator('.xterm-rows:visible')).toContainText('Do you want to proceed?')
    await page
      .locator('.tab-body:not(.hidden) .pane-banner button', {
        hasText: 'Back to reporting to the orchestrator',
      })
      .click()
    await peek().locator('.close').click()
    await expect.poll(() => placeOf(page, worker)).toBe('background')
    const pill = page.locator('#tab-strip .worker-pill')
    await expect(pill).toHaveText('worker · permission', { timeout: 15_000 })
    await shots(page, 'pill')
    await pill.click()
    await expect.poll(() => placeOf(page, worker)).toBe('peek')
    await expect(peek()).toHaveClass(/selected/)
    await expect(pill).toHaveCount(0)

    // With you from a background worker's row menu: an ordinary tab, not selected.
    await strip(page).nth(1).locator('.close').click()
    await expect.poll(() => placeOf(page, second)).toBe('background')
    await rowOf(second).locator('.more').click()
    await page
      .locator('.menu-item')
      .filter({ hasText: /With you$/ })
      .click()
    await expect.poll(() => placeOf(page, second)).toBe('ordinary')
    const tab = strip(page).filter({ hasText: 'client-work-t1' })
    await expect(tab).not.toHaveClass(/selected/)
    expect(await looks(tab.locator('.title'))).toBe('bold')
  } finally {
    await launched.close()
  }
})
