// send_message (plan 39 P1b.3, decisions D2 and D3): a Claude session and a Codex session of one
// project message each other by name through Menkar, each through the receiver's own channel —
// `codex queue` for Codex, the messaging socket for Claude — with Menkar's frame naming the sender,
// its agent and the tool to answer with. A Claude→Claude call is refused, naming SendMessage, and
// a Codex session that has no thread yet (before its first message) cannot be sent one.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare } from './fixtures'
import { codexStandIn } from './standins/codex'

const CLAUDE = 'fix the login bug'
const TIME = String.raw`\(\d\d:\d\d:\d\d\)`

async function launch() {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      const env = prepare(dirs)
      codexStandIn(join(dirs.root, 'bin'))
      mkdirSync(join(dirs.home, '.codex'), { recursive: true })
      return { ...env, FAKE_CLAUDE_SOCKET: '1', FAKE_CODEX_TURN_MS: '300' }
    },
  })
  const read = (name: string) => {
    const file = join(home, name)
    return existsSync(file) ? readFileSync(file, 'utf8') : ''
  }
  return { launched, page: launched.window, home, read }
}

// A tool of Menkar's called as the Claude session calls it: through the server its --mcp-config
// names, in the stand-in claude's own environment.
// The first session's environment is kept at the first call: every stand-in that starts writes its
// own over the file, and a session the call starts would otherwise become the next call's caller.
const firstEnv = new Map<string, Record<string, string>>()
function callAsClaude(home: string, tool: string, args: Record<string, unknown>): Promise<string> {
  const line = readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n')[0] ?? ''
  const config = /--mcp-config (\{.*?\}\}\}\})/.exec(line)?.[1] ?? '{}'
  const server = JSON.parse(config).mcpServers.menkar
  const env = firstEnv.get(home) ?? JSON.parse(readFileSync(join(home, 'claude-env.json'), 'utf8'))
  firstEnv.set(home, env)
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

const claudePosts = (read: (name: string) => string): string[] =>
  read('claude-posts.jsonl')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l).content)

test('a Claude session and a Codex worker message each other by name, each through its own channel, with the frame naming the sender and the tool to answer with', async () => {
  const app = await launch()
  try {
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    expect(await callAsClaude(app.home, 'start_session', { name: 'cx', agent: 'codex' })).toContain(
      'Started "cx"',
    )

    // No thread before its first message: nothing to queue to, and nothing is queued.
    expect(await callAsClaude(app.home, 'send_message', { name: 'cx', text: 'early' })).toBe(
      'cx cannot take a message now: its conversation has not started yet, or it is not running. The message was not sent.',
    )

    await app.page.locator('.tab', { hasText: 'cx' }).click()
    await typeIn(app.page, 'build the thing')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: build the thing')
    await expect
      .poll(() =>
        callAsClaude(app.home, 'send_message', { name: 'cx', text: 'look at a.txt\nthen report' }),
      )
      .toBe(
        'Sent to cx. It reaches it as a message from Menkar naming you; its answer comes back the same way.',
      )

    // Claude → Codex: the queued text is the session's next turn, byte for byte.
    await expect
      .poll(() => codexUserMessages(app.home))
      .toEqual([
        'build the thing',
        expect.stringMatching(
          new RegExp(
            `^\\[Menkar\\] from ${CLAUDE} \\(Claude Code\\); reply with send_message: look at a\\.txt\\nthen report ${TIME}$`,
          ),
        ),
      ])
    expect(codexUserMessages(app.home).join('')).not.toContain('early')

    // Codex → Claude: through Claude Code's messaging socket, the frame naming Codex.
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Done: [Menkar] from')
    await typeIn(
      app.page,
      `/menkar send_message ${JSON.stringify({ name: CLAUDE, text: 'done, see a.txt' })}`,
    )
    await expect(app.page.locator('.xterm-rows:visible')).toContainText(
      `TOOL send_message: Sent to ${CLAUDE}.`,
    )
    await expect
      .poll(() => claudePosts(app.read))
      .toEqual([
        expect.stringMatching(
          new RegExp(
            `^\\[Menkar\\] from cx \\(Codex\\); reply with send_message: done, see a\\.txt ${TIME}$`,
          ),
        ),
      ])
  } finally {
    await app.launched.close()
  }
})

test('a Claude session sending to another Claude session is refused and told to use SendMessage; nothing is posted', async () => {
  const app = await launch()
  try {
    await app.page.locator('.row').first().dblclick()
    await expect(app.page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    expect(await callAsClaude(app.home, 'start_session', { name: 'cl' })).toContain('Started "cl"')
    await expect(app.page.locator('.tab', { hasText: 'cl' })).toBeVisible()
    // cl's stand-in is up, its environment written over the first session's.
    await expect.poll(() => app.read('claude-args.txt').trim().split('\n').length).toBe(2)
    expect(await callAsClaude(app.home, 'send_message', { name: 'cl', text: 'hi' })).toBe(
      "Your own messaging reaches cl: use SendMessage. Menkar's send_message is for the sessions it cannot reach.",
    )
    expect(await callAsClaude(app.home, 'send_message', { name: 'nobody', text: 'hi' })).toBe(
      'No session of your project is called "nobody".',
    )
    expect(claudePosts(app.read)).toEqual([])
  } finally {
    await app.launched.close()
  }
})
