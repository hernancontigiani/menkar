import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ElectronApplication, expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'

// Usage with a Codex session beside a Claude one (plan 39's P1a.6): Codex's turn from its rollout,
// its tokens from the response's record, its cost from OpenAI's prices, marked as an estimate.
// Screenshots in both themes go to the files folder when it is set.

const THREAD = '019a6000-0000-7000-8000-0000000000aa'
const TURN = '019a6000-0010-7000-8000-0000000000a1'
const pad = (n: number) => String(n).padStart(2, '0')

function seed(home: string): void {
  const now = Date.now()
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString()
  const claude = join(home, '.claude', 'projects', '-home-demo-app')
  mkdirSync(claude, { recursive: true })
  const claudeLines = [
    { type: 'user', uuid: 'claude-1', timestamp: at(90), turnOrigin: 'human' },
    {
      type: 'assistant',
      timestamp: at(80),
      requestId: 'req_1',
      message: { id: 'msg_1', model: 'claude-opus-5-5', usage: { output_tokens: 1500 } },
    },
    { type: 'custom-title', customTitle: 'claude-demo' },
  ]
  writeFileSync(
    join(claude, 'claude-session.jsonl'),
    `${claudeLines.map((l) => JSON.stringify(l)).join('\n')}\n`,
  )
  const today = new Date(now)
  const day = join(
    home,
    '.codex',
    'sessions',
    String(today.getFullYear()),
    pad(today.getMonth() + 1),
    pad(today.getDate()),
  )
  mkdirSync(day, { recursive: true })
  const usage = {
    input_tokens: 200_000,
    cached_input_tokens: 150_000,
    cache_write_input_tokens: 0,
    output_tokens: 4000,
    reasoning_output_tokens: 1000,
    total_tokens: 204_000,
  }
  const line = (minutesAgo: number, type: string, payload: object) =>
    JSON.stringify({ timestamp: at(minutesAgo), type, payload })
  const rollout = [
    line(60, 'session_meta', {
      id: THREAD,
      cwd: '/home/demo/api',
      source: 'cli',
      thread_source: 'user',
      history_mode: 'paginated',
    }),
    line(59, 'turn_context', { turn_id: TURN, cwd: '/home/demo/api', model: 'gpt-6.1-sol' }),
    line(59, 'event_msg', { type: 'task_started', turn_id: TURN, model_context_window: 258400 }),
    line(59, 'event_msg', {
      type: 'item_completed',
      thread_id: THREAD,
      turn_id: TURN,
      item: { type: 'UserMessage', content: [{ type: 'text', text: 'Add the routes' }] },
    }),
    line(50, 'token_usage_record', {
      thread_id: THREAD,
      turn_id: TURN,
      response_id: 'resp_1',
      usage,
    }),
    line(50, 'event_msg', {
      type: 'token_count',
      info: { total_token_usage: usage, last_token_usage: usage, model_context_window: 258400 },
    }),
    line(49, 'event_msg', { type: 'task_complete', turn_id: TURN, last_agent_message: 'Done.' }),
  ]
  writeFileSync(
    join(day, `rollout-${today.getFullYear()}-01-01T00-00-00-${THREAD}.jsonl`),
    `${rollout.join('\n')}\n`,
  )
  writeFileSync(
    join(home, '.codex', 'session_index.jsonl'),
    `${JSON.stringify({ id: THREAD, thread_name: 'codex-demo', updated_at: at(58) })}\n`,
  )
}

async function openUsage(app: ElectronApplication, page: Page): Promise<Page> {
  const [usage] = await Promise.all([
    app.waitForEvent('window'),
    page.evaluate(() =>
      (
        window as unknown as { menkar: { window: { act(a: unknown): Promise<unknown> } } }
      ).menkar.window.act({ type: 'openUsage' }),
    ),
  ])
  await usage.waitForLoadState('domcontentloaded')
  const scope = usage.locator('[data-key="all-projects"]')
  await scope.click()
  await expect(scope).toHaveAttribute('aria-pressed', 'true')
  return usage
}

for (const scheme of ['dark', 'light'] as const) {
  test(`Usage shows a Codex session's turn, tokens and estimated cost beside Claude's (${scheme})`, async () => {
    const launched = await launchApp({
      prepare: ({ root, home }) => {
        seed(home)
        const config = join(root, 'config', 'menkar')
        mkdirSync(config, { recursive: true })
        writeFileSync(
          join(config, 'state.json'),
          JSON.stringify({
            settings: {
              color_scheme: scheme,
              terminal_theme: scheme === 'light' ? 'Catppuccin Latte' : 'Catppuccin Mocha',
            },
          }),
        )
        return { CODEX_HOME: '' }
      },
    })
    try {
      const usage = await openUsage(launched.app, launched.window)
      await expect(usage).toHaveTitle('Usage')
      const sessions = usage.locator('.usage-row.session')
      await expect(sessions).toHaveCount(2)
      const codex = sessions.filter({ hasText: 'codex-demo' })
      await expect(codex).toHaveCount(1)
      await expect(codex.locator('.w9')).toHaveText(/^~\$0\.1[56]$/)
      await expect(codex.locator('.w9')).toHaveAttribute('title', /gpt-6\.1-sol/)
      await expect(codex.locator('.w7')).toHaveAttribute('title', /^Started by: human /)
      const files = process.env.MENKAR_FILES
      if (files)
        await usage.screenshot({ path: join(files, `menkar-t148-usage-codex-${scheme}.png`) })
    } finally {
      await launched.close()
    }
  })
}
