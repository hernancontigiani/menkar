// A Codex session through Menkar, end to end with the stand-in `codex` (plan 39's gate for Codex
// as a session): started from New with Menkar's notify program in place of the user's, which still
// runs; bound to its thread; its row named from Codex's own index and its state read from its
// screen; stopped when its tab closes and resumed from its row with `codex resume <id>`.
// Binding details (/new, a fork, two tabs in one folder) are codex-bind.spec.ts's; Usage with a
// Codex session is usage-codex.spec.ts's.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'
import { codexStandIn } from './standins/codex'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

interface Shown {
  tabs: { id: string; panes: { id: string; sessionId: string | null }[] }[]
}

const shown = (page: Page) =>
  page.evaluate(() =>
    (
      globalThis as unknown as { menkar: { window: { state(): Promise<unknown> } } }
    ).menkar.window.state(),
  ) as Promise<Shown>

interface Saved {
  projects: { members: string[] }[]
}

// The user's own notify: it keeps Codex's argument, so the test sees it was chained.
const USER_NOTIFY = `#!/usr/bin/env node
require('node:fs').writeFileSync(require('node:path').join(process.env.HOME, 'user-notify.json'), process.argv[process.argv.length - 1])
`

async function launch() {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      codexStandIn(join(dirs.root, 'bin'))
      const program = join(dirs.home, 'user-notify')
      writeFileSync(program, USER_NOTIFY)
      chmodSync(program, 0o755)
      // Codex's home exists before Menkar starts, so its sessions are watched from the start.
      mkdirSync(join(dirs.home, '.codex'), { recursive: true })
      writeFileSync(join(dirs.home, '.codex', 'config.toml'), `notify = ["${program}"]\n`)
      return { ...env, FAKE_CODEX_TURN_MS: '8000' }
    },
  })
  const page = launched.window
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  const threads = () => read('codex-threads.txt').trim().split('\n').filter(Boolean)
  const saved = (): Saved =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
  const dot = (session: string) =>
    page.locator(`.row[data-session="${session}"] .dot`).getAttribute('class')
  return { launched, page, home, read, threads, saved, dot }
}

async function typeIn(page: Page, text: string) {
  await page.locator('.xterm:visible').click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

test('a Codex session started from New runs with Menkar’s notify, binds to its thread, shows Codex’s name and its state, and the user’s own notify still runs', async () => {
  const app = await launch()
  try {
    const work = join(app.home, 'work')
    await act(app.page, { type: 'startNew', agent: 'codex', folder: work, name: '' })
    await expect(app.page.locator('.xterm-rows')).toContainText('Ask Codex to do anything')
    const started = app.read('codex-args.txt').trim()
    // The project's files folder, then Menkar's notify program in place of the user's.
    expect(started).toMatch(/^--add-dir .*\/Menkar\/Client work\/files -c notify=\[/)
    expect(started).toContain('codex-notify.js')
    expect(started).not.toContain('resume')

    await typeIn(app.page, 'add the routes')
    await expect.poll(app.threads).toHaveLength(1)
    const [thread = ''] = app.threads()
    await expect.poll(() => app.saved().projects[0]?.members, { timeout: 5000 }).toContain(thread)
    // Read from Codex's screen while the turn runs.
    await expect(app.page.locator('.tab .dot').first()).toHaveClass(/working/)
    await expect(app.page.locator('.xterm-rows')).toContainText('Done: add the routes', {
      timeout: 20_000,
    })
    await expect.poll(() => app.dot(thread), { timeout: 5000 }).not.toContain('working')
    expect(await app.dot(thread)).not.toContain('blocked')

    // Menkar's program ran first and passed Codex's argument on to the user's notify.
    await expect.poll(() => app.read('user-notify.json'), { timeout: 5000 }).toContain(thread)
    expect(JSON.parse(app.read('user-notify.json'))['last-assistant-message']).toBe(
      'Done: add the routes',
    )

    // Codex names its threads in its own index; the row shows that name.
    writeFileSync(
      join(app.home, '.codex', 'session_index.jsonl'),
      `${JSON.stringify({ id: thread, thread_name: 'Routes for the API', updated_at: new Date().toISOString() })}\n`,
    )
    await expect(app.page.locator(`.row[data-session="${thread}"]`)).toContainText(
      'Routes for the API',
      { timeout: 20_000 },
    )
    expect(app.saved().projects[0]?.members).toEqual([SESSION, thread])
  } finally {
    await app.launched.close()
  }
})

test('closing a Codex tab stops it; opening its row resumes the same thread with `codex resume <id>` and no model', async () => {
  const app = await launch()
  try {
    const work = join(app.home, 'work')
    await act(app.page, { type: 'startNew', agent: 'codex', folder: work, name: '' })
    await expect(app.page.locator('.xterm-rows')).toContainText('Ask Codex to do anything')
    await typeIn(app.page, 'first')
    await expect.poll(app.threads).toHaveLength(1)
    const [thread = ''] = app.threads()
    await expect(app.page.locator('.xterm-rows')).toContainText('Done: first', { timeout: 20_000 })
    await expect.poll(async () => (await shown(app.page)).tabs[0]?.panes[0]?.sessionId).toBe(thread)

    await act(app.page, { type: 'closeTab', tab: (await shown(app.page)).tabs[0]?.id })
    await expect(app.page.locator('.tab')).toHaveCount(0)
    await expect.poll(() => app.dot(thread)).toContain('stopped')

    await act(app.page, { type: 'openSession', session: thread })
    await expect(app.page.locator('.xterm-rows')).toContainText('Ask Codex to do anything')
    const resumed = app.read('codex-args.txt').trim().split('\n').at(-1) ?? ''
    expect(resumed).toMatch(new RegExp(`^resume .*notify=.* ${thread}$`))
    expect(resumed).not.toMatch(/(^| )-m /)

    await typeIn(app.page, 'second')
    await expect(app.page.locator('.xterm-rows')).toContainText('Done: second', {
      timeout: 20_000,
    })
    // The same thread goes on: no new one minted, the tab still runs it.
    expect(app.threads()).toEqual([thread, thread])
    expect((await shown(app.page)).tabs.map((t) => t.panes.map((p) => p.sessionId))).toEqual([
      [thread],
    ])
  } finally {
    await app.launched.close()
  }
})
