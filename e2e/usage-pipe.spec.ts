// `menkar usage` into a pipe: the process ends only once standard output has drained, so a reader
// slower than the app still gets every byte, and a reader that goes away makes the exit non-zero.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { expect, test } from '@playwright/test'
import { e2ePath } from './path'

const PACKAGED = process.env.MENKAR_E2E_EXECUTABLE
const EXECUTABLE = resolve(PACKAGED ?? 'node_modules/electron/dist/electron')
const APP_ARGS = PACKAGED ? [] : [resolve('.')]
const TURNS = 3000

interface Run {
  readonly stdout: Buffer
  readonly code: number | null
  readonly signal: NodeJS.Signals | null
}

function prepareHome(root: string): Record<string, string> {
  const dirs = {
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
  }
  const transcripts = join(dirs.HOME, '.claude', 'projects', '-home-demo-app')
  mkdirSync(transcripts, { recursive: true })
  const lines: string[] = []
  for (let i = 0; i < TURNS; i++) {
    const at = Date.UTC(2026, 10, 8, 13) + i * 60_000
    lines.push(
      JSON.stringify({
        type: 'user',
        uuid: `turn-${i}`,
        timestamp: new Date(at).toISOString(),
        turnOrigin: 'human',
      }),
      JSON.stringify({
        type: 'assistant',
        timestamp: new Date(at + 30_000).toISOString(),
        requestId: `req_${i}`,
        message: { id: `msg_${i}`, model: 'claude-opus-5-5', usage: { output_tokens: 7 } },
      }),
    )
  }
  writeFileSync(join(transcripts, 'session-1.jsonl'), `${lines.join('\n')}\n`)
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
  Object.assign(env, dirs, { PATH: e2ePath(root) })
  delete env.WAYLAND_DISPLAY
  delete env.DISPLAY
  return env
}

// What ssh, cron or a systemd user service leaves: no display and no desktop session at all.
function withoutDesktop(env: Record<string, string>): Record<string, string> {
  const bare = { ...env }
  for (const name of [
    'DISPLAY',
    'WAYLAND_DISPLAY',
    'XAUTHORITY',
    'XDG_SESSION_TYPE',
    'XDG_RUNTIME_DIR',
    'DBUS_SESSION_BUS_ADDRESS',
  ])
    delete bare[name]
  return bare
}

// The reader pauses after each chunk, so the app fills the pipe's buffer long before the reader
// catches up.
function slowly(stdout: Readable, chunks: Buffer[]): void {
  stdout.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
    stdout.pause()
    setTimeout(() => stdout.resume(), 5)
  })
}

// `reader` decides how standard output is read; the run ends when the process exits.
function run(
  root: string,
  env: Record<string, string>,
  args: readonly string[],
  reader: (stdout: Readable, chunks: Buffer[]) => void,
): Promise<Run> {
  return new Promise((done, fail) => {
    const child = spawn(EXECUTABLE, ['--no-sandbox', ...APP_ARGS, 'usage', ...args], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const chunks: Buffer[] = []
    const timer = setTimeout(() => child.kill('SIGKILL'), 60_000)
    reader(child.stdout, chunks)
    child.once('error', fail)
    // 'close' comes once the process has exited and its standard output has ended, so what was
    // still in the pipe at the exit is read before the run is judged.
    child.once('close', (code, signal) => {
      clearTimeout(timer)
      done({ stdout: Buffer.concat(chunks), code, signal })
    })
  })
}

test('`menkar usage export` into a slow pipe delivers every byte and exits 0', async () => {
  test.setTimeout(120_000)
  const root = mkdtempSync(join(tmpdir(), 'menkar-e2e-usage-pipe-'))
  try {
    const env = prepareHome(root)
    const file = join(root, 'export.jsonl')
    const toFile = await run(root, env, ['export', '--period', 'all', '--output', file], (stdout) =>
      stdout.resume(),
    )
    expect(toFile.code).toBe(0)
    const expected = readFileSync(file)
    expect(expected.length).toBeGreaterThan(4 * 65_536)

    const piped = await run(root, env, ['export', '--period', 'all'], slowly)
    expect(piped.signal).toBeNull()
    expect(piped.code).toBe(0)
    expect(piped.stdout.length).toBe(expected.length)
    expect(piped.stdout.equals(expected)).toBe(true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('`menkar usage export` whose reader goes away exits non-zero', async () => {
  test.setTimeout(120_000)
  const root = mkdtempSync(join(tmpdir(), 'menkar-e2e-usage-epipe-'))
  try {
    const env = prepareHome(root)
    const closed = await run(root, env, ['export', '--period', 'all'], (stdout, chunks) => {
      stdout.once('data', (chunk: Buffer) => {
        chunks.push(chunk)
        stdout.destroy()
      })
    })
    expect(closed.signal).toBeNull()
    expect(closed.code).not.toBe(0)
    expect(closed.code).not.toBeNull()
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('with no display or desktop session, `menkar usage` into a slow pipe is whole and exits 0', async () => {
  test.setTimeout(120_000)
  const root = mkdtempSync(join(tmpdir(), 'menkar-e2e-usage-bare-'))
  try {
    const env = withoutDesktop(prepareHome(root))
    const file = join(root, 'export.jsonl')
    const toFile = await run(root, env, ['export', '--period', 'all', '--output', file], (stdout) =>
      stdout.resume(),
    )
    expect(toFile.code).toBe(0)
    const expected = readFileSync(file)
    expect(expected.length).toBeGreaterThan(4 * 65_536)

    const piped = await run(root, env, ['export', '--period', 'all'], slowly)
    expect(piped.signal).toBeNull()
    expect(piped.code).toBe(0)
    expect(piped.stdout.length).toBe(expected.length)
    expect(piped.stdout.equals(expected)).toBe(true)

    const now = await run(root, env, ['now', '--json'], slowly)
    expect(now.signal).toBeNull()
    expect(now.code).toBe(0)
    expect(() => JSON.parse(now.stdout.toString('utf8'))).not.toThrow()
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
