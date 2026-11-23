// One OpenCode session from New: its title and first prompt, the screen states (working, the
// Esc steps, the permission and question cards as blocked), a subagent, /new and the picker, and
// the end of Menkar's server.
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  act,
  alive,
  launch,
  noter,
  RUN,
  serves,
  sleep,
  startModel,
  state,
  typeIn,
  typeSlash,
} from './lib'

test('alone: New, screen states, subagent, /new and picker, the server ends', async () => {
  const model = await startModel('alone')
  const app = await launch(model)
  const note = noter('alone')
  const before = serves()
  let killed = false
  try {
    const work = join(app.home(), 'work')
    await act(app.page, {
      type: 'startNew',
      agent: 'opencode',
      folder: work,
      name: 'probe-title',
      prompt: 'SLOW first prompt from New',
    })
    // The first prompt is drawn running, and the title Menkar set is kept.
    await expect(app.page.locator('.xterm-rows:visible')).toContainText(
      'SLOW first prompt from New',
      { timeout: 60_000 },
    )
    const id = await app.session()
    await expect.poll(() => app.tabDot(), { timeout: 10_000 }).toContain('working')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('ack', { timeout: 40_000 })
    await expect
      .poll(() => app.sql(`select title from session_v2 where id='${id}'`))
      .toEqual([['probe-title']])
    // /new sends nothing until a prompt is typed: the first prompt went out once.
    await typeSlash(app.page, '/new')
    await sleep(4000)
    const firsts = model
      .requests()
      .filter((r) => JSON.stringify(r.body.messages ?? []).includes('SLOW first prompt'))
    expect(firsts).toHaveLength(1)
    await app.page.screenshot({ path: join(RUN, 'alone-after-new.png') })

    // The Esc steps.
    await typeIn(app.page, 'SLOW turn for esc')
    await expect.poll(() => app.shownSession(), { timeout: 10_000 }).not.toBe(id)
    const id2 = (await app.shownSession()) ?? ''
    await expect.poll(() => app.rowDot(id2), { timeout: 10_000 }).toContain('working')
    await app.page.keyboard.press('Escape')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('esc again to interrupt')
    expect(await app.rowDot(id2)).toContain('working')
    await app.page.keyboard.press('Escape')
    await expect.poll(() => app.rowDot(id2), { timeout: 10_000 }).toContain('idle')

    // The permission card is blocked; answered, idle.
    await typeIn(app.page, 'RUNTOOL now')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Permission required', {
      timeout: 10_000,
    })
    await expect.poll(() => app.rowDot(id2), { timeout: 10_000 }).toContain('blocked')
    await app.page.screenshot({ path: join(RUN, 'alone-permission.png') })
    await app.page.keyboard.press('Enter')
    await expect.poll(() => app.rowDot(id2), { timeout: 15_000 }).toContain('idle')

    // The question card is blocked; answered, idle.
    await typeIn(app.page, 'ASKQ please')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('enter submit', {
      timeout: 10_000,
    })
    await expect.poll(() => app.rowDot(id2), { timeout: 10_000 }).toContain('blocked')
    await app.page.screenshot({ path: join(RUN, 'alone-question.png') })
    await app.page.keyboard.press('Enter')
    await expect.poll(() => app.rowDot(id2), { timeout: 15_000 }).toContain('idle')

    // A subagent: the root reads working from the post to its end, with one change.
    const seen: string[] = []
    await typeIn(app.page, 'SUBAGENT go')
    for (let i = 0; i < 60; i++) {
      const d = (await app.rowDot(id2)) ?? ''
      if (seen.at(-1) !== d) seen.push(d)
      await sleep(200)
    }
    note(`subagent: the root's dot went ${JSON.stringify(seen)}`)
    expect(seen.filter((d) => d.includes('working'))).toHaveLength(1)
    expect(seen.at(-1)).toContain('idle')
    expect(app.sql(`select count(*) from session_v2 where parent_id='${id2}'`)).toEqual([[1]])

    // The picker (Ctrl+X L) brings the pane back to the first session.
    await app.focus()
    await app.page.keyboard.press('Control+x')
    await sleep(300)
    await app.page.keyboard.press('l')
    await sleep(1500)
    await app.page.keyboard.type('probe-title', { delay: 50 })
    await sleep(1000)
    await app.page.keyboard.press('Enter')
    await expect.poll(() => app.shownSession(), { timeout: 10_000 }).toBe(id)

    // The last tab closed: no server. Reopened and Menkar SIGKILLed: no server.
    const mine = serves().filter((l) => !before.includes(l))
    expect(mine).toHaveLength(1)
    const pid = Number(mine[0]?.split(' ')[0])
    await act(app.page, { type: 'closeTab', tab: (await state(app.page)).tabs[0]?.id, force: true })
    await expect.poll(() => alive(pid), { timeout: 10_000 }).toBe(false)
    await act(app.page, { type: 'openSession', session: id })
    await expect
      .poll(() => serves().filter((l) => !before.includes(l)), { timeout: 20_000 })
      .toHaveLength(1)
    const pid2 = Number(
      serves()
        .filter((l) => !before.includes(l))[0]
        ?.split(' ')[0],
    )
    process.kill(app.launched.app.process().pid ?? 0, 'SIGKILL')
    killed = true
    await expect.poll(() => alive(pid2), { timeout: 15_000 }).toBe(false)
  } finally {
    if (!killed) await app.launched.close()
    // A killed app could not remove its own throwaway folder.
    else rmSync(app.root(), { recursive: true, force: true })
    model.process.kill()
  }
})
