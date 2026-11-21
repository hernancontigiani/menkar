// A Codex tab binds to its thread (§2.5.2 of the multi-agent architecture, with codex's
// measurements of 2026-11-20): Codex picks the id, its rollout appears at the first message and
// its process holds it open, so the tab binds then, from its own process, before the turn ends.
// A thread change in the tab is followed from the turn-end record Codex's notify writes: a /new
// takes the old thread's place (a clear), a fork is an in-tab switch, as a /resume is (1.63).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

interface Saved {
  projects: {
    members: string[]
    earlier?: Record<string, string[]>
    parents?: Record<string, string>
  }[]
  windows: { tabs: Record<string, { panes?: string[] }[]> }[]
}

// A Codex thread of the work folder, older than any test's tab, its parent the Claude session.
const OLD = '019a4f2c-1e00-7a11-8a01-0000000000a1'

function codexHome(home: string): void {
  const day = join(home, '.codex', 'sessions', '2026', '11', '02')
  mkdirSync(day, { recursive: true })
  const cwd = join(home, 'work')
  const at = '2026-11-02T12:15:00.000Z'
  const lines = [
    {
      timestamp: at,
      type: 'session_meta',
      payload: {
        session_id: OLD,
        id: OLD,
        timestamp: at,
        cwd,
        originator: 'codex-tui',
        cli_version: '0.169.0',
        source: 'cli',
        thread_source: 'user',
        model_provider: 'openai',
        history_mode: 'paginated',
      },
    },
    {
      timestamp: at,
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        thread_id: OLD,
        turn_id: 't1',
        item: { type: 'UserMessage', id: 'u1', content: [{ type: 'text', text: 'plan the API' }] },
      },
    },
  ]
  writeFileSync(
    join(day, `rollout-2026-11-02T09-15-00-${OLD}.jsonl`),
    `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
  )
}

async function launch(turnMs: number, withParent = false) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      codexStandIn(join(dirs.root, 'bin'))
      codexHome(dirs.home)
      if (withParent)
        writeFileSync(
          join(dirs.root, 'config', 'menkar', 'projects.json'),
          JSON.stringify({
            version: 1,
            current: 'aaaaaaaaaaaa',
            projects: [
              {
                id: 'aaaaaaaaaaaa',
                name: 'Client work',
                members: [SESSION, OLD],
                groups: [],
                parents: { [OLD]: SESSION },
              },
            ],
            windows: [],
          }),
        )
      return { ...env, FAKE_CODEX_TURN_MS: String(turnMs) }
    },
  })
  const page = launched.window
  const saved = (): Saved =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
  const threads = (): string[] => {
    const file = join(home, 'codex-threads.txt')
    return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : []
  }
  const tabs = () => saved().windows[0]?.tabs.aaaaaaaaaaaa?.map((t) => t.panes ?? null) ?? []
  const turnEnds = (): string[] => {
    const dir = join(root, 'cache', 'menkar', 'control', 'turn-ends')
    return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : []
  }
  return { launched, page, saved, threads, tabs, turnEnds, home, root }
}

async function typeIn(page: Page, tab: number, text: string) {
  await page.locator('.tab').nth(tab).click()
  await page.locator('.xterm:visible').click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

test('a Codex tab has no thread until its first message, then binds to it before the turn ends', async () => {
  const app = await launch(20_000)
  try {
    const work = join(app.home, 'work')
    await act(app.page, { type: 'startNew', agent: 'codex', folder: work, name: '' })
    await expect(app.page.locator('.xterm-rows')).toContainText('Ask Codex to do anything')
    await app.page.waitForTimeout(3000)
    expect(app.threads()).toEqual([])
    expect(app.saved().projects[0]?.members).toEqual([SESSION])

    await typeIn(app.page, 0, 'hello')
    await expect.poll(app.threads).toHaveLength(1)
    const [thread] = app.threads()
    await expect.poll(() => app.saved().projects[0]?.members, { timeout: 5000 }).toContain(thread)
    expect(app.tabs()).toEqual([[thread]])
    // Bound from the process: the turn, and so Codex's notify, has not ended.
    expect(app.turnEnds()).toEqual([])
  } finally {
    await app.launched.close()
  }
})

test('two Codex tabs in one folder each bind to their own thread, never to the other’s', async () => {
  const app = await launch(3000)
  try {
    const work = join(app.home, 'work')
    await act(app.page, { type: 'startNew', agent: 'codex', folder: work, name: '' })
    await expect(app.page.locator('.xterm-rows')).toContainText('Ask Codex to do anything')
    await typeIn(app.page, 0, 'first')
    await expect.poll(app.threads).toHaveLength(1)
    // The second starts while the first's rollout is still being written: a guess by folder and
    // time would take the first's thread for its own.
    await act(app.page, { type: 'startNew', agent: 'codex', folder: work, name: '' })
    await expect(app.page.locator('.tab')).toHaveCount(2)
    const [first] = app.threads()
    await expect.poll(app.tabs, { timeout: 5000 }).toContainEqual([first])
    // The first's turn ends and its rollout changes, after the second tab started.
    await expect.poll(app.turnEnds, { timeout: 10_000 }).toHaveLength(1)
    await app.page.waitForTimeout(4000)
    expect(app.tabs()).toEqual([[first]])

    await typeIn(app.page, 1, 'second')
    await expect.poll(app.threads).toHaveLength(2)
    const second = app.threads()[1]
    await expect.poll(app.tabs, { timeout: 5000 }).toEqual([[first], [second]])
  } finally {
    await app.launched.close()
  }
})

test('after a /new the tab runs the new thread, which takes the old one’s place; the old one is its earlier conversation', async () => {
  const app = await launch(500)
  try {
    const work = join(app.home, 'work')
    await act(app.page, { type: 'startNew', agent: 'codex', folder: work, name: '' })
    await expect(app.page.locator('.xterm-rows')).toContainText('Ask Codex to do anything')
    await typeIn(app.page, 0, 'one')
    await expect.poll(app.threads).toHaveLength(1)
    const [first] = app.threads()
    await expect.poll(app.tabs).toEqual([[first]])
    await expect(app.page.locator('.xterm-rows')).toContainText('Done: one')

    await typeIn(app.page, 0, '/new')
    await expect(app.page.locator('.xterm-rows')).toContainText('new thread')
    await typeIn(app.page, 0, 'two')
    await expect.poll(app.threads).toHaveLength(2)
    const second = app.threads()[1] ?? ''
    await expect.poll(app.tabs, { timeout: 10_000 }).toEqual([[second]])
    expect(app.saved().projects[0]?.members).toEqual([SESSION, second, first])
    expect(app.saved().projects[0]?.earlier).toEqual({ [second]: [first] })
  } finally {
    await app.launched.close()
  }
})

test('a fork made in the tab is an in-tab switch, as a /resume is (1.63): the tab runs the fork, the source is its earlier conversation, and the source’s parent is not carried', async () => {
  const app = await launch(500, true)
  try {
    // Listed first: its agent is known once Codex's catalog has read it.
    await expect(app.page.locator(`.row[data-session="${OLD}"]`)).toBeVisible()
    await act(app.page, { type: 'openSession', session: OLD })
    await expect(app.page.locator('.xterm-rows')).toContainText('Ask Codex to do anything')
    await typeIn(app.page, 0, '/fork')
    await expect(app.page.locator('.xterm-rows')).toContainText('fork thread')
    await expect.poll(app.threads).toHaveLength(2)
    const fork = app.threads()[1] ?? ''
    await typeIn(app.page, 0, 'go on')
    await expect.poll(app.tabs, { timeout: 10_000 }).toEqual([[fork]])
    const project = app.saved().projects[0]
    expect(project?.members).toEqual([SESSION, fork, OLD])
    expect(project?.earlier).toEqual({ [fork]: [OLD] })
    expect(project?.parents?.[fork]).toBeUndefined()
  } finally {
    await app.launched.close()
  }
})

test('a Claude tab still joins by the id it was started with, whatever a turn-end record names', async () => {
  const app = await launch(500)
  try {
    const work = join(app.home, 'work')
    await act(app.page, { type: 'startNew', agent: 'claude', folder: work, name: 'mine' })
    const args = join(app.home, 'claude-args.txt')
    await expect.poll(() => existsSync(args)).toBe(true)
    const id = /--session-id (\S+)/.exec(readFileSync(args, 'utf8'))?.[1] ?? ''
    const pane = JSON.parse(readFileSync(join(app.home, 'claude-env.json'), 'utf8')).MENKAR_PANE
    const dir = join(app.root, 'cache', 'menkar', 'control', 'turn-ends')
    mkdirSync(dir, { recursive: true })
    const other = '0f0f0f0f-0000-4000-8000-000000000001'
    writeFileSync(
      join(dir, `${pane}.json`),
      JSON.stringify({ session_id: other, at: new Date().toISOString() }),
    )
    await app.page.waitForTimeout(3000)
    expect(app.saved().projects[0]?.members).not.toContain(other)
    const transcripts = join(app.home, '.claude', 'projects', work.replace(/[^A-Za-z0-9]/g, '-'))
    writeFileSync(
      join(transcripts, `${id}.jsonl`),
      `${JSON.stringify({ type: 'user', cwd: work, message: { content: 'typed' } })}\n`,
    )
    await expect.poll(() => app.saved().projects[0]?.members, { timeout: 10_000 }).toContain(id)
    expect(app.saved().projects[0]?.members).not.toContain(other)
  } finally {
    await app.launched.close()
  }
})
