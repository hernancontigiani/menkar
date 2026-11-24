// Plan 39 P3.2 (set, 2026-11-23, option b): Menkar starts a new Cursor session under an id of its
// own with Cursor's hidden `--new-session-id`. A Cursor build that drops the option stops at once
// with commander's error: the pane says so in one line of Menkar's own, nothing is typed into it,
// and the next new session lets Cursor pick its id.
import { spawn } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, terminalText } from './app'
import { cursorStandIn, prepare, SESSION } from './fixtures'
import { cursorTurnsStandIn } from './standins/cursor'

const CLAUDE = 'fix the login bug'
// Cursor's folder for a working folder's chats.
const slugOf = (folder: string) => folder.replace(/^\//, '').replaceAll('/', '-')

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

test('a Cursor that refuses --new-session-id is told once in its pane, and its next start picks its own id', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      const env = prepare(dirs)
      cursorStandIn(join(dirs.root, 'bin'))
      return { ...env, FAKE_CURSOR_NO_NEW_ID: '1' }
    },
  })
  const page = launched.window
  const argsFile = join(home, 'cursor-args.txt')
  const starts = () =>
    existsSync(argsFile) ? readFileSync(argsFile, 'utf8').split('\n').slice(0, -1) : []
  try {
    const work = join(home, 'work')
    await act(page, { type: 'startNew', agent: 'cursor', folder: work, name: '' })
    await expect.poll(() => starts().length, { timeout: 20_000 }).toBe(1)
    expect(starts()[0]).toMatch(/^--new-session-id [0-9a-f-]{36} /)
    await expect
      .poll(() => terminalText(page), { timeout: 20_000 })
      .toContain('refused the id Menkar gave this new session')
    await page.screenshot({ path: join('test-results', 'cursor-id-refused.png') })
    expect((await terminalText(page)).match(/refused the id Menkar gave/g)).toHaveLength(1)

    await act(page, { type: 'startNew', agent: 'cursor', folder: work, name: '' })
    await expect.poll(() => starts().length, { timeout: 20_000 }).toBe(2)
    expect(starts()[1]).not.toContain('--new-session-id')
    expect(starts()[1]).toContain('--plugin-dir ')
  } finally {
    await launched.close()
  }
})

// A tool of Menkar's called as the Claude session calls it: through the server its --mcp-config
// names, in the stand-in claude's own environment.
function callAsClaude(home: string, tool: string, args: Record<string, unknown>): Promise<string> {
  const line = readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n')[0] ?? ''
  const config = /--mcp-config (\{.*?\}\}\}\})/.exec(line)?.[1] ?? '{}'
  const server = JSON.parse(config).mcpServers.menkar
  const env = JSON.parse(readFileSync(join(home, 'claude-env.json'), 'utf8'))
  const child = spawn(server.command, server.args, {
    env: { ...env, ...server.env },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  return new Promise((resolve, reject) => {
    let out = ''
    child.on('error', reject)
    child.stdout.on('data', (d) => {
      out += d
      for (const text of out.split('\n')) {
        if (!text.trim()) continue
        const reply = JSON.parse(text)
        if (reply.id !== 2) continue
        child.kill()
        resolve(reply.result.content[0].text)
      }
    })
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })}\n`,
    )
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } })}\n`,
    )
  })
}

// Plan 39 P3.4, D1 and D22: a Cursor worker a Claude session starts keeps its name in Menkar's own
// names. Cursor has no channel into a running chat, so a message for the idle worker waits while
// the human has a draft in its box — nothing is typed into it and the draft stays — and once the box
// is empty Menkar ends the session and resumes it with the message as its first.
test('a message for an idle Cursor worker waits out a draft in its box, then resumes the session with it', async () => {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      const env = prepare(dirs)
      cursorStandIn(join(dirs.root, 'bin'))
      // Cursor's folders exist before Menkar starts, so its watch sees the worker's transcript come.
      mkdirSync(
        join(
          dirs.home,
          '.cursor',
          'projects',
          slugOf(join(dirs.home, 'work')),
          'agent-transcripts',
        ),
        { recursive: true },
      )
      return { ...env, FAKE_CURSOR_BOX: '1' }
    },
  })
  const page = launched.window
  const argsFile = join(home, 'cursor-args.txt')
  const starts = () =>
    existsSync(argsFile) ? readFileSync(argsFile, 'utf8').split('\n').slice(0, -1) : []
  const names = () =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'state.json'), 'utf8')).names ?? {}
  const heldRoot = join(root, 'cache', 'menkar', 'control', 'held-wakes')
  const held = () =>
    existsSync(heldRoot)
      ? readdirSync(heldRoot, { recursive: true }).filter((f) => String(f).endsWith('.txt'))
      : []
  try {
    await page.locator('.row').first().dblclick()
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    expect(await callAsClaude(home, 'start_session', { name: 'cw', agent: 'cursor' })).toContain(
      'Started "cw"',
    )
    await expect.poll(() => starts().length, { timeout: 20_000 }).toBe(1)
    const id = /--new-session-id ([0-9a-f-]{36})/.exec(starts()[0] ?? '')?.[1] ?? ''
    expect(id).not.toBe('')
    await expect.poll(names).toEqual({ [id]: 'cw' })
    // Its first message, as Cursor writes it: a session with no transcript is never resumed.
    const transcripts = join(
      home,
      '.cursor',
      'projects',
      slugOf(join(home, 'work')),
      'agent-transcripts',
      id,
    )
    mkdirSync(transcripts, { recursive: true })
    writeFileSync(
      join(transcripts, `${id}.jsonl`),
      `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: '<user_query>\nstart\n</user_query>' }] } })}\n`,
    )

    // Found by the next scan of Cursor's folders, after their changes settle.
    await page.waitForTimeout(3000)
    await page.locator('.tab', { hasText: 'cw' }).click()
    const screen = page.locator('.xterm-rows:visible')
    await expect(screen).toContainText('→ Add a follow-up')
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('half a thought')
    await expect(screen).toContainText('→ half a thought')

    expect(await callAsClaude(home, 'send_message', { name: 'cw', text: 'look at a.txt' })).toMatch(
      /^Sent to cw\./,
    )
    await expect.poll(held).toHaveLength(1)
    await page.waitForTimeout(1500)
    expect(starts()).toHaveLength(1)
    await expect(screen).toContainText('→ half a thought')
    await page.screenshot({ path: join('test-results', 'cursor-wake-held.png') })

    for (let i = 0; i < 'half a thought'.length; i++) await page.keyboard.press('Backspace')
    await expect.poll(() => starts().length, { timeout: 20_000 }).toBe(2)
    expect(starts()[1]).toContain(`--resume ${id} `)
    expect(starts()[1]).toMatch(
      new RegExp(
        `-- \\[Menkar\\] from ${CLAUDE} \\(Claude Code\\); reply with send_message: look at a\\.txt \\(`,
      ),
    )
    await expect(page.locator('.xterm-rows:visible')).toContainText('PROMPT: [Menkar] from')
    await page.screenshot({ path: join('test-results', 'cursor-wake-resumed.png') })
    expect(held()).toEqual([])
    expect(names()).toEqual({ [id]: 'cw' })
  } finally {
    await launched.close()
  }
})

// Plan 39's gate for Cursor (P3.5): a Cursor worker of a Claude orchestrator, end to end with the
// stand-in that runs turns, its hooks and its MCP calls as cursor-agent 2026.11.13 does. With
// Cursor's two integrations items on, its turns are recorded, Menkar's tools need no approval and
// a message for a busy worker rides on its turn's end; without them the worker still works, asks
// before each of Menkar's tools, and a message reaches it only when it is idle, by a resume.
const WORKER = 'client-work-t1'
const TIME = String.raw`\(\d\d:\d\d:\d\d\)`

async function launchTeam(extra: Record<string, string> = {}) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      cursorTurnsStandIn(join(dirs.root, 'bin'))
      writeFileSync(
        join(dirs.root, 'config', 'menkar', 'projects.json'),
        JSON.stringify({
          version: 1,
          current: 'aaaaaaaaaaaa',
          projects: [
            {
              id: 'aaaaaaaaaaaa',
              name: 'Client work',
              members: [SESSION],
              groups: [],
              orchestration: { on: true, orchestrator: SESSION },
            },
          ],
          windows: [],
        }),
      )
      // Cursor writes its cli-config.json at login; the allow item edits it, never creates it.
      mkdirSync(join(dirs.root, 'config', 'cursor'), { recursive: true })
      writeFileSync(
        join(dirs.root, 'config', 'cursor', 'cli-config.json'),
        '{\n  "permissions": {\n    "allow": []\n  }\n}\n',
      )
      mkdirSync(
        join(
          dirs.home,
          '.cursor',
          'projects',
          slugOf(join(dirs.home, 'work')),
          'agent-transcripts',
        ),
        { recursive: true },
      )
      return { ...env, MENKAR_LOG: 'info', FAKE_CLAUDE_SOCKET: '1', ...extra }
    },
  })
  const page = launched.window
  const read = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : '')
  const starts = () => read(join(home, 'cursor-args.txt')).split('\n').slice(0, -1)
  const posts = (): string[] =>
    read(join(home, 'claude-posts.jsonl'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l).content)
  const contexts = (): { session: string; context: string }[] =>
    read(join(home, 'cursor-context.jsonl'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  const hookLog = (): { event: string; session_id: string; status?: string }[] =>
    read(join(root, 'cache', 'menkar', 'cursor-turns.jsonl'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  const saved = (): { projects: { members: string[]; parents?: Record<string, string> }[] } =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
  const names = () =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'state.json'), 'utf8')).names ?? {}
  const dot = (session: string) =>
    page.locator(`.row[data-session="${session}"] .dot`).getAttribute('class')
  const heldRoot = join(root, 'cache', 'menkar', 'control', 'held-wakes')
  const held = () =>
    existsSync(heldRoot)
      ? readdirSync(heldRoot, { recursive: true }).filter((f) => String(f).endsWith('.txt'))
      : []
  return {
    launched,
    page,
    root,
    home,
    starts,
    posts,
    contexts,
    hookLog,
    saved,
    names,
    dot,
    held,
  }
}

type Team = Awaited<ReturnType<typeof launchTeam>>

// The orchestrator starts the worker for task 1; its id is the one Menkar gave it.
async function startWorker(team: Team, firstReply = 'ack 1:'): Promise<string> {
  await team.page.locator('.row').first().dblclick()
  await expect(team.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
  expect(await callAsClaude(team.home, 'task_add', { title: 'build the thing' })).toContain(
    'Task 1 added.',
  )
  expect(
    await callAsClaude(team.home, 'start_session', {
      agent: 'cursor',
      task: 1,
      prompt: 'build the thing',
    }),
  ).toContain(`Started "${WORKER}" for task 1, now assigned to it`)
  await expect.poll(() => team.starts().length, { timeout: 20_000 }).toBe(1)
  const id = /--new-session-id ([0-9a-f-]{36})/.exec(team.starts()[0] ?? '')?.[1] ?? ''
  expect(id).not.toBe('')
  expect(team.starts()[0]).toMatch(/--plugin-dir \S+\/panes\/[^/ ]+\/menkar /)
  // Its team block, as the pane's plugin's sessionStart answered it.
  await expect.poll(team.contexts).toHaveLength(1)
  expect(team.contexts()[0]?.session).toBe(id)
  expect(team.contexts()[0]?.context).toContain(WORKER)
  expect(team.contexts()[0]?.context).toContain('GetDynamicTools')
  await expect.poll(() => team.saved().projects[0]?.members, { timeout: 20_000 }).toContain(id)
  expect(team.saved().projects[0]?.parents).toEqual({ [id]: SESSION })
  expect(team.names()).toEqual({ [id]: WORKER })
  // Found by the next scan of Cursor's folders, after their changes settle.
  await team.page.locator(`.row[data-session="${SESSION}"] .team-fold`).click()
  await expect(team.page.locator(`.row[data-session="${id}"]`)).toContainText(WORKER, {
    timeout: 15_000,
  })
  await team.page.locator(`.row[data-session="${id}"]`).click()
  await expect(team.page.locator('.xterm-rows:visible')).toContainText(firstReply, {
    timeout: 15_000,
  })
  const take = team.page.locator('.pane-banner button:visible', { hasText: 'Take control' })
  await take.click()
  await expect(take).toHaveCount(0)
  return id
}

async function typeIn(page: Page, text: string) {
  await page.locator('.xterm:visible').click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

const shot = async (page: Page, name: string) => {
  const files = process.env.MENKAR_FILES
  if (files) await page.screenshot({ path: join(files, `menkar-t223-${name}.png`) })
}

test('a Cursor worker of a Claude orchestrator with both Cursor items on: its turns recorded, Menkar’s tools with no card, its review wakes the orchestrator, a message for it while busy rides on its turn’s end (screenshots)', async () => {
  const team = await launchTeam()
  const screen = team.page.locator('.xterm-rows:visible')
  try {
    const prefs = await (async () => {
      await team.page.locator('body').click({ position: { x: 5, y: 5 } })
      const [child] = await Promise.all([
        team.launched.app.waitForEvent('window'),
        team.page.keyboard.press('Control+Comma'),
      ])
      await child.waitForLoadState('domcontentloaded')
      return child
    })()
    await prefs.locator('.section-item[data-section="agents"]').click()
    await prefs.locator('[data-key="agent-item-cursor-hooks"]').check()
    await prefs.locator('[data-key="agent-item-cursor-allow"]').check()
    await expect(prefs.locator('[data-key="agent-item-cursor-allow"]')).toBeChecked()
    await expect
      .poll(() => readFileSync(join(team.home, '.cursor', 'hooks.json'), 'utf8'))
      .toContain('cursor-hook.js')
    await prefs.close()

    const id = await startWorker(team)
    // The hook program recorded its first turn: a prompt and a completed stop.
    await expect
      .poll(() => team.hookLog().map((l) => `${l.event}:${l.session_id}`))
      .toEqual([`prompt:${id}`, `stop:${id}`])
    await shot(team.page, 'cursor-worker-started')

    // Menkar's tools through the pane's plugin, allowed by the item: no card.
    await typeIn(
      team.page,
      `CALLMENKAR task_steps ${JSON.stringify({ number: 1, steps: ['build', 'check', 'report'] })}`,
    )
    await expect(screen).toContainText('TOOL task_steps: Task 1 has 3 steps', { timeout: 15_000 })
    await expect(screen).not.toContainText('Run (once)')
    const mcpEnv = JSON.parse(readFileSync(join(team.home, 'cursor-mcp-env.json'), 'utf8'))
    expect(mcpEnv.MENKAR_AGENT).toBe('cursor')
    expect(mcpEnv.MENKAR_PANE).toMatch(/\S/)

    await typeIn(
      team.page,
      `CALLMENKAR task_review ${JSON.stringify({ number: 1, note: 'ready' })}`,
    )
    await expect(screen).toContainText('TOOL task_review: Task 1 is to review', { timeout: 15_000 })
    const review = new RegExp(`^\\[Menkar\\] ${WORKER} set task 1 to review: ready ${TIME}`)
    await expect
      .poll(() => team.posts().filter((p) => review.test(p)), { timeout: 20_000 })
      .toHaveLength(1)
    await expect
      .poll(() => callAsClaude(team.home, 'last_reply', { name: WORKER }), { timeout: 15_000 })
      .toContain('TOOL task_review')

    // A message while its turn runs waits for the turn's end, and goes as Cursor's followup: no
    // restart.
    await typeIn(team.page, 'SLOW think it over')
    await expect.poll(() => team.dot(id), { timeout: 10_000 }).toContain('working')
    expect(
      await callAsClaude(team.home, 'send_message', { name: WORKER, text: 'look at a.txt' }),
    ).toMatch(/^Sent to client-work-t1\./)
    await expect.poll(team.held).toHaveLength(1)
    await expect(screen).toContainText(
      `PROMPT: [Menkar] from ${CLAUDE} (Claude Code); reply with send_message: look at a.txt`,
      { timeout: 20_000 },
    )
    await expect(screen).toContainText(`ack 5: [Menkar] from ${CLAUDE}`, { timeout: 15_000 })
    expect(team.held()).toEqual([])
    expect(team.starts()).toHaveLength(1)
    await shot(team.page, 'cursor-worker-followup')

    // Cursor → Claude, through Claude Code's messaging socket.
    await typeIn(
      team.page,
      `CALLMENKAR send_message ${JSON.stringify({ name: CLAUDE, text: 'done, see a.txt' })}`,
    )
    await expect(screen).toContainText(`TOOL send_message: Sent to ${CLAUDE}.`, {
      timeout: 15_000,
    })
    await expect
      .poll(() => team.posts().filter((p) => p.includes('done, see a.txt')))
      .toEqual([
        expect.stringMatching(
          new RegExp(
            `^\\[Menkar\\] from ${WORKER} \\(Cursor\\); reply with send_message: done, see a\\.txt ${TIME}$`,
          ),
        ),
      ])
    // Nothing Menkar keeps holds the account's email Cursor sends with every event (D21).
    const cache = join(team.root, 'cache', 'menkar')
    // Electron's own profile, under the same folder, is not Menkar's.
    const kept = readdirSync(cache, { recursive: true })
      .filter((f) => !String(f).startsWith('electron'))
      .map((f) => join(cache, String(f)))
      .filter((f) => lstatSync(f).isFile())
    expect(kept).toContain(join(cache, 'cursor-turns.jsonl'))
    expect(kept.filter((f) => readFileSync(f, 'utf8').includes('someone@example.com'))).toEqual([])
    expect(team.names()).toEqual({ [id]: WORKER })
  } finally {
    await team.launched.close()
  }
})

test('a Cursor worker of a Claude orchestrator without Cursor’s items: it asks before Menkar’s tool, its review still wakes the orchestrator, and a message for it idle resumes it (screenshots)', async () => {
  const team = await launchTeam()
  const screen = team.page.locator('.xterm-rows:visible')
  try {
    const id = await startWorker(team)
    expect(existsSync(join(team.home, '.cursor', 'hooks.json'))).toBe(false)

    await typeIn(
      team.page,
      `CALLMENKAR task_steps ${JSON.stringify({ number: 1, steps: ['build', 'check', 'report'] })}`,
    )
    await expect(screen).toContainText('Run (once) (y) (enter)', { timeout: 15_000 })
    await team.page.keyboard.press('y')
    await expect(screen).toContainText('TOOL task_steps: Task 1 has 3 steps', { timeout: 15_000 })
    await typeIn(
      team.page,
      `CALLMENKAR task_review ${JSON.stringify({ number: 1, note: 'ready' })}`,
    )
    await expect(screen).toContainText('Run (once) (y) (enter)', { timeout: 15_000 })
    await expect.poll(() => team.dot(id), { timeout: 10_000 }).toContain('blocked')
    await shot(team.page, 'cursor-worker-asks')
    // The human approves it; Menkar never answers a card.
    await team.page.keyboard.press('y')
    await expect(screen).toContainText('TOOL task_review: Task 1 is to review', { timeout: 15_000 })
    const review = new RegExp(`^\\[Menkar\\] ${WORKER} set task 1 to review: ready ${TIME}`)
    await expect
      .poll(() => team.posts().filter((p) => review.test(p)), { timeout: 20_000 })
      .toHaveLength(1)

    // Idle with an empty box: ended and resumed with the message as its first.
    expect(
      await callAsClaude(team.home, 'send_message', { name: WORKER, text: 'look at a.txt' }),
    ).toMatch(/^Sent to client-work-t1\./)
    await expect.poll(() => team.starts().length, { timeout: 20_000 }).toBe(2)
    expect(team.starts()[1]).toContain(`--resume ${id} `)
    await expect(team.page.locator('.xterm-rows:visible')).toContainText(
      `PROMPT: [Menkar] from ${CLAUDE} (Claude Code); reply with send_message: look at a.txt`,
      { timeout: 20_000 },
    )
    // A resume is given no sessionStart: the block it holds stays the one it started with.
    expect(team.contexts()).toHaveLength(1)
    expect(team.hookLog()).toEqual([])
    expect(team.names()).toEqual({ [id]: WORKER })
    await shot(team.page, 'cursor-worker-resumed')
  } finally {
    await team.launched.close()
  }
})

// `/new` inside Cursor's TUI, as cursor-agent 2026.11.13 does it: no hook runs, the new chat's
// metadata comes at once, under Cursor's config folder ($XDG_CONFIG_HOME/cursor here, not the home's
// .cursor), and its transcript at its first message, whose hooks carry the new id. The tab follows
// it as it follows a clear: the new id takes the worker's place.
test('a Cursor worker’s /new is followed by its tab: the new chat takes the worker’s place', async () => {
  const team = await launchTeam()
  const screen = team.page.locator('.xterm-rows:visible')
  try {
    const prefs = await (async () => {
      await team.page.locator('body').click({ position: { x: 5, y: 5 } })
      const [child] = await Promise.all([
        team.launched.app.waitForEvent('window'),
        team.page.keyboard.press('Control+Comma'),
      ])
      await child.waitForLoadState('domcontentloaded')
      return child
    })()
    await prefs.locator('.section-item[data-section="agents"]').click()
    await prefs.locator('[data-key="agent-item-cursor-hooks"]').check()
    await expect
      .poll(() => readFileSync(join(team.home, '.cursor', 'hooks.json'), 'utf8'))
      .toContain('cursor-hook.js')
    await prefs.close()

    const id = await startWorker(team)
    await expect.poll(() => team.hookLog().length).toBe(2)
    // The real run's sequence: the pane restarted by a wake first, then /new in it.
    await expect
      .poll(() => callAsClaude(team.home, 'last_reply', { name: WORKER }), { timeout: 15_000 })
      .toContain('ack 1: build the thing')
    expect(
      await callAsClaude(team.home, 'send_message', { name: WORKER, text: 'look at a.txt' }),
    ).toMatch(/^Sent to client-work-t1\./)
    await expect.poll(() => team.starts().length, { timeout: 20_000 }).toBe(2)
    expect(team.starts()[1]).toContain(`--resume ${id} `)
    await expect(screen).toContainText('ack 1: [Menkar] from', { timeout: 15_000 })
    await expect.poll(() => team.hookLog().length).toBe(4)
    await typeIn(team.page, '/new')
    await typeIn(team.page, 'Say OK new.')
    await expect(screen).toContainText('ack 2: Say OK new.', { timeout: 15_000 })
    const fresh = () =>
      team
        .hookLog()
        .map((l) => l.session_id)
        .find((s) => s !== id) ?? ''
    await expect.poll(fresh).not.toBe('')
    const newId = fresh()
    const panes = async () =>
      (
        (await team.page.evaluate(() =>
          (
            globalThis as unknown as { menkar: { window: { state(): Promise<unknown> } } }
          ).menkar.window.state(),
        )) as { tabs: { panes: { sessionId: string | null }[] }[] }
      ).tabs.flatMap((t) => t.panes.map((p) => p.sessionId))
    await expect.poll(panes, { timeout: 15_000 }).toContain(newId)
    expect(await panes()).not.toContain(id)
    expect(team.saved().projects[0]?.members).toContain(newId)
    expect(team.saved().projects[0]?.parents).toEqual({ [newId]: SESSION })
  } finally {
    await team.launched.close()
  }
})

// Cursor's free-requests limit (measured by `cursor`, 2026-11-24): every turn ends in an error and
// the refused prompt is put back in the box. A wake never restarts such a session on its own; once
// the human empties the box it is resumed once, and the refused wake back in the box holds the next.
test('a Cursor worker on its free-requests limit screen is not restarted by wakes in a loop', async () => {
  const team = await launchTeam({ FAKE_CURSOR_LIMIT: '1' })
  const screen = team.page.locator('.xterm-rows:visible')
  // A start's line; a multi-line first prompt goes on over more lines of the file.
  const starts = () => team.starts().filter((l) => /^--(new-session-id|resume) /.test(l))
  try {
    const id = await startWorker(team, 'free requests limit')
    await expect(screen).toContainText('→ build the thing')
    await expect
      .poll(() => callAsClaude(team.home, 'last_reply', { name: WORKER }), { timeout: 15_000 })
      .not.toMatch(/no session|not found/i)
    for (const text of ['look at a.txt', 'and b.txt'])
      expect(await callAsClaude(team.home, 'send_message', { name: WORKER, text })).toMatch(
        /^Sent to client-work-t1\./,
      )
    await expect.poll(team.held).toHaveLength(2)
    await team.page.waitForTimeout(3000)
    expect(starts()).toHaveLength(1)

    // The human empties the box: one resume carries both, and is refused in turn.
    await team.page.locator('.xterm:visible').click()
    for (let i = 0; i < 'build the thing'.length; i++) await team.page.keyboard.press('Backspace')
    await expect.poll(() => starts().length, { timeout: 20_000 }).toBe(2)
    expect(starts()[1]).toContain(`--resume ${id} `)
    await expect(screen).toContainText('free requests limit', { timeout: 15_000 })
    await expect(screen).toContainText('→ [Menkar] from')
    expect(team.held()).toEqual([])

    expect(
      await callAsClaude(team.home, 'send_message', { name: WORKER, text: 'and c.txt' }),
    ).toMatch(/^Sent to client-work-t1\./)
    await expect.poll(team.held).toHaveLength(1)
    await team.page.waitForTimeout(3000)
    expect(starts()).toHaveLength(2)
  } finally {
    await team.launched.close()
  }
})
