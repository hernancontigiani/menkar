// Plan 31: Menkar's MCP tools, called by the stand-in claude through the real built server, as
// Claude Code calls them. renew (1.70) ends the session once its turn is over and starts a fresh
// one in the same tab, the old one its earlier conversation; start_session opens a session after
// the caller's tab without taking the focus; list_sessions and last_reply address sessions by name.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    orchestration?: { roles?: Record<string, string>; priority?: string[] }
  }[]
}

// A stopped session called "worker", with a role and the ★, in the orchestration mode with "api"
// its orchestrator (decision 1.92).
const OLD_WORKER = '0b1d0b1d-0000-4000-8000-000000000001'

async function open(options: { stoppedWorker?: boolean } = {}) {
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
                      priority: [OLD_WORKER],
                    },
                  }
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
      const state = join(dirs.root, 'config', 'menkar', 'state.json')
      writeFileSync(
        state,
        JSON.stringify({ ...JSON.parse(readFileSync(state, 'utf8')), remote_control: [SESSION] }),
      )
      return env
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
  return { launched, page, saved, argLines, remote, root }
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

    await page.keyboard.type('LISTS')
    await said(page, '"name": "worker"')
    await said(page, '"parent": "api"')
    await page.keyboard.type('REPLY')
    await said(page, 'TOOL last_reply: "worker" has not replied yet.')
  } finally {
    await launched.close()
  }
})

test('decision 1.92: start_session with the name of a stopped session takes it over, as after a renew: one "worker" row with its role and ★, the caller its parent, the old one its earlier conversation', async () => {
  const { launched, page, saved, argLines } = await open({ stoppedWorker: true })
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
    expect(p?.orchestration?.priority).toEqual([worker])
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
