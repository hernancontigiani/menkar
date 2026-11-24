// A real Cursor worker of the Claude stand-in orchestrator, with Cursor's two integrations items on:
// the start, the trust prompt, the block, the tools with no card, a skill, the hook records, the
// waker (followup, multi-line, idle resume, draft), a team update, /summarize, /new and /resume,
// last_reply and Usage; then both items off, the user's files as they were.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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
  SERVER,
  shot,
  shownState,
  sleep,
  startWorker,
  takeControl,
  typeIn,
  usageToday,
  WORKER,
} from './lib'

const results: string[] = []
function check(name: string, ok: boolean, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  results.push(line)
  writeFileSync(join(RUN, 'worker-results.txt'), `${results.join('\n')}\n`)
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

test('worker with both items', async () => {
  const team = await launchTeam({ userFiles: true })
  const note = noter('worker')
  const p = team.page
  const hooksFile = join(team.home(), '.cursor', 'hooks.json')
  const cfgFile = join(team.root(), 'config', 'cursor', 'cli-config.json')
  try {
    // --- The two items on: only Menkar's part added.
    const hooksBefore = readFileSync(hooksFile, 'utf8')
    const cfgBefore = JSON.parse(readFileSync(cfgFile, 'utf8'))
    const prefs = await openPrefs(team)
    await prefs.locator('[data-key="agent-item-cursor-hooks"]').check()
    await prefs.locator('[data-key="agent-item-cursor-allow"]').check()
    await sleep(1500)
    const hooksOn = readFileSync(hooksFile, 'utf8')
    const cfgOn = JSON.parse(readFileSync(cfgFile, 'utf8'))
    writeFileSync(join(RUN, 'hooks-on.json'), hooksOn)
    writeFileSync(join(RUN, 'cli-config-on.json'), JSON.stringify(cfgOn, null, 2))
    const userHookKept = hooksOn.includes('"afterFileEdit": [ { "command": "true" } ]')
    check('hooks item: user hook kept byte for byte', userHookKept)
    const hj = JSON.parse(hooksOn)
    const events = Object.keys(hj.hooks).sort()
    check(
      'hooks item: Menkar adds its three turn events',
      ['afterAgentResponse', 'beforeSubmitPrompt', 'stop'].every((e) =>
        JSON.stringify(hj.hooks[e] ?? []).includes('cursor-hook.js'),
      ),
      events.join(','),
    )
    const added = (cfgOn.permissions?.allow ?? []).filter(
      (a: string) => !(cfgBefore.permissions?.allow ?? []).includes(a),
    )
    check(
      'allow item: only Menkar entries added, user allow/deny kept',
      added.every((a: string) => a.includes(SERVER)) &&
        added.length > 0 &&
        JSON.stringify(cfgOn.permissions.deny) === JSON.stringify(cfgBefore.permissions.deny) &&
        (cfgOn.permissions.allow as string[]).includes('Shell(ls)'),
      JSON.stringify(added),
    )
    await prefs.close()

    // --- 1. The worker started by start_session.
    const P1 =
      'Do these three things in order. 1) In one line, state your session name and your orchestrator’s name exactly as your team instructions give them. 2) Call Menkar’s task_steps tool for task 1 with steps a, b, c. 3) Load the skill named worker by reading its SKILL.md file, and quote its first heading line.'
    const id = await startWorker(team, P1)
    note(`worker ${id}; start: ${team.starts().at(-1)}`)
    const start = team.starts().find((s) => s.includes('--new-session-id')) ?? ''
    check(
      '1 start: --new-session-id, --add-dir, --plugin-dir, -- prompt',
      /--new-session-id \S+ --add-dir .+ --plugin-dir \S+ -- /.test(start),
      start.slice(0, 200),
    )

    // --- 2. The trust prompt, read as blocked.
    const trustShown = await until(
      async () =>
        (await team.screen()).includes('Trust this workspace') ||
        ((await p.locator('.xterm-rows:visible').count()) > 0 &&
          (await team.screen()).includes('Workspace Trust')),
      20_000,
    )
    await until(async () => String(await team.dot(id)).includes('blocked'), 15_000)
    const dotAtTrust = await team.dot(id)
    note(`trust shown on screen: ${trustShown}; dot: ${dotAtTrust}`)
    await shot(p, '02-trust')
    writeFileSync(join(RUN, 'screen-trust.txt'), await team.screen())
    check(
      '2 trust prompt read as blocked',
      String(dotAtTrust).includes('blocked'),
      String(dotAtTrust),
    )
    await takeControl(team)
    await p.locator('.xterm:visible .xterm-helper-textarea').first().focus()
    await p.keyboard.press('a')
    const firstStop = await until(
      () => team.hookLog().some((l) => l.event === 'stop' && l.session_id === id),
      150_000,
    )
    await sleep(3000)
    check(
      '4 hook program recorded the first turn',
      firstStop,
      JSON.stringify(team.hookLog()).slice(0, 300),
    )
    const t1 = flat(team.transcript(id))
    writeFileSync(join(RUN, 'transcript-1.json'), JSON.stringify(t1, null, 1))
    const text1 = t1
      .filter((x) => x.role === 'assistant' && x.text)
      .map((x) => x.text)
      .join('\n')
    check('1 block obeyed: names itself', text1.includes(WORKER), text1.slice(0, 200))
    check('1 block obeyed: names its orchestrator (orch)', /orch/.test(text1), '')
    const dyn = t1.filter((x) => x.tool === 'GetDynamicTools' || x.tool === 'CallDynamicTool')
    check(
      `1 deferred tools found on ${SERVER}`,
      dyn.some((x) => JSON.stringify(x.input).includes(SERVER)) &&
        dyn.some((x) => x.tool === 'CallDynamicTool'),
      JSON.stringify(dyn).slice(0, 300),
    )
    const reads = t1.filter((x) => x.tool === 'Read').map((x) => JSON.stringify(x.input))
    check(
      '1 skill loaded by its SKILL.md',
      reads.some((r) => r.includes('SKILL.md')),
      reads.join(' '),
    )
    check(
      '3 with the allow item: no card for Menkar tools',
      !(await team.screen()).includes('Run this MCP tool?'),
    )
    const tl = await callAsClaude(team.home(), 'task_list', {})
    check('1 task_steps reached Menkar', /1\/3|3 steps/.test(tl), tl.slice(0, 200))

    // --- 4. The hook records: no email; Esc mid-turn gives one record.
    const files = readdirSync(team.cache(), { recursive: true })
      .map((f) => join(team.cache(), String(f)))
      .filter((f) => {
        try {
          return statSync(f).isFile()
        } catch {
          return false
        }
      })
    const withEmail = files.filter((f) => {
      try {
        return /@[a-z0-9-]+\.[a-z]/i.test(readFileSync(f, 'utf8')) && f.includes('cursor')
      } catch {
        return false
      }
    })
    check(
      '4 no file of Menkar’s with the account’s email',
      withEmail.length === 0,
      withEmail.join(' '),
    )
    writeFileSync(
      join(RUN, 'hooklog-1.jsonl'),
      team
        .hookLog()
        .map((l) => JSON.stringify(l))
        .join('\n'),
    )
    const before = team.hookLog().length
    await typeIn(p, 'Write a 200-line poem about rivers, one line at a time, no tools.')
    await until(async () => String(await team.dot(id)).includes('working'), 15_000)
    await sleep(3000)
    await p.keyboard.press('Escape')
    let stopped = await until(() => team.hookLog().length > before + 1, 10_000)
    let how = 'Esc'
    if (!stopped) {
      await p.keyboard.press('Control+c')
      how = 'Ctrl+C (Esc did not stop it)'
      stopped = await until(() => team.hookLog().length > before + 1, 15_000)
    }
    await sleep(3000)
    const after = team.hookLog().slice(before)
    note(`interrupt by ${how}: ${JSON.stringify(after)}`)
    check(
      '4 an interrupted turn gives one turn record',
      after.filter((l) => l.event === 'stop').length === 1,
      `${how}: ${JSON.stringify(after)}`,
    )
    // The interrupted prompt comes back into the box; empty it as the human would.
    await p.keyboard.press('Control+u')
    await sleep(1000)

    // --- 5. The waker: a message during a turn rides on the followup; then a multi-line one.
    await typeIn(p, 'Count from 1 to 60, one number per line, no tools.')
    await until(async () => String(await team.dot(id)).includes('working'), 15_000)
    const sentAt = Date.now()
    const r1 = await callAsClaude(team.home(), 'send_message', {
      name: WORKER,
      text: 'reply exactly ACK-FOLLOW',
    })
    note(`send_message during turn: ${r1}; held ${team.held().length}`)
    const fuSeen = await until(
      () =>
        flat(team.transcript(id)).some(
          (x) => x.role === 'user' && String(x.text).includes('ACK-FOLLOW'),
        ),
      120_000,
    )
    const stops = team.hookLog().filter((l) => l.event === 'stop' && l.session_id === id)
    note(
      `followup seen ${fuSeen} after ${Date.now() - sentAt} ms; stops ${JSON.stringify(stops.slice(-3))}`,
    )
    check(
      '5 a message during a turn arrives as the followup (no restart)',
      fuSeen && team.starts().filter((s) => s.includes('--resume')).length === 0,
      `${team.starts().length} starts`,
    )
    await until(async () => !String(await team.dot(id)).includes('working'), 60_000)
    await sleep(2000)
    const MULTI =
      'reply exactly the code on the last line.\n"double" \'single\' `back` $VAR\nCode: MULTI-77'
    await typeIn(p, 'Count from 1 to 40, one number per line, no tools.')
    await until(async () => String(await team.dot(id)).includes('working'), 15_000)
    await callAsClaude(team.home(), 'send_message', { name: WORKER, text: MULTI })
    const whole = await until(
      () =>
        flat(team.transcript(id)).some((x) => x.role === 'user' && String(x.text).includes(MULTI)),
      120_000,
    )
    check('5 a multi-line message arrives whole', whole)
    await until(async () => !String(await team.dot(id)).includes('working'), 60_000)
    await sleep(3000)

    // --- 6. A team update held, handed over with the next wake.
    const roleSet = await act(p, {
      type: 'configureRole',
      session: id,
      label: 'builder',
      skills: [],
    })
    note(`configureRole: ${JSON.stringify(roleSet)}; held ${team.held().length}`)
    await sleep(2000)
    const heldAfterRole = team.held().length
    // --- 5. Idle worker, empty box: hangup and resume with the text.
    const startsBefore = team.starts().length
    await callAsClaude(team.home(), 'send_message', {
      name: WORKER,
      text: 'reply exactly IDLE-WAKE',
    })
    const resumed = await until(() => team.starts().length > startsBefore, 30_000)
    const idleSeen = await until(
      () =>
        flat(team.transcript(id)).some(
          (x) => x.role === 'user' && String(x.text).includes('IDLE-WAKE'),
        ),
      120_000,
    )
    const resumeLine = team.starts().at(-1) ?? ''
    check(
      '5 an idle worker with an empty box: hangup and resume with the text',
      resumed && idleSeen && resumeLine.includes(`--resume ${id}`),
      resumeLine.slice(0, 200),
    )
    const wakeText = flat(team.transcript(id))
      .filter((x) => x.role === 'user' && String(x.text).includes('IDLE-WAKE'))
      .map((x) => x.text)
      .join('')
    check(
      '6 the team update held, handed over with the next wake',
      heldAfterRole > 0 && /builder/.test(wakeText),
      `held after role ${heldAfterRole}; wake text: ${wakeText.slice(0, 300)}`,
    )
    await until(async () => !String(await team.dot(id)).includes('working'), 60_000)
    await sleep(3000)
    await takeControl(team)

    // --- 5. A draft in the box: the message waits, the draft is kept.
    await typeIn(p, 'half a thought', false)
    await sleep(1000)
    const s2 = team.starts().length
    await callAsClaude(team.home(), 'send_message', {
      name: WORKER,
      text: 'reply exactly DRAFT-WAIT',
    })
    await sleep(12_000)
    const screenDraft = await team.screen()
    check(
      '5 a draft in the box: kept, the message waits',
      screenDraft.includes('half a thought') &&
        team.starts().length === s2 &&
        team.held().length > 0,
      `held ${team.held().length}, starts ${team.starts().length - s2}`,
    )
    await p.locator('.xterm:visible .xterm-helper-textarea').first().focus()
    await p.keyboard.press('Control+u')
    const draftDelivered = await until(
      () =>
        flat(team.transcript(id)).some(
          (x) => x.role === 'user' && String(x.text).includes('DRAFT-WAIT'),
        ),
      120_000,
    )
    check('5 once the box is empty, the held message goes', draftDelivered)
    await until(async () => !String(await team.dot(id)).includes('working'), 60_000)
    await sleep(3000)
    await takeControl(team)

    // --- 6. /summarize on the resumed pane: the whole block told again.
    const userBefore = flat(team.transcript(id)).filter((x) => x.role === 'user').length
    await typeIn(p, '/summarize')
    await sleep(40_000)
    const afterSum = flat(team.transcript(id))
      .filter((x) => x.role === 'user')
      .slice(userBefore)
    writeFileSync(join(RUN, 'after-summarize.json'), JSON.stringify(afterSum, null, 1))
    check(
      '6 after /summarize on a resumed pane, the whole block told again',
      afterSum.some(
        (x) => String(x.text).includes(WORKER) && String(x.text).includes('GetDynamicTools'),
      ),
      afterSum.map((x) => String(x.text).slice(0, 120)).join(' | '),
    )
    await sleep(5000)

    // --- 8. last_reply and Usage.
    const lr = await callAsClaude(team.home(), 'last_reply', { name: WORKER })
    note(`last_reply: ${lr.slice(0, 300)}`)
    const lastAssistant =
      flat(team.transcript(id))
        .filter((x) => x.role === 'assistant' && x.text)
        .at(-1)?.text ?? ''
    check(
      '8 last_reply from the rewritten transcript',
      lr.includes(lastAssistant.slice(0, 20).trim()),
      `${lr.slice(0, 120)} vs ${lastAssistant.slice(0, 60)}`,
    )
    const usage = await usageToday(p)
    writeFileSync(join(RUN, 'usage.json'), JSON.stringify(usage, null, 1))
    const u = JSON.stringify(usage)
    check(
      '8 Usage has the session with turns and tokens',
      u.includes(id) || u.includes(WORKER),
      u.slice(0, 300),
    )

    // --- 7. /new and /resume followed by the tab.
    await takeControl(team)
    await typeIn(p, '/new')
    await sleep(3000)
    await typeIn(p, 'Say OK new.')
    const newId = await (async () => {
      for (let i = 0; i < 60; i++) {
        const dirs = readdirSync(team.transcriptsDir()).filter((d) => d !== id)
        if (dirs.length) return dirs[0] ?? ''
        await sleep(1000)
      }
      return ''
    })()
    await sleep(8000)
    const panes = (await shownState(p)).tabs.flatMap((t) => t.panes.map((x) => x.sessionId))
    check(
      '7 /new followed by the tab',
      newId !== '' && panes.includes(newId),
      `new ${newId}; panes ${panes}`,
    )
    await typeIn(p, '/resume')
    await sleep(3000)
    writeFileSync(join(RUN, 'screen-resume.txt'), await team.screen())
    // The picker lists the newest first: the old chat is the second row.
    await p.keyboard.press('ArrowDown')
    await sleep(500)
    await p.keyboard.press('Enter')
    await sleep(4000)
    await typeIn(p, 'Say OK back.')
    await sleep(15_000)
    const panes2 = (await shownState(p)).tabs.flatMap((t) => t.panes.map((x) => x.sessionId))
    check('7 /resume followed by the tab', panes2.includes(id), `panes ${panes2}`)
    await shot(p, '07-after-resume')

    // --- Both items off: the user's files as they were.
    const prefs2 = await openPrefs(team)
    await prefs2.locator('[data-key="agent-item-cursor-hooks"]').uncheck()
    await prefs2.locator('[data-key="agent-item-cursor-allow"]').uncheck()
    await sleep(1500)
    await prefs2.close()
    const hooksOff = readFileSync(hooksFile, 'utf8')
    const cfgOff = JSON.parse(readFileSync(cfgFile, 'utf8'))
    check(
      'hooks item removed: hooks.json byte-identical to the user’s',
      hooksOff === hooksBefore,
      hooksOff.slice(0, 200),
    )
    check(
      'allow item removed: permissions as the user had them',
      JSON.stringify(cfgOff.permissions) === JSON.stringify(cfgBefore.permissions),
      JSON.stringify(cfgOff.permissions),
    )
  } finally {
    writeFileSync(join(RUN, 'starts.txt'), team.starts().join('\n'))
    writeFileSync(
      join(RUN, 'hooklog.jsonl'),
      team
        .hookLog()
        .map((l) => JSON.stringify(l))
        .join('\n'),
    )
    await team.launched.close()
  }
})
