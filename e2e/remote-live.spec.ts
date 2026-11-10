import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Locator, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'

// The phone shows Remote Control as Claude Code reports it now (plan 18, decisions 1.18 and 1.19).
// This stand-in `claude` keeps the per-process registry file Claude Code keeps,
// `~/.claude/sessions/<pid>.json`, with its own pid and start time; the test sets its bridge
// through `rc-state` beside it: a bridge id, `null`, or `absent` (no file at all).
const LIVE_CLAUDE = `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const home = process.env.HOME
const args = process.argv.slice(2)
const session = args[args.indexOf('--resume') + 1]
const dir = path.join(home, '.claude', 'sessions')
const file = path.join(dir, process.pid + '.json')
const stat = fs.readFileSync('/proc/self/stat', 'utf8')
const procStart = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\\s+/)[19]
fs.mkdirSync(dir, { recursive: true })
const write = () => {
  let state = 'absent'
  try { state = fs.readFileSync(path.join(home, 'rc-state'), 'utf8').trim() } catch {}
  if (state === 'absent') { try { fs.rmSync(file) } catch {} ; return }
  const entry = { pid: process.pid, sessionId: session, procStart, status: 'idle' }
  if (state !== 'missing-key') entry.bridgeSessionId = state === 'null' ? null : state
  fs.writeFileSync(file, JSON.stringify(entry))
}
write()
setInterval(write, 200)
process.stdin.resume()
`

let home = ''

function setup(remote: string[], rc: string) {
  return (dirs: { readonly root: string; readonly home: string }) => {
    home = dirs.home
    const env = prepare(dirs)
    writeFileSync(join(dirs.root, 'bin', 'claude'), LIVE_CLAUDE)
    chmodSync(join(dirs.root, 'bin', 'claude'), 0o755)
    writeFileSync(join(dirs.home, 'rc-state'), rc)
    writeFileSync(
      join(dirs.root, 'config', 'menkar', 'state.json'),
      JSON.stringify({ remote_control: remote, settings: { color_scheme: 'dark' } }),
    )
    return env
  }
}

const rc = (state: string) => writeFileSync(join(home, 'rc-state'), state)

// The glyph is the outline, not the emoji, drawn in the text color.
async function outline(phone: Locator): Promise<void> {
  await expect(phone.locator('svg')).toHaveCount(1)
  await expect(phone).not.toContainText('📱')
  expect(await phone.locator('svg').getAttribute('stroke')).toBe('currentColor')
  expect(await phone.locator('svg rect').getAttribute('rx')).toBe('1.6')
}

test('the row’s phone follows the bridge as Claude Code reports it: connected, gone at null, and the app list when unreadable', async () => {
  const launched = await launchApp({ prepare: setup([], 'session_01FakeBridge') })
  const page = launched.window
  try {
    const row = page.locator('.row', { hasText: 'fix the login bug' })
    await row.dblclick()
    const rowPhone = row.locator('.phone')
    // The row only, never the tab (plan 23).
    const tabPhone = page.locator('.tab.selected .phone')
    // Turned on inside the session (not in the app's list, not started with the flag): shown.
    await expect(rowPhone).toHaveAttribute('title', 'Remote Control connected', { timeout: 10_000 })
    await expect(tabPhone).toHaveCount(0)
    await outline(rowPhone)
    // Where the emoji was: after the state dot, left of the name, centered on name and folder.
    const box = async (l: Locator) => {
      const b = await l.boundingBox()
      if (!b) throw new Error('not laid out')
      return b
    }
    // The row is redrawn as the state arrives; measured once it stands.
    await expect(rowPhone.locator('svg')).toBeVisible()
    const phoneBox = await box(rowPhone.locator('svg'))
    const nameBox = await box(row.locator('.name'))
    const textBox = await box(row.locator('.name').locator('..'))
    expect(phoneBox.x + phoneBox.width).toBeLessThanOrEqual(nameBox.x)
    expect(
      Math.abs(phoneBox.y + phoneBox.height / 2 - (textBox.y + textBox.height / 2)),
    ).toBeLessThanOrEqual(2)
    await page.screenshot({ path: 'test-results/rc-live.png' })

    // Disconnected (`null`): gone from the row and the tab.
    rc('null')
    await expect(rowPhone).toHaveCount(0, { timeout: 10_000 })
    await expect(tabPhone).toHaveCount(0)

    // Unreadable (no registry file): the app's own list decides; in it, the phone comes back
    // with the fallback tooltip.
    await row.click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Remote control' }).click()
    await expect(rowPhone).toHaveCount(0)
    rc('absent')
    await expect(rowPhone).toHaveAttribute('title', 'Remote Control on at start (state unknown)', {
      timeout: 10_000,
    })
    await expect(tabPhone).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('RC-27 (plan 23) the phone shows in the row and never on a tab', async () => {
  const launched = await launchApp({ prepare: setup([], 'session_01FakeBridge') })
  const page = launched.window
  try {
    const row = page.locator('.row', { hasText: 'fix the login bug' })
    await row.dblclick()
    await expect(row.locator('.phone')).toHaveAttribute('title', 'Remote Control connected', {
      timeout: 10_000,
    })
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect(page.locator('.tab .phone')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('a registry entry with no bridge key reads as off: no phone, even for a session in the list', async () => {
  const launched = await launchApp({ prepare: setup([SESSION], 'missing-key') })
  const page = launched.window
  try {
    const row = page.locator('.row', { hasText: 'fix the login bug' })
    await row.dblclick()
    await expect(page.locator('.tab.selected')).toBeVisible()
    await page.waitForTimeout(6000)
    // A fresh window state, so the row knows the session runs: off must hide the phone even then.
    await page.locator('.tab.selected').click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as { menkar: { window: { state(): Promise<{ running: string[] }> } } }
          ).menkar.window
            .state()
            .then((s) => s?.running ?? []),
        ),
      )
      .toContain(SESSION)
    await page.waitForTimeout(500)
    await expect(row.locator('.phone')).toHaveCount(0)
    await expect(page.locator('.tab.selected .phone')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
