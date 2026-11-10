import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// One X server per Playwright worker, so tests in parallel never share a screen: several read the
// whole screen back, or size and maximize their window. A worker is a process of its own, and every
// app a test starts copies this process's environment, so setting DISPLAY here reaches them all.

const outer = process.env.DISPLAY ?? null
let ready: Promise<string> | null = null

export function ensureDisplay(): Promise<string> {
  ready ??= start()
  return ready
}

// What `xvfb-run` set around the whole run, and what this worker uses instead.
export function displays(): { readonly outer: string | null; readonly own: string | null } {
  return { outer, own: process.env.DISPLAY ?? null }
}

const SCREEN = '1280x1024x24'
// Each worker probes its own band of numbers, as `xvfb-run -a` probes one, so other runs on the
// machine (another session's suite) and a restarted worker find a free one.
const BAND = 10

async function start(): Promise<string> {
  const slot = Number(process.env.TEST_PARALLEL_INDEX ?? '0')
  const dir = mkdtempSync(join(tmpdir(), 'menkar-xvfb-'))
  const auth = join(dir, 'Xauthority')
  const cookie = randomBytes(16).toString('hex')
  for (let n = 100 + slot * BAND; n < 100 + (slot + 1) * BAND; n += 1) {
    if (existsSync(`/tmp/.X${n}-lock`) || existsSync(`/tmp/.X11-unix/X${n}`)) continue
    execFileSync('xauth', ['-q', '-f', auth, 'add', `:${n}`, '.', cookie])
    const server = spawn(
      'Xvfb',
      [`:${n}`, '-screen', '0', SCREEN, '-nolisten', 'tcp', '-auth', auth, '-displayfd', '3'],
      { stdio: ['ignore', 'ignore', 'ignore', 'pipe'] },
    )
    // Xvfb writes its number on fd 3 once it accepts connections; an exit first means it lost the
    // number to another server started in between.
    const up = await new Promise<boolean>((resolve) => {
      server.stdio[3]?.once('data', () => resolve(true))
      server.once('exit', () => resolve(false))
      server.once('error', () => resolve(false))
    })
    if (!up) continue
    const display = `:${n}`
    process.env.DISPLAY = display
    process.env.XAUTHORITY = auth
    // The session bus would carry an app's desktop notifications to the developer's own desktop.
    delete process.env.DBUS_SESSION_BUS_ADDRESS
    process.once('exit', () => {
      server.kill()
      rmSync(dir, { recursive: true, force: true })
    })
    return display
  }
  rmSync(dir, { recursive: true, force: true })
  throw new Error(`no free X display between :${100 + slot * BAND} and :${99 + (slot + 1) * BAND}`)
}
