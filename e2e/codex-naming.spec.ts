// Decision 1.195, with the stand-in `codex`: Menkar names the Codex sessions start_session starts,
// through `codex app-server --disable plugins`, as soon as their rollout appears, over the title
// Codex generated for the first message; a /rename by the human afterwards is never overwritten;
// a renew names the new thread too. A Codex session opened from New keeps Codex's own title.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare } from './fixtures'
import { codexStandIn } from './standins/codex'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

async function launch(turnMs = 500) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      codexStandIn(join(dirs.root, 'bin'))
      mkdirSync(join(dirs.home, '.codex'), { recursive: true })
      return {
        ...env,
        MENKAR_LOG: 'info',
        FAKE_CODEX_TURN_MS: String(turnMs),
        FAKE_CODEX_TITLE: 'Generated title',
      }
    },
  })
  const page = launched.window
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  const threads = () => read('codex-threads.txt').trim().split('\n').filter(Boolean)
  // Codex's name for the thread: the last line of its index wins.
  const nameOf = (thread: string) =>
    read('.codex/session_index.jsonl')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.id === thread)
      .at(-1)?.thread_name
  const serverRuns = () =>
    read('codex-args.txt')
      .split('\n')
      .filter((line) => line.startsWith('app-server'))
  const starts = () =>
    read('codex-args.txt')
      .split('\n')
      .filter((line) => line && !/^(app-server|queue|--version)/.test(line))
  const agentNamed = (): string[] => {
    const file = join(root, 'config', 'menkar', 'state.json')
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')).agent_named ?? []) : []
  }
  return { launched, page, home, read, threads, nameOf, serverRuns, starts, agentNamed }
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

async function startWorker(app: Awaited<ReturnType<typeof launch>>) {
  await app.page.locator('.row').first().dblclick()
  await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
  const answer = await callAsClaude(app.home, 'start_session', { name: 'cx', agent: 'codex' })
  expect(answer).toContain('Started "cx"')
  await app.page.locator('.tab', { hasText: 'cx' }).click()
  await expect(app.page.locator('.xterm-rows:visible')).toContainText('Ask Codex to do anything')
}

test('a worker is named at once over Codex’s generated title; the human’s /rename afterwards stays', async () => {
  const app = await launch(6000)
  try {
    await startWorker(app)
    await typeIn(app.page, 'build the thing')
    await expect.poll(app.threads).toHaveLength(1)
    const [thread = ''] = app.threads()
    // Codex saved its title at the first message; Menkar's name overwrote it, before the turn ended.
    await expect.poll(() => app.nameOf(thread), { timeout: 4000 }).toBe('cx')
    await expect(app.page.locator('.xterm-rows:visible')).not.toContainText('Done: build the thing')
    expect(app.read('.codex/session_index.jsonl')).toContain('Generated title')
    expect(app.serverRuns()[0]).toBe('app-server --disable plugins')
    expect(existsSync(join(app.home, '.codex', '.tmp'))).toBe(false)
    await expect.poll(app.agentNamed).toEqual([thread])

    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: build the thing', {
      timeout: 10_000,
    })
    await typeIn(app.page, '/rename Mine')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Thread renamed')
    await typeIn(app.page, 'and the tests')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: and the tests', {
      timeout: 10_000,
    })
    // Two turns ended after the rename: the name is still the human's.
    await app.page.waitForTimeout(2000)
    expect(app.nameOf(thread)).toBe('Mine')
  } finally {
    await app.launched.close()
  }
})

test('a renewed worker’s new thread is named the same', async () => {
  const app = await launch()
  try {
    await startWorker(app)
    await typeIn(app.page, 'first')
    await expect.poll(app.threads).toHaveLength(1)
    const [first = ''] = app.threads()
    await expect.poll(() => app.nameOf(first)).toBe('cx')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: first')

    await typeIn(app.page, '/menkar renew')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('TOOL renew:')
    await typeIn(app.page, 'end this turn')
    // Renewed once the turn ends: a new Codex starts in the same tab, its thread made at its first
    // message.
    await expect.poll(app.starts, { timeout: 20_000 }).toHaveLength(2)
    await expect(app.page.locator('.xterm-rows:visible')).not.toContainText('Done: end this turn')
    await typeIn(app.page, 'fresh start')
    await expect.poll(app.threads, { timeout: 20_000 }).toHaveLength(2)
    const second = app.threads()[1] ?? ''
    await expect.poll(() => app.nameOf(second)).toBe('cx')
    await expect.poll(app.agentNamed).toEqual([first, second].sort())
  } finally {
    await app.launched.close()
  }
})

test('a Codex session opened from New keeps Codex’s own title: Menkar never names it', async () => {
  const app = await launch()
  try {
    await act(app.page, {
      type: 'startNew',
      agent: 'codex',
      folder: join(app.home, 'work'),
      name: '',
    })
    await expect(app.page.locator('.xterm-rows')).toContainText('Ask Codex to do anything')
    await typeIn(app.page, 'add the routes')
    await expect.poll(app.threads).toHaveLength(1)
    const [thread = ''] = app.threads()
    await expect(app.page.locator('.xterm-rows')).toContainText('Done: add the routes')
    await app.page.waitForTimeout(2000)
    expect(app.nameOf(thread)).toBe('Generated title')
    expect(app.serverRuns()).toEqual([])
    expect(app.agentNamed()).toEqual([])
  } finally {
    await app.launched.close()
  }
})
