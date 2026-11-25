// Without Cursor's items: the real "Run this MCP tool?" card read as blocked. Then a Cursor
// orchestrator (both items on), woken through its waker by a Claude worker's messages.
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@playwright/test'
import {
  act,
  callAsClaude,
  flat,
  launchTeam,
  noter,
  openPrefs,
  RUN,
  shot,
  sleep,
  startWorker,
  takeControl,
  typeIn,
} from './lib'

const results: string[] = []
function check(name: string, ok: boolean, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  results.push(line)
  writeFileSync(join(RUN, 'alone-results.txt'), `${results.join('\n')}\n`)
  console.log(line)
}
async function until(f: () => boolean | Promise<boolean>, ms: number): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await f()) return true
    await sleep(500)
  }
  return false
}

test('no items: the card', async () => {
  const team = await launchTeam()
  const note = noter('alone-card')
  const p = team.page
  try {
    check(
      'no items: no hooks.json written',
      !existsSync(join(team.home(), '.cursor', 'hooks.json')),
    )
    const id = await startWorker(
      team,
      'Call Menkar’s task_list tool once and quote what it returns.',
    )
    await until(async () => (await team.screen()).includes('Trust this workspace'), 20_000)
    await takeControl(team)
    await p.locator('.xterm:visible .xterm-helper-textarea').first().focus()
    await p.keyboard.press('a')
    const card = await until(
      async () => (await team.screen()).includes('Run this MCP tool?'),
      120_000,
    )
    await sleep(2500)
    const dot = await team.dot(id)
    const screen = await team.screen()
    writeFileSync(join(RUN, 'screen-mcp-card.txt'), screen)
    await shot(p, 'alone-card')
    check(
      '3 without the allow item: the card read as blocked',
      card && String(dot).includes('blocked'),
      String(dot),
    )
    await p.keyboard.press('y')
    const done = await until(
      () => flat(team.transcript(id)).some((x) => x.tool === 'CallDynamicTool'),
      60_000,
    )
    await sleep(5000)
    const dotAfter = await team.dot(id)
    note(`after y: called ${done}; dot ${dotAfter}`)
    check(
      '3 answered card: the tool runs, the dot leaves blocked',
      done && !String(dotAfter).includes('blocked'),
      String(dotAfter),
    )
  } finally {
    await team.launched.close()
  }
})

test('a Cursor orchestrator woken through its waker', async () => {
  const team = await launchTeam()
  const note = noter('alone-orch')
  const p = team.page
  try {
    const prefs = await openPrefs(team)
    await prefs.locator('[data-key="agent-item-cursor-hooks"]').check()
    await prefs.locator('[data-key="agent-item-cursor-allow"]').check()
    await sleep(1500)
    await prefs.close()
    await act(p, {
      type: 'startNew',
      agent: 'cursor',
      folder: join(team.home(), 'work'),
      name: 'corch',
      orchestrator: true,
    })
    await until(async () => (await team.screen()).includes('Trust this workspace'), 30_000)
    await takeControl(team)
    await p.locator('.xterm:visible .xterm-helper-textarea').first().focus()
    await p.keyboard.press('a')
    await until(() => team.hookLog().some((l) => l.event === 'stop'), 180_000)
    await sleep(5000)
    note(
      `starts: ${JSON.stringify(team.starts()).slice(0, 300)}; first stop ${JSON.stringify(team.hookLog().filter((l) => l.event === 'stop'))}`,
    )
    note(
      `screen: ${(await team.screen())
        .split('\n')
        .filter((l) => l.trim())
        .slice(-6)
        .join(' ⏎ ')}`,
    )
    await takeControl(team)
    await typeIn(
      p,
      'Call Menkar’s start_session tool with agent "claude", name "helper" and prompt "hi". Then say STARTED and stop.',
    )
    const helper = await until(() => existsSync(join(team.home(), 'claude-args.txt')), 180_000)
    await shot(p, 'alone-orch-after-ask')
    note(
      `after ask: ${(await team.screen())
        .split('\n')
        .filter((l) => l.trim())
        .slice(-8)
        .join(' ⏎ ')}`,
    )
    if (!helper) {
      check('9 the Cursor orchestrator starts a Claude worker', false)
      return
    }
    check('9 the Cursor orchestrator starts a Claude worker', helper)
    const orchId = (() => {
      const d = team.transcriptsDir()
      return existsSync(d) ? (readdirSync(d)[0] ?? '') : ''
    })()
    await until(() => team.hookLog().filter((l) => l.event === 'stop').length >= 1, 60_000)
    await sleep(8000)
    // Two messages from the worker while the orchestrator is idle: each one a hangup and a resume.
    const s0 = team.starts().length
    for (const code of ['ORCH-WAKE-1', 'ORCH-WAKE-2']) {
      const r = await callAsClaude(team.home(), 'send_message', {
        name: 'corch',
        text: `reply exactly ${code}`,
      })
      note(`send ${code}: ${r}`)
      const got = await until(
        () =>
          flat(team.transcript(orchId)).some(
            (x) => x.role === 'user' && String(x.text).includes(code),
          ),
        120_000,
      )
      await until(
        () =>
          flat(team.transcript(orchId)).some(
            (x) => x.role === 'assistant' && String(x.text).includes(code),
          ),
        60_000,
      )
      await sleep(8000)
      check(`9 orchestrator woken (${code})`, got)
    }
    const restarts = team
      .starts()
      .slice(s0)
      .filter((s) => s.includes('--resume'))
    note(`restarts for two idle wakes: ${restarts.length}`)
    check(
      '9 how often it restarts: one resume per idle wake',
      restarts.length === 2,
      `${restarts.length} resumes: ${restarts.map((s) => s.slice(0, 80)).join(' | ')}`,
    )
    // A message while it works rides on the turn's end: no restart.
    await takeControl(team)
    await typeIn(p, 'Count from 1 to 60, one number per line, no tools.')
    await sleep(3000)
    const s1 = team.starts().length
    await callAsClaude(team.home(), 'send_message', {
      name: 'corch',
      text: 'reply exactly ORCH-BUSY',
    })
    const busy = await until(
      () =>
        flat(team.transcript(orchId)).some(
          (x) => x.role === 'user' && String(x.text).includes('ORCH-BUSY'),
        ),
      120_000,
    )
    check(
      '9 a message while it works: the followup, no restart',
      busy && team.starts().length === s1,
      `${team.starts().length - s1} new starts`,
    )
    await shot(p, 'alone-orch')
  } finally {
    writeFileSync(join(RUN, 'alone-starts.txt'), team.starts().join('\n'))
    await team.launched.close()
  }
})
