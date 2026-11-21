// A Codex worker started by a Claude session's start_session (plan 39 P1b.2), with the stand-in
// `codex`: Codex has no id until its first message, so the worker is placed at once under a
// provisional id, as member and child, and its real thread id takes that place when it binds.
// Menkar's MCP server reaches it through `-c mcp_servers.menkar.*`, started with Codex's own
// environment rule, and finds Menkar under the run's XDG directories. A provisional id Menkar
// stopped with is dropped on the next start, with its parent and its task's assignee.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'
import { codexStandIn } from './standins/codex'

const PROJECT = 'aaaaaaaaaaaa'
const PROVISIONAL = 'pending:4e1f9c2a-0b3d-4c5e-8f6a-7b8c9d0e1f2a'

interface Saved {
  projects: { members: string[]; parents?: Record<string, string> }[]
  windows: { tabs: Record<string, { panes: string[] }[]> }[]
}

async function launch(options: { readonly unbound?: boolean } = {}) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      codexStandIn(join(dirs.root, 'bin'))
      mkdirSync(join(dirs.home, '.codex'), { recursive: true })
      if (options.unbound) unboundWorker(dirs.root)
      return { ...env, MENKAR_LOG: 'info', FAKE_CODEX_TURN_MS: '500' }
    },
  })
  const page = launched.window
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  const saved = (): Saved =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
  const log = () => {
    const file = join(root, 'cache', 'menkar', 'menkar.log')
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  return { launched, page, root, home, read, saved, log }
}

// What Menkar saved when it stopped before its Codex worker's first message: the worker a member
// and child under its provisional id, in a saved tab, assigned a task.
function unboundWorker(root: string): void {
  const config = join(root, 'config', 'menkar')
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: PROJECT,
      projects: [
        {
          id: PROJECT,
          name: 'Client work',
          members: [SESSION, PROVISIONAL],
          groups: [],
          parents: { [PROVISIONAL]: SESSION },
        },
      ],
      windows: [
        {
          current: PROJECT,
          tabs: { [PROJECT]: [{ panes: [PROVISIONAL], orientation: 'horizontal' }] },
        },
      ],
    }),
  )
  writeFileSync(
    join(config, 'tasks.json'),
    JSON.stringify({
      version: 1,
      projects: {
        [PROJECT]: {
          next: 2,
          tasks: [
            {
              number: 1,
              title: 'Fix the login',
              assignee: PROVISIONAL,
              star: false,
              state: 'queued',
              steps: [],
              step: 0,
              note: '',
              created: '2026-11-20T10:00:00.000-03:00',
              updated: '2026-11-20T10:00:00.000-03:00',
            },
          ],
        },
      },
    }),
  )
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

async function typeIn(page: Page, text: string) {
  await page.locator('.xterm:visible').click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

test('a Codex worker started by a Claude session is member and child by a provisional id until it binds, then by its thread’s; its Menkar tools work under the run’s XDG directories', async () => {
  const app = await launch()
  try {
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    const answer = await callAsClaude(app.home, 'start_session', { name: 'cx', agent: 'codex' })
    expect(answer).toContain('Started "cx"')
    await expect.poll(() => app.read('codex-args.txt')).not.toBe('')

    // Placed at once, under a provisional id: no thread exists before its first message.
    const before = app.saved().projects[0]
    const provisional = before?.members.find((id) => id.startsWith('pending:')) ?? ''
    expect(provisional).not.toBe('')
    expect(before?.members).toEqual([SESSION, provisional])
    expect(before?.parents).toEqual({ [provisional]: SESSION })
    // Started with Menkar's server mounted for it, and nothing of Claude's.
    const started = app.read('codex-args.txt').trim()
    expect(started).toContain('mcp_servers.menkar.default_tools_approval_mode="approve"')
    expect(started).not.toContain('--mcp-config')

    // Its first message makes its thread; the tab binds and the real id takes the place.
    await app.page.locator('.tab', { hasText: 'cx' }).click()
    await typeIn(app.page, 'build the thing')
    await expect.poll(() => app.read('codex-threads.txt').trim()).not.toBe('')
    const thread = app.read('codex-threads.txt').trim()
    await expect.poll(() => app.saved().projects[0]?.members).toEqual([SESSION, thread])
    expect(app.saved().projects[0]?.parents).toEqual({ [thread]: SESSION })
    expect(JSON.stringify(app.saved())).not.toContain('pending:')
    expect(app.log()).toContain('a started session bound its id')

    // Its own Menkar tools: the server Codex starts finds Menkar's files under the run's cache.
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: build the thing')
    await typeIn(app.page, '/menkar list_sessions')
    const screen = app.page.locator('.xterm-rows:visible')
    await expect(screen).toContainText('TOOL list_sessions: { "project": "Client work"')
    await expect(screen).toContainText(`"name": "cx", "id": "${thread}", "state": "`)
    await expect(screen).toContainText('"parent": "fix the login bug"')
    const env = JSON.parse(app.read('codex-mcp-env.json'))
    expect(env.XDG_CACHE_HOME).toBe(join(app.root, 'cache'))
    expect(env.MENKAR_AGENT).toBe('codex')
    expect(env.MENKAR_PANE).toMatch(/\S/)
    expect(env.MENKAR_FILES).toBeUndefined()
  } finally {
    await app.launched.close()
  }
})

test('start_session refuses an agent Menkar does not know, and one not installed', async () => {
  const app = await launch()
  try {
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    expect(await callAsClaude(app.home, 'start_session', { name: 'g', agent: 'gemini' })).toBe(
      'Menkar knows no agent called "gemini".',
    )
    expect(await callAsClaude(app.home, 'start_session', { name: 'c', agent: 'cursor' })).toBe(
      'The agent "cursor" is not installed on this machine.',
    )
    expect(app.saved().projects[0]?.members).toEqual([SESSION])
  } finally {
    await app.launched.close()
  }
})

test('a worker Menkar stopped with before it bound is dropped on the next start: its tab, parent and task assignee, with a log line', async () => {
  const app = await launch({ unbound: true })
  try {
    await expect(app.page.locator('.row')).toHaveCount(1)
    await expect.poll(() => app.log()).toContain('sessions that had not bound their id')
    await expect(app.page.locator('.tab')).toHaveCount(0)
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    await expect.poll(() => JSON.stringify(app.saved())).not.toContain('pending:')
    expect(app.saved().projects[0]?.members).toEqual([SESSION])
    expect(app.saved().projects[0]?.parents).toBeUndefined()
    const tasks = JSON.parse(readFileSync(join(app.root, 'config', 'menkar', 'tasks.json'), 'utf8'))
    expect(tasks.projects[PROJECT].tasks[0].assignee).toBeUndefined()
    expect(tasks.projects[PROJECT].tasks[0].state).toBe('queued')
  } finally {
    await app.launched.close()
  }
})
