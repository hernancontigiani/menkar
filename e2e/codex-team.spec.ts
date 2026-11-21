// Plan 39 P1b.5, with the stand-in `codex`: a Codex worker in a project in the orchestration mode
// is given its team block by `-c developer_instructions`, the user's own after it; a change of its
// facts reaches it through `codex queue`; what it holds is recorded, so a resume is told only what
// changed while it was stopped; a compaction rebuilds the block it started with, so what it was told
// since is told again.
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'
import { codexStandIn } from './standins/codex'

const PROJECT = 'aaaaaaaaaaaa'
const USER_OWN = 'USER-OWN: answer in English.'
const QUIET_MS = 4000

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

async function launch() {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      codexStandIn(join(dirs.root, 'bin'))
      mkdirSync(join(dirs.home, '.codex'), { recursive: true })
      writeFileSync(
        join(dirs.home, '.codex', 'config.toml'),
        `developer_instructions = ${JSON.stringify(USER_OWN)}\n`,
      )
      writeFileSync(
        join(dirs.root, 'config', 'menkar', 'projects.json'),
        JSON.stringify({
          version: 1,
          current: PROJECT,
          projects: [
            {
              id: PROJECT,
              name: 'Client work',
              members: [SESSION],
              groups: [],
              orchestration: { on: true, orchestrator: SESSION },
            },
          ],
          windows: [],
        }),
      )
      return { ...env, MENKAR_LOG: 'info', FAKE_CODEX_TURN_MS: '300' }
    },
  })
  const page = launched.window
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  const starts = (): { resume: boolean; instructions: string | null }[] =>
    read('codex-developer.jsonl')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  const thread = () => read('codex-threads.txt').trim().split('\n')[0] ?? ''
  // What the worker was given as turns: its rollout's user messages, in order.
  const messages = (): string[] => {
    const id = thread()
    if (!id) return []
    const day = (dir: string): string | null => {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const at = join(dir, item.name)
        if (item.isDirectory()) {
          const found = day(at)
          if (found) return found
        } else if (item.name.endsWith(`-${id}.jsonl`)) return at
      }
      return null
    }
    const file = day(join(home, '.codex', 'sessions'))
    if (!file) return []
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .filter((l) => l.payload?.item?.type === 'UserMessage')
      .map((l) => l.payload.item.content[0].text)
  }
  const updates = () => messages().filter((m) => m.includes('Team update'))
  const recorded = () => {
    const file = join(root, 'cache', 'menkar', 'control', 'team-held', `${thread()}.json`)
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined
  }
  // The stand-in TUIs of this run still alive.
  const running = () =>
    execSync('ps -eo args')
      .toString()
      .split('\n')
      .filter((line) => line.includes(`${root}/bin/codex`) && !/ (queue|app-server) /.test(line))
      .length
  return { launched, page, root, home, running, starts, thread, messages, updates, recorded }
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

const ROLE = (role: string) =>
  new RegExp(
    `^\\[Menkar\\] Team update: your facts are now:\\nYou are \`cx\`, a session of the Menkar project "Client work", in orchestration mode\\. Your role: "${role}"\\. Your parent is \`5c1e7a2b\`, the orchestrator\\.\\n`,
  )

test('a Codex worker gets its block with the user’s own after it; a resume is told once what changed while it was stopped, a running worker once per change, through codex queue; a compaction tells it again', async () => {
  const app = await launch()
  try {
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    expect(
      await callAsClaude(app.home, 'start_session', {
        name: 'cx',
        agent: 'codex',
        prompt: 'build the thing',
      }),
    ).toContain('Started "cx"')

    // Started with the block, then a blank line, then the user's own instructions.
    await expect.poll(() => app.starts().length).toBe(1)
    const first = app.starts()[0]?.instructions ?? ''
    expect(first).toMatch(
      /^# Your team in Menkar\nYou are `cx`, a session of the Menkar project "Client work", in orchestration mode\. Your parent is `5c1e7a2b`, the orchestrator\.\n/,
    )
    expect(first).toMatch(/\/skills\/worker\/SKILL\.md`\) first, by reading its SKILL\.md/)
    expect(first).toContain('`send_message` tool')
    expect(first.endsWith(`\n\n${USER_OWN}`)).toBe(true)
    await expect.poll(() => app.thread()).not.toBe('')
    const thread = app.thread()
    await expect.poll(() => app.recorded()?.facts).toMatch(/^# Your team in Menkar\nYou are `cx`/)

    // Stopped, its role set meanwhile, resumed: the resume passes the block again, which the
    // thread does not see until a compaction, so it is told the change once, through codex queue.
    await act(app.page, { type: 'stopSession', session: thread })
    await expect.poll(() => app.running(), { timeout: 15_000 }).toBe(0)
    await act(app.page, { type: 'setRole', session: thread, label: 'Reviewer' })
    await act(app.page, { type: 'openSession', session: thread })
    await expect.poll(() => app.starts().length, { timeout: 15_000 }).toBe(2)
    expect(app.starts()[1]?.resume).toBe(true)
    expect(app.starts()[1]?.instructions).toContain('Your role: "Reviewer"')
    expect(app.starts()[1]?.instructions?.endsWith(`\n\n${USER_OWN}`)).toBe(true)
    await expect
      .poll(() => app.updates(), { timeout: 20_000 })
      .toEqual([expect.stringMatching(ROLE('Reviewer'))])
    await expect.poll(() => app.recorded()?.facts).toContain('Your role: "Reviewer"')
    await app.page.waitForTimeout(QUIET_MS)
    expect(app.updates()).toHaveLength(1)

    // A change while it runs: one post.
    await act(app.page, { type: 'setRole', session: thread, label: 'Tester' })
    await expect
      .poll(() => app.updates(), { timeout: 20_000 })
      .toEqual([expect.stringMatching(ROLE('Reviewer')), expect.stringMatching(ROLE('Tester'))])
    await expect.poll(() => app.recorded()?.facts).toContain('Your role: "Tester"')

    // A compaction rebuilds the block this run started with, which says Reviewer: told again.
    await app.page.locator('.tab', { hasText: 'cx' }).click()
    await app.page
      .locator('.tab-body:not(.hidden) .pane-banner button', { hasText: 'Take control' })
      .click()
    await app.page.locator('.xterm:visible').click()
    await app.page.keyboard.type('/compact')
    await app.page.keyboard.press('Enter')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Context compacted')
    await expect
      .poll(() => app.updates(), { timeout: 20_000 })
      .toEqual([
        expect.stringMatching(ROLE('Reviewer')),
        expect.stringMatching(ROLE('Tester')),
        expect.stringMatching(ROLE('Tester')),
      ])
    await app.page.waitForTimeout(QUIET_MS)
    expect(app.updates()).toHaveLength(3)
  } finally {
    await app.launched.close()
  }
})
