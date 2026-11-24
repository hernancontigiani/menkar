// Cursor's real-check harness: a packaged Menkar build under xvfb (e2e's launchApp, every HOME and
// XDG folder throwaway), the real `cursor-agent` behind a wrapper that records its arguments, on the
// human's Cursor login (a copy of auth.json inside the run's own folders, deleted with them).
import { execFileSync, spawn } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, type Page } from '@playwright/test'
import { launchApp } from '../../../e2e/app'
import { prepare, SESSION } from '../../../e2e/fixtures'

export { SESSION }
export const CLAUDE = 'fix the login bug'
export const WORKER = 'client-work-t1'
export const SERVER = 'plugin-menkar-sandbox-menkar'

export const RUN = mkdtempSync(join(tmpdir(), 'menkar-probe-cursor-'))
if (!process.env.MENKAR_E2E_EXECUTABLE) throw new Error('set MENKAR_E2E_EXECUTABLE')
export const CURSOR = realpathSync(
  process.env.CURSOR_BIN ?? join(homedir(), '.local', 'bin', 'cursor-agent'),
)
const AUTH = join(homedir(), '.config', 'cursor', 'auth.json')

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const slug = (p: string) =>
  p
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

export function noter(name: string) {
  const lines: string[] = []
  return (s: string) => {
    lines.push(`${new Date().toISOString()} ${s}`)
    writeFileSync(join(RUN, `${name}.txt`), `${lines.join('\n')}\n`)
    console.log(`[${name}] ${s}`)
  }
}

export const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )
export const shownState = (page: Page) =>
  page.evaluate(() =>
    (
      globalThis as unknown as { menkar: { window: { state(): Promise<unknown> } } }
    ).menkar.window.state(),
  ) as Promise<{ tabs: { panes: { sessionId: string | null }[] }[] }>
export const usageToday = (page: Page) =>
  page.evaluate(() =>
    (
      globalThis as unknown as {
        menkar: { usage: { view(w: unknown, all: boolean): Promise<unknown> } }
      }
    ).menkar.usage.view({ kind: 'period', period: 'today' }, true),
  )

export interface TeamOptions {
  // The user's own entries placed in hooks.json and cli-config.json before Menkar's items.
  readonly userFiles?: boolean
  readonly orchestrator?: string | null
}

export async function launchTeam(options: TeamOptions = {}) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      const bin = join(dirs.root, 'bin')
      writeFileSync(
        join(bin, 'cursor-agent'),
        `#!/bin/bash\nprintf '%s\\n' "$*" >> "$HOME/cursor-args.txt"\nexec '${CURSOR}' "$@"\n`,
        { mode: 0o755 },
      )
      // The human's login, copied where Cursor looks under the run's XDG config folder.
      mkdirSync(join(dirs.root, 'config', 'cursor'), { recursive: true })
      copyFileSync(AUTH, join(dirs.root, 'config', 'cursor', 'auth.json'))
      // Cursor writes its own cli-config.json at its first run; let it, in the run's folders.
      execFileSync(CURSOR, ['status'], {
        env: {
          PATH: '/usr/bin:/bin',
          HOME: dirs.home,
          XDG_CONFIG_HOME: join(dirs.root, 'config'),
          XDG_CACHE_HOME: join(dirs.root, 'cache'),
          XDG_DATA_HOME: join(dirs.root, 'data'),
        },
        stdio: 'ignore',
      })
      if (options.userFiles) {
        const cfg = join(dirs.root, 'config', 'cursor', 'cli-config.json')
        const c = JSON.parse(readFileSync(cfg, 'utf8'))
        c.permissions = { allow: ['Shell(ls)'], deny: ['Shell(rm)'] }
        writeFileSync(cfg, `${JSON.stringify(c, null, 2)}\n`)
        mkdirSync(join(dirs.home, '.cursor'), { recursive: true })
        writeFileSync(
          join(dirs.home, '.cursor', 'hooks.json'),
          '{\n    "version": 1,\n    "hooks": {\n        "afterFileEdit": [ { "command": "true" } ]\n    }\n}\n',
        )
      }
      const orchestrator = options.orchestrator ?? null
      const projects = [
        {
          id: 'aaaaaaaaaaaa',
          name: 'Client work',
          members: [SESSION],
          groups: [],
          orchestration: { on: true, orchestrator },
        },
      ]
      for (const folder of ['menkar', 'menkar-sandbox']) {
        const dir = join(dirs.root, 'config', folder)
        mkdirSync(dir, { recursive: true })
        writeFileSync(
          join(dir, 'projects.json'),
          JSON.stringify({ version: 1, current: 'aaaaaaaaaaaa', projects, windows: [] }),
        )
        if (folder !== 'menkar')
          writeFileSync(
            join(dir, 'state.json'),
            readFileSync(join(dirs.root, 'config', 'menkar', 'state.json')),
          )
      }
      mkdirSync(
        join(dirs.home, '.cursor', 'projects', slug(join(dirs.home, 'work')), 'agent-transcripts'),
        { recursive: true },
      )
      return { ...env, MENKAR_LOG: 'info', FAKE_CLAUDE_SOCKET: '1' }
    },
  })
  const page = launched.window
  const read = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8') : '')
  const jsonl = (f: string) =>
    read(f)
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  const starts = () =>
    read(join(home, 'cursor-args.txt'))
      .split('\n')
      .slice(0, -1)
      .filter((l) => l.startsWith('--') && l !== '--version')
  const posts = (): string[] => jsonl(join(home, 'claude-posts.jsonl')).map((p) => p.content)
  const cache = () => join(root, 'cache', 'menkar-sandbox')
  const hookLog = (): Record<string, unknown>[] => jsonl(join(cache(), 'cursor-turns.jsonl'))
  const names = () =>
    JSON.parse(read(join(root, 'config', 'menkar-sandbox', 'state.json')) || '{}').names ?? {}
  const projectsSaved = () =>
    JSON.parse(read(join(root, 'config', 'menkar-sandbox', 'projects.json')) || '{}')
  const dot = (session: string) =>
    page
      .locator(`.row[data-session="${session}"] .dot`)
      .first()
      .getAttribute('class', { timeout: 1000 })
      .catch(() => null)
  const heldRoot = () => join(cache(), 'control', 'held-wakes')
  const held = () =>
    existsSync(heldRoot())
      ? readdirSync(heldRoot(), { recursive: true }).filter((f) => String(f).endsWith('.txt'))
      : []
  const transcriptsDir = () =>
    join(home, '.cursor', 'projects', slug(join(home, 'work')), 'agent-transcripts')
  const transcript = (id: string) => jsonl(join(transcriptsDir(), id, `${id}.jsonl`))
  const screen = () =>
    page
      .locator('.xterm-rows:visible')
      .first()
      // biome-ignore lint/performance/useDomNodeTextContent: one line per terminal row.
      .innerText()
      .catch(() => '')
  return {
    launched,
    page,
    root: () => root,
    home: () => home,
    cache,
    starts,
    posts,
    hookLog,
    names,
    projectsSaved,
    dot,
    held,
    transcriptsDir,
    transcript,
    screen,
    read,
  }
}
export type Team = Awaited<ReturnType<typeof launchTeam>>

// The user texts and tool calls of a transcript, flat.
export function flat(lines: Record<string, unknown>[]) {
  const out: { role: string; text?: string; tool?: string; input?: unknown }[] = []
  for (const l of lines) {
    const role = String(l.role ?? l.type)
    const content = (l.message as { content?: unknown[] } | undefined)?.content ?? []
    for (const b of content as { type: string; text?: string; name?: string; input?: unknown }[]) {
      if (b.type === 'text') out.push({ role, text: b.text })
      if (b.type === 'tool_use') out.push({ role, tool: b.name, input: b.input })
    }
    if (l.type === 'turn_ended') out.push({ role: 'turn_ended', text: String(l.status) })
  }
  return out
}

export async function typeIn(page: Page, text: string, enter = true) {
  await page.locator('.xterm:visible .xterm-helper-textarea').first().focus()
  await page.keyboard.type(text, { delay: 15 })
  if (enter) {
    await sleep(600)
    await page.keyboard.press('Enter')
  }
}

export async function openPrefs(team: Team) {
  await team.page.locator('body').click({ position: { x: 5, y: 5 } })
  const [child] = await Promise.all([
    team.launched.app.waitForEvent('window'),
    team.page.keyboard.press('Control+Comma'),
  ])
  await child.waitForLoadState('domcontentloaded')
  await child.locator('.section-item[data-section="agents"]').click()
  return child
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(RUN, `${name}.png`) })
}

// A tool of Menkar's called as the Claude stand-in calls it, through its --mcp-config server.
export function callAsClaude(
  home: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<string> {
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
    const send = (o: unknown) => child.stdin.write(`${JSON.stringify(o)}\n`)
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } })
  })
}

// The orchestrator (the Claude stand-in) opened and a worker started for task 1.
export async function startWorker(team: Team, prompt: string): Promise<string> {
  await openOrchestrator(team)
  await callAsClaude(team.home(), 'task_add', { title: 'build the thing' })
  const started = await callAsClaude(team.home(), 'start_session', {
    agent: 'cursor',
    task: 1,
    prompt,
  })
  expect(started).toContain(`Started "${WORKER}"`)
  await expect.poll(() => team.starts().length, { timeout: 20_000 }).toBe(1)
  const id = /--new-session-id ([0-9a-f-]{36})/.exec(team.starts()[0] ?? '')?.[1] ?? ''
  expect(id).not.toBe('')
  await team.page
    .locator('.team-fold')
    .first()
    .click({ timeout: 5000 })
    .catch(() => undefined)
  await expect(team.page.locator(`.row[data-session="${id}"]`)).toBeVisible({ timeout: 30_000 })
  await team.page.locator(`.row[data-session="${id}"]`).click()
  return id
}

export async function takeControl(team: Team) {
  const take = team.page.locator('.pane-banner button:visible', { hasText: 'Take control' })
  if (await take.count()) {
    await take.click()
    await expect(take).toHaveCount(0)
  }
}

// The Claude stand-in as the project's orchestrator, started from New as the human would.
export async function openOrchestrator(team: Team) {
  await act(team.page, {
    type: 'startNew',
    agent: 'claude',
    folder: join(team.home(), 'work'),
    name: 'orch',
    orchestrator: true,
  })
  await expect
    .poll(() => existsSync(join(team.home(), 'claude-args.txt')), { timeout: 20_000 })
    .toBe(true)
  await sleep(2000)
}
