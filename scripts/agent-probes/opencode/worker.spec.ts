// An OpenCode worker of a Claude orchestrator (the e2e Claude stand-in): Menkar's tools listed
// directly with no card, load_skill, a team update mid-turn, a wake behind a permission card, and
// the folder mount reaching a mode-off session in the same folder (as designed, decision 1.141).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  act,
  callAsClaude,
  launch,
  noter,
  RUN,
  sleep,
  startModel,
  state,
  textOf,
  typeIn,
} from './lib'

const WORKER = 'client-work-t1'

test('worker: tools, load_skill, a team update mid-turn, a wake behind a card', async () => {
  const model = await startModel('worker')
  const app = await launch(model, { orchestration: true })
  const note = noter('worker')
  const sees = (text: string) => model.requests().some((r) => JSON.stringify(r.body).includes(text))
  try {
    const work = join(app.home(), 'work')
    const skill = join(work, '.claude', 'skills', 'probe-role')
    mkdirSync(skill, { recursive: true })
    writeFileSync(
      join(skill, 'SKILL.md'),
      '---\nname: probe-role\ndescription: PROBE-ROLE a stored role skill.\n---\nPROBE-ROLE-BODY\n',
    )
    await act(app.page, {
      type: 'startNew',
      agent: 'claude',
      folder: work,
      name: 'orch',
      orchestrator: true,
    })
    await expect
      .poll(() => existsSync(join(app.home(), 'claude-args.txt')), { timeout: 20_000 })
      .toBe(true)
    await sleep(2000)
    expect(await callAsClaude(app.home(), 'task_add', { title: 'build' })).toContain('Task 1 added')
    await callAsClaude(app.home(), 'start_session', {
      agent: 'opencode',
      task: 1,
      prompt: 'SLOW build CALL:glob {"pattern":"*"}',
    })
    await expect
      .poll(() => app.sql('select id from session_v2 where parent_id is null'), { timeout: 20_000 })
      .toHaveLength(1)
    const id = String(app.sql('select id from session_v2 where parent_id is null')[0]?.[0])

    // Its first request: Menkar's tools by name, the team entry naming load_skill.
    await expect.poll(() => sees('SLOW build'), { timeout: 15_000 }).toBe(true)
    const first = model
      .requests()
      .find((r) => JSON.stringify(r.body.messages ?? []).includes('SLOW build'))
    const tools = (first?.body.tools ?? []).map((t) => t.function.name)
    expect(tools).toEqual(
      expect.arrayContaining(['menkar_load_skill', 'menkar_send_message', 'menkar_task_review']),
    )
    const entry =
      /<context key="menkar\.team">([\s\S]*?)<\/context>/.exec(
        textOf(first?.body.messages?.[0]?.content),
      )?.[1] ?? ''
    expect(entry).toContain(WORKER)
    expect(entry).toContain('load_skill')

    // A team update during the turn reaches its next step, in the same execution.
    const t = Date.now()
    expect(
      await act(app.page, {
        type: 'configureRole',
        session: id,
        label: 'builder',
        skills: [{ name: 'probe-role' }],
      }),
    ).toEqual({})
    await expect
      .poll(
        () =>
          model
            .requests()
            .some((r) => r.t > t && JSON.stringify(r.body).includes('changed and supersedes')),
        { timeout: 30_000 },
      )
      .toBe(true)
    await sleep(3000)
    const rows = app
      .sql(
        `select type from session_message where session_id='${id}' and type in ('user','system','idle') order by seq`,
      )
      .map((r) => r[0])
    note(`team update: rows ${JSON.stringify(rows)}`)
    expect(rows).toEqual(['user', 'system', 'idle'])

    // A tool of Menkar's runs with no card; load_skill gives the skill's text.
    await callAsClaude(app.home(), 'send_message', {
      name: WORKER,
      text: 'CALL:menkar_task_list {}',
    })
    await expect.poll(() => sees('build · client-work-t1'), { timeout: 20_000 }).toBe(true)
    await callAsClaude(app.home(), 'send_message', {
      name: WORKER,
      text: 'CALL:menkar_load_skill {"name":"probe-role"}',
    })
    await expect.poll(() => sees('PROBE-ROLE-BODY'), { timeout: 20_000 }).toBe(true)

    // A wake sent while a permission card is up waits; the card is never answered for the human.
    await app.page
      .locator('.team-fold')
      .first()
      .click({ timeout: 3000 })
      .catch(() => undefined)
    await app.page.locator(`.row[data-session="${id}"]`).click()
    const take = app.page.locator('.pane-banner button:visible', { hasText: 'Take control' })
    if (await take.count()) await take.click()
    await typeIn(app.page, 'RUNTOOL from the worker')
    await expect(app.page.locator('.xterm-rows:visible')).toContainText('Permission required', {
      timeout: 15_000,
    })
    await callAsClaude(app.home(), 'send_message', { name: WORKER, text: 'WAKE during the card' })
    await sleep(15_000)
    expect(await app.screen()).toContain('Permission required')
    expect(existsSync(join(work, 'b.txt'))).toBe(false)
    expect(sees('WAKE during the card')).toBe(false)
    await app.page.screenshot({ path: join(RUN, 'worker-card.png') })
    await app.page.keyboard.press('Enter')
    await expect.poll(() => existsSync(join(work, 'b.txt')), { timeout: 15_000 }).toBe(true)
    await expect.poll(() => sees('WAKE during the card'), { timeout: 20_000 }).toBe(true)

    // A mode-off session in the same folder sees Menkar's tools too (1.141: one mount per folder).
    await act(app.page, { type: 'createProject', name: 'Mode off' })
    const project = (await state(app.page)).projects?.find((p) => p.name === 'Mode off')
    await act(app.page, { type: 'switchProject', project: project?.id })
    await act(app.page, {
      type: 'startNew',
      agent: 'opencode',
      folder: work,
      name: 'probe-off',
      prompt: 'modeoff hello',
    })
    await expect.poll(() => sees('modeoff hello'), { timeout: 20_000 }).toBe(true)
    const off = model
      .requests()
      .find((r) => JSON.stringify(r.body.messages ?? []).includes('modeoff hello'))
    const offTools = (off?.body.tools ?? []).map((x) => x.function.name)
    note(
      `mode-off session in the mounted folder: ${offTools.filter((x) => x.startsWith('menkar_')).length} menkar_* tools, entry ${/<context key=/.test(textOf(off?.body.messages?.[0]?.content))}`,
    )
    expect(/<context key=/.test(textOf(off?.body.messages?.[0]?.content))).toBe(false)
  } finally {
    await app.launched.close()
    model.process.kill()
  }
})
