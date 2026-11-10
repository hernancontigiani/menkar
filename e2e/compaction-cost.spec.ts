// The bar's cost since the last compaction, end to end: a session Menkar starts gets its
// `--settings` file, and its two commands run as Claude Code runs them (`/bin/sh -c`, the state on
// stdin), the SessionStart hook standing in for a new session and a compaction.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare } from './fixtures'

interface Settings {
  statusLine: { command: string }
  hooks: { SessionStart: { matcher: string; hooks: { type: string; command: string }[] }[] }
}

test('a compaction noted by the --settings hook resets the cost since; the total stays', async () => {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      return prepare(dirs)
    },
  })
  try {
    await launched.window.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(() => existsSync(join(home, 'claude-pid.txt'))).toBe(true)
    const settings = JSON.parse(
      readFileSync(join(root, 'config', 'menkar', 'claude-settings.json'), 'utf8'),
    ) as Settings
    const hookFor = (source: string) =>
      settings.hooks.SessionStart.find((h) => h.matcher === source)?.hooks[0]?.command ?? ''
    expect(hookFor('startup')).not.toBe('')
    expect(hookFor('compact')).toBe(hookFor('startup'))
    const env = {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_CACHE_HOME: join(root, 'cache'),
      XDG_DATA_HOME: join(root, 'data'),
    }
    const sh = (command: string, input: unknown) => {
      const result = spawnSync('/bin/sh', ['-c', command], {
        input: JSON.stringify(input),
        env,
        encoding: 'utf8',
      })
      expect(result.status).toBe(0)
      return result.stdout
    }
    const id = '6d8defc8-efa3-4eeb-99a0-8ade0b810efe'
    const turn = (total: number) =>
      sh(settings.statusLine.command, {
        session_id: id,
        session_name: 'set',
        context_window: { used_percentage: 22 },
        cost: { total_cost_usd: total },
      })
    const start = (source: string) =>
      sh(hookFor(source), {
        session_id: id,
        transcript_path: '/x.jsonl',
        cwd: home,
        hook_event_name: 'SessionStart',
        source,
      })

    expect(start('startup')).toBe('')
    expect(turn(1.2)).toBe('set · 22% · $1.20 · $1.20 total\n')
    expect(start('compact')).toBe('')
    expect(turn(234.1)).toBe('set · 22% · $0.00 · $234.10 total\n')
    expect(turn(246.5)).toBe('set · 22% · $12.40 · $246.50 total\n')
  } finally {
    await launched.close()
  }
})
