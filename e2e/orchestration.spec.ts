// Plan 34: the orchestration mode. Switched from the header (1.91) and from the project popover
// (1.89); the row menu's block — Orchestrator, Role…, With you — only while it is on;
// switching it off keeps every mark (1.77).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi } from '../src/shared/ipc'
import { launchApp } from './app'
import { CLIENT, clientWork, prepare } from './fixtures'

type PageGlobals = { menkar: MenkarApi }

const SHOTS = '/tmp/menkar-shots'

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, name) })
}

const shown = (page: Page) =>
  page.evaluate(async () => {
    const s = await (globalThis as unknown as PageGlobals).menkar.window.state()
    return s?.projects.find((p) => p.id === s.shown)?.orchestration
  })

const rowMenu = async (page: Page, session: string) => {
  await page.locator(`.row[data-session="${session}"]`).click({ button: 'right' })
  return page.locator('.menu-item')
}

async function launch() {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      return clientWork(dirs)
    },
  })
  return { launched, page: launched.window, root, home }
}

const card = (page: Page) => page.locator('.orch-card')
const cardButton = (page: Page, label: string) =>
  card(page).locator('.responses button', { hasText: label })

// The first time, the switch opens the card; Start with the first session listed marks it. The
// others are left loose, so their rows stay where these tests look for them.
async function startWithFirst(page: Page): Promise<void> {
  await expect(card(page)).toBeVisible()
  for (const box of await card(page).locator('.card-managed:visible input').all())
    await box.uncheck()
  await cardButton(page, 'Start').click()
  await expect(card(page)).toHaveCount(0)
}

test('the header switch: the first time the card, then on and off for the shown project; its word is "Orchestration" (screenshots)', async () => {
  const { launched, page } = await launch()
  try {
    const toggle = page.locator('#orchestration-switch')
    await expect(toggle).toHaveText('Orchestration')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator(`.row[data-session="${CLIENT.login}"]`)).toBeVisible()
    await shot(page, 'orchestration-header-off.png')
    await toggle.click()
    await startWithFirst(page)
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect((await shown(page))?.on).toBe(true)
    await shot(page, 'orchestration-header-on.png')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect((await shown(page))?.on).toBe(false)
    // With an orchestrator marked, no card: straight on.
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(card(page)).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('the popover’s team icon opens the card the first time, then the mode is on and the icon lit (screenshot)', async () => {
  const { launched, page } = await launch()
  try {
    await page.locator('#project-button').click()
    const team = page.locator('.project-row .team-button').first()
    await expect(team).toHaveAttribute('aria-pressed', 'false')
    await team.click()
    await startWithFirst(page)
    await expect(page.locator('#orchestration-switch')).toHaveAttribute('aria-checked', 'true')
    await page.locator('#project-button').click()
    await expect(page.locator('.project-row .team-button.lit')).toHaveCount(1)
    await shot(page, 'orchestration-popover.png')
  } finally {
    await launched.close()
  }
})

test('the row menu’s block sits after Group only while the mode is on; marks are read back and kept through off and on (screenshot)', async () => {
  const { launched, page, root } = await launch()
  try {
    let items = await rowMenu(page, CLIENT.login)
    await expect(items.filter({ hasText: 'Orchestrator' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.locator('#orchestration-switch').click()
    await startWithFirst(page)
    await page.locator('#view-switch .view-team').click()

    items = await rowMenu(page, CLIENT.login)
    const labels = await items.allTextContents()
    const group = labels.findIndex((l) => l.startsWith('Group'))
    // Decision 1.114: the ★ belongs to tasks, so the row menu has no "Priority".
    expect(labels.slice(group + 1, group + 4)).toEqual(['Orchestrator', 'Role…', 'With you'])
    expect(labels).not.toContain('Priority')
    await items.filter({ hasText: /^Orchestrator$/ }).click()
    await expect.poll(async () => (await shown(page))?.orchestrator).toBe(CLIENT.login)

    // Marking another unmarks the first: one orchestrator per project.
    await (await rowMenu(page, CLIENT.api)).filter({ hasText: /^Orchestrator$/ }).click()
    await expect.poll(async () => (await shown(page))?.orchestrator).toBe(CLIENT.api)

    await (await rowMenu(page, CLIENT.long)).filter({ hasText: 'Role…' }).click()
    await page.locator('[role="alertdialog"] input').fill('Fabric expert')
    await page.locator('[role="alertdialog"] button', { hasText: 'Save' }).click()
    await (await rowMenu(page, CLIENT.login)).filter({ hasText: /^With you$/ }).click()
    const marks = {
      on: true,
      orchestrator: CLIENT.api,
      roles: { [CLIENT.long]: 'Fabric expert' },
      withYou: [CLIENT.login],
      parked: [],
      workersCap: null,
    }
    await expect.poll(() => shown(page)).toEqual(marks)

    items = await rowMenu(page, CLIENT.api)
    await expect(items.filter({ hasText: '✓ Orchestrator' })).toHaveCount(1)
    await shot(page, 'orchestration-row-menu.png')
    await page.keyboard.press('Escape')

    await page.locator('#orchestration-switch').click()
    await expect.poll(() => shown(page)).toEqual({ ...marks, on: false })
    const saved = () =>
      JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')).projects[0]
        .orchestration
    await expect.poll(saved).toEqual({
      on: false,
      orchestrator: CLIENT.api,
      roles: { [CLIENT.long]: 'Fabric expert' },
      with_you: [CLIENT.login],
    })
    await page.locator('#orchestration-switch').click()
    await expect.poll(() => shown(page)).toEqual(marks)
  } finally {
    await launched.close()
  }
})

test('the card: its sessions and a new one; "Not now" leaves the mode off; an existing session chosen is marked and the mode on (screenshot)', async () => {
  const { launched, page } = await launch()
  try {
    await page.locator('#orchestration-switch').click()
    await expect(card(page).locator('.heading')).toHaveText('Orchestration mode · Client work')
    await expect(card(page).locator('.card-choice')).toHaveText([
      'abcdefghijklmnopqrstuvwxyz0123456789ABCD',
      'api review',
      'login fix',
      'A new session',
    ])
    await expect(card(page).locator('.card-name')).toHaveValue('orchestrator')
    await expect(cardButton(page, 'Open the guide')).toBeVisible()
    await expect(cardButton(page, 'Copy a prompt for another session')).toBeVisible()
    await shot(page, 'orchestration-card.png')
    await cardButton(page, 'Not now').click()
    await expect(card(page)).toHaveCount(0)
    expect((await shown(page))?.on).toBe(false)

    await page.locator('#orchestration-switch').click()
    await card(page).locator('.card-choice', { hasText: 'api review' }).click()
    await cardButton(page, 'Start').click()
    await expect.poll(() => shown(page)).toMatchObject({ on: true, orchestrator: CLIENT.api })
  } finally {
    await launched.close()
  }
})

// Decision 1.94 (mock G1): the guide opens and the card hides; closing the guide's tab brings the
// card back as it was left; the mode does not move until Start or Not now.
test('the card: "Open the guide" opens Menkar’s guide read only and hides the card; closing the guide brings the card back as it was (screenshot)', async () => {
  const { launched, page } = await launch()
  try {
    await page.locator('#orchestration-switch').click()
    await card(page).locator('.card-choice', { hasText: 'A new session' }).click()
    await card(page).locator('.card-name').fill('lead')
    await cardButton(page, 'Open the guide').click()
    await expect(card(page)).toHaveCount(0)
    await expect(page.locator('.tab.selected')).toHaveText(/orchestration-mode\.md/)
    await expect(page.locator('.file-bar')).toHaveText(
      'This file is part of Menkar: it is read only.',
    )
    await expect(page.locator('.cm-content')).toContainText("Menkar's orchestration mode")
    await expect(page.locator('.file-tab:visible .ask-agent')).toHaveText('Ask an agent')
    expect((await shown(page))?.on).toBe(false)

    await page.locator('.tab.selected .close').click()
    await expect(card(page)).toBeVisible()
    await expect(card(page).locator('input[value="#new"]')).toBeChecked()
    await expect(card(page).locator('.card-name')).toHaveValue('lead')
    expect((await shown(page))?.on).toBe(false)
    await shot(page, 'orchestration-guide-back.png')
    await cardButton(page, 'Not now').click()
    await expect(card(page)).toHaveCount(0)
    expect((await shown(page))?.on).toBe(false)
  } finally {
    await launched.close()
  }
})

test('the card: "A new session" starts a tab named as typed, marked orchestrator, told to load the skill and read the guide first', async () => {
  const { launched, page, home } = await launch()
  try {
    await page.locator('#orchestration-switch').click()
    await card(page).locator('.card-choice', { hasText: 'A new session' }).click()
    await card(page).locator('.card-name').fill('lead')
    await cardButton(page, 'Start').click()
    await expect(page.locator('.tab.selected')).toHaveText(/lead/)
    const argsFile = join(home, 'claude-args.txt')
    const args = () => (existsSync(argsFile) ? readFileSync(argsFile, 'utf8') : '')
    // The orchestration is new: the prompt names Menkar's guide by its absolute path.
    const told =
      /-n lead Load `menkar:orchestrator`\. You are the orchestrator of the project Client work\. Its orchestration is new: read Menkar's guide at (\/\S+\/orchestration-mode\.md) first, then help me configure it\./
    await expect.poll(args).toMatch(told)
    expect(existsSync(told.exec(args())?.[1] ?? '')).toBe(true)
    const id = /--session-id (\S+) -n lead/.exec(args())?.[1]
    await expect.poll(() => shown(page)).toMatchObject({ on: true, orchestrator: id })
  } finally {
    await launched.close()
  }
})

// A team: the orchestrator with two children (one with a tab, one without), an expert on a ★ task,
// a plain session in a group, and three topics, one of the ★ task and one blocking.
const TEAM = {
  orch: 'a0a0a0a0-0000-4000-8000-0000000000a1',
  w1: 'a0a0a0a0-0000-4000-8000-0000000000a2',
  w2: 'a0a0a0a0-0000-4000-8000-0000000000a3',
  expert: 'a0a0a0a0-0000-4000-8000-0000000000a4',
  plain: 'a0a0a0a0-0000-4000-8000-0000000000a5',
} as const
const TEAM_NAMES: Record<keyof typeof TEAM, string> = {
  orch: 'orchestrator',
  w1: 'login worker',
  w2: 'old worker',
  expert: 'fabric',
  plain: 'notes',
}
const TEAM_PROJECT = 'dddddddddddd'

// `split`: the worker with a tab works in another folder, work/lib.
function team(
  dirs: { readonly root: string; readonly home: string },
  split = false,
): Record<string, string> {
  const env = prepare(dirs)
  for (const key of Object.keys(TEAM) as (keyof typeof TEAM)[]) {
    const cwd = join(dirs.home, 'work', split && key === 'w1' ? 'lib' : 'app')
    mkdirSync(cwd, { recursive: true })
    const transcripts = join(dirs.home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'))
    mkdirSync(transcripts, { recursive: true })
    writeFileSync(
      join(transcripts, `${TEAM[key]}.jsonl`),
      `${[
        { type: 'custom-title', customTitle: TEAM_NAMES[key] },
        { type: 'user', cwd, message: { content: `work as ${key}` } },
      ]
        .map((l) => JSON.stringify(l))
        .join('\n')}\n`,
    )
  }
  const config = join(dirs.root, 'config', 'menkar')
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: TEAM_PROJECT,
      projects: [
        {
          id: TEAM_PROJECT,
          name: 'Team',
          members: Object.values(TEAM),
          groups: [{ name: 'writing', color: '#e0b45b', members: [TEAM.plain] }],
          parents: { [TEAM.w1]: TEAM.orch, [TEAM.w2]: TEAM.orch },
          // The Team view, where the rows are; Work is the default (decision 1.112).
          team_view: true,
          orchestration: {
            on: true,
            orchestrator: TEAM.orch,
            roles: { [TEAM.expert]: 'Fabric expert' },
            with_you: [TEAM.plain],
          },
        },
      ],
      windows: [
        {
          current: TEAM_PROJECT,
          tabs: {
            [TEAM_PROJECT]: [
              { panes: [TEAM.orch], orientation: 'horizontal' },
              { panes: [TEAM.w1], orientation: 'horizontal' },
            ],
          },
        },
      ],
    }),
  )
  const topic = (
    number: number,
    title: string,
    from: string,
    blocking: boolean,
    task?: number,
  ) => ({
    number,
    title,
    context: `What to do about ${title.toLowerCase()}.`,
    from,
    blocking,
    ...(task ? { task } : {}),
    status: 'open',
    created: '2026-11-12T10:00:00.000-03:00',
    updated: '2026-11-12T10:00:00.000-03:00',
  })
  writeFileSync(
    join(config, 'topics.json'),
    JSON.stringify({
      version: 1,
      projects: {
        [TEAM_PROJECT]: {
          next: 4,
          topics: [
            topic(1, 'Release date', TEAM.orch, false),
            topic(2, 'Schema of the orders table', TEAM.expert, false, 1),
            topic(3, 'Deploy key missing', TEAM.orch, true),
          ],
        },
      },
    }),
  )
  writeFileSync(
    join(config, 'tasks.json'),
    JSON.stringify({
      version: 1,
      projects: {
        [TEAM_PROJECT]: {
          next: 2,
          tasks: [
            {
              number: 1,
              title: 'Orders schema',
              assignee: TEAM.expert,
              star: true,
              state: 'queued',
              steps: [],
              step: 0,
              note: '',
              created: '2026-11-12T10:00:00.000-03:00',
              updated: '2026-11-12T10:00:00.000-03:00',
            },
          ],
        },
      },
    }),
  )
  return env
}

const listed = (page: Page) =>
  page
    .locator('#session-list > *')
    .evaluateAll((ns) =>
      ns.map((n) =>
        n.classList.contains('row')
          ? `${n.classList.contains('nested') ? '  ' : ''}${n.querySelector('.name')?.textContent}`
          : (n.textContent ?? ''),
      ),
    )

test('in the mode the sidebar shows the team by role and the Topics section on top (screenshots)', async () => {
  const launched = await launchApp({ prepare: (dirs) => team(dirs) })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect
      .poll(() => listed(page))
      .toEqual([
        'orchestrator',
        '  login worker',
        '1 earlier',
        'Consultants',
        '★fabric',
        'Others',
        '●writing',
        'noteswith you',
      ])
    await expect(page.locator('.row', { hasText: 'fabric' }).locator('.role')).toHaveText(
      'Fabric expert',
    )
    await expect(page.locator('.row', { hasText: 'orchestrator' }).locator('.role')).toHaveText(
      'Orchestrator',
    )
    await expect(page.locator('.row', { hasText: 'notes' }).locator('.with-you')).toHaveText(
      'with you',
    )
    // Decisions 1.100 and 1.114: the ★ task's topic first, then the blocking one, then by number.
    await expect(page.locator('.topics-toggle')).toHaveText('Topics · 3')
    await expect(page.locator('.topic-row')).toHaveText([
      '★2Schema of the orders table',
      '3Deploy key missing',
      '1Release date',
    ])
    await expect(page.locator('.topic-row[data-topic="3"] .topic-blocking')).toHaveCount(1)
    await shot(page, 'orchestration-sidebar.png')

    await page.locator('.earlier-row').click()
    await expect.poll(() => listed(page)).toContain('  old worker')
    await page.locator('.topic-row[data-topic="3"]').click()
    await expect(page.locator('.topic-detail')).toContainText(
      'What to do about deploy key missing.',
    )
    await expect(page.locator('.topic-detail')).toContainText('From orchestrator · open')
    await shot(page, 'orchestration-topics-open.png')

    // Collapsed, saved; and with the mode off the ordinary list and no Topics section.
    await page.locator('.topics-toggle').click()
    await expect(page.locator('.topic-row')).toHaveCount(0)
    await page.locator('#orchestration-switch').click()
    await expect(page.locator('#topics-section')).toBeEmpty()
    await expect(page.locator('#session-list .earlier-row')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

// Decision 1.96: a double-click on a topic sets it to "discussing", selects the orchestrator's tab
// and posts to the orchestrator through Claude Code's messaging, as the wakes do.
test('a double-click on a topic: discussing, the orchestrator’s tab selected and told; with no orchestrator running, only discussing (screenshot)', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      const env = team(dirs)
      mkdirSync(join(dirs.home, '.claude', 'sessions'), { recursive: true })
      writeFileSync(
        join(dirs.home, '.claude', 'sessions', '4242.json'),
        JSON.stringify({
          pid: 4242,
          sessionId: TEAM.orch,
          messagingSocketPath: join(dirs.root, 'orch.sock'),
          peerProtocol: 1,
        }),
      )
      return env
    },
  })
  const page = launched.window
  const lines: string[] = []
  const server = createServer((connection) => {
    let data = ''
    connection.on('data', (d) => {
      data += d
    })
    connection.on('end', () => lines.push(...data.split('\n').filter(Boolean)))
  })
  await new Promise<void>((resolve) => server.listen(join(root, 'orch.sock'), resolve))
  const posted = () => lines.map((line) => JSON.parse(line).message.content as string)
  const statusOf = (number: number) =>
    (
      JSON.parse(readFileSync(join(root, 'config', 'menkar', 'topics.json'), 'utf8')).projects[
        TEAM_PROJECT
      ].topics as { number: number; status: string }[]
    ).find((x) => x.number === number)?.status
  const orchTab = page.locator('.tab', { hasText: 'orchestrator' })
  try {
    await expect(page.locator('.tab')).toHaveCount(2)
    await page.locator('.tab', { hasText: 'login worker' }).click()
    await expect(orchTab).not.toHaveClass(/selected/)

    // A single click still only unfolds.
    await page.locator('.topic-row[data-topic="3"]').click()
    await expect(page.locator('.topic-detail')).toContainText('From orchestrator · open')
    expect(statusOf(3)).toBe('open')
    await page.locator('.topic-row[data-topic="3"]').click()

    await page.locator('.topic-row[data-topic="3"]').dblclick()
    await expect.poll(() => statusOf(3)).toBe('discussing')
    await expect(orchTab).toHaveClass(/selected/)
    await expect.poll(posted, { timeout: 15_000 }).toEqual([expect.stringMatching(DISCUSS_3)])
    await page.locator('.topic-row[data-topic="3"]').click()
    await expect(page.locator('.topic-detail')).toContainText('From orchestrator · discussing')
    await shot(page, 'b1-topic-discuss.png')

    // The orchestrator's tab closed: the topic still goes to discussing; nothing is posted.
    await orchTab.locator('.close').click()
    await expect(page.locator('.tab')).toHaveCount(1)
    await page.locator('.topic-row[data-topic="1"]').dblclick()
    await expect.poll(() => statusOf(1)).toBe('discussing')
    await page.waitForTimeout(1500)
    expect(posted()).toEqual([expect.stringMatching(DISCUSS_3)])
  } finally {
    server.close()
    await launched.close()
  }
})

// Every post ends with the local time, so Claude Code keeps two identical ones apart.
const DISCUSS_3 = /^\[Menkar\] The human wants to discuss topic 3 \(\d{2}:\d{2}:\d{2}\)$/

const drawer = (page: Page) => page.locator('.tab-body:not(.hidden) .pane.drawer')
const jumpRows = (page: Page) => page.locator('.jump-row')
const focusInDrawer = (page: Page) =>
  page.evaluate(
    () => document.activeElement?.closest('.pane')?.classList.contains('drawer') ?? false,
  )
const drawerId = (page: Page) =>
  page.evaluate(async () => {
    const s = await (globalThis as unknown as PageGlobals).menkar.window.state()
    return s?.tabs.find((tab) => tab.id === s.selectedTab)?.drawer?.id
  })

test("Ctrl+` in the orchestrator's tab asks which of the team's folders; the last chosen comes first; in a worker's tab, no list (screenshot)", async () => {
  const launched = await launchApp({ prepare: (dirs) => team(dirs, true) })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect
      .poll(() => page.locator('.xterm-rows').allTextContents(), { timeout: 15_000 })
      .toEqual([
        expect.stringContaining('stand-in claude ready'),
        expect.stringContaining('stand-in claude ready'),
      ])
    await page.locator('.tab').first().click()
    await page.locator('.tab-body:not(.hidden) .xterm').click()
    await page.keyboard.press('Control+Backquote')
    await expect(jumpRows(page).locator('.name')).toHaveText(['app', 'lib'])
    await expect(jumpRows(page).locator('.caption')).toHaveText(['~/work/app', '~/work/lib'])
    await expect(jumpRows(page).nth(0)).toHaveClass(/selected/)
    await shot(page, 'orchestration-folders.png')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(drawer(page).locator('.frame-label')).toHaveText('shell · lib')

    await expect.poll(() => focusInDrawer(page)).toBe(true)
    await page.keyboard.type('echo lib-$((40+2))\n')
    await expect(drawer(page).locator('.xterm-rows')).toContainText('lib-42')
    const libId = await drawerId(page)

    // Hidden as today, with no list; asked again, lib comes preselected.
    await page.keyboard.press('Control+Backquote')
    await expect(drawer(page)).toBeHidden()
    await expect(jumpRows(page)).toHaveCount(0)
    await page.locator('.tab-body:not(.hidden) .xterm').first().click()
    await page.keyboard.press('Control+Backquote')
    await expect(jumpRows(page).nth(1)).toHaveClass(/selected/)

    // One shell per folder (decision 1.93): app gets its own; lib's stays alive and comes back.
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')
    await expect(drawer(page).locator('.frame-label')).toHaveText('shell · app')
    const appId = await drawerId(page)
    expect(appId).not.toBe(libId)
    await page.keyboard.press('Control+Backquote')
    await expect(drawer(page)).toBeHidden()
    await page.locator('.tab-body:not(.hidden) .xterm').first().click()
    await page.keyboard.press('Control+Backquote')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(drawer(page).locator('.frame-label')).toHaveText('shell · lib')
    expect(await drawerId(page)).toBe(libId)
    await expect(drawer(page).locator('.xterm-rows')).toContainText('lib-42')
    await page.keyboard.press('Control+Backquote')

    // The worker's tab: no list, its own folder at once.
    await page.locator('.tab').nth(1).click()
    await page.locator('.tab-body:not(.hidden) .xterm').click()
    await page.keyboard.press('Control+Backquote')
    await expect(drawer(page).locator('.frame-label')).toHaveText('shell · lib')
    await expect(jumpRows(page)).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

const paneOf = (page: Page, session: string) =>
  page.evaluate(async (id) => {
    const s = await (globalThis as unknown as PageGlobals).menkar.window.state()
    return s?.tabs.flatMap((tab) => tab.panes).find((p) => p.sessionId === id)?.id ?? ''
  }, session)

// Typed into a pane whose tab is not shown, as main's input path receives it.
const typeInto = (page: Page, pane: string, data: string) =>
  page.evaluate(
    ([id, text]) => (globalThis as unknown as PageGlobals).menkar.panes.input(id, text),
    [pane, data] as const,
  )

const logOf = (root: string) => {
  const file = join(root, 'cache', 'menkar', 'menkar.log')
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}
const sounds = (root: string) =>
  logOf(root)
    .split('\n')
    .filter((l) => l.includes('sound played'))

// Decision 1.104: any session can be muted from its row menu, in any mode: no sound, toast or
// desktop notice; its row shows a muted speaker and its dot still shows the state.
test('Mute in the row menu: the row shows the muted speaker; a blocked state raises no sound or toast, while an unmuted one does (screenshot)', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return { ...clientWork(dirs, { tabs: [['login'], ['api'], ['long']] }), MENKAR_LOG: 'info' }
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(3)
    await expect
      .poll(() => page.locator('.xterm-rows').allTextContents(), { timeout: 15_000 })
      .toEqual(Array(3).fill(expect.stringContaining('stand-in claude ready')))
    const items = await rowMenu(page, CLIENT.login)
    await items.filter({ hasText: /^Mute$/ }).click()
    await expect(page.locator(`.row[data-session="${CLIENT.login}"] .muted-icon`)).toHaveCount(1)
    await expect(page.locator(`.row[data-session="${CLIENT.api}"] .muted-icon`)).toHaveCount(0)
    const saved = () =>
      JSON.parse(readFileSync(join(root, 'config', 'menkar', 'state.json'), 'utf8')).muted
    await expect.poll(saved).toEqual([CLIENT.login])
    await expect((await rowMenu(page, CLIENT.login)).filter({ hasText: /^Unmute$/ })).toHaveCount(1)
    await page.keyboard.press('Escape')

    await page.locator('.tab').nth(2).click()
    await typeInto(page, await paneOf(page, CLIENT.login), 'ASK')
    await expect
      .poll(() => page.locator(`.row[data-session="${CLIENT.login}"] .dot`).getAttribute('class'), {
        timeout: 10_000,
      })
      .toContain('blocked')
    await shot(page, 'mute.png')
    await page.waitForTimeout(1000)
    expect(sounds(root)).toEqual([])
    await expect(page.locator('.toast')).toHaveCount(0)

    // The same blocked state in a session not muted notifies.
    await typeInto(page, await paneOf(page, CLIENT.api), 'ASK')
    await expect.poll(() => sounds(root).length, { timeout: 10_000 }).toBe(1)
    await expect(page.locator('.toast')).toContainText('api review')
  } finally {
    await launched.close()
  }
})

const topicsFile = (root: string) =>
  JSON.parse(readFileSync(join(root, 'config', 'menkar', 'topics.json'), 'utf8')).projects[
    TEAM_PROJECT
  ].topics as { number: number; status: string; seen?: boolean }[]

// Decision 1.103: a new topic notifies as a blocked session does, without sound while another is
// being discussed; its notice's Show opens the orchestrator's tab with the topic unfolded and seen.
test('a new topic raises a toast "Topic N"; with one discussing, a toast and no sound; Show unfolds it and marks it seen', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return { ...team(dirs), MENKAR_LOG: 'info' }
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect
      .poll(() => page.locator('.xterm-rows').allTextContents(), { timeout: 15_000 })
      .toEqual(Array(2).fill(expect.stringContaining('stand-in claude ready')))
    const orch = await paneOf(page, TEAM.orch)
    await typeInto(page, orch, 'TOPIC')
    await expect(page.locator('.toast')).toContainText('Topic 4: Pick a port', { timeout: 15_000 })
    await expect.poll(() => sounds(root).length).toBe(1)
    await expect(page.locator('.topic-row')).toHaveCount(4)

    await page.locator('.topic-row[data-topic="1"]').dblclick()
    await expect.poll(() => topicsFile(root).find((x) => x.number === 1)?.status).toBe('discussing')
    await page.locator('.toast').evaluateAll((ns) => {
      for (const n of ns) n.remove()
    })
    await page.locator('.tab', { hasText: 'login worker' }).click()
    await typeInto(page, orch, 'TOPIC')
    const toast = page.locator('.toast', { hasText: 'Topic 5: Pick a port' })
    await expect(toast).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(1000)
    expect(sounds(root).length).toBe(1)
    expect(topicsFile(root).find((x) => x.number === 5)?.seen).toBeUndefined()

    await toast.locator('button', { hasText: 'Show' }).click()
    await expect(page.locator('.tab', { hasText: 'orchestrator' })).toHaveClass(/selected/)
    await expect(page.locator('.topic-row[data-topic="5"]')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(page.locator('.topic-detail')).toContainText('Which port should the API use?')
    await expect.poll(() => topicsFile(root).find((x) => x.number === 5)?.seen).toBe(true)
    await shot(page, 'topic-notice.png')
  } finally {
    await launched.close()
  }
})

const ESC = String.fromCharCode(27)

// The orchestrator's messaging socket, as the stand-in cannot open one: what Menkar posts to it.
function orchestratorSocket(dirs: { readonly root: string; readonly home: string }): void {
  mkdirSync(join(dirs.home, '.claude', 'sessions'), { recursive: true })
  writeFileSync(
    join(dirs.home, '.claude', 'sessions', '4242.json'),
    JSON.stringify({
      pid: 4242,
      sessionId: TEAM.orch,
      messagingSocketPath: join(dirs.root, 'orch.sock'),
      peerProtocol: 1,
    }),
  )
}

async function listen(root: string): Promise<{ posted: () => string[]; close: () => void }> {
  const lines: string[] = []
  const server = createServer((connection) => {
    let data = ''
    connection.on('data', (d) => {
      data += d
    })
    connection.on('end', () => lines.push(...data.split('\n').filter(Boolean)))
  })
  await new Promise<void>((resolve) => server.listen(join(root, 'orch.sock'), resolve))
  return {
    posted: () => lines.map((line) => JSON.parse(line).message.content as string),
    close: () => server.close(),
  }
}

// Decision 1.101: a session under the orchestrator is read only — main drops what is typed or
// pasted — under a yellow banner; Take control makes it "with you", writable, under a blue one,
// and tells the orchestrator; Back to reporting undoes both; at a permission prompt it is writable.
test('a read-only tab: keys and pastes never reach its agent while its terminal still answers the agent’s queries; Take control lets them through and tells the orchestrator; Back to reporting closes it again (screenshots)', async () => {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = team(dirs)
      orchestratorSocket(dirs)
      return { ...env, FAKE_CLAUDE_QUERY: TEAM.w1 }
    },
  })
  const page = launched.window
  const socket = await listen(root)
  const inputFile = () => join(home, 'claude-input.txt')
  const received = () =>
    existsSync(inputFile())
      ? readFileSync(inputFile(), 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((hex) => Buffer.from(hex, 'hex').toString())
          .join('')
      : ''
  const banner = page.locator('.tab-body:not(.hidden) .pane-banner')
  try {
    await expect
      .poll(() => page.locator('.xterm-rows').allTextContents(), { timeout: 15_000 })
      .toEqual(Array(2).fill(expect.stringContaining('stand-in claude ready')))
    await page.locator('.tab', { hasText: 'login worker' }).click()
    await expect(banner).toHaveClass(/warning/)
    await expect(banner).toContainText('This session reports to the orchestrator.')
    await expect(banner.locator('button')).toHaveText('Take control')
    // The terminal's own reply to the agent's cursor-position query arrives, read only or not.
    await expect.poll(received, { timeout: 10_000 }).toMatch(new RegExp(`${ESC}\\[\\d+;\\d+R`))
    await page.locator('.tab-body:not(.hidden) .xterm').click()
    await page.keyboard.type('typed-while-read-only')
    await page.keyboard.press('Shift+Enter')
    await page.evaluate(() =>
      (globalThis as unknown as PageGlobals).menkar.window.act({
        type: 'copyText',
        text: 'pasted-while-read-only',
      }),
    )
    await page.keyboard.press('Control+Shift+V')
    await page.locator('.tab-body:not(.hidden) .xterm').click({ button: 'right' })
    await expect(page.locator('.menu-item', { hasText: 'Paste' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await page.locator('.tab-body:not(.hidden) .xterm textarea').evaluate((area) => {
      for (const type of ['paste', 'drop'] as const) {
        const data = new DataTransfer()
        data.setData('text/plain', `${type}-event-while-read-only`)
        area.dispatchEvent(
          type === 'paste'
            ? new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
            : new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
        )
      }
    })
    await page.waitForTimeout(800)
    expect(received()).not.toContain('read-only')
    expect(received()).not.toContain('\x1b\r')
    await shot(page, 'banner-yellow.png')

    // The orchestrator's own tab has no banner and takes keys.
    await page.locator('.tab', { hasText: 'orchestrator' }).click()
    await expect(banner).toHaveCount(0)
    await page.locator('.tab-body:not(.hidden) .xterm').click()
    await page.keyboard.type('to-the-orchestrator')
    await expect.poll(received).toContain('to-the-orchestrator')

    await page.locator('.tab', { hasText: 'login worker' }).click()
    await banner.locator('button', { hasText: 'Take control' }).click()
    await expect(banner).toHaveClass(/info/)
    await expect(banner).toContainText('This session is with you.')
    await expect.poll(async () => (await shown(page))?.withYou).toContain(TEAM.w1)
    await page.locator('.tab-body:not(.hidden) .xterm').click()
    await page.keyboard.type('typed-with-you')
    await expect.poll(received).toContain('typed-with-you')
    await expect
      .poll(socket.posted, { timeout: 15_000 })
      .toEqual([
        expect.stringMatching(
          /^\[Menkar\] The human took control of login worker \(\d{2}:\d{2}:\d{2}\)$/,
        ),
      ])
    await shot(page, 'banner-blue.png')

    // At a permission prompt, even handed back, the tab takes keys while it waits.
    await page.keyboard.type('ASK')
    await banner.locator('button', { hasText: 'Back to reporting to the orchestrator' }).click()
    await expect
      .poll(socket.posted, { timeout: 15_000 })
      .toContainEqual(
        expect.stringMatching(
          /^\[Menkar\] The human handed login worker back \(\d{2}:\d{2}:\d{2}\)$/,
        ),
      )
    await expect(banner).toContainText('Waiting for your permission', { timeout: 10_000 })
    await expect(banner).toHaveClass(/warning/)
    await page.locator('.tab-body:not(.hidden) .xterm').click()
    await page.keyboard.type('answer-at-prompt')
    await expect.poll(received).toContain('answer-at-prompt')
  } finally {
    socket.close()
    await launched.close()
  }
})

const parents = (page: Page) =>
  page.evaluate(async () => {
    const s = await (globalThis as unknown as PageGlobals).menkar.window.state()
    return s?.projects.find((p) => p.id === s.shown)?.parents
  })

// Decision 1.102: the row menu hands a session to the orchestrator and takes it back; nothing
// restarts, only who is woken changes — and so its tab turns read only.
test('"Report to the orchestrator" nests a loose session under it and its tab turns read only; "Stop reporting to the orchestrator" makes it loose again', async () => {
  const launched = await launchApp({ prepare: (dirs) => team(dirs) })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(2)
    await page.locator('.row', { hasText: 'fabric' }).dblclick()
    await expect(page.locator('.tab')).toHaveCount(3)
    await expect(page.locator('.tab.selected')).toHaveText(/fabric/)
    await expect(page.locator('.tab-body:not(.hidden) .pane-banner')).toHaveCount(0)
    const items = await rowMenu(page, TEAM.expert)
    await expect(items.filter({ hasText: 'Stop reporting to the orchestrator' })).toHaveCount(0)
    await items.filter({ hasText: 'Report to the orchestrator' }).click()
    await expect.poll(() => parents(page)).toMatchObject({ [TEAM.expert]: TEAM.orch })
    await expect.poll(() => listed(page)).toContain('  ★fabric')
    await expect(page.locator('.tab-body:not(.hidden) .pane-banner')).toContainText(
      'This session reports to the orchestrator.',
    )
    // The orchestrator's own row offers neither.
    const own = await rowMenu(page, TEAM.orch)
    await expect(own.filter({ hasText: /orchestrator/i })).toHaveText(['✓ Orchestrator'])
    await page.keyboard.press('Escape')

    await (await rowMenu(page, TEAM.expert))
      .filter({ hasText: 'Stop reporting to the orchestrator' })
      .click()
    await expect.poll(async () => (await parents(page))?.[TEAM.expert]).toBeUndefined()
    await expect(page.locator('.tab-body:not(.hidden) .pane-banner')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('the card lists the sessions the orchestrator manages, all checked but the one chosen; one unchecked stays loose (screenshot)', async () => {
  const { launched, page } = await launch()
  try {
    await page.locator('#orchestration-switch').click()
    const managed = card(page).locator('.card-managed:visible')
    // The first radio, the long name, orchestrates: it is not listed.
    await expect(managed).toHaveText(['api review', 'login fix'])
    await expect(managed.locator('input:checked')).toHaveCount(2)
    await card(page).locator('.card-choice', { hasText: 'login fix' }).click()
    await expect(managed).toHaveText(['abcdefghijklmnopqrstuvwxyz0123456789ABCD', 'api review'])
    await managed.filter({ hasText: 'api review' }).locator('input').uncheck()
    await shot(page, 'card-managed.png')
    await cardButton(page, 'Start').click()
    await expect.poll(() => shown(page)).toMatchObject({ on: true, orchestrator: CLIENT.login })
    await expect.poll(() => parents(page)).toEqual({ [CLIENT.long]: CLIENT.login })
  } finally {
    await launched.close()
  }
})

// Decisions 1.120 and 1.118: a parked worker shows apart, in a folded "Parked · N" row under the
// orchestrator; unfolded, with what its task waits on.
test('a parked worker: "Parked · 1" under the orchestrator, folded; unfolded, the worker with what its task waits on (screenshot)', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = team(dirs)
      const config = join(dirs.root, 'config', 'menkar')
      const projects = JSON.parse(readFileSync(join(config, 'projects.json'), 'utf8'))
      projects.projects[0].orchestration.parked = [TEAM.w2]
      writeFileSync(join(config, 'projects.json'), JSON.stringify(projects))
      const tasks = JSON.parse(readFileSync(join(config, 'tasks.json'), 'utf8'))
      tasks.projects[TEAM_PROJECT].next = 3
      tasks.projects[TEAM_PROJECT].tasks.push({
        number: 2,
        title: 'Login fix',
        assignee: TEAM.w2,
        star: false,
        state: 'waiting',
        steps: ['read', 'fix', 'open the PR'],
        step: 3,
        note: 'PR open',
        waiting_on: 'the PR review',
        created: '2026-11-12T10:00:00.000-03:00',
        updated: '2026-11-12T10:00:00.000-03:00',
      })
      writeFileSync(join(config, 'tasks.json'), JSON.stringify(tasks))
      return env
    },
  })
  const page = launched.window
  try {
    await expect
      .poll(() => listed(page))
      .toEqual([
        'orchestrator',
        '  login worker',
        'Parked · 1',
        'Consultants',
        '★fabric',
        'Others',
        '●writing',
        'noteswith you',
      ])
    await expect(page.locator('.parked-row')).toHaveAttribute('aria-expanded', 'false')
    await page.locator('.parked-row').click()
    await expect.poll(() => listed(page)).toContain('  old worker')
    const parked = page.locator(`.row[data-session="${TEAM.w2}"]`)
    await expect(parked.locator('.parked-on')).toHaveText('waiting on the PR review')
    await expect(parked.locator('.team-task')).toContainText('Login fix')
    await shot(page, 'parked.png')
  } finally {
    await launched.close()
  }
})

// Decisions 1.121 and 1.122: the cap on workers at once is the project's, asked in the first-time
// card (empty = unlimited) and changed later from a gear beside the popover's mode icon, shown only
// while the mode is on.
test('the cap: the card asks "Workers at once", empty by default; Start with 2 saves it; the gear beside the mode icon, only while on, opens the project’s orchestration settings, where it changes (screenshot)', async () => {
  const { launched, page, root } = await launch()
  const saved = () =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')).projects[0]
      .orchestration
  try {
    await page.locator('#project-button').click()
    await expect(page.locator('.project-row .team-button')).toHaveCount(1)
    await expect(page.locator('.project-row .orch-settings-button')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.locator('#orchestration-switch').click()
    await expect(card(page)).toBeVisible()
    const field = card(page).locator('.cap-field input')
    await expect(field).toHaveValue('')
    await expect(field).toHaveAttribute('placeholder', 'Unlimited')
    await field.fill('2')
    await startWithFirst(page)
    await expect.poll(saved).toMatchObject({ on: true, workers_cap: 2 })

    await page.locator('#project-button').click()
    await expect(page.locator('.project-row .orch-settings-button')).toHaveAttribute(
      'title',
      'Orchestration settings',
    )
    await shot(page, 'orchestration-settings-gear.png')
    await page.locator('.project-row .orch-settings-button').click()
    const dialog = page.locator('[role="alertdialog"]')
    await expect(dialog.locator('.heading')).toHaveText('Orchestration settings of Client work')
    await expect(dialog.locator('.cap-label')).toHaveText('Workers at once')
    await expect(dialog.locator('.cap-field input')).toHaveValue('2')
    await dialog.locator('.cap-field input').fill('3')
    await shot(page, 'orchestration-settings.png')
    await dialog.locator('button', { hasText: 'Save' }).click()
    await expect.poll(saved).toMatchObject({ workers_cap: 3 })
    // The mode did not move.
    expect((await shown(page))?.on).toBe(true)

    await page.locator('#project-button').click()
    await page.locator('.project-row .orch-settings-button').click()
    await dialog.locator('.cap-field input').fill('')
    await dialog.locator('button', { hasText: 'Save' }).click()
    await expect.poll(saved).not.toHaveProperty('workers_cap')
  } finally {
    await launched.close()
  }
})
