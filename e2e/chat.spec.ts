import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'

// Chat tabs, MCP servers and Ghostty on the real app (docs/spec/chat.md), with the stand-ins of
// tests/data/chat first on the PATH: the real `claude`, `cursor-agent` and `ghostty` never run.

const STANDINS = resolve('tests/data/chat')

type Act = (action: unknown) => Promise<unknown>
const act = (page: Page, action: unknown) =>
  page.evaluate(
    (a) => (window as unknown as { menkar: { window: { act: Act } } }).menkar.window.act(a),
    action,
  )

// A Cursor session in the list, for the Cursor chats: its transcript under ~/.cursor, in `folder`.
const CURSOR_CHAT = 'c0ffee02'
function withCursorSession(dirs: { root: string; home: string }): void {
  const folder = dirs.root.slice(1).replace(/[^A-Za-z0-9]/g, '-')
  const transcripts = join(
    dirs.home,
    '.cursor',
    'projects',
    folder,
    'agent-transcripts',
    CURSOR_CHAT,
  )
  mkdirSync(transcripts, { recursive: true })
  writeFileSync(
    join(transcripts, `${CURSOR_CHAT}.jsonl`),
    `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: '<user_query>hello</user_query>' }] } })}\n`,
  )
}

function withStandins(log: string) {
  return (dirs: { root: string; home: string }) => {
    const prepared = prepare(dirs) ?? {}
    return {
      ...prepared,
      PATH: `${STANDINS}:${prepared.PATH ?? process.env.PATH ?? ''}`,
      FAKE_CHAT_LOG: log,
    }
  }
}

const records = (log: string, file: string) =>
  existsSync(join(log, file))
    ? readFileSync(join(log, file), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : []

test('CHT-6, CHT-13, CHT-15, CHT-16, CHT-32, CHT-35 a Claude chat: tab, message, permission card', async () => {
  const log = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'menkar-chat-e2e-'))
  const launched = await launchApp({
    prepare: (dirs) => {
      return withStandins(log)(dirs)
    },
  })
  const page = launched.window
  try {
    await act(page, { type: 'continueInChat', session: SESSION, key: 'default' })
    const chat = page.locator('.chat')
    await expect(chat.locator('.banner')).toHaveText(
      'Chat with Claude Code — every file edit and command asks your permission first.',
    )
    await expect.poll(() => records(log, 'claude.json').length).toBe(1)

    const entry = chat.locator('[data-key="chat-entry"]')
    await expect(entry).toBeFocused()
    await entry.fill('  run the tests  ')
    await entry.press('Enter')
    await expect(chat.locator('.bubble.user')).toHaveText('run the tests')
    await expect(chat.locator('.card.permission .card-title')).toHaveText(
      'Claude Code wants to use Bash',
    )
    await expect(chat.locator('.card.permission .card-body')).toHaveText('npm test')
    await expect(chat.locator('.card.permission button')).toHaveText([
      'Deny',
      'Always allow Bash',
      'Allow once',
    ])
    await expect(chat.locator('.bubble.assistant').first()).toHaveText('Hello')
    await chat.locator('[data-answer="once"]').click()
    await expect(chat.locator('.card.permission')).toHaveCount(0)
    await expect(chat.locator('.chip')).toHaveText('🔧 Allowed Bash.')
    await expect(chat.locator('.bubble.assistant').last()).toHaveText(' ran')
    await expect(chat.locator('[data-key="chat-send"]')).toBeEnabled()
  } finally {
    await launched.close()
  }
})

test('CHT-9, CHT-39, CHT-40, CHT-41 Continue in chat; the chat tab is not saved, not asked about, and ends on close', async () => {
  const log = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'menkar-chat-e2e-'))
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return withStandins(log)(dirs)
    },
  })
  const page = launched.window
  try {
    await act(page, { type: 'continueInChat', session: SESSION, key: 'default' })
    await expect(page.locator('.tab.selected')).toContainText('Chat — fix the login bug')
    await expect(page.locator('.chat .notice')).toHaveText(
      "Continuing the previous session — earlier messages aren't shown here.",
    )
    await expect.poll(() => records(log, 'claude.json').length).toBe(1)
    expect(records(log, 'claude.json')[0].argv.slice(-2)).toEqual(['--resume', SESSION])
    await page.waitForTimeout(700)
    const saved = readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')
    expect(saved).not.toContain('Chat —')
    expect(JSON.parse(saved).projects[0].members).toEqual([SESSION])
    // Closing the window: no confirmation lists the chat.
    const closed = new Promise<void>((resolve) =>
      launched.app.process().once('exit', () => resolve()),
    )
    // Watched from before the close until the app is gone: the window may close before a check
    // made after it could run, which under load read a closed page.
    const asked = page
      .locator('.dialog')
      .waitFor({ state: 'attached', timeout: 30_000 })
      .then(
        () => true,
        () => false,
      )
    await launched.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
    await closed
    expect(await asked).toBe(false)
  } finally {
    await launched.close().catch(() => undefined)
  }
})

test('CHT-8, CHT-12, CHT-30 a Cursor ask chat starts nothing until a message, then answers once', async () => {
  const log = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'menkar-chat-e2e-'))
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = withStandins(log)(dirs)
      withCursorSession(dirs)
      return env
    },
  })
  const page = launched.window
  try {
    await act(page, { type: 'continueInChat', session: CURSOR_CHAT, key: 'ask' })
    const chat = page.locator('.chat')
    await expect(chat.locator('.banner')).toHaveText(
      'Read-only chat with Cursor — analyses and answers, never edits.',
    )
    await page.waitForTimeout(500)
    expect(records(log, 'cursor.json')).toEqual([])
    await chat.locator('[data-key="chat-entry"]').fill('list files')
    await chat.locator('[data-key="chat-entry"]').press('Enter')
    await expect(chat.locator('.bubble.assistant')).toHaveText('echo: list files')
    const argv = records(log, 'cursor.json')[0].argv
    expect(argv.slice(-3)).toEqual(['--mode', 'ask', 'list files'])
    expect(argv).toContain('--trust')
    expect(argv.slice(argv.indexOf('--resume'), argv.indexOf('--resume') + 2)).toEqual([
      '--resume',
      CURSOR_CHAT,
    ])
  } finally {
    await launched.close()
  }
})

test('CHT-42, CHT-44 MCP servers (a Settings section) lists ~/.claude.json, read only; nothing configured says so', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      writeFileSync(
        join(home, '.claude.json'),
        JSON.stringify({
          mcpServers: {
            web: { type: 'http', url: 'https://mcp.example.com' },
            fs: { command: 'npx', args: ['-y', 'fs-server'] },
          },
          projects: {
            '/home/user/src/shop': { mcpServers: { db: { type: 'stdio', command: 'db-mcp' } } },
            '/home/user/src/blog': {},
          },
        }),
      )
      return undefined
    },
  })
  try {
    const before = readFileSync(join(home, '.claude.json'), 'utf8')
    const [mcp] = await Promise.all([
      launched.app.waitForEvent('window'),
      act(launched.window, { type: 'openSettings', section: 'mcp' }),
    ])
    await expect(mcp.locator('main[data-section="mcp"]')).toBeVisible()
    await expect(mcp.locator('.group-title')).toHaveText(['Global', 'shop'])
    await expect(mcp.locator('[data-section="Global"] .row-title')).toHaveText(['fs', 'web'])
    await expect(mcp.locator('[data-section="Global"] .row-subtitle')).toHaveText([
      'stdio · npx -y fs-server',
      'http · https://mcp.example.com',
    ])
    await expect(mcp.locator('[data-section="shop"] .group-description')).toHaveText(
      '/home/user/src/shop',
    )
    expect(readFileSync(join(home, '.claude.json'), 'utf8')).toBe(before)
    await mcp.close()
    writeFileSync(join(home, '.claude.json'), '[1,2]')
    const [again] = await Promise.all([
      launched.app.waitForEvent('window'),
      act(launched.window, { type: 'openSettings', section: 'mcp' }),
    ])
    await expect(again.locator('[data-key="none"]')).toHaveText('No MCP servers configured')
  } finally {
    await launched.close()
  }
})

test('CHT-48 Open in Ghostty resumes the session in its folder, outside the app', async () => {
  const log = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'menkar-chat-e2e-'))
  const launched = await launchApp({ prepare: withStandins(log) })
  try {
    await act(launched.window, { type: 'openInGhostty', session: SESSION })
    await expect.poll(() => existsSync(join(log, 'ghostty.txt'))).toBe(true)
    const args = readFileSync(join(log, 'ghostty.txt'), 'utf8').trim().split('\n')
    expect(args.slice(1)).toEqual(['-e', 'claude', '--resume', SESSION])
    expect(args[0]).toMatch(/^--working-directory=\//)
    await expect(launched.window.locator('.tab')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

// The chooser's options are recorded and it is cancelled, so the test reads where it would open.
async function recordChooser(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ dialog }) => {
    const seen: unknown[] = []
    ;(globalThis as unknown as { chooserSeen: unknown[] }).chooserSeen = seen
    dialog.showOpenDialog = (async (...args: unknown[]) => {
      seen.push(args.find((a) => typeof a === 'object' && a !== null && 'properties' in a))
      return { canceled: true, filePaths: [] }
    }) as typeof dialog.showOpenDialog
  })
}

const chooserSeen = (app: ElectronApplication) =>
  app.evaluate(
    () =>
      (globalThis as unknown as { chooserSeen: { title?: string; defaultPath?: string }[] })
        .chooserSeen,
  )

test('PRF-30 the session chooser opens in the remembered folder, at its own default once it is gone', async () => {
  let folder = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      folder = join(dirs.root, 'todo-api')
      mkdirSync(folder)
      const env = withStandins(mkdtempSync(join(dirs.root, 'log-')))(dirs)
      const state = join(dirs.root, 'config', 'menkar', 'state.json')
      const saved = JSON.parse(readFileSync(state, 'utf8'))
      writeFileSync(
        state,
        JSON.stringify({ ...saved, settings: { ...saved.settings, new_session_dir: folder } }),
      )
      return env
    },
  })
  const page = launched.window
  try {
    await recordChooser(launched.app)
    await act(page, { type: 'pickFolder' })
    await expect.poll(async () => (await chooserSeen(launched.app)).length).toBe(1)
    for (const seen of await chooserSeen(launched.app)) {
      expect(seen.title).toBe('Choose project directory')
      expect(seen.defaultPath).toBe(folder)
    }
    rmSync(folder, { recursive: true })
    await act(page, { type: 'pickFolder' })
    await expect.poll(async () => (await chooserSeen(launched.app)).length).toBe(2)
    for (const seen of (await chooserSeen(launched.app)).slice(1))
      expect(seen.defaultPath).toBeUndefined()
  } finally {
    await launched.close()
  }
})

test('CHT-13 the trusted Cursor chat warns that it runs edits and commands without asking', async () => {
  const log = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'menkar-chat-e2e-'))
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = withStandins(log)(dirs)
      withCursorSession(dirs)
      return env
    },
  })
  try {
    await act(launched.window, { type: 'continueInChat', session: CURSOR_CHAT, key: 'trusted' })
    await expect(launched.window.locator('.chat .banner')).toHaveText(
      'Chat with Cursor — ⚠ runs edits and commands automatically, without asking.',
    )
  } finally {
    await launched.close()
  }
})

test('CHT-27, CHT-28 a user message is plain text; the view follows the bottom only within 48 px', async () => {
  const log = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'menkar-chat-e2e-'))
  const launched = await launchApp({
    prepare: (dirs) => {
      return withStandins(log)(dirs)
    },
  })
  const page = launched.window
  try {
    await act(page, { type: 'continueInChat', session: SESSION, key: 'default' })
    const chat = page.locator('.chat')
    const entry = chat.locator('[data-key="chat-entry"]')
    await entry.fill('**not bold**')
    await entry.press('Enter')
    await expect(chat.locator('.bubble.user')).toHaveText('**not bold**')
    await expect(chat.locator('.bubble.user b')).toHaveCount(0)
    await chat.locator('[data-answer="deny"]').click()
    await expect(chat.locator('[data-key="chat-send"]')).toBeEnabled()

    await entry.fill('stream')
    await entry.press('Enter')
    const conversation = chat.locator('.conversation')
    const gap = () => conversation.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight)
    await expect
      .poll(() => conversation.evaluate((n) => n.scrollHeight - n.clientHeight))
      .toBeGreaterThan(400)
    // Text arrives every 40 ms, so a paragraph could land between a scroll and the moment the view
    // handles it, and the view would rightly judge the bottom too far. The stand-in holds its
    // stream while `pause` exists: each position is set with nothing in flight, and the stream
    // goes on once the scroll has been handled.
    const pause = join(log, 'pause')
    const scrollAbove = async (offset: number) => {
      writeFileSync(pause, '')
      let last = -1
      await expect
        .poll(
          async () => {
            const height = await conversation.evaluate((n) => n.scrollHeight)
            const still = height === last
            last = height
            return still
          },
          { intervals: [150] },
        )
        .toBe(true)
      await conversation.evaluate(
        (n, above) =>
          new Promise<void>((handled) => {
            n.addEventListener('scroll', () => requestAnimationFrame(() => handled()), {
              once: true,
            })
            n.scrollTop = n.scrollHeight - n.clientHeight - above
          }),
        offset,
      )
      rmSync(pause)
      const height = await conversation.evaluate((n) => n.scrollHeight)
      await expect
        .poll(() => conversation.evaluate((n) => n.scrollHeight))
        .toBeGreaterThan(height + 200)
    }

    for (const above of [200, 60]) {
      await scrollAbove(above)
      // Not followed: the view stayed where it was put while the text grew below it.
      expect(await gap()).toBeGreaterThan(200)
    }
    await scrollAbove(40)
    await expect.poll(gap).toBeLessThanOrEqual(1)
  } finally {
    await launched.close()
  }
})

test('the chat look: bubbles, the tool chip and the permission card as measured', async () => {
  const log = mkdtempSync(join(process.env.TMPDIR ?? '/tmp', 'menkar-chat-e2e-'))
  const launched = await launchApp({
    prepare: (dirs) => {
      return withStandins(log)(dirs)
    },
  })
  const page = launched.window
  try {
    await act(page, { type: 'continueInChat', session: SESSION, key: 'default' })
    const chat = page.locator('.chat')
    await chat.locator('[data-key="chat-entry"]').fill('run the tests')
    await chat.locator('[data-key="chat-entry"]').press('Enter')
    await expect(chat.locator('.card.permission')).toBeVisible()
    const style = (selector: string, props: readonly string[]) =>
      chat
        .locator(selector)
        .first()
        .evaluate((n, keys) => {
          const s = getComputedStyle(n)
          return Object.fromEntries(keys.map((k) => [k, s.getPropertyValue(k)]))
        }, props)
    expect(
      await style('.bubble.user', ['background-color', 'color', 'border-radius', 'padding']),
    ).toEqual({
      'background-color': 'rgb(217, 119, 87)',
      color: 'rgb(255, 255, 255)',
      'border-radius': '14px',
      padding: '8px 12px',
    })
    const assistant = await style('.bubble.assistant', ['background-color', 'border-radius'])
    expect(assistant['border-radius']).toBe('14px')
    expect(assistant['background-color']).toMatch(/ \/ 0\.08\)$/)
    expect(
      await style('.card.permission', ['border', 'border-radius', 'padding', 'box-shadow', 'gap']),
    ).toEqual({
      border: '1px solid rgba(217, 119, 87, 0.6)',
      'border-radius': '12px',
      padding: '12px',
      'box-shadow': 'rgba(0, 0, 0, 0.35) 0px 2px 12px 0px',
      gap: '8px',
    })
    expect(await style('.card-title', ['color', 'font-weight'])).toEqual({
      color: 'rgb(217, 119, 87)',
      'font-weight': '700',
    })
    await chat.locator('[data-answer="once"]').click()
    expect(await style('.chip', ['opacity', 'padding'])).toEqual({
      opacity: '0.6',
      padding: '2px 4px',
    })
  } finally {
    await launched.close()
  }
})
