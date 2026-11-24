// Plan 39 P3.2 (set, 2026-11-23, option b): Menkar starts a new Cursor session under an id of its
// own with Cursor's hidden `--new-session-id`. A Cursor build that drops the option stops at once
// with commander's error: the pane says so in one line of Menkar's own, nothing is typed into it,
// and the next new session lets Cursor pick its id.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, terminalText } from './app'
import { cursorStandIn, prepare } from './fixtures'

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
