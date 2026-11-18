// Decision 1.176: in the orchestration mode the orchestrator's workers run without a tab in the
// strip. A click on a worker's row shows it in its project's one peek tab, last; closing a worker's
// tab only sends it back to the background, its process running; only Stop ends it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { endSessions, type LaunchedApp, launchApp, terminalText } from './app'
import { prepare, SESSION } from './fixtures'

const CLIENT_WORK = 'aaaaaaaaaaaa'

interface TabState {
  readonly id: string
  readonly title: string
  readonly place?: string | undefined
  readonly panes: readonly { readonly sessionId: string | null }[]
}

async function open(): Promise<{
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
      writeFileSync(
        join(
          dirs.home,
          '.claude',
          'projects',
          work.replace(/[^A-Za-z0-9]/g, '-'),
          `${SESSION}.jsonl`,
        ),
        `${[
          { type: 'custom-title', customTitle: 'api' },
          { type: 'user', cwd: work, message: { content: 'fix the login bug' } },
        ]
          .map((l) => JSON.stringify(l))
          .join('\n')}\n`,
      )
      writeFileSync(
        join(dirs.root, 'config', 'menkar', 'projects.json'),
        JSON.stringify({
          version: 1,
          current: CLIENT_WORK,
          projects: [
            {
              id: CLIENT_WORK,
              name: 'Client work',
              members: [SESSION],
              groups: [{ name: 'pair', color: '#5ec4b6', members: [SESSION] }],
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
