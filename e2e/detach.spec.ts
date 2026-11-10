// Decision 1.27: `menkar` run in a terminal gives it back at once, the app going on in a session of
// its own. Run under a pseudo-terminal, as a person's shell would, never by Playwright's launcher
// (whose pipes are not a terminal, so the app stays attached for every other test).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import * as pty from 'node-pty'
import { ensureDisplay } from './display'

const DETACHED = '--menkar-detached'

// Chromium rewrites its own command line into one space-joined string, so it is read as text.
const cmdline = (pid: number) => {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ')
  } catch {
    return ''
  }
}

// The processes of this run, found through /proc and never by a name: those with its temporary
// HOME, Chromium's helpers (the crash handler) that carry its folders on their command line
// instead, those holding a file under it, and the children of any of them. The environment alone
// is not enough: Chromium writes its process title over that memory, after which the detached
// copy's environ reads as zeros, and a scan that comes late (under load) would miss it.
function processesOf(root: string): number[] {
  const parents = new Map<number, number>()
  const found = new Set<number>()
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    const pid = Number(entry)
    try {
      parents.set(
        pid,
        Number(/^PPid:\s+(\d+)$/m.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1]),
      )
      const environ = readFileSync(`/proc/${pid}/environ`, 'utf8')
      if (
        environ.includes(`\0HOME=${root}/`) ||
        cmdline(pid).includes(`${root}/`) ||
        holdsUnder(pid, root)
      )
        found.add(pid)
    } catch {
      // gone, or not ours to read
    }
  }
  for (let grew = true; grew; ) {
    grew = false
    for (const [pid, parent] of parents)
      if (!found.has(pid) && found.has(parent)) {
        found.add(pid)
        grew = true
      }
  }
  return [...found]
}

function holdsUnder(pid: number, root: string): boolean {
  return readdirSync(`/proc/${pid}/fd`).some((fd) => {
    try {
      return readlinkSync(`/proc/${pid}/fd/${fd}`).startsWith(`${root}/`)
    } catch {
      return false // closed meanwhile
    }
  })
}

// Running or exiting, but not yet gone: a process that is exiting no longer shows its environment,
// so the ones found are waited for by PID. A zombie writes nothing more.
function alive(pid: number): boolean {
  try {
    return readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]?.[0] !== 'Z'
  } catch {
    return false
  }
}

// Field 6 of /proc/<pid>/stat, after the parenthesised command name.
const sessionOf = (pid: number) =>
  Number(readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]?.split(' ')[3])

test('decision 1.27: menkar in a terminal returns within 2 s while the app runs on, detached', async () => {
  test.setTimeout(30_000)
  // Inside xvfb-run only: the app this starts opens a window.
  expect(process.env.MENKAR_E2E_XVFB).toBe('1')
  await ensureDisplay()
  const root = mkdtempSync(join(tmpdir(), 'menkar-detach-'))
  const home = join(root, 'home')
  mkdirSync(home)
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value
  Object.assign(env, {
    HOME: home,
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
    SHELL: '/bin/bash',
    XDG_SESSION_TYPE: 'x11',
  })
  // What keeps every other run attached would keep this one attached too.
  for (const key of [
    'MENKAR_E2E_XVFB',
    'MENKAR_E2E_EXECUTABLE',
    'ELECTRON_RENDERER_URL',
    'ELECTRON_RUN_AS_NODE',
    'WAYLAND_DISPLAY',
  ])
    delete env[key]
  const packaged = process.env.MENKAR_E2E_EXECUTABLE
  // Absolute, as the app starts its detached copy with its own resolved path.
  const executable = resolve(packaged ?? (createRequire(import.meta.url)('electron') as string))
  const args = packaged ? ['--ozone-platform=x11'] : ['--ozone-platform=x11', '.']
  let started: number[] = []
  try {
    const startedAt = Date.now()
    const terminal = pty.spawn(executable, args, { cwd: process.cwd(), env, cols: 80, rows: 24 })
    // An app still attached never gives the terminal back: -1 after 5 s says so at once.
    const exitCode = await Promise.race([
      new Promise<number>((resolve) => terminal.onExit(({ exitCode: code }) => resolve(code))),
      new Promise<number>((resolve) => setTimeout(() => resolve(-1), 5000)),
    ])
    const took = Date.now() - startedAt
    expect(exitCode).toBe(0)
    expect(took).toBeLessThan(2000)
    let app = 0
    await expect
      .poll(
        () => {
          started = processesOf(root)
          app = started.find((pid) => cmdline(pid).includes(DETACHED)) ?? 0
          return app
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0)
    expect(cmdline(app).startsWith(`${executable} ${DETACHED} `)).toBe(true)
    // setsid: the app leads a session of its own, so the terminal closing sends it no SIGHUP.
    expect(sessionOf(app)).toBe(app)
    expect(terminal.pid).not.toBe(app)
    // Past Chromium's start (its sandbox included): the copy has a renderer for its window.
    await expect
      .poll(() => processesOf(root).some((pid) => cmdline(pid).includes(' --type=renderer ')), {
        timeout: 10_000,
      })
      .toBe(true)
    expect(alive(app)).toBe(true)
  } finally {
    const ours = new Set([...started, ...processesOf(root)])
    for (const pid of ours) {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // already gone
      }
    }
    await expect
      .poll(() => [...ours, ...processesOf(root)].filter(alive), { timeout: 10_000 })
      .toEqual([])
    rmSync(root, { recursive: true, force: true })
  }
})
