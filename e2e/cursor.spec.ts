// Plan 39 P3.2 (set, 2026-11-23, option b): Menkar starts a new Cursor session under an id of its
// own with Cursor's hidden `--new-session-id`. A Cursor build that drops the option stops at once
// with commander's error: the pane says so in one line of Menkar's own, nothing is typed into it,
// and the next new session lets Cursor pick its id.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, terminalText } from './app'
import { cursorStandIn, prepare } from './fixtures'

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
