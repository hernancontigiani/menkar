// R10: what `startPaneHeld` assembles for the sessions Menkar starts — argv and environment, as
// the stand-ins record them — and what the app runs and listens on, taken on `main` before the
// multi-agent work moves any of it behind per-agent kits. The expected bytes live under
// tests/core/r10/e2e/, beside the unit snapshots, so the branch's CI guards them with the rest.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { kitOf } from '../src/core/agents/registry'
import { type LaunchedApp, launchApp } from './app'
import { cursorStandIn, prepare, SESSION } from './fixtures'
import { opencodeStandIn } from './standins/opencode'

const REPO = resolve('.')
const EXPECTED = join(REPO, 'tests', 'core', 'r10', 'e2e')
const CURSOR = 'c0ffee02'
const PROJECT = 'aaaaaaaaaaaa'
// Bash's own bookkeeping in the pane's shell, not Menkar's assembly.
const SHELL_OWNED = new Set(['PWD', 'OLDPWD', 'SHLVL', '_'])

// A missing expected file fails, unless MENKAR_R10_WRITE=1 asks for it to be written: R10's
// files are written once, on `main`.
function matchesR10(name: string, actual: string): void {
  const file = join(EXPECTED, name)
  if (!existsSync(file)) {
    if (process.env.MENKAR_R10_WRITE !== '1')
      throw new Error(`R10: ${file} is missing (written only on main, with MENKAR_R10_WRITE=1)`)
    mkdirSync(EXPECTED, { recursive: true })
    writeFileSync(file, actual)
  }
  expect(actual, name).toBe(readFileSync(file, 'utf8'))
}

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

// Every variable a Claude session would hand down, set in the app's own environment, so what
// Menkar strips is the same on every machine; a few of the user's own, which it keeps; and a value
// of its own for each variable the pane sets, so it shows as set whatever the terminal the run was
// started from already had.
const INHERITED: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    Object.values(kitOf('claude').env ?? {}).flatMap((keys) => keys.map((k) => [k, 'x'])),
  ),
  ANTHROPIC_MODEL: 'claude-opus-5-5',
  CLAUDE_CODE_DISABLE_AUTOUPDATER: '1',
  R10_USER_VARIABLE: 'kept',
  SHLVL: '1',
  ...Object.fromEntries(
    ['TERM', 'COLORTERM', 'FORCE_HYPERLINK', 'MENKAR_PANE', 'MENKAR_FILES', 'MENKAR_PRIVATE'].map(
      (k) => [k, 'outer'],
    ),
  ),
}

async function open(
  mode: 'off' | 'on',
  options: {
    readonly cursor: boolean
    readonly opencode?: boolean
    readonly env?: Readonly<Record<string, string>>
  },
) {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      const env = prepare(dirs)
      if (options.cursor) cursorStandIn(join(dirs.root, 'bin'))
      if (options.opencode) opencodeStandIn(join(dirs.root, 'bin'))
      const work = join(dirs.home, 'work')
      const transcripts = join(
        dirs.home,
        '.cursor',
        'projects',
        work.slice(1).replace(/[^A-Za-z0-9]/g, '-'),
        'agent-transcripts',
        CURSOR,
      )
      mkdirSync(transcripts, { recursive: true })
      writeFileSync(
        join(transcripts, `${CURSOR}.jsonl`),
        `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: '<user_query>hello</user_query>' }] } })}\n`,
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
              members: [SESSION, CURSOR],
              groups: [],
              ...(mode === 'on'
                ? { orchestration: { on: true, orchestrator: SESSION }, team_view: true }
                : {}),
            },
          ],
          windows: [],
        }),
      )
      return { ...INHERITED, ...env, ...options.env }
    },
  })
  return { launched, home: () => home }
}

// A packaged build runs from its own folder: its binary, its asar and its plugin stand where the
// dev build has Electron, `out/` and `plugin/`, so one set of expected files holds for both runs.
function packagedToDev(): [string, string][] {
  const executable = process.env.MENKAR_E2E_EXECUTABLE
  if (!executable) return []
  const binary = resolve(executable)
  const resources = join(dirname(binary), 'resources')
  return [
    [join(resources, 'app.asar', 'out'), join(REPO, 'out')],
    [join(resources, 'plugin'), join(REPO, 'plugin')],
    [binary, join(REPO, 'node_modules', 'electron', 'dist', 'electron')],
  ]
}

// The argv and the environment a stand-in recorded, with what varies per run as placeholders.
function recorded(
  launched: LaunchedApp,
  base: Readonly<Record<string, string | undefined>>,
  args: string,
  env: Record<string, string>,
  ids: Readonly<Record<string, string>>,
): string {
  const pane = env.MENKAR_PANE ?? '<no pane>'
  const placeholders: [string, string][] = [
    ...packagedToDev(),
    [launched.root, '<root>'],
    [REPO, '<repo>'],
    [pane, '<pane>'],
    ...Object.entries(ids),
  ]
  const clean = (text: string) =>
    placeholders.reduce((out, [from, to]) => out.replaceAll(from, to), text)
  const set = Object.keys(env)
    .filter((key) => !SHELL_OWNED.has(key) && env[key] !== base[key])
    .sort()
    .map((key) => `${key}=${clean(env[key] ?? '')}`)
  const removed = Object.keys(base)
    .filter((key) => !(key in env))
    .sort()
  return `argv: ${clean(args)}\nset:\n${set.join('\n')}\nremoved:\n${removed.join('\n')}\n`
}

// Starts one session and waits for its stand-in's record: the last argv line and its environment.
async function started(
  home: string,
  agent: 'claude' | 'cursor',
  start: () => Promise<unknown>,
): Promise<{ args: string; env: Record<string, string> }> {
  const argsFile = join(home, `${agent}-args.txt`)
  const envFile = join(home, `${agent}-env.json`)
  // One line per start, an empty one for a start with no arguments.
  const recordedLines = () =>
    existsSync(argsFile) ? readFileSync(argsFile, 'utf8').split('\n').slice(0, -1) : []
  const lines = () => recordedLines().length
  const before = lines()
  rmSync(envFile, { force: true })
  await start()
  await expect.poll(lines, { timeout: 20_000 }).toBe(before + 1)
  let env: Record<string, string> | null = null
  await expect
    .poll(
      () => {
        try {
          env = JSON.parse(readFileSync(envFile, 'utf8'))
          return true
        } catch {
          return false // not written yet, or half written
        }
      },
      { timeout: 20_000 },
    )
    .toBe(true)
  const args = recordedLines().pop() ?? ''
  return { args, env: env ?? {} }
}

for (const mode of ['off', 'on'] as const) {
  test(`R10: startPaneHeld's assembly, the mode ${mode}`, async () => {
    const { launched, home } = await open(mode, { cursor: true })
    const page = launched.window
    const work = join(home(), 'work')
    try {
      // The main process's own environment, with what Electron itself set in it: the panes'
      // differences from it are Menkar's assembly.
      const base = await launched.app.evaluate(() => ({ ...process.env }))
      await expect(page.locator('#session-list .row')).toHaveCount(2)
      const resume = await started(home(), 'claude', () =>
        act(page, { type: 'openSession', session: SESSION }),
      )
      matchesR10(`${mode}-claude-resume.txt`, recorded(launched, base, resume.args, resume.env, {}))

      const fork = await started(home(), 'claude', () =>
        act(page, { type: 'forkSession', session: SESSION }),
      )
      const forkId = /--session-id (\S+)/.exec(fork.args)?.[1] ?? '<none>'
      matchesR10(
        `${mode}-claude-fork.txt`,
        recorded(launched, base, fork.args, fork.env, { [forkId]: '<fork-id>' }),
      )

      const fresh = await started(home(), 'claude', () =>
        act(page, { type: 'startNew', agent: 'claude', folder: work, name: 'r10 new' }),
      )
      const newId = /--session-id (\S+)/.exec(fresh.args)?.[1] ?? '<none>'
      matchesR10(
        `${mode}-claude-new.txt`,
        recorded(launched, base, fresh.args, fresh.env, { [newId]: '<new-id>' }),
      )

      const remote = await started(home(), 'claude', () =>
        act(page, {
          type: 'startNew',
          agent: 'claude',
          folder: work,
          name: 'r10 remote',
          remoteControl: true,
          prompt: 'the first prompt',
        }),
      )
      const remoteId = /--session-id (\S+)/.exec(remote.args)?.[1] ?? '<none>'
      matchesR10(
        `${mode}-claude-remote.txt`,
        recorded(launched, base, remote.args, remote.env, { [remoteId]: '<new-id>' }),
      )

      const cursorResume = await started(home(), 'cursor', () =>
        act(page, { type: 'openSession', session: CURSOR }),
      )
      matchesR10(
        `${mode}-cursor-resume.txt`,
        recorded(launched, base, cursorResume.args, cursorResume.env, {}),
      )
      const cursorNew = await started(home(), 'cursor', () =>
        act(page, { type: 'startNew', agent: 'cursor', folder: work, name: '' }),
      )
      const cursorId = /--new-session-id (\S+)/.exec(cursorNew.args)?.[1] ?? '<none>'
      matchesR10(
        `${mode}-cursor-new.txt`,
        recorded(launched, base, cursorNew.args, cursorNew.env, { [cursorId]: '<new-id>' }),
      )
      // Plan 39 P3.2: each pane's plugin folder names its server's caller, and in the mode its
      // hooks record a compaction; a resume runs no sessionStart.
      for (const [start, hooks] of [
        [cursorResume, mode === 'on' ? ['preCompact'] : []],
        [cursorNew, mode === 'on' ? ['sessionStart', 'preCompact'] : []],
      ] as const) {
        const folder = /--plugin-dir (\S+)/.exec(start.args)?.[1] ?? '<none>'
        const server = JSON.parse(readFileSync(join(folder, '.mcp.json'), 'utf8')).mcpServers.menkar
        expect(server.env).toMatchObject({
          MENKAR_PANE: start.env.MENKAR_PANE,
          MENKAR_AGENT: 'cursor',
        })
        const written = JSON.parse(readFileSync(join(folder, 'hooks', 'hooks.json'), 'utf8'))
        expect(Object.keys(written.hooks)).toEqual(hooks)
        if (hooks.includes('sessionStart'))
          expect(
            JSON.parse(readFileSync(join(folder, 'session-start.json'), 'utf8')).additional_context,
          ).toContain('Your team in Menkar')
      }
    } finally {
      await launched.close()
    }
  })
}

interface Proc {
  readonly pid: number
  readonly ppid: number
  readonly argv: readonly string[]
}

function processes(): Proc[] {
  const out: Proc[] = []
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue
    try {
      // The command name sits in parentheses and may hold spaces: the fields follow the last one.
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8')
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
      const argv = readFileSync(`/proc/${name}/cmdline`, 'utf8').split('\0').filter(Boolean)
      out.push({ pid: Number(name), ppid, argv })
    } catch {
      // a process that ended while listed
    }
  }
  return out
}

function descendants(root: number): Proc[] {
  const all = processes()
  const found = new Set([root])
  for (let grew = true; grew; ) {
    grew = false
    for (const p of all)
      if (!found.has(p.pid) && found.has(p.ppid)) {
        found.add(p.pid)
        grew = true
      }
  }
  return all.filter((p) => found.has(p.pid))
}

// A process as the set names it: Electron's by its type, a script by its interpreter and file.
// Chromium rewrites its children's command lines (a renderer shows the app's name), so a process is
// told by its executable; an Electron one by the type its command line still shows, if any.
function named(p: Proc, electron: string): string {
  let exe: string
  try {
    exe = readlinkSync(`/proc/${p.pid}/exe`)
  } catch {
    return '(ended)'
  }
  const line = p.argv.join(' ')
  if (exe === electron) {
    const type = /--type=(\S+)/.exec(line)?.[1]
    const sub = /--utility-sub-type=(\S+)/.exec(line)?.[1]
    return ['electron', type, sub].filter(Boolean).join(' ')
  }
  const script = basename(exe) === 'node' && p.argv[1] ? ` ${basename(p.argv[1])}` : ''
  return `${basename(exe)}${script}`
}

// The inodes of the TCP sockets in LISTEN state (0A), IPv4 and IPv6.
function listeningInodes(): Map<string, string> {
  const out = new Map<string, string>()
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').trim().split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/)
      if (fields[3] === '0A' && fields[9]) out.set(fields[9], fields[1] ?? '')
    }
  }
  return out
}

// What the processes listen on, as "<pid> <executable> <address>", but for the harness's ports.
function listening(procs: readonly Proc[], harness: readonly number[]): string[] {
  const inodes = listeningInodes()
  const found: string[] = []
  for (const p of procs) {
    let fds: string[]
    try {
      fds = readdirSync(`/proc/${p.pid}/fd`)
    } catch {
      continue // ended
    }
    for (const fd of fds) {
      let target: string
      try {
        target = readlinkSync(`/proc/${p.pid}/fd/${fd}`)
      } catch {
        continue // closed while read
      }
      const inode = /^socket:\[(\d+)\]$/.exec(target)?.[1]
      const local = inode ? inodes.get(inode) : undefined
      if (local === undefined) continue
      const port = Number.parseInt(local.split(':')[1] ?? '', 16)
      if (!harness.includes(port)) found.push(`${p.pid} ${basename(p.argv[0] ?? '')} ${local}`)
    }
  }
  return found
}

// OpenCode's server starts with the first OpenCode tab: with OpenCode installed and none open, the
// app runs and listens on what it does without it.
async function processesAndListening(opencode: 'absent' | 'present but unused'): Promise<void> {
  // R10_DEFECT_LISTEN=1 is the check's injected defect: the stand-in then listens on loopback.
  const { launched, home } = await open('off', {
    cursor: false,
    opencode: opencode !== 'absent',
    env: process.env.R10_DEFECT_LISTEN === '1' ? { FAKE_CLAUDE_LISTEN: '1' } : {},
  })
  const page = launched.window
  try {
    await started(home(), 'claude', () => act(page, { type: 'openSession', session: SESSION }))
    // R10_DEFECT_OPENCODE=1 is the OpenCode row's injected defect: main starts OpenCode's server
    // with no OpenCode tab.
    if (opencode !== 'absent' && process.env.R10_DEFECT_OPENCODE === '1')
      await launched.app.evaluate(() => {
        const { spawn } = process.getBuiltinModule('node:child_process')
        spawn('opencode', ['serve', '--stdio'], { stdio: ['pipe', 'ignore', 'ignore'] })
      })
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    const pid = launched.app.process().pid
    if (pid === undefined) throw new Error('the app has no pid')
    const electron = readlinkSync(`/proc/${pid}/exe`)
    const procs = descendants(pid)
    expect(procs.length).toBeGreaterThanOrEqual(3)
    const set = [...new Set(procs.map((p) => named(p, electron)))].sort()
    matchesR10('processes.txt', `${set.join('\n')}\n`)
    // Playwright's own: the main process's inspector (--inspect=0) and Chromium's DevTools port
    // (--remote-debugging-port=0), whose descriptor every child inherits.
    const inspector = await launched.app.evaluate(() => process.debugPort)
    const devtools = readFileSync(
      join(launched.root, 'cache', 'menkar', 'electron', 'DevToolsActivePort'),
      'utf8',
    ).split('\n')[0]
    const harness = [Number(inspector), Number(devtools)]
    expect(harness.every((port) => port > 0)).toBe(true)
    expect(listening(procs, harness)).toEqual([])
    expect(existsSync(join(home(), 'opencode-serve-pids.txt'))).toBe(false)
  } finally {
    await launched.close()
  }
}

test("R10: with the stand-in claude alone, the app's processes are the expected set and none listens", () =>
  processesAndListening('absent'))

test("R10: with the stand-in claude and OpenCode present but unused, the app's processes are the expected set and none listens", () =>
  processesAndListening('present but unused'))
