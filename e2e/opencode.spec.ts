// An OpenCode session through Menkar, end to end with the stand-in `opencode` (plan 39's gate for
// OpenCode): alone, started from New on Menkar's own `opencode serve` through its pane's proxy,
// its state read from its screen, the server stopped with its last tab and its session resumed
// from its row; and as a worker of a Claude orchestrator, with Menkar's MCP mounted for its folder,
// its team entry, its skills served by `load_skill`, a subagent's call resolved to its root, and
// messages both ways. The catalog is opencode-catalog.spec.ts's; D9's line
// opencode-other-server.spec.ts's.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'
import { opencodeStandIn } from './standins/opencode'

const TIME = String.raw`\(\d\d:\d\d:\d\d\)`
const BUILTIN = [
  'edit',
  'glob',
  'grep',
  'question',
  'read',
  'shell',
  'skill',
  'subagent',
  'webfetch',
  'websearch',
  'write',
  'execute',
]

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
  projects: { members: string[]; parents?: Record<string, string> }[]
}

interface Request {
  sessionID: string
  tools: string[]
  system: { instructions: string[]; skills: string[]; entries: { key: string; value: string }[] }
}

async function launch(
  options: { readonly orchestration?: boolean; readonly turnMs?: number } = {},
) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      opencodeStandIn(join(dirs.root, 'bin'))
      if (options.orchestration)
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
      return {
        ...env,
        MENKAR_LOG: 'info',
        FAKE_CLAUDE_SOCKET: '1',
        FAKE_OPENCODE_TURN_MS: String(options.turnMs ?? 1500),
      }
    },
  })
  const page = launched.window
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  const lines = (name: string) => read(name).split('\n').filter(Boolean)
  const requests = (): Request[] => lines('opencode-requests.jsonl').map((l) => JSON.parse(l))
  const saved = (): Saved =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
  const dot = (session: string) =>
    page.locator(`.row[data-session="${session}"] .dot`).getAttribute('class')
  // The TUIs Menkar started: `--server <proxy> -s <id>`, never `serve`.
  const tuis = () => lines('opencode-args.txt').filter((l) => l.startsWith('--server'))
  const serves = () => lines('opencode-args.txt').filter((l) => l.startsWith('serve'))
  return { launched, page, root, home, read, lines, requests, saved, dot, tuis, serves }
}

async function typeIn(page: Page, text: string) {
  await page.locator('.xterm:visible').click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const shot = async (page: Page, name: string) => {
  const files = process.env.MENKAR_FILES
  if (files) await page.screenshot({ path: join(files, `menkar-t196-${name}.png`) })
}

test('an OpenCode session started from New runs on Menkar’s server through its own proxy, made before its TUI; its state is read from its screen; a mode-off session’s request has none of Menkar’s tools', async () => {
  const app = await launch({ turnMs: 6000 })
  try {
    const work = join(app.home, 'work')
    await act(app.page, { type: 'startNew', agent: 'opencode', folder: work, name: '' })
    await expect(app.page.locator('.xterm-rows')).toContainText('ctrl+p commands')

    // One server, `serve --stdio` on a port of its own; the TUI on another port, the pane's proxy,
    // with the session Menkar made for it and nothing else.
    expect(app.serves()).toEqual([expect.stringMatching(/^serve --stdio --port \d+$/)])
    const serverPort = /--port (\d+)/.exec(app.serves()[0] ?? '')?.[1]
    const [tui = ''] = app.tuis()
    const started = /^--server http:\/\/127\.0\.0\.1:(\d+) -s (ses_\w+)$/.exec(tui)
    expect(started).not.toBeNull()
    const [, proxyPort, id = ''] = started ?? []
    expect(proxyPort).not.toBe(serverPort)
    const env = JSON.parse(app.read('opencode-env.json'))
    expect(env.OPENCODE_PASSWORD).toMatch(/\S{20,}/)
    const serverEnv = JSON.parse(app.read('opencode-serve-env.json'))
    expect(serverEnv.MENKAR_PANE).toBeUndefined()
    expect(serverEnv.OPENCODE_PASSWORD).toBe(env.OPENCODE_PASSWORD)

    await typeIn(app.page, 'add the routes')
    // Read from OpenCode's screen while the turn runs.
    await expect(app.page.locator('.tab .dot').first()).toHaveClass(/working/)
    await expect.poll(() => app.saved().projects[0]?.members, { timeout: 10_000 }).toContain(id)
    await expect(app.page.locator('.xterm-rows')).toContainText('ack 1: add the routes', {
      timeout: 15_000,
    })
    await expect.poll(() => app.dot(id), { timeout: 10_000 }).not.toContain('working')
    // The stand-in titles a session by its first words; the row shows OpenCode's title.
    await expect(app.page.locator(`.row[data-session="${id}"]`)).toContainText('add the routes', {
      timeout: 20_000,
    })

    // Outside the orchestration mode the model is sent exactly what OpenCode sends on its own.
    const request = app.requests().find((r) => r.sessionID === id)
    expect(request?.tools).toEqual(BUILTIN)
    expect(request?.system).toEqual({ instructions: [], skills: [], entries: [] })

    // A permission card is blocked; answered, the turn ends.
    await typeIn(app.page, 'RUNTOOL now')
    await expect(app.page.locator('.xterm-rows')).toContainText('Permission required')
    await expect.poll(() => app.dot(id), { timeout: 10_000 }).toContain('blocked')
    await shot(app.page, 'opencode-blocked')
    await app.page.keyboard.press('Enter')
    await expect(app.page.locator('.xterm-rows')).toContainText('ack 2: RUNTOOL now', {
      timeout: 15_000,
    })
    await expect.poll(() => app.dot(id), { timeout: 10_000 }).not.toMatch(/working|blocked/)
    await shot(app.page, 'opencode-alone')
  } finally {
    await app.launched.close()
  }
})

test('closing the last OpenCode tab stops Menkar’s server; opening the row resumes the same session with `-s <id>` on a new server', async () => {
  const app = await launch()
  try {
    const work = join(app.home, 'work')
    await act(app.page, { type: 'startNew', agent: 'opencode', folder: work, name: '' })
    await expect(app.page.locator('.xterm-rows')).toContainText('ctrl+p commands')
    const id = /-s (ses_\w+)/.exec(app.tuis()[0] ?? '')?.[1] ?? ''
    await typeIn(app.page, 'first')
    await expect(app.page.locator('.xterm-rows')).toContainText('ack 1: first', {
      timeout: 15_000,
    })
    await expect.poll(async () => (await shown(app.page)).tabs[0]?.panes[0]?.sessionId).toBe(id)
    const [pid] = app.lines('opencode-serve-pids.txt').map(Number)
    expect(alive(pid ?? 0)).toBe(true)

    await act(app.page, { type: 'closeTab', tab: (await shown(app.page)).tabs[0]?.id })
    await expect(app.page.locator('.tab')).toHaveCount(0)
    await expect.poll(() => alive(pid ?? 0), { timeout: 10_000 }).toBe(false)
    await expect.poll(() => app.dot(id)).toContain('stopped')

    await act(app.page, { type: 'openSession', session: id })
    await expect(app.page.locator('.xterm-rows')).toContainText('ack 1: first')
    expect(app.serves()).toHaveLength(2)
    expect(app.tuis().at(-1)).toMatch(new RegExp(`^--server http://127\\.0\\.0\\.1:\\d+ -s ${id}$`))
    await typeIn(app.page, 'second')
    await expect(app.page.locator('.xterm-rows')).toContainText(/ack \d+: second/, {
      timeout: 15_000,
    })
    expect((await shown(app.page)).tabs.map((t) => t.panes.map((p) => p.sessionId))).toEqual([[id]])
  } finally {
    await app.launched.close()
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

// Menkar's own server, called as OpenCode's subagent tool would make a child: the password is the
// one the server was started with, the port the one it was given.
async function onServer(
  app: Awaited<ReturnType<typeof launch>>,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const port = /--port (\d+)/.exec(app.serves().at(-1) ?? '')?.[1]
  const password = JSON.parse(app.read('opencode-serve-env.json')).OPENCODE_PASSWORD
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const raw = await response.text()
  return { status: response.status, body: raw ? JSON.parse(raw) : null }
}

test('a Claude orchestrator and an OpenCode worker: Menkar’s MCP for its folder and its team entry; it loads a skill with load_skill; a subagent’s call is its root’s; it reports and the orchestrator is woken; they message each other by name (screenshots)', async () => {
  const app = await launch({ orchestration: true })
  const WORKER = 'client-work-t1'
  const ORCHESTRATOR = 'fix the login bug'
  const posts = (): string[] =>
    app
      .read('claude-posts.jsonl')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l).content)
  const screen = app.page.locator('.xterm-rows:visible')
  try {
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')

    expect(await callAsClaude(app.home, 'task_add', { title: 'build the thing' })).toContain(
      'Task 1 added.',
    )
    expect(
      await callAsClaude(app.home, 'start_session', {
        agent: 'opencode',
        task: 1,
        prompt: 'build the thing',
      }),
    ).toContain(`Started "${WORKER}" for task 1, now assigned to it`)
    await expect.poll(() => app.tuis()).toHaveLength(1)
    const id = /-s (ses_\w+)/.exec(app.tuis()[0] ?? '')?.[1] ?? ''
    // OpenCode's session is made before its TUI, so it is member and child by its own id at once.
    expect(app.saved().projects[0]?.members).toEqual([SESSION, id])
    expect(app.saved().projects[0]?.parents).toEqual({ [id]: SESSION })

    // Its first prompt ran with Menkar's tools listed directly and its team block as an entry.
    await expect.poll(() => app.requests().filter((r) => r.sessionID === id)).not.toHaveLength(0)
    const [first] = app.requests().filter((r) => r.sessionID === id)
    expect(first?.tools).toEqual(
      expect.arrayContaining(['menkar_task_review', 'menkar_send_message', 'menkar_load_skill']),
    )
    expect(first?.system.skills).toEqual([])
    expect(first?.system.entries).toHaveLength(1)
    expect(first?.system.entries[0]?.value).toContain(WORKER)
    expect(first?.system.entries[0]?.value).toContain('load_skill')
    const mcpEnv = JSON.parse(app.read('opencode-mcp-env.json'))
    expect(mcpEnv.MENKAR_AGENT).toBe('opencode')
    expect(mcpEnv.MENKAR_PANE).toBeUndefined()

    await app.page.locator(`.row[data-session="${SESSION}"] .team-fold`).click()
    await expect(app.page.locator(`.row[data-session="${id}"]`)).toContainText(WORKER, {
      timeout: 15_000,
    })
    await app.page.locator(`.row[data-session="${id}"]`).click()
    await expect(screen).toContainText('ack 1: build the thing', { timeout: 15_000 })
    await shot(app.page, 'opencode-worker-started')
    const take = app.page.locator('.pane-banner button:visible', { hasText: 'Take control' })
    await take.click()
    await expect(take).toHaveCount(0)

    // A skill by its name, through Menkar's MCP, with its folder as OpenCode's own skill tool says.
    const answers = async (session: string) =>
      (
        (await onServer(app, `/api/session/${session}/message`)).body as {
          data: { type: string; data: { content?: { text: string }[] } }[]
        }
      ).data
        .filter((m) => m.type === 'assistant')
        .map((m) => m.data.content?.[0]?.text ?? '')
    await typeIn(app.page, `CALLMENKAR load_skill ${JSON.stringify({ name: 'menkar:worker' })}`)
    await expect
      .poll(async () => (await answers(id)).at(-1), { timeout: 15_000 })
      .toMatch(/^TOOL load_skill: Base directory for this skill: \/\S+\/skills\/worker\n/)
    expect((await answers(id)).at(-1)).toContain('# Working on a task another session handed you')
    await shot(app.page, 'opencode-worker-load-skill')
    const before = (await answers(id)).length
    await typeIn(app.page, `CALLMENKAR load_skill ${JSON.stringify({ name: 'nothing' })}`)
    await expect.poll(async () => (await answers(id)).length, { timeout: 15_000 }).toBe(before + 1)
    expect((await answers(id)).at(-1)).toBe(
      'TOOL load_skill: Menkar has no skill by that name for this session.',
    )
    // One named with Menkar's own prefix that its plugin does not have is refused the same way.
    await typeIn(app.page, `CALLMENKAR load_skill ${JSON.stringify({ name: 'menkar:nope' })}`)
    await expect.poll(async () => (await answers(id)).length, { timeout: 15_000 }).toBe(before + 2)
    expect((await answers(id)).at(-1)).toBe(
      'TOOL load_skill: Menkar has no skill by that name for this session.',
    )

    // A subagent's call names its own session; Menkar follows it to the root the pane shows.
    const child = 'ses_0000000000a1SubagentChild1'
    expect(
      (
        await onServer(app, '/api/session', {
          id: child,
          parentID: id,
          location: { directory: join(app.home, 'work') },
        })
      ).status,
    ).toBe(200)
    await onServer(app, `/api/session/${child}/prompt`, {
      text: `CALLMENKAR task_steps ${JSON.stringify({ number: 1, steps: ['build', 'check', 'report'] })}`,
    })
    await expect
      .poll(async () => (await answers(child)).at(-1), { timeout: 15_000 })
      .toMatch(/^TOOL task_steps: Task 1 has 3 steps/)

    // Report and wake: its task to review, and at its turn's end the orchestrator is told once.
    await typeIn(app.page, `CALLMENKAR task_review ${JSON.stringify({ number: 1, note: 'ready' })}`)
    await expect(screen).toContainText('TOOL task_review: Task 1 is to review', { timeout: 15_000 })
    const review = new RegExp(`^\\[Menkar\\] ${WORKER} set task 1 to review: ready ${TIME}`)
    await expect
      .poll(() => posts().filter((p) => review.test(p)), { timeout: 20_000 })
      .toHaveLength(1)

    // last_reply reads the worker's last answer from OpenCode's database.
    await expect
      .poll(() => callAsClaude(app.home, 'last_reply', { name: WORKER }), { timeout: 15_000 })
      .toContain('TOOL task_review')

    // Claude → OpenCode: queued on its own server, framed with the sender and the tool to answer.
    expect(
      await callAsClaude(app.home, 'send_message', { name: WORKER, text: 'look at a.txt' }),
    ).toBe(
      `Sent to ${WORKER}. It reaches it as a message from Menkar naming you; its answer comes back the same way.`,
    )
    await expect(screen).toContainText(
      `[Menkar] from ${ORCHESTRATOR} (Claude Code); reply with send_message: look at a.txt`,
      { timeout: 20_000 },
    )

    // OpenCode → Claude, through Claude Code's messaging socket.
    await typeIn(
      app.page,
      `CALLMENKAR send_message ${JSON.stringify({ name: ORCHESTRATOR, text: 'done, see a.txt' })}`,
    )
    await expect(screen).toContainText(`TOOL send_message: Sent to ${ORCHESTRATOR}.`, {
      timeout: 15_000,
    })
    await expect
      .poll(() => posts().filter((p) => p.includes('done, see a.txt')))
      .toEqual([
        expect.stringMatching(
          new RegExp(
            `^\\[Menkar\\] from ${WORKER} \\(OpenCode\\); reply with send_message: done, see a\\.txt ${TIME}$`,
          ),
        ),
      ])
    await shot(app.page, 'opencode-worker-messages')
  } finally {
    await app.launched.close()
  }
})
