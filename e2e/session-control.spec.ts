// Plan 31: Menkar's MCP tools, called by the stand-in claude through the real built server, as
// Claude Code calls them. renew (1.70) ends the session once its turn is over and starts a fresh
// one in the same tab, the old one its earlier conversation; start_session opens a session after
// the caller's tab without taking the focus; list_sessions and last_reply address sessions by name.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, savedState, terminalText } from './app'
import { prepare, SESSION } from './fixtures'

const CLIENT_WORK = 'aaaaaaaaaaaa'

interface Saved {
  projects: {
    members: string[]
    groups: { name: string; members: string[] }[]
    earlier?: Record<string, string[]>
    parents?: Record<string, string>
    orchestration?: { roles?: Record<string, string>; parked?: string[] }
    hidden?: string[]
  }[]
}

// A stopped session called "worker", with a role and a ★ task, in the orchestration mode with "api"
// its orchestrator (decision 1.92).
const OLD_WORKER = '0b1d0b1d-0000-4000-8000-000000000001'

async function open(
  options: {
    stoppedWorker?: boolean
    orchestrated?: boolean
    env?: Readonly<Record<string, string>>
  } = {},
) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      const work = join(dirs.home, 'work')
      // Claude named it, so a renew starts the fresh session with the same name.
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
      if (options.stoppedWorker)
        writeFileSync(
          join(
            dirs.home,
            '.claude',
            'projects',
            work.replace(/[^A-Za-z0-9]/g, '-'),
            `${OLD_WORKER}.jsonl`,
          ),
          `${[
            { type: 'custom-title', customTitle: 'worker' },
            { type: 'user', cwd: work, message: { content: 'an earlier task' } },
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
              members: options.stoppedWorker ? [SESSION, OLD_WORKER] : [SESSION],
              groups: [{ name: 'pair', color: '#5ec4b6', members: [SESSION] }],
              ...(options.stoppedWorker
                ? {
                    orchestration: {
                      on: true,
                      orchestrator: SESSION,
                      roles: { [OLD_WORKER]: 'Worker' },
                    },
                    team_view: true,
                  }
                : {}),
              ...(options.orchestrated
                ? { orchestration: { on: true, orchestrator: SESSION }, team_view: true }
                : {}),
            },
          ],
          windows: [],
        }),
      )
      // The parent's entry in Claude Code's registry, naming a socket this test listens on.
      mkdirSync(join(dirs.home, '.claude', 'sessions'), { recursive: true })
      writeFileSync(
        join(dirs.home, '.claude', 'sessions', '4242.json'),
        JSON.stringify({
          pid: 4242,
          sessionId: SESSION,
          messagingSocketPath: join(dirs.root, 'parent.sock'),
          peerProtocol: 1,
        }),
      )
      if (options.stoppedWorker)
        writeFileSync(
          join(dirs.root, 'config', 'menkar', 'tasks.json'),
          JSON.stringify({
            version: 1,
            projects: {
              [CLIENT_WORK]: {
                next: 2,
                tasks: [
                  {
                    number: 1,
                    title: 'An earlier task',
                    assignee: OLD_WORKER,
                    star: true,
                    state: 'queued',
                    steps: [],
                    step: 0,
                    note: '',
                    created: '2026-11-13T10:00:00.000-03:00',
                    updated: '2026-11-13T10:00:00.000-03:00',
                  },
                ],
              },
            },
          }),
        )
      const state = join(dirs.root, 'config', 'menkar', 'state.json')
      writeFileSync(
        state,
        JSON.stringify({ ...JSON.parse(readFileSync(state, 'utf8')), remote_control: [SESSION] }),
      )
      return { ...env, ...options.env }
    },
  })
  const page = launched.window
  await page.locator('.row', { hasText: 'api' }).dblclick()
  await expect.poll(() => existsSync(join(home, 'claude-pid.txt'))).toBe(true)
  await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
  await page.locator('.xterm').click()
  const saved = (): Saved =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
  const argLines = (): string[] =>
    existsSync(join(home, 'claude-args.txt'))
      ? readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n')
      : []
  const remote = (): unknown => savedState(root).remote_control
  const tasksSaved = (): {
    projects: Record<string, { tasks: { assignee?: string; state: string }[] } | undefined>
  } =>
    existsSync(join(root, 'config', 'menkar', 'tasks.json'))
      ? JSON.parse(readFileSync(join(root, 'config', 'menkar', 'tasks.json'), 'utf8'))
      : { projects: {} }
  const jsonLines = <T>(name: string): T[] =>
    existsSync(join(home, name))
      ? readFileSync(join(home, name), 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line) as T)
      : []
  // What each stand-in read from its --append-system-prompt-file at start, and what reached its
  // messaging socket.
  const teamFiles = () => jsonLines<{ id: string; file: string; text: string }>('claude-team.jsonl')
  const posts = (id: string) =>
    jsonLines<{ id: string; content: string }>('claude-posts.jsonl')
      .filter((p) => p.id === id)
      .map((p) => p.content)
  return { launched, page, saved, argLines, remote, root, tasksSaved, teamFiles, posts, home }
}

const said = (page: Page, text: string) =>
  expect.poll(() => terminalText(page), { timeout: 15_000 }).toContain(text)

test('renew: once the turn ends, a fresh session with the same name and the prompt starts in the same tab; the old one is its earlier conversation, its group and Remote Control follow', async () => {
  const { launched, page, saved, argLines, remote } = await open()
  try {
    // The tool's answer is printed by the session that is then hung up: the tab shows the new one.
    await page.keyboard.type('RENEW')
    await expect.poll(() => argLines().length, { timeout: 15_000 }).toBe(2)
    const fresh = /--session-id (\S+)/.exec(argLines()[1] ?? '')?.[1] ?? ''
    expect(fresh).toMatch(/^[0-9a-f-]{36}$/)
    expect(fresh).not.toBe(SESSION)
    // The prompt reached the command through its file, whole: the shell read it.
    expect(argLines()[1]).toContain(
      `--session-id ${fresh} -n api --remote-control=api carry on from the notes --add-dir`,
    )
    await expect.poll(() => saved().projects[0]?.members).toEqual([fresh, SESSION])
    expect(saved().projects[0]?.earlier).toEqual({ [fresh]: [SESSION] })
    expect(saved().projects[0]?.groups[0]?.members).toEqual([fresh])
    await expect.poll(remote).toEqual([fresh])
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect(page.locator(`.row[data-session="${fresh}"]`)).toHaveCount(1)
    await expect(page.locator(`.row[data-session="${SESSION}"]`)).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('start_session opens the new session right after the caller’s tab without taking the focus; a taken name or an unknown group is refused; list_sessions and last_reply go by name', async () => {
  const { launched, page, saved, argLines } = await open()
  try {
    const callerTab = await page.locator('.tab.selected').getAttribute('data-tab')
    await page.keyboard.type('SPAWN1')
    await said(page, 'TOOL start_session: Started "worker" in a tab after yours')
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('.tab').first()).toHaveAttribute('data-tab', callerTab ?? '')
    await expect(page.locator('.tab.selected')).toHaveAttribute('data-tab', callerTab ?? '')
    await expect(page.locator('.tab').nth(1)).toHaveText(/worker/)
    await expect.poll(() => argLines().length).toBe(2)
    const worker = /--session-id (\S+)/.exec(argLines()[1] ?? '')?.[1] ?? ''
    expect(argLines()[1]).toContain(`--session-id ${worker} -n worker build the thing`)
    await expect.poll(() => saved().projects[0]?.parents).toEqual({ [worker]: SESSION })
    expect(saved().projects[0]?.members).toContain(worker)
    expect(saved().projects[0]?.groups[0]?.members).toEqual([SESSION, worker])

    await page.keyboard.type('SPAWN2')
    await said(page, 'A session called "worker" already has a tab in this project.')
    await page.keyboard.type('SPAWN3')
    await said(page, 'The project has no group called "no such group".')
    await expect(page.locator('.tab')).toHaveCount(2)

    // list_sessions reads the snapshot main writes once changes settle: wait for it to hold
    // the worker, as an agent told "try again in a moment" would.
    const snapshot = join(
      launched.root,
      'cache',
      'menkar',
      'control',
      'snapshot',
      `${CLIENT_WORK}.json`,
    )
    await expect
      .poll(() => (existsSync(snapshot) ? readFileSync(snapshot, 'utf8') : ''))
      .toContain('"name":"worker"')
    await page.keyboard.type('LISTS')
    await said(page, '"name": "worker"')
    await said(page, '"parent": "api"')
    await page.keyboard.type('REPLY')
    await said(page, 'TOOL last_reply: "worker" has not replied yet.')
  } finally {
    await launched.close()
  }
})

test('decision 1.92: start_session with the name of a stopped session takes it over, as after a renew: one "worker" row with its role and its tasks, the caller its parent, the old one its earlier conversation', async () => {
  const { launched, page, saved, argLines, tasksSaved } = await open({ stoppedWorker: true })
  try {
    await expect(page.locator(`.row[data-session="${OLD_WORKER}"]`)).toHaveCount(1)
    await page.keyboard.type('SPAWN1')
    await said(page, 'TOOL start_session: Started "worker" in a tab after yours')
    await expect.poll(() => argLines().length).toBe(2)
    const worker = /--session-id (\S+)/.exec(argLines()[1] ?? '')?.[1] ?? ''
    await expect.poll(() => saved().projects[0]?.earlier).toEqual({ [worker]: [OLD_WORKER] })
    const p = saved().projects[0]
    expect(p?.members).toEqual([SESSION, worker, OLD_WORKER])
    expect(p?.parents).toEqual({ [worker]: SESSION })
    expect(p?.orchestration?.roles).toEqual({ [worker]: 'Worker' })
    // Decision 1.114: the ★ is the task's, and the task follows the session to its new id.
    await expect.poll(() => tasksSaved().projects[CLIENT_WORK]?.tasks[0]?.assignee).toBe(worker)
    await expect(page.locator(`.row[data-session="${worker}"]`)).toHaveCount(1)
    await expect(page.locator(`.row[data-session="${OLD_WORKER}"]`)).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

// Decisions 13 and 14: a child waiting at a permission prompt wakes its parent through the socket
// Claude Code publishes for it, with one line in the measured frame.
test('a started session waiting at a permission prompt wakes its parent through its messaging socket', async () => {
  const { launched, page, root } = await open()
  const lines: string[] = []
  const server = createServer((connection) => {
    let data = ''
    connection.on('data', (d) => {
      data += d
    })
    connection.on('end', () => lines.push(...data.split('\n').filter(Boolean)))
  })
  await new Promise<void>((resolve) => server.listen(join(root, 'parent.sock'), resolve))
  try {
    await page.keyboard.type('SPAWN1')
    await said(page, 'TOOL start_session: Started "worker"')
    await page.locator('.tab').nth(1).click()
    await expect(page.locator('.xterm-rows:visible')).toContainText('stand-in claude ready')
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('ASK')
    const frames = () => lines.map((line) => JSON.parse(line))
    await expect
      .poll(() => frames().map((f) => f.message.content), { timeout: 20_000 })
      .toContainEqual(
        expect.stringMatching(
          /^\[Menkar\] worker is waiting at a permission prompt \(\d{2}:\d{2}:\d{2}\)$/,
        ),
      )
    for (const frame of frames()) {
      expect(Object.keys(frame)).toEqual(['type', 'message', 'from', 'msg_id'])
      expect(frame).toMatchObject({ type: 'user', from: 'menkar' })
    }
  } finally {
    server.close()
    await launched.close()
  }
})

// Decisions 1.118 and 1.120: a worker per task, named by Menkar; parked while its task waits, after
// its turn, resumed with its conversation and a prompt, hidden once its task closes.
test('a worker per task: started for task 1 as "client-work-t1"; parked while it waits; resumed with a prompt; hidden when the task closes', async () => {
  const { launched, page, saved, argLines, tasksSaved } = await open({ orchestrated: true })
  try {
    await page.keyboard.type('TASKADD')
    await said(page, 'TOOL task_add: Task 1 added.')
    await page.keyboard.type('WORKT')
    await said(page, 'TOOL start_session: Started "client-work-t1" in a tab after yours for task 1')
    await expect.poll(() => argLines().length).toBe(2)
    const worker = /--session-id (\S+)/.exec(argLines()[1] ?? '')?.[1] ?? ''
    expect(argLines()[1]).toContain(`--session-id ${worker} -n client-work-t1 fix the login`)
    await expect.poll(() => tasksSaved().projects[CLIENT_WORK]?.tasks[0]?.assignee).toBe(worker)
    await expect.poll(() => saved().projects[0]?.parents).toEqual({ [worker]: SESSION })

    // The worker reports, and waits on the PR, ending its turn: the human takes control of its
    // read-only tab to type for it.
    await page.locator('.tab').nth(1).click()
    await expect(page.locator('.xterm-rows:visible')).toContainText('stand-in claude ready')
    await page
      .locator('.tab-body:not(.hidden) .pane-banner button', { hasText: 'Take control' })
      .click()
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('STEPS')
    await said(page, 'TOOL task_steps: Task 1 has 3 steps')
    await page.keyboard.type('WAITS')
    await said(page, 'TOOL task_progress: Task 1 is waiting on the PR review')

    await page.locator('.tab').first().click()
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('PARK')
    await said(page, 'TOOL park_session: "client-work-t1" will be parked once its turn is over')
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect.poll(() => saved().projects[0]?.orchestration?.parked).toEqual([worker])

    await page.keyboard.type('WAKEW')
    await said(page, 'TOOL resume_session: Resumed "client-work-t1"')
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('.tab.selected')).toHaveAttribute(
      'data-tab',
      (await page.locator('.tab').first().getAttribute('data-tab')) ?? '',
    )
    await expect.poll(() => argLines().length).toBe(3)
    expect(argLines()[2]).toContain(`--resume ${worker}`)
    expect(argLines()[2]).toContain('the PR got feedback')
    await expect.poll(() => saved().projects[0]?.orchestration?.parked).toBeUndefined()

    await page.keyboard.type('CLOSE1')
    await said(page, 'TOOL task_close: Task 1 closed as done.')
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect.poll(() => saved().projects[0]?.hidden).toEqual([worker])
    await expect(page.locator(`.row[data-session="${worker}"]`)).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

// Decision 1.144: the orchestrator gives a task the ★ and takes it away with task_star, and the
// Work view and the Board show it; a session that is not the orchestrator is refused.
test('task_star: the orchestrator gives task 1 the ★ and takes it away, the Work view and the Board follow; a worker is refused (screenshot)', async () => {
  const { launched, page, tasksSaved } = await open({ orchestrated: true })
  const starOf = () =>
    (tasksSaved().projects[CLIENT_WORK]?.tasks[0] as { star?: boolean } | undefined)?.star
  const row = page.locator('.task-row[data-task="1"]')
  const card = page.locator('#board-panel .task-card[data-task="1"]')
  try {
    await page.keyboard.type('TASKADD')
    await said(page, 'TOOL task_add: Task 1 added.')
    await page.locator('#view-switch .view-work').click()
    await expect(row).toBeVisible()
    await expect(row.locator('.priority-star')).toHaveCount(0)

    await page.locator('.xterm:visible').click()
    await page.keyboard.type('STAR1')
    await said(page, 'TOOL task_star: Task 1 has the ★.')
    await expect.poll(starOf).toBe(true)
    await expect(row.locator('.priority-star')).toHaveCount(1)
    await page.locator('#board-button').click()
    await expect(card.locator('.priority-star')).toHaveCount(1)
    const files = process.env.MENKAR_FILES
    if (files) await page.screenshot({ path: join(files, 'menkar-t14-task-star-set.png') })

    await page.locator('.xterm:visible').click()
    await page.keyboard.type('DROPSTAR')
    await said(page, 'TOOL task_star: Task 1 no longer has the ★.')
    await expect.poll(starOf).toBe(false)
    await expect(card.locator('.priority-star')).toHaveCount(0)
    await expect(row.locator('.priority-star')).toHaveCount(0)
    if (files) await page.screenshot({ path: join(files, 'menkar-t14-task-star-removed.png') })

    // The worker started for task 1 is not the orchestrator.
    await page.keyboard.type('WORKT')
    await said(page, 'TOOL start_session: Started "client-work-t1"')
    await page.locator('.tab').nth(1).click()
    await expect(page.locator('.xterm-rows:visible')).toContainText('stand-in claude ready')
    await page
      .locator('.tab-body:not(.hidden) .pane-banner button', { hasText: 'Take control' })
      .click()
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('STAR1')
    await said(page, "TOOL task_star: Only the orchestrator sets a task's ★, when the person asks.")
    expect(starOf()).toBe(false)
  } finally {
    await launched.close()
  }
})

// ---------------------------------------------------------------- plan 40: the team block

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

// What reaches the orchestrator's socket (the test's, as its registry entry names it).
async function orchestratorPosts(root: string): Promise<{ posted: () => string[]; close(): void }> {
  const lines: string[] = []
  const server = createServer((connection) => {
    let data = ''
    connection.on('data', (d) => {
      data += d
    })
    connection.on('end', () => lines.push(...data.split('\n').filter(Boolean)))
  })
  await new Promise<void>((resolve) => server.listen(join(root, 'parent.sock'), resolve))
  return {
    posted: () => lines.map((line) => JSON.parse(line).message.content as string),
    close: () => server.close(),
  }
}

const teamDir = (root: string) => join(root, 'cache', 'menkar', 'control', 'team')
// Longer than a settle (2 s) and a wake's batch (3 s): what has not come by then does not come.
const QUIET_MS = 6000
const FLAG = /--append-system-prompt-file (\S+)$/

test('the team block, mode off: neither flag on the command line, no team file', async () => {
  const { launched, argLines, root } = await open()
  try {
    expect(argLines()[0]).toContain(`--resume ${SESSION}`)
    expect(argLines()[0]).not.toContain('--append-system-prompt-file')
    expect(argLines()[0]).not.toContain('--system-prompt-snapshot')
    expect(existsSync(teamDir(root)) ? readdirSync(teamDir(root)) : []).toEqual([])
  } finally {
    await launched.close()
  }
})

test('the team block, mode on: a resume rebuilds it and gets no post; the human’s new session and a fork carry it; the fork, once it joins, gets the whole block once', async () => {
  const { launched, page, argLines, root, teamFiles, posts } = await open({
    orchestrated: true,
    env: { FAKE_CLAUDE_START_HOOK: '1', FAKE_CLAUDE_SOCKET: '1' },
  })
  const orchestrator = await orchestratorPosts(root)
  try {
    // The restored tab: the snapshot flag before the file, both last.
    expect(argLines()[0]).toMatch(
      new RegExp(
        `^--resume ${SESSION} .* --system-prompt-snapshot off --append-system-prompt-file \\S+$`,
      ),
    )
    const own = teamFiles().find((f) => f.id === SESSION)
    expect(own?.file).toBe(FLAG.exec(argLines()[0] ?? '')?.[1])
    expect(own?.text).toContain(
      'You are `api`, a session of the Menkar project "Client work", in orchestration mode. You are its orchestrator.',
    )
    expect(own?.text).toContain(
      'Skills to have loaded (load any that is not): `menkar:orchestrator`.',
    )
    expect(own?.text).toContain('## How the team works')
    expect(own?.text).toContain('`SendMessage`')
    // N1: the record its own --resume start wrote names its session: nothing is posted.
    await page.waitForTimeout(QUIET_MS)
    expect(orchestrator.posted().filter((p) => p.includes('Team update'))).toEqual([])

    await act(page, {
      type: 'startNew',
      agent: 'claude',
      folder: join(root, 'home', 'work'),
      name: 'scratch',
    })
    await expect.poll(() => argLines().length).toBe(2)
    const scratch = /--session-id (\S+) -n scratch/.exec(argLines()[1] ?? '')?.[1] ?? ''
    expect(argLines()[1]).toMatch(FLAG)
    expect(argLines()[1]).not.toContain('--system-prompt-snapshot')
    expect(teamFiles().find((f) => f.id === scratch)?.text).toContain(
      'You are `scratch`, a session of the Menkar project "Client work", in orchestration mode. You have no parent; the orchestrator is `api`.',
    )

    await act(page, { type: 'forkSession', session: SESSION })
    await expect.poll(() => argLines().length).toBe(3)
    const fork = /--fork-session --session-id (\S+)/.exec(argLines()[2] ?? '')?.[1] ?? ''
    expect(argLines()[2]).toMatch(FLAG)
    expect(argLines()[2]).not.toContain('--system-prompt-snapshot')
    await expect
      .poll(() => posts(fork), { timeout: 20_000 })
      .toEqual([
        expect.stringMatching(
          /^\[Menkar\] Team update: your team instructions, replacing any earlier ones:\n# Your team in Menkar\nYou are a new session of the Menkar project "Client work", in orchestration mode\. You have no parent; the orchestrator is `api`\.\n[\s\S]*No reply is needed\. \(\d{2}:\d{2}:\d{2}\)$/,
        ),
      ])
    // The human's session joined with the facts it started with: nothing to tell it.
    await page.waitForTimeout(QUIET_MS)
    expect(posts(scratch)).toEqual([])
    expect(posts(fork)).toHaveLength(1)
  } finally {
    orchestrator.close()
    await launched.close()
  }
})

test('the team block: a role change is one post, saving it unchanged none, a compaction posts the facts again; a turn that only answered it wakes no parent, a typed one does', async () => {
  const { launched, page, argLines, root, posts } = await open({
    orchestrated: true,
    env: { FAKE_CLAUDE_TEAM_TURN: '1', FAKE_CLAUDE_SOCKET: '1' },
  })
  const orchestrator = await orchestratorPosts(root)
  const finished = () => orchestrator.posted().filter((p) => p.includes('worker finished its turn'))
  const ROLE =
    /^\[Menkar\] Team update: your facts are now:\nYou are `worker`, a session of the Menkar project "Client work", in orchestration mode\. Your role: "Reviewer"\. Your parent is `api`, the orchestrator\.\n/
  try {
    await page.keyboard.type('SPAWN1')
    await said(page, 'TOOL start_session: Started "worker"')
    await expect.poll(() => argLines().length).toBe(2)
    const worker = /--session-id (\S+) -n worker/.exec(argLines()[1] ?? '')?.[1] ?? ''
    await act(page, { type: 'setRole', session: worker, label: 'Reviewer' })
    await expect
      .poll(() => posts(worker), { timeout: 15_000 })
      .toEqual([expect.stringMatching(ROLE)])
    // The stand-in answers it in a turn of its own, which tells the orchestrator nothing.
    await page.waitForTimeout(QUIET_MS)
    expect(finished()).toEqual([])

    await act(page, { type: 'setRole', session: worker, label: 'Reviewer' })
    await page.waitForTimeout(QUIET_MS)
    expect(posts(worker)).toHaveLength(1)

    await page.locator('.tab').nth(1).click()
    await expect(page.locator('.xterm-rows:visible')).toContainText('stand-in idle')
    await page
      .locator('.tab-body:not(.hidden) .pane-banner button', { hasText: 'Take control' })
      .click()
    await page.locator('.xterm:visible').click()
    // Back to the start text, which had no role: the facts again.
    await page.keyboard.type('COMPACT')
    await expect
      .poll(() => posts(worker), { timeout: 15_000 })
      .toEqual([expect.stringMatching(ROLE), expect.stringMatching(ROLE)])
    await page.waitForTimeout(QUIET_MS)
    expect(finished()).toEqual([])

    await page.keyboard.type('TURN')
    await expect.poll(finished, { timeout: 15_000 }).toHaveLength(1)
  } finally {
    orchestrator.close()
    await launched.close()
  }
})

test('the team block, Claude Code older than 2.1.267: no flags, one toast, no post on a role change', async () => {
  const { launched, page, argLines, posts } = await open({
    orchestrated: true,
    env: { FAKE_CLAUDE_VERSION: '2.1.266', FAKE_CLAUDE_SOCKET: '1' },
  })
  const toast = page.locator('.toast', {
    hasText:
      'Claude Code 2.1.266 is older than 2.1.267: sessions start without their team instructions. Update Claude Code.',
  })
  try {
    expect(argLines()[0]).not.toContain('--append-system-prompt-file')
    expect(argLines()[0]).not.toContain('--system-prompt-snapshot')
    await expect(toast).toHaveCount(1)
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('SPAWN1')
    await said(page, 'TOOL start_session: Started "worker"')
    await expect.poll(() => argLines().length).toBe(2)
    expect(argLines()[1]).not.toContain('--append-system-prompt-file')
    const worker = /--session-id (\S+) -n worker/.exec(argLines()[1] ?? '')?.[1] ?? ''
    await act(page, { type: 'setRole', session: worker, label: 'Reviewer' })
    await page.waitForTimeout(QUIET_MS)
    expect(posts(worker)).toEqual([])
    await expect(toast).toHaveCount(1)
    const files = process.env.MENKAR_FILES
    if (files) await page.screenshot({ path: join(files, 'menkar-t33-old-claude-toast.png') })
  } finally {
    await launched.close()
  }
})
