// Decision 1.9 as amended (2026-11-10): closing hangs up, and nothing of the pty may be left after
// it. The agent here ignores SIGHUP, as Claude Code's background backend does when it does not own
// the terminal, so only the reaper's SIGTERM/SIGKILL ends it. Each way a pty is closed is checked:
// close tab, Stop, close a window, quit with the last window, Restart now.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { CURSOR_SESSION, type LaunchedApp, launchApp, savedCursorTab } from './app'

const AGENT = `
process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.on('data', () => {})
process.stdin.on('error', () => {})
process.stdout.on('error', () => {})
process.on('SIGHUP', () => {})
require('node:fs').writeFileSync(process.env.AGENT_PID_FILE, String(process.pid))
process.stdout.write('agent-ready\\n')
if (process.argv[2] === 'stop') setTimeout(() => process.kill(process.pid, 'SIGSTOP'), 200)
setInterval(() => { try { process.stdout.write('') } catch {} }, 500)
`

// Running or stopped, but not yet gone; a zombie is gone.
function state(pid: number): string | null {
  try {
    const s = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const value = s.slice(s.lastIndexOf(') ') + 2)[0] ?? null
    return value === 'Z' ? null : value
  } catch {
    return null
  }
}

async function launch(
  how: 'run' | 'stop' = 'run',
): Promise<{ launched: LaunchedApp; page: Page; agent: number }> {
  let pidFile = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = savedCursorTab(dirs)
      const script = join(dirs.root, 'bin', 'agent.js')
      pidFile = join(dirs.root, 'agent-pid.txt')
      writeFileSync(script, AGENT)
      writeFileSync(
        join(dirs.root, 'bin', 'cursor-agent'),
        `#!/bin/sh\nAGENT_PID_FILE='${pidFile}' exec '${process.execPath}' '${script}' ${how}\n`,
      )
      return env
    },
  })
  const page = launched.window
  let agent = 0
  await expect
    .poll(
      () => {
        try {
          agent = Number(readFileSync(pidFile, 'utf8'))
        } catch {
          agent = 0
        }
        return agent
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0)
  await expect.poll(() => state(agent)).toBe(how === 'stop' ? 'T' : 'S')
  return { launched, page, agent }
}

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

const firstTab = (page: Page) =>
  page.evaluate(() =>
    (
      globalThis as unknown as {
        menkar: { window: { state(): Promise<{ tabs: { id: string }[] }> } }
      }
    ).menkar.window
      .state()
      .then((s) => s.tabs[0]?.id),
  )

const gone = (agent: number) => expect.poll(() => state(agent), { timeout: 10_000 }).toBeNull()

const exited = (launched: LaunchedApp) =>
  new Promise<void>((resolve) => {
    const child = launched.app.process()
    if (child.exitCode !== null) resolve()
    else child.once('exit', () => resolve())
  })

test('closing the tab ends an agent that ignores SIGHUP', async () => {
  const { launched, page, agent } = await launch()
  try {
    await act(page, { type: 'closeTab', tab: await firstTab(page), force: true })
    await gone(agent)
  } finally {
    await launched.close()
  }
})

test('closing the tab ends an agent that is stopped and ignores SIGHUP', async () => {
  const { launched, page, agent } = await launch('stop')
  try {
    await act(page, { type: 'closeTab', tab: await firstTab(page), force: true })
    await gone(agent)
  } finally {
    await launched.close()
  }
})

test('Stop ends an agent that ignores SIGHUP', async () => {
  const { launched, page, agent } = await launch()
  try {
    await act(page, { type: 'stopSession', session: CURSOR_SESSION })
    await gone(agent)
  } finally {
    await launched.close()
  }
})

test('closing a window that is not the last ends its agent, the app running on', async () => {
  const { launched, page, agent } = await launch()
  try {
    await act(page, { type: 'newWindowWithProject', name: 'Other' })
    await expect.poll(() => launched.app.windows().length).toBe(2)
    // The window closes under the call, so its answer never comes.
    void act(page, { type: 'confirmClose' }).catch(() => undefined)
    await expect.poll(() => launched.app.windows().length).toBe(1)
    await gone(agent)
  } finally {
    await launched.close()
  }
})

test('quitting with the last window waits for its agent to be ended, then exits', async () => {
  const { launched, page, agent } = await launch()
  try {
    const done = exited(launched)
    // The window closes under the call, so its answer never comes.
    void act(page, { type: 'confirmClose' }).catch(() => undefined)
    await done
    // The app is gone; what it hung up must be gone with it, not left to the user's systemd.
    expect(state(agent)).toBeNull()
  } finally {
    await launched.close().catch(() => undefined)
  }
})

test('Restart now waits for the agent to be ended before the app exits', async () => {
  const { launched, page, agent } = await launch()
  try {
    await launched.app.evaluate(({ app }) => {
      app.relaunch = () => undefined
    })
    const done = exited(launched)
    await page.evaluate(
      () =>
        void (
          window as unknown as { menkar: { preferences: { restart(): Promise<boolean> } } }
        ).menkar.preferences.restart(),
    )
    await done
    expect(state(agent)).toBeNull()
  } finally {
    await launched.close().catch(() => undefined)
  }
})
