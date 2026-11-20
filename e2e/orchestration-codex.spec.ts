// Plan 39 P1b.6. The first-time card with several agents installed (decision 1.155 Q2 and the
// human's of 2026-11-20): the new orchestrator's agent on a line of its own, defaulting to the
// agent last started and remembered for the next card; only an agent whose sessions can use
// Menkar's tools can be chosen; each listed session names its agent; a Cursor session chosen to
// orchestrate or to work for the orchestrator is said to have limits, and nothing is forbidden.
// "Ask an agent" starts the focused agent pane's agent, else the agent last started. And a Claude
// orchestrator with a Codex worker, end to end, with the stand-in agents.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { CLEARED_SESSION, CLIENT, clientWork, cursorStandIn, prepare, SESSION } from './fixtures'
import { codexStandIn } from './standins/codex'

const SHOTS = '/tmp/menkar-shots'
const SECOND = 'dddddddddddd'
const CURSOR = 'c0ffee01'
const TIME = String.raw`\(\d\d:\d\d:\d\d\)`
const QUIET_MS = 4000

type Agent = 'codex' | 'cursor'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

interface Shown {
  readonly orchestration: { on: boolean; orchestrator: string | null }
  readonly lastAgent: string
}

const shown = (page: Page): Promise<Shown> =>
  page.evaluate(async () => {
    const s = await (
      globalThis as unknown as {
        menkar: {
          window: {
            state(): Promise<{
              shown: string
              settings: { last_agent: string }
              projects: { id: string; orchestration: Shown['orchestration'] }[]
            }>
          }
        }
      }
    ).menkar.window.state()
    const p = s.projects.find((x) => x.id === s.shown)
    return {
      orchestration: p?.orchestration ?? { on: false, orchestrator: null },
      lastAgent: s.settings.last_agent,
    }
  })

// A Cursor session of the client's project, in its api folder, as Cursor keeps one.
function cursorMember(dirs: { readonly root: string; readonly home: string }): void {
  const cwd = join(dirs.home, 'work', 'api')
  const transcripts = join(
    dirs.home,
    '.cursor',
    'projects',
    cwd.slice(1).replace(/[^A-Za-z0-9]/g, '-'),
    'agent-transcripts',
    CURSOR,
  )
  mkdirSync(transcripts, { recursive: true })
  writeFileSync(
    join(transcripts, `${CURSOR}.jsonl`),
    `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: '<user_query>polish the ui</user_query>' }] } })}\n`,
  )
  const file = join(dirs.root, 'config', 'menkar', 'projects.json')
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  saved.projects[0].members.push(CURSOR)
  writeFileSync(file, JSON.stringify(saved))
}

async function cardApp(
  agents: readonly Agent[],
  options: { readonly lastAgent?: string; readonly cursorSession?: boolean } = {},
) {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      const env = clientWork(dirs, {
        settings: { last_agent: options.lastAgent ?? '' },
        extraProjects: [{ id: SECOND, name: 'Second', members: [] }],
      })
      const bin = join(dirs.root, 'bin')
      if (agents.includes('codex')) {
        codexStandIn(bin)
        mkdirSync(join(dirs.home, '.codex'), { recursive: true })
      }
      if (agents.includes('cursor')) cursorStandIn(bin)
      if (options.cursorSession) cursorMember(dirs)
      return { ...env, FAKE_CODEX_TURN_MS: '300' }
    },
  })
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  return { launched, page: launched.window, home, read }
}

const card = (page: Page) => page.locator('.orch-card')
const picker = (page: Page) => card(page).locator('.card-agent .agent-picker')
const agentButton = (page: Page, agent: string) =>
  picker(page).locator(`button[data-agent="${agent}"]`)

async function openCard(page: Page): Promise<void> {
  await page.locator('#orchestration-switch').click()
  await expect(card(page)).toBeVisible()
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, name) })
}

test('the first-time card with one agent installed: no agent line, no agent beside the sessions, no limits said (screenshot)', async () => {
  const app = await cardApp([])
  try {
    await openCard(app.page)
    await expect(card(app.page).locator('.card-choice')).toHaveCount(4)
    await expect(card(app.page).locator('.card-agent')).toHaveCount(0)
    await expect(card(app.page).locator('.card-agent-name')).toHaveCount(0)
    await expect(card(app.page).locator('.card-limits:visible')).toHaveCount(0)
    await expect(card(app.page).locator('.body.dim')).toHaveText(
      'The orchestrator is an ordinary session that loads Menkar’s orchestrator skill.',
    )
    await shot(app.page, 'card-one-agent.png')
  } finally {
    await app.launched.close()
  }
})

test('the first-time card with two agents: the agent line defaults to the agent last started; Codex chosen starts a Codex orchestrator, marked at once, told to read its skill by path, named as typed; the next card defaults to Codex (screenshots)', async () => {
  const app = await cardApp(['codex'], { lastAgent: 'claude' })
  try {
    await openCard(app.page)
    await expect(picker(app.page)).toBeVisible()
    await expect(agentButton(app.page, 'claude')).toHaveAttribute('aria-pressed', 'true')
    await expect(agentButton(app.page, 'codex')).toHaveAttribute('aria-pressed', 'false')
    await expect(agentButton(app.page, 'codex')).toBeEnabled()
    await expect(agentButton(app.page, 'cursor')).toBeDisabled()
    await expect(agentButton(app.page, 'cursor')).toHaveAttribute(
      'title',
      'cursor-agent is not installed',
    )
    await expect(
      card(app.page).locator(`.card-choice:has(input[value="${CLIENT.login}"]) .card-agent-name`),
    ).toHaveText('Claude Code')
    await expect(
      card(app.page).locator(`.card-managed[data-session="${CLIENT.api}"] .card-agent-name`),
    ).toHaveText('Claude Code')
    await shot(app.page, 'card-two-agents.png')

    await card(app.page).locator('input[value="#new"]').check()
    await agentButton(app.page, 'codex').click()
    await expect(agentButton(app.page, 'codex')).toHaveAttribute('aria-pressed', 'true')
    await expect(card(app.page).locator('.card-limits:visible')).toHaveCount(0)
    for (const box of await card(app.page).locator('.card-managed:visible input').all())
      await box.uncheck()
    await card(app.page).locator('.responses button', { hasText: 'Start' }).click()
    await expect(card(app.page)).toHaveCount(0)

    await expect.poll(() => app.read('codex-args.txt')).not.toBe('')
    const args = app.read('codex-args.txt')
    expect(args).toMatch(
      /Load `menkar:orchestrator` by reading its SKILL\.md at \/\S+\/skills\/orchestrator\/SKILL\.md, whole\. You are the orchestrator of the project Client work\./,
    )
    expect(args).not.toContain('Skill tool')
    const marked = await shown(app.page)
    expect(marked.orchestration.on).toBe(true)
    expect(marked.orchestration.orchestrator).not.toBeNull()
    expect(marked.lastAgent).toBe('codex')
    // Its thread binds at its first message, the prompt's; the mark and the name follow it.
    await expect.poll(() => app.read('codex-threads.txt').trim()).not.toBe('')
    const thread = app.read('codex-threads.txt').trim().split('\n')[0] ?? ''
    await expect
      .poll(async () => (await shown(app.page)).orchestration.orchestrator, { timeout: 15_000 })
      .toBe(thread)
    await expect
      .poll(() => app.read('.codex/session_index.jsonl'), { timeout: 15_000 })
      .toContain('"orchestrator"')
    await expect(app.page.locator(`.row[data-session="${thread}"]`)).toContainText('orchestrator')

    // The next card, another project's, defaults to the agent chosen.
    await act(app.page, { type: 'switchProject', project: SECOND })
    await openCard(app.page)
    await expect(agentButton(app.page, 'codex')).toHaveAttribute('aria-pressed', 'true')
    await expect(agentButton(app.page, 'claude')).toHaveAttribute('aria-pressed', 'false')
    await shot(app.page, 'card-remembers-codex.png')
  } finally {
    await app.launched.close()
  }
})

test("the first-time card with Cursor installed: Cursor can't be chosen for a new orchestrator yet; a Cursor session chosen to orchestrate or checked to work is said to have limits, and nothing is forbidden (screenshots)", async () => {
  const app = await cardApp(['codex', 'cursor'], { lastAgent: 'cursor', cursorSession: true })
  try {
    await openCard(app.page)
    // The agent last started can't orchestrate a new session: Claude Code is chosen instead.
    await expect(agentButton(app.page, 'claude')).toHaveAttribute('aria-pressed', 'true')
    await expect(agentButton(app.page, 'cursor')).toBeDisabled()
    await expect(agentButton(app.page, 'cursor')).toHaveAttribute(
      'title',
      'Cursor sessions can’t use Menkar’s tools yet',
    )
    const cursorRow = card(app.page).locator(`.card-managed[data-session="${CURSOR}"]`)
    await expect(cursorRow.locator('.card-agent-name')).toHaveText('Cursor')
    const workerLimits = card(app.page).locator(`.card-limits[data-limits="${CURSOR}"]`)
    const orchestratorLimits = card(app.page).locator('.card-limits[data-limits="orchestrator"]')
    await expect(workerLimits).toBeVisible()
    await expect(workerLimits).toContainText(
      'is a Cursor session: it can work for the orchestrator, with limits — waking it when idle restarts it, and it asks before each tool you have not allowed.',
    )
    await expect(orchestratorLimits).toBeHidden()
    await shot(app.page, 'card-cursor-worker.png')

    // Unchecked: no longer said.
    await cursorRow.locator('input').uncheck()
    await expect(workerLimits).toHaveCount(0)
    await cursorRow.locator('input').check()
    await expect(workerLimits).toBeVisible()

    // Chosen to orchestrate: said under the choice, and no longer listed to work.
    await card(app.page).locator(`input[name="orchestrator"][value="${CURSOR}"]`).check()
    await expect(orchestratorLimits).toBeVisible()
    await expect(orchestratorLimits).toHaveText(
      'Cursor can orchestrate, with limits: waking it when idle restarts it, and it asks before each tool you have not allowed.',
    )
    await expect(workerLimits).toHaveCount(0)
    await shot(app.page, 'card-cursor-orchestrator.png')

    // Start is not refused: the Cursor session is marked.
    await card(app.page).locator('.responses button', { hasText: 'Start' }).click()
    await expect(card(app.page)).toHaveCount(0)
    await expect.poll(async () => (await shown(app.page)).orchestration.orchestrator).toBe(CURSOR)
  } finally {
    await app.launched.close()
  }
})

async function askApp() {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      const env = clientWork(dirs, { settings: { last_agent: 'codex' } })
      codexStandIn(join(dirs.root, 'bin'))
      mkdirSync(join(dirs.home, '.codex'), { recursive: true })
      mkdirSync(join(dirs.home, 'docs'), { recursive: true })
      writeFileSync(join(dirs.home, 'docs', 'design.md'), '# Design\n')
      return { ...env, FAKE_CODEX_TURN_MS: '300' }
    },
  })
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  return { launched, page: launched.window, home, read }
}

test('"Ask an agent" starts the focused agent pane’s agent; with no agent pane, the agent last started', async () => {
  const app = await askApp()
  const design = () => join(app.home, 'docs', 'design.md')
  const prompt = () => `Read ${design()} and answer my questions about it.`
  try {
    // No agent pane in the project: the agent last started, Codex.
    await act(app.page, { type: 'openFilePath', path: design() })
    await app.page.locator('.file-tab:visible .ask-agent').click()
    await expect.poll(() => app.read('codex-args.txt')).toContain(prompt())
    expect(app.read('claude-args.txt')).toBe('')

    // The login fix's Claude pane focused: Claude, though Codex was the agent last started.
    await app.page.locator(`.row[data-session="${CLIENT.login}"]`).dblclick()
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('stand-in claude ready')
    await act(app.page, { type: 'openFilePath', path: design() })
    await app.page.locator('.file-tab:visible .ask-agent').click()
    await expect.poll(() => app.read('claude-args.txt')).toContain(prompt())
  } finally {
    await app.launched.close()
  }
})

// ------------------------------------------------- a Claude orchestrator with a Codex worker

async function teamApp() {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      const env = prepare(dirs)
      codexStandIn(join(dirs.root, 'bin'))
      mkdirSync(join(dirs.home, '.codex'), { recursive: true })
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
      return { ...env, MENKAR_LOG: 'info', FAKE_CLAUDE_SOCKET: '1', FAKE_CODEX_TURN_MS: '300' }
    },
  })
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  return { launched, page: launched.window, home, root, read }
}

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

// The user messages of every rollout under the stand-in's Codex home, in order.
function codexUserMessages(home: string): string[] {
  const texts: string[] = []
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const at = join(dir, item.name)
      if (item.isDirectory()) walk(at)
      else if (item.name.endsWith('.jsonl'))
        for (const line of readFileSync(at, 'utf8').split('\n').filter(Boolean)) {
          const record = JSON.parse(line)
          if (record.payload?.item?.type === 'UserMessage')
            texts.push(record.payload.item.content[0].text)
        }
    }
  }
  walk(join(home, '.codex', 'sessions'))
  return texts
}

async function typeIn(page: Page, text: string) {
  await page.locator('.xterm:visible').click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

test('a Claude orchestrator and a Codex worker: started for a task, it reports and the orchestrator is woken; last_reply reads it; they message each other by name; a team update to it wakes nobody (screenshots)', async () => {
  const app = await teamApp()
  const WORKER = 'client-work-t1'
  const ORCHESTRATOR = 'fix the login bug'
  const posts = (): string[] =>
    app
      .read('claude-posts.jsonl')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l).content)
  try {
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')

    // Start: a Codex worker for task 1, told what to do by its first message.
    expect(await callAsClaude(app.home, 'task_add', { title: 'build the thing' })).toContain(
      'Task 1 added.',
    )
    expect(
      await callAsClaude(app.home, 'start_session', {
        agent: 'codex',
        task: 1,
        prompt: 'build the thing',
      }),
    ).toContain(`Started "${WORKER}" for task 1, now assigned to it`)
    await expect.poll(() => app.read('codex-threads.txt').trim()).not.toBe('')
    const thread = app.read('codex-threads.txt').trim().split('\n')[0] ?? ''
    // The worker's row is under the orchestrator's, folded.
    await app.page.locator(`.row[data-session="${SESSION}"] .team-fold`).click()
    await expect(app.page.locator(`.row[data-session="${thread}"]`)).toContainText(WORKER, {
      timeout: 15_000,
    })
    await shot(app.page, 'codex-worker-started.png')

    // Report and wake: its task to review, and at its turn's end the orchestrator is told once.
    await app.page.locator(`.row[data-session="${thread}"]`).click()
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: build the thing')
    const take = app.page.locator('.pane-banner button:visible', { hasText: 'Take control' })
    await take.click()
    await expect(take).toHaveCount(0)
    await typeIn(
      app.page,
      `/menkar task_steps ${JSON.stringify({ number: 1, steps: ['build', 'check', 'report'] })}`,
    )
    await expect(app.page.locator('.xterm-rows:visible')).toContainText(
      'TOOL task_steps: Task 1 has 3 steps',
    )
    await typeIn(app.page, `/menkar task_review ${JSON.stringify({ number: 1, note: 'ready' })}`)
    await expect(app.page.locator('.xterm-rows:visible')).toContainText(
      'TOOL task_review: Task 1 is to review',
    )
    await typeIn(app.page, 'wrap up')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: wrap up')
    const review = new RegExp(`^\\[Menkar\\] ${WORKER} set task 1 to review: ready ${TIME}`)
    await expect
      .poll(() => posts().filter((p) => review.test(p)), { timeout: 15_000 })
      .toHaveLength(1)
    await shot(app.page, 'codex-worker-reported.png')

    // last_reply: the worker's last answer, read from its rollout.
    await expect
      .poll(() => callAsClaude(app.home, 'last_reply', { name: WORKER }))
      .toContain('Done: wrap up')

    // Claude → Codex, through codex queue, framed with the sender and the tool to answer with.
    expect(
      await callAsClaude(app.home, 'send_message', { name: WORKER, text: 'look at a.txt' }),
    ).toBe(
      `Sent to ${WORKER}. It reaches it as a message from Menkar naming you; its answer comes back the same way.`,
    )
    await expect
      .poll(() => codexUserMessages(app.home).at(-1))
      .toMatch(
        new RegExp(
          `^\\[Menkar\\] from ${ORCHESTRATOR} \\(Claude Code\\); reply with send_message: look at a\\.txt ${TIME}$`,
        ),
      )

    // Codex → Claude, through Claude Code's messaging socket.
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: [Menkar] from')
    await typeIn(
      app.page,
      `/menkar send_message ${JSON.stringify({ name: ORCHESTRATOR, text: 'done, see a.txt' })}`,
    )
    await expect(app.page.locator('.xterm-rows:visible')).toContainText(
      `TOOL send_message: Sent to ${ORCHESTRATOR}.`,
    )
    await expect
      .poll(() => posts().filter((p) => p.includes('done, see a.txt')))
      .toEqual([
        expect.stringMatching(
          new RegExp(
            `^\\[Menkar\\] from ${WORKER} \\(Codex\\); reply with send_message: done, see a\\.txt ${TIME}$`,
          ),
        ),
      ])

    // A team update reaches the worker as a turn of its own; its end wakes nobody.
    const before = posts().length
    await act(app.page, { type: 'setRole', session: thread, label: 'Reviewer' })
    await expect
      .poll(() => codexUserMessages(app.home).filter((m) => m.includes('Team update')), {
        timeout: 20_000,
      })
      .toHaveLength(1)
    await expect(app.page.locator('.xterm-rows:visible')).toContainText(
      'Done: [Menkar] Team update',
    )
    await app.page.waitForTimeout(QUIET_MS)
    expect(posts()).toHaveLength(before)
    await shot(app.page, 'codex-worker-team-update.png')
  } finally {
    await app.launched.close()
  }
})

// A pane's banner acts on the session the pane runs now: a worker whose id changed while its
// banner showed (a Claude `/clear`, a Codex thread binding) is handed back under its new id.
test('a Claude worker taken control of, then cleared: "Back to reporting" hands back the new session', async () => {
  const app = await teamApp()
  try {
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    expect(await callAsClaude(app.home, 'start_session', { name: 'helper' })).toContain(
      'Started "helper"',
    )
    await app.page.locator(`.row[data-session="${SESSION}"] .team-fold`).click()
    await app.page.locator('.row', { hasText: 'helper' }).click()
    const banner = app.page.locator('.pane-banner:visible')
    await expect(banner).toContainText('This session reports to the orchestrator.')
    await banner.locator('button').click()
    await expect(banner.locator('button')).toHaveText('Back to reporting to the orchestrator')
    await app.page.locator('.xterm:visible').click()
    await app.page.keyboard.type('CLEAR')
    await expect(banner).toHaveAttribute('data-session', CLEARED_SESSION)
    await banner.locator('button').click()
    await expect(banner).toContainText('This session reports to the orchestrator.')
  } finally {
    await app.launched.close()
  }
})
