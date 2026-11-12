import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp, savedState } from './app'

// Settings' Integrations, Usage & classifier and About sections on the real app (docs/spec/preferences.md PRF-31 to PRF-36,
// context.md's switch, classifier.md CLS-25 to CLS-32). The real `claude` is never run.

const FAKE_DIR = resolve('tests/data/classifier')

async function openWindow(
  app: ElectronApplication,
  page: Page,
  open: () => Promise<void>,
): Promise<Page> {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  const [child] = await Promise.all([app.waitForEvent('window'), open()])
  await child.waitForLoadState('domcontentloaded')
  return child
}

async function integrations(
  app: ElectronApplication,
  page: Page,
  section: 'statusline' | 'retention' | 'usage' = 'usage',
): Promise<Page> {
  const prefs = await openWindow(app, page, () => page.keyboard.press('Control+Comma'))
  await prefs.locator(`.section-item[data-section="${section}"]`).click()
  await expect(prefs.locator(`main[data-section="${section}"]`)).toBeVisible()
  return prefs
}

const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

test('PRF-31, CTX-31, CTX-32, CTX-33 the status line switch installs and removes, backing the file up first', async () => {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(
        join(home, '.claude', 'settings.json'),
        '{"model":"opus","statusLine":{"type":"command","command":"my-bar"}}',
      )
      return undefined
    },
  })
  try {
    const settings = join(home, '.claude', 'settings.json')
    const original = readFileSync(settings, 'utf8')
    const prefs = await integrations(launched.app, launched.window, 'statusline')
    await expect(prefs.locator('.group-title')).toHaveText(['Claude Code settings'])
    await expect(prefs.locator('.row-subtitle').first()).toContainText('started outside Menkar')
    const toggle = prefs.locator('[data-key="statusline"]')
    await expect(toggle).not.toBeChecked()
    expect(readFileSync(settings, 'utf8')).toBe(original)
    expect(readdirSync(join(home, '.claude'))).toEqual(['settings.json'])

    await toggle.check()
    await expect(toggle).toBeChecked()
    // The switch flips at the click; main writes the file a moment later.
    await expect
      .poll(() => JSON.parse(readFileSync(settings, 'utf8')).statusLine?.command ?? '')
      .toContain('statusline.js')
    const installed = JSON.parse(readFileSync(settings, 'utf8'))
    expect(Object.keys(installed)).toEqual(['model', 'statusLine'])
    expect(installed.model).toBe('opus')
    expect(installed.statusLine.command).toContain('statusline.js')
    const backups = join(root, 'data', 'menkar', 'settings-backup')
    const [backup] = readdirSync(backups)
    expect(readFileSync(join(backups, backup ?? ''), 'utf8')).toBe(original)

    await toggle.uncheck()
    await expect(toggle).not.toBeChecked()
    await expect
      .poll(() => JSON.parse(readFileSync(settings, 'utf8')))
      .toEqual(JSON.parse(original))
    expect(JSON.parse(readFileSync(settings, 'utf8'))).toEqual(JSON.parse(original))
  } finally {
    await launched.close()
  }
})

test('CTX-36, CTX-37 a refused change says why, leaves the file as it is, and the switch follows the file', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(join(home, '.claude', 'settings.json'), '{"a":')
      return undefined
    },
  })
  try {
    const settings = join(home, '.claude', 'settings.json')
    const before = sha(settings)
    const prefs = await integrations(launched.app, launched.window, 'statusline')
    const toggle = prefs.locator('[data-key="statusline"]')
    await toggle.click()
    await expect(prefs.locator('[data-toast]')).toHaveText(
      `${settings} is not valid JSON; it was left as it is.`,
    )
    await expect(toggle).not.toBeChecked()
    expect(sha(settings)).toBe(before)
  } finally {
    await launched.close()
  }
})

test('CLS-25, CLS-26, CLS-27 the switch shows the earlier-turns row; its dialog counts, estimates and runs', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base, home }) => {
      root = base
      const projects = join(home, '.claude', 'projects', '-home-demo-app')
      mkdirSync(projects, { recursive: true })
      const today = new Date()
      const lines = [0, 1, 2].map((i) => ({
        type: 'user',
        uuid: `old-${i}`,
        timestamp: new Date(today.getTime() - (3 - i) * 86_400_000).toISOString(),
        turnOrigin: 'human',
        message: { content: `an earlier prompt number ${i}, long enough to stand alone` },
      }))
      writeFileSync(
        join(projects, 'session-old.jsonl'),
        `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
      )
      const log = join(base, 'fake-log')
      const replies = join(base, 'fake-replies')
      mkdirSync(log)
      mkdirSync(replies)
      const answers = [0, 1, 2].map((id) => ({ id, category: 'plan' }))
      writeFileSync(join(replies, '1.json'), JSON.stringify({ result: JSON.stringify(answers) }))
      return {
        PATH: `${FAKE_DIR}:${process.env.PATH ?? ''}`,
        FAKE_CLAUDE_LOG: log,
        FAKE_CLAUDE_REPLIES: replies,
      }
    },
  })
  try {
    const prefs = await integrations(launched.app, launched.window)
    const row = prefs.locator('[data-key="earlier-row"]')
    await expect(row).toBeHidden()
    await prefs.locator('[data-key="classify"]').check()
    await expect(row).toBeVisible()
    await expect(prefs.locator('[data-key="earlier-subtitle"]')).toHaveText(
      'Turns from before you turned it on, from a date you choose.',
    )
    await expect(prefs.locator('[data-key="earlier-button"]')).toHaveText('Classify earlier turns…')
    const state = savedState(root)
    expect(typeof state.settings.classify_since).toBe('number')

    await prefs.locator('[data-key="earlier-button"]').click()
    const weekAgo = new Date(Date.now() - 7 * 86_400_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    await expect(prefs.locator('[data-key="earlier-day"]')).toHaveValue(
      `${weekAgo.getFullYear()}-${pad(weekAgo.getMonth() + 1)}-${pad(weekAgo.getDate())}`,
    )
    const confirm = prefs.locator('[data-key="earlier-confirm"]')
    await expect(confirm).toHaveText('Classify 3 turns')
    await expect(prefs.locator('[data-key="estimate"]')).toContainText('Turns to send: 3')
    await expect(prefs.locator('[data-key="estimate"]')).toContainText('under US$0.01')
    await confirm.click()
    await expect(prefs.locator('[data-dialog="earlier"]')).toHaveCount(0)
    await expect(prefs.locator('[data-key="classify-status"]')).toContainText(
      /3 turns classified · \d\d:\d\d/,
    )
    expect(existsSync(join(root, 'fake-log', 'call-1'))).toBe(true)
  } finally {
    await launched.close()
  }
})

test('PRF-32 to PRF-36 About shows the star, the name, the developer and the version; links only on a click', async () => {
  const launched = await launchApp()
  try {
    await launched.app.evaluate(({ shell }) => {
      const opened: string[] = []
      ;(globalThis as unknown as { opened: string[] }).opened = opened
      shell.openExternal = async (url: string) => {
        opened.push(url)
      }
    })
    const about = await openWindow(launched.app, launched.window, async () => {
      await launched.window.evaluate(() =>
        (
          window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
        ).menkar.window.act({
          type: 'openSettings',
          section: 'about',
        }),
      )
    })
    await expect(about.locator('main[data-section="about"]')).toBeVisible()
    await expect(about.locator('[data-key="name"]')).toHaveText('Menkar')
    await expect(about.locator('[data-key="developer"]')).toHaveText('Hernan Contigiani')
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version
    await expect(about.locator('[data-key="version"]')).toHaveText(version)
    await expect(about.locator('.about-logo svg')).toBeVisible()
    const opened = () =>
      launched.app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened)
    expect(await opened()).toEqual([])
    await about.locator('[data-section="details"] summary').click()
    await expect(about.locator('[data-section="details"]')).toContainText(
      'Manage and resume your AI coding agent sessions.',
    )
    await expect(about.locator('[data-section="details"]')).toContainText(
      'not affiliated with or endorsed by Anthropic',
    )
    await about.locator('[data-section="credits"] summary').click()
    await expect(about.locator('[data-section="credits"]')).toContainText(
      'Menkar grew out of Agent Session Manager by Máté Molnár. It was written from scratch, but the idea started there.',
    )
    // No credit points anywhere: nothing in About names or links the original's repository.
    expect(await about.locator('body').innerHTML()).not.toContain('github.com/r4nd3l')
    await about.locator('[data-section="legal"] summary').click()
    await expect(about.locator('[data-section="legal"]')).toContainText('GPL-3.0-or-later')
    await about.locator('[data-key="issues"]').click()
    await expect.poll(opened).toEqual(['https://github.com/hernancontigiani/menkar/issues'])
  } finally {
    await launched.close()
  }
})

// Three human turns, three, two and one days back, in one session of a fresh HOME; the fake
// `claude` records every call under <root>/fake-log.
function earlierTurns(base: string, home: string): Record<string, string> {
  const projects = join(home, '.claude', 'projects', '-home-demo-app')
  mkdirSync(projects, { recursive: true })
  const today = Date.now()
  const lines = [0, 1, 2].map((i) => ({
    type: 'user',
    uuid: `old-${i}`,
    timestamp: new Date(today - (3 - i) * 86_400_000).toISOString(),
    turnOrigin: 'human',
    message: { content: `an earlier prompt number ${i}, long enough to stand alone` },
  }))
  writeFileSync(
    join(projects, 'session-old.jsonl'),
    `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
  )
  mkdirSync(join(base, 'fake-log'))
  return { PATH: `${FAKE_DIR}:${process.env.PATH ?? ''}`, FAKE_CLAUDE_LOG: join(base, 'fake-log') }
}

const dayBefore = (days: number) => {
  const d = new Date(Date.now() - days * 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

test('CLS-1 a fresh install: the switch off, no earlier-turns row, no claude -p, no category level in Usage', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base, home }) => {
      root = base
      return earlierTurns(base, home)
    },
  })
  try {
    const prefs = await integrations(launched.app, launched.window)
    await expect(prefs.locator('[data-key="classify"]')).not.toBeChecked()
    await expect(prefs.locator('[data-key="earlier-row"]')).toBeHidden()
    await prefs.close()
    const usage = await openWindow(launched.app, launched.window, async () => {
      await launched.window.evaluate(() =>
        (
          window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
        ).menkar.window.act({ type: 'openUsage' }),
      )
    })
    await expect(usage.locator('[data-key="footer"]')).toBeVisible()
    await expect(usage.locator('[data-key="hint"]')).toBeVisible()
    await expect(usage.locator('[data-toggles="stack"]')).toHaveCount(0)
    await expect(usage.locator('.usage-row.category')).toHaveCount(0)
    const state = savedState(root)
    expect(state.settings?.classify_since ?? state.classify_since).toBeUndefined()
    expect(readdirSync(join(root, 'fake-log'))).toEqual([])
  } finally {
    await launched.close()
  }
})

async function earlierDialog(prefs: Page): Promise<void> {
  await prefs.locator('[data-key="classify"]').check()
  await prefs.locator('[data-key="earlier-button"]').click()
}

test('CLS-30 no turns to send: the button reads Classify and is disabled', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => {
      const env = earlierTurns(root, home)
      rmSync(join(home, '.claude', 'projects'), { recursive: true })
      return env
    },
  })
  try {
    const prefs = await integrations(launched.app, launched.window)
    await earlierDialog(prefs)
    await expect(prefs.locator('[data-key="estimate"]')).toContainText('Turns to send: 0')
    const confirm = prefs.locator('[data-key="earlier-confirm"]')
    await expect(confirm).toHaveText('Classify')
    await expect(confirm).toBeDisabled()
  } finally {
    await launched.close()
  }
})

test('CLS-31 the usage history cannot be opened while counting: our sentence, the button disabled', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: ({ root: base, home }) => {
      root = base
      return earlierTurns(base, home)
    },
  })
  const history = () => join(root, 'data', 'menkar', 'history.sqlite')
  try {
    const prefs = await integrations(launched.app, launched.window)
    await expect.poll(() => existsSync(history())).toBe(true)
    // Unreadable, in a folder where it cannot be moved aside and replaced either.
    chmodSync(history(), 0o000)
    chmodSync(join(root, 'data', 'menkar'), 0o555)
    await earlierDialog(prefs)
    await expect(prefs.locator('[data-key="estimate"]')).toHaveText(
      'Could not read the usage history (see the log).',
    )
    await expect(prefs.locator('[data-key="earlier-confirm"]')).toBeDisabled()
  } finally {
    chmodSync(join(root, 'data', 'menkar'), 0o755)
    if (existsSync(history())) chmodSync(history(), 0o644)
    await launched.close()
  }
})

test('CLS-32 day A then day B before A is counted: only the estimate for B is ever shown', async () => {
  const launched = await launchApp({
    prepare: ({ root, home }) => earlierTurns(root, home),
  })
  try {
    const dayA = dayBefore(7)
    await launched.app.evaluate(({ ipcMain }, slowDay) => {
      type Handler = (event: unknown, request: { day: string }) => unknown
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })
        ._invokeHandlers
      const original = handlers.get('classifier:estimate')
      if (!original) throw new Error('no classifier:estimate handler')
      handlers.set('classifier:estimate', async (event, request) => {
        if (request.day === slowDay) await new Promise((r) => setTimeout(r, 1500))
        return original(event, request)
      })
    }, dayA)
    const prefs = await integrations(launched.app, launched.window)
    await prefs.exposeFunction('sawConfirm', (text: string) => seen.push(text))
    const seen: string[] = []
    await prefs.evaluate(() => {
      new MutationObserver(() => {
        const button = document.querySelector('[data-key="earlier-confirm"]')
        if (button?.textContent)
          (window as unknown as { sawConfirm(t: string): void }).sawConfirm(button.textContent)
      }).observe(document.body, { childList: true, subtree: true, characterData: true })
    })
    await earlierDialog(prefs)
    const day = prefs.locator('[data-key="earlier-day"]')
    await expect(day).toHaveValue(dayA)
    await day.fill(dayBefore(2))
    await day.dispatchEvent('change')
    const confirm = prefs.locator('[data-key="earlier-confirm"]')
    await expect(confirm).toHaveText('Classify 2 turns')
    await prefs.waitForTimeout(2000)
    await expect(confirm).toHaveText('Classify 2 turns')
    expect(seen).not.toContain('Classify 3 turns')
  } finally {
    await launched.close()
  }
})
