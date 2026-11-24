// The waker of a real Cursor worker (both items on), with waits on the hook log rather than the
// dot: a team update held, an idle wake by hangup and resume carrying it, a draft waited out, and
// /new and /resume followed by the tab.
import { readdirSync, writeFileSync } from 'node:fs'
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
  shownState,
  sleep,
  startWorker,
  takeControl,
  typeIn,
  WORKER,
} from './lib'

const results: string[] = []
function check(name: string, ok: boolean, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  results.push(line)
  writeFileSync(join(RUN, 'waker-results.txt'), `${results.join('\n')}\n`)
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

test('waker', async () => {
  const team = await launchTeam()
  const note = noter('waker')
  const p = team.page
  // Idle: the hook log's last line a stop at least 10 s old.
  const idle = () =>
    until(() => {
      const last = team.hookLog().at(-1)
      return !!last && last.event === 'stop' && Date.now() / 1000 - Number(last.at) > 10
    }, 180_000)
  const users = (id: string) =>
    flat(team.transcript(id))
      .filter((x) => x.role === 'user')
      .map((x) => String(x.text))
  const trace = async (label: string) => {
    const last = team.hookLog().at(-1)
    const lines = (await team.screen())
      .split('\n')
      .filter((l) => l.trim())
      .slice(-4)
      .join(' ⏎ ')
    note(
      `${label}: starts ${team.starts().length}, held ${team.held().length}, last hook ${last?.event}/${last?.status ?? ''}@${String(last?.at).slice(-6)}, users ${team.transcript ? flat(team.transcript(idRef)).filter((x) => x.role === 'user').length : 0}, screen: ${lines.slice(0, 220)}`,
    )
  }
  let idRef = ''
  const watch = async (label: string, until2: () => boolean, ms: number) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      await trace(label)
      if (until2()) return true
      await sleep(5000)
    }
    return false
  }
  try {
    const prefs = await openPrefs(team)
    await prefs.locator('[data-key="agent-item-cursor-hooks"]').check()
    await prefs.locator('[data-key="agent-item-cursor-allow"]').check()
    await sleep(1500)
    await prefs.close()
    const id = await startWorker(team, 'Say OK.')
    idRef = id
    await until(async () => (await team.screen()).includes('Trust this workspace'), 20_000)
    await takeControl(team)
    await p.locator('.xterm:visible .xterm-helper-textarea').first().focus()
    await p.keyboard.press('a')
    await idle()

    // A team update while idle is held.
    await act(p, { type: 'configureRole', session: id, label: 'builder', skills: [] })
    await sleep(3000)
    const heldRole = team.held().length
    note(`held after configureRole: ${heldRole}; starts ${team.starts().length}`)

    // An idle worker, empty box: hangup and resume, the update with the message.
    const s0 = team.starts().length
    await callAsClaude(team.home(), 'send_message', {
      name: WORKER,
      text: 'reply exactly IDLE-WAKE',
    })
    const resumed = await until(() => team.starts().length > s0, 40_000)
    const seen = await watch(
      'after idle send',
      () => users(id).some((u) => u.includes('IDLE-WAKE')),
      240_000,
    )
    await shot(p, 'waker-after-idle')
    const wake = users(id).find((u) => u.includes('IDLE-WAKE')) ?? ''
    writeFileSync(join(RUN, 'wake-prompt.txt'), wake)
    note(`resume start: ${team.starts().slice(s0).join(' / ').slice(0, 200)}`)
    check(
      '5 idle worker, empty box: hangup and resume with the text',
      resumed &&
        seen &&
        team
          .starts()
          .slice(s0)
          .some((s) => s.startsWith(`--resume ${id}`)),
      `resumed ${resumed}, seen ${seen}`,
    )
    check(
      '6 a team update held, handed over with the next wake',
      heldRole > 0 && wake.includes('builder'),
      wake.slice(0, 160),
    )
    await idle()

    // A draft in the box: the message waits, the draft is kept; then the box emptied.
    await takeControl(team)
    await typeIn(p, 'half a thought', false)
    await sleep(1500)
    const s1 = team.starts().length
    await callAsClaude(team.home(), 'send_message', {
      name: WORKER,
      text: 'reply exactly DRAFT-WAIT',
    })
    await watch('draft wait', () => false, 15_000)
    const scr = await team.screen()
    const heldDraft = team.held().length
    check(
      '5 a draft in the box: kept, nothing typed, the message waits',
      scr.includes('half a thought') &&
        team.starts().length === s1 &&
        heldDraft > 0 &&
        !users(id).some((u) => u.includes('DRAFT-WAIT')),
      `held ${heldDraft}, new starts ${team.starts().length - s1}`,
    )
    await p.locator('.xterm:visible .xterm-helper-textarea').first().focus()
    await p.keyboard.press('Control+u')
    const went = await watch(
      'after ctrl-u',
      () => users(id).some((u) => u.includes('DRAFT-WAIT')),
      240_000,
    )
    check(
      '5 once the box is empty, the held message goes (by resume)',
      went && team.starts().length > s1,
      `new starts ${team.starts().length - s1}`,
    )
    await idle()

    // /new, then /resume: the tab follows.
    await takeControl(team)
    await typeIn(p, '/new')
    await sleep(3000)
    await typeIn(p, 'Say OK new.')
    let newId = ''
    await until(() => {
      newId = readdirSync(team.transcriptsDir()).find((d) => d !== id) ?? ''
      return newId !== ''
    }, 60_000)
    await trace('after /new turn')
    const followedNew = await until(
      async () =>
        (await shownState(p)).tabs.some((t) => t.panes.some((x) => x.sessionId === newId)),
      60_000,
    )
    check('7 /new followed by the tab', followedNew, `new ${newId}`)
    await idle()
    await typeIn(p, '/resume')
    await sleep(3000)
    writeFileSync(join(RUN, 'screen-resume-picker.txt'), await team.screen())
    await p.keyboard.press('ArrowDown')
    await sleep(600)
    await p.keyboard.press('Enter')
    await sleep(4000)
    await typeIn(p, 'Say OK back.')
    const followedOld = await until(
      async () => (await shownState(p)).tabs.some((t) => t.panes.some((x) => x.sessionId === id)),
      60_000,
    )
    check('7 /resume followed by the tab', followedOld)
    await shot(p, 'waker-end')
  } finally {
    writeFileSync(join(RUN, 'waker-starts.txt'), team.starts().join('\n'))
    if (idRef)
      writeFileSync(
        join(RUN, 'waker-transcript.json'),
        JSON.stringify(flat(team.transcript(idRef)), null, 1),
      )
    writeFileSync(
      join(RUN, 'waker-hooklog.jsonl'),
      team
        .hookLog()
        .map((l) => JSON.stringify(l))
        .join('\n'),
    )
    await team.launched.close()
  }
})
