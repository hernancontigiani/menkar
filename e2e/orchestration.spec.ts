// Plan 34: the orchestration mode. Switched from the header (1.91) and from the project popover
// (1.89); the row menu's block — Orchestrator, Configure role…, With you — only while it is on;
// switching it off keeps every mark (1.77).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi } from '../src/shared/ipc'
import { launchApp } from './app'
import { CLIENT, catppuccin, clientWork, prepare } from './fixtures'

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
    expect(labels.slice(group + 1, group + 4)).toEqual([
      'Orchestrator',
      'Configure role…',
      'With you',
    ])
    expect(labels).not.toContain('Priority')
    await items.filter({ hasText: /^Orchestrator$/ }).click()
    await expect.poll(async () => (await shown(page))?.orchestrator).toBe(CLIENT.login)

    // Marking another unmarks the first: one orchestrator per project.
    await (await rowMenu(page, CLIENT.api)).filter({ hasText: /^Orchestrator$/ }).click()
    await expect.poll(async () => (await shown(page))?.orchestrator).toBe(CLIENT.api)

    await (await rowMenu(page, CLIENT.long)).filter({ hasText: 'Configure role…' }).click()
    await page.locator('.role-window .role-label').fill('Fabric expert')
    await page.locator('.role-window .responses button', { hasText: 'Save' }).click()
    await expect(page.locator('.role-window')).toHaveCount(0)
    await (await rowMenu(page, CLIENT.login)).filter({ hasText: /^With you$/ }).click()
    const marks = {
      on: true,
      orchestrator: CLIENT.api,
      roles: { [CLIENT.long]: 'Fabric expert' },
      withYou: [CLIENT.login],
      parked: [],
      workersCap: null,
      folders: [],
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
    // The mode goes on first, so the orchestrator starts with its team block.
    expect(args()).toMatch(/ --append-system-prompt-file \S+\n$/)
    expect(teamTexts(home).find((f) => f.id === id)?.text).toContain(
      'You are `lead`, a session of the Menkar project "Client work", in orchestration mode. You are its orchestrator.',
    )
  } finally {
    await launched.close()
  }
})

const jsonLines = <T>(home: string, name: string): T[] =>
  existsSync(join(home, name))
    ? readFileSync(join(home, name), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as T)
    : []
// What each stand-in read from its team file at start, and what reached its messaging socket.
const teamTexts = (home: string) =>
  jsonLines<{ id: string; text: string }>(home, 'claude-team.jsonl')
const postsTo = (home: string, id: string) =>
  jsonLines<{ id: string; content: string }>(home, 'claude-posts.jsonl')
    .filter((p) => p.id === id)
    .map((p) => p.content)

test('the card: a new orchestrator refused its start (its folder gone) leaves the mode off', async () => {
  const { launched, page, home } = await launch()
  try {
    await page.locator('#orchestration-switch').click()
    await card(page).locator('.card-choice', { hasText: 'A new session' }).click()
    await card(page).locator('.card-name').fill('lead')
    for (const folder of ['api', 'web']) rmSync(join(home, 'work', folder), { recursive: true })
    await cardButton(page, 'Start').click()
    await expect(page.locator('.toast').first()).toBeVisible()
    await expect.poll(async () => (await shown(page))?.on).toBe(false)
    expect(existsSync(join(home, 'claude-args.txt'))).toBe(false)
  } finally {
    await launched.close()
  }
})

// 1.154 Q2: switching the mode on posts the whole block to each running session of the
// project, once, however many changes the card makes (the mode, the mark, the hand-over).
test('the card: switching the mode on with two sessions running posts each one its whole block once', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return { ...clientWork(dirs, { tabs: [['login'], ['api']] }), FAKE_CLAUDE_SOCKET: '1' }
    },
  })
  const page = launched.window
  const argLines = () =>
    existsSync(join(home, 'claude-args.txt'))
      ? readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n')
      : []
  try {
    await expect.poll(() => argLines().length).toBe(2)
    for (const line of argLines()) expect(line).not.toContain('--append-system-prompt-file')
    await page.locator('#orchestration-switch').click()
    await card(page).locator('.card-choice', { hasText: 'login fix' }).click()
    await cardButton(page, 'Start').click()
    await expect.poll(() => shown(page)).toMatchObject({ on: true, orchestrator: CLIENT.login })
    const whole = (who: string) =>
      new RegExp(
        `^\\[Menkar\\] Team update: your team instructions, replacing any earlier ones:\\n# Your team in Menkar\\nYou are ${who}`,
      )
    await expect
      .poll(() => postsTo(home, CLIENT.login), { timeout: 15_000 })
      .toEqual([
        expect.stringMatching(
          whole(
            '`login fix`, a session of the Menkar project "Client work", in orchestration mode\\. You are its orchestrator\\.',
          ),
        ),
      ])
    await expect
      .poll(() => postsTo(home, CLIENT.api), { timeout: 15_000 })
      .toEqual([
        expect.stringMatching(
          whole(
            '`api review`, a session of the Menkar project "Client work", in orchestration mode\\. Your parent is `login fix`, the orchestrator\\.',
          ),
        ),
      ])
    await page.waitForTimeout(6000)
    expect(postsTo(home, CLIENT.login)).toHaveLength(1)
    expect(postsTo(home, CLIENT.api)).toHaveLength(1)
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
  look: { readonly scheme?: 'dark' | 'light'; readonly discussing?: number } = {},
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
    status: number === look.discussing ? 'discussing' : 'open',
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
  if (look.scheme === 'light')
    writeFileSync(
      join(config, 'state.json'),
      JSON.stringify({
        settings: {
          color_scheme: 'light',
          terminal_theme: catppuccin('light'),
          terminal_colors: 'theme',
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
    await expect(page.locator('.topics-toggle')).toHaveText('Awaiting you · 3')
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

// Decision 1.169: the topic being discussed is the current one: first, before the ★ task's topic
// and the blocking one, with a green dot; a blocking one discussed keeps its red mark too.
for (const scheme of ['dark', 'light'] as const)
  test(`the discussing topic comes first with a green dot, the red blocking mark kept (${scheme}, screenshot)`, async () => {
    const launched = await launchApp({
      prepare: (dirs) => team(dirs, false, { scheme, discussing: 3 }),
    })
    const page = launched.window
    try {
      await expect(page.locator('.topic-row')).toHaveText([
        '3Deploy key missing',
        '★2Schema of the orders table',
        '1Release date',
      ])
      await expect(page.locator('.topic-current')).toHaveCount(1)
      const current = page.locator('.topic-row[data-topic="3"]')
      await expect(current.locator('.topic-current')).toHaveCount(1)
      await expect(current.locator('.topic-blocking')).toHaveCount(1)
      const expected = await page.evaluate(() => {
        const probe = document.createElement('span')
        probe.style.background = 'var(--green)'
        document.body.append(probe)
        const color = getComputedStyle(probe).backgroundColor
        probe.remove()
        return color
      })
      // A render may replace the row between finding the dot and reading it, and a dot no longer in
      // the page has no computed colour: read it until the attached one answers.
      await expect
        .poll(() =>
          current
            .locator('.topic-current')
            .evaluate((node) => (node.isConnected ? getComputedStyle(node).backgroundColor : '')),
        )
        .toBe(expected)
      await shot(page, `current-topic-${scheme}.png`)
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
    // The post's counts are the Work view's tiles.
    await page.locator('#view-switch .view-work').click()
    await expect(page.locator('.work-tile .tile-n')).toHaveText(['3', '0', '0'])
    await page.locator('#view-switch .view-team').click()
    await expect(page.locator('.work-tile')).toHaveCount(0)
    await page.locator('.topic-row[data-topic="3"]').click()
    await expect(page.locator('.topic-detail')).toContainText('From orchestrator · discussing')
    await shot(page, 'b1-topic-discuss.png')

    // The orchestrator's tab closed: the topic still goes to discussing; nothing is posted.
    await orchTab.locator('.close').click()
    await expect(page.locator('.tab')).toHaveCount(1)
    await page.locator('.topic-row[data-topic="1"]').dblclick()
    await expect.poll(() => statusOf(1)).toBe('discussing')
    await page.waitForTimeout(4000)
    expect(posted()).toEqual([expect.stringMatching(DISCUSS_3)])
  } finally {
    server.close()
    await launched.close()
  }
})

// Every post ends with the local time, so Claude Code keeps two identical ones apart; one to the
// orchestrator, then with the Work view's counts (decision 1.125).
const COUNTS = ' · 3 topics · 0 working · 0 waiting'
const DISCUSS_3 = new RegExp(
  `^\\[Menkar\\] The human wants to discuss topic 3 \\(\\d{2}:\\d{2}:\\d{2}\\)${COUNTS}$`,
)

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

// The stand-in agent in that session's pane is up. Only the panes a test types into are waited on:
// with several apps starting at once, a shell the test never uses may still be starting.
const agentReady = async (page: Page, session: string) => {
  const pane = await paneOf(page, session)
  await expect
    .poll(() => page.locator(`.pane[data-pane="${pane}"] .xterm-rows`).textContent(), {
      timeout: 15_000,
    })
    .toContain('stand-in claude ready')
  return pane
}

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
    const login = await agentReady(page, CLIENT.login)
    const api = await agentReady(page, CLIENT.api)
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
    await typeInto(page, login, 'ASK')
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
    await typeInto(page, api, 'ASK')
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
    const orch = await agentReady(page, TEAM.orch)
    await typeInto(page, orch, 'TOPIC')
    await expect(page.locator('.toast')).toContainText('Item 4: Pick a port', { timeout: 15_000 })
    await expect.poll(() => sounds(root).length).toBe(1)
    await expect(page.locator('.topic-row')).toHaveCount(4)

    await page.locator('.topic-row[data-topic="1"]').dblclick()
    await expect.poll(() => topicsFile(root).find((x) => x.number === 1)?.status).toBe('discussing')
    await page.locator('.toast').evaluateAll((ns) => {
      for (const n of ns) n.remove()
    })
    await page.locator('.tab', { hasText: 'login worker' }).click()
    await typeInto(page, orch, 'TOPIC')
    const toast = page.locator('.toast', { hasText: 'Item 5: Pick a port' })
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
          new RegExp(
            `^\\[Menkar\\] The human took control of login worker \\(\\d{2}:\\d{2}:\\d{2}\\)${COUNTS}$`,
          ),
        ),
      ])
    await shot(page, 'banner-blue.png')

    // At a permission prompt, even handed back, the tab takes keys while it waits.
    await page.keyboard.type('ASK')
    await banner.locator('button', { hasText: 'Back to reporting to the orchestrator' }).click()
    await expect.poll(socket.posted, { timeout: 15_000 }).toContainEqual(
      expect.stringMatching(
        // The prompt that follows may join it, after the human's own news (decision 1.173).
        /^\[Menkar\] The human handed login worker back(; [^(]+)? \(\d{2}:\d{2}:\d{2}\) · \d+ topics? · \d+ working · \d+ waiting$/,
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

// Decision 1.124: a project's folders are its sessions' folders and the ones added by hand. The
// first-time card offers them; the gear's dialog lists them, the sessions' own marked and kept,
// an added one removable; "Add folder…" goes through the system's chooser.
test('the project’s folders: the card offers its sessions’ folders; the gear’s dialog lists them, adds one through the chooser and removes it (screenshot)', async () => {
  const { launched, page, root, home } = await launch()
  const other = join(home, 'other', 'repo')
  mkdirSync(other, { recursive: true })
  const saved = () =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')).projects[0]
      .orchestration
  await launched.app.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [chosen],
    })) as unknown as typeof dialog.showOpenDialog
  }, other)
  try {
    await page.locator('#orchestration-switch').click()
    await expect(card(page).locator('.card-folder option')).toHaveText(['~/work/api', '~/work/web'])
    await startWithFirst(page)

    await page.locator('#project-button').click()
    await page.locator('.project-row .orch-settings-button').click()
    const dialog = page.locator('[role="alertdialog"]')
    const rows = dialog.locator('.orch-folder-row')
    await expect(dialog.locator('.orch-folders-label')).toHaveText('Folders')
    await expect(rows.locator('.orch-folder-path')).toHaveText(['~/work/api', '~/work/web'])
    await expect(rows.locator('.orch-folder-auto')).toHaveCount(2)
    await expect(rows.locator('.orch-folder-remove')).toHaveCount(0)

    await dialog.locator('.orch-folder-add', { hasText: 'Add folder…' }).click()
    await expect(rows.locator('.orch-folder-path')).toHaveText([
      '~/work/api',
      '~/work/web',
      '~/other/repo',
    ])
    await expect(rows.nth(2).locator('.orch-folder-remove')).toHaveCount(1)
    await expect.poll(saved).toMatchObject({ folders: [other] })
    await shot(page, 'folders.png')

    await rows.nth(2).locator('.orch-folder-remove').click()
    await expect(rows).toHaveCount(2)
    await expect.poll(saved).not.toHaveProperty('folders')
    await dialog.locator('button', { hasText: 'Cancel' }).click()
    // Added and removed at once, not on Save: Cancel leaves them as they are.
    expect(saved()).not.toHaveProperty('folders')
  } finally {
    await launched.close()
  }
})

// A folder of the project gone from disk: the card (and Ctrl+`) do not offer it; the gear's list
// keeps it, marked missing, so the human sees why.
test('a project folder gone from disk: the card leaves it out; the gear’s list keeps it marked “missing” (screenshot)', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      const env = clientWork(dirs)
      rmSync(join(dirs.home, 'work', 'web'), { recursive: true })
      return env
    },
  })
  const page = launched.window
  try {
    expect(home).not.toBe('')
    await page.locator('#orchestration-switch').click()
    await expect(card(page).locator('.card-folder option')).toHaveText(['~/work/api'])
    await startWithFirst(page)

    await page.locator('#project-button').click()
    await page.locator('.project-row .orch-settings-button').click()
    const rows = page.locator('[role="alertdialog"] .orch-folder-row')
    await expect(rows.locator('.orch-folder-path')).toHaveText(['~/work/api', '~/work/web'])
    await expect(rows.nth(0).locator('.orch-folder-missing')).toHaveCount(0)
    await expect(rows.nth(1).locator('.orch-folder-missing')).toHaveText('missing')
    await shot(page, 'folders-missing.png')
  } finally {
    await launched.close()
  }
})

// A project with many sessions in a short window: the card's two lists are as long as the
// project, and its buttons were once cut off below the window with no way to reach them.
test('the card in a short window with 20 more sessions: it fits, its buttons stay in view and the last managed session scrolls into view (screenshot)', async () => {
  const crowd = Array.from({ length: 20 }, (_, i) => ({
    id: `c20c20c2-0000-4000-8000-${String(i).padStart(12, '0')}`,
    name: `crowd ${String(i + 1).padStart(2, '0')}`,
  }))
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = clientWork(dirs)
      const cwd = join(dirs.home, 'work', 'api')
      const transcripts = join(dirs.home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'))
      for (const s of crowd)
        writeFileSync(
          join(transcripts, `${s.id}.jsonl`),
          `${[
            { type: 'custom-title', customTitle: s.name },
            { type: 'user', cwd, message: { content: `work on ${s.name}` } },
          ]
            .map((l) => JSON.stringify(l))
            .join('\n')}\n`,
        )
      const file = join(dirs.root, 'config', 'menkar', 'projects.json')
      const projects = JSON.parse(readFileSync(file, 'utf8')) as {
        projects: { members: string[] }[]
      }
      projects.projects[0]?.members.push(...crowd.map((s) => s.id))
      writeFileSync(file, JSON.stringify(projects))
      return env
    },
  })
  const page = launched.window
  try {
    await launched.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(800, 600)
    })
    await expect.poll(() => page.evaluate(() => globalThis.innerHeight)).toBe(600)
    await page.locator('#orchestration-switch').click()
    await expect(card(page)).toBeVisible()
    const managed = card(page).locator('.card-managed:visible')
    await expect(managed).toHaveCount(22)
    const box = await card(page).boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(600)
    }
    for (const label of ['Start', 'Not now']) await expect(cardButton(page, label)).toBeInViewport()
    await expect(card(page).locator('.heading')).toBeInViewport()
    const last = managed.last()
    await expect(last).toHaveText('login fix')
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
    await last.locator('input').uncheck()
    await expect(last.locator('input')).not.toBeChecked()
    await shot(page, 'card-short-window.png')
    await cardButton(page, 'Start').click()
    await expect(card(page)).toHaveCount(0)
    await expect.poll(() => shown(page)).toMatchObject({ on: true, orchestrator: CLIENT.long })
    await expect.poll(() => parents(page)).not.toHaveProperty(CLIENT.login)
  } finally {
    await launched.close()
  }
})

// "Configure role…", mock-up C (decisions 1.154, 1.157). A team whose `app`
// folder is a repository with four skills, a second repository `lib` with one, and the user's own
// skills, one of them named like Menkar's.
const ROLE = {
  orch: 'e0e0e0e0-0000-4000-8000-0000000000e1',
  expert: 'e0e0e0e0-0000-4000-8000-0000000000e2',
  keeper: 'e0e0e0e0-0000-4000-8000-0000000000e3',
  libber: 'e0e0e0e0-0000-4000-8000-0000000000e4',
} as const
const ROLE_NAMES: Record<keyof typeof ROLE, string> = {
  orch: 'orchestrator',
  expert: 'packager',
  keeper: 'claude-cli',
  libber: 'lib worker',
}
const ROLE_PROJECT = 'eeeeeeeeeeee'

function skillAt(skills: string, dir: string, name = dir): void {
  mkdirSync(join(skills, dir), { recursive: true })
  writeFileSync(
    join(skills, dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: What ${name} is for.\n---\n\nBody.\n`,
  )
}

function roleTeam(
  dirs: { readonly root: string; readonly home: string },
  scheme: 'dark' | 'light' = 'dark',
): Record<string, string> {
  const env = prepare(dirs)
  const app = join(dirs.home, 'work', 'app')
  const lib = join(dirs.home, 'work', 'lib')
  for (const repo of [app, lib]) mkdirSync(join(repo, '.git'), { recursive: true })
  for (const dir of ['packager', 'review-branch', 'claude-cli', 'compact-safe'])
    skillAt(join(app, '.claude', 'skills'), dir)
  skillAt(join(lib, '.claude', 'skills'), 'lib-only')
  const user = join(dirs.home, '.claude', 'skills')
  skillAt(user, 'compact-safe')
  skillAt(user, 'commit-style')
  skillAt(user, 'sneaky', 'menkar:sneaky')
  for (const key of Object.keys(ROLE) as (keyof typeof ROLE)[]) {
    const cwd = key === 'libber' ? lib : app
    const transcripts = join(dirs.home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'))
    mkdirSync(transcripts, { recursive: true })
    writeFileSync(
      join(transcripts, `${ROLE[key]}.jsonl`),
      `${[
        { type: 'custom-title', customTitle: ROLE_NAMES[key] },
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
      current: ROLE_PROJECT,
      projects: [
        {
          id: ROLE_PROJECT,
          name: 'Roles',
          members: Object.values(ROLE),
          groups: [],
          parents: { [ROLE.expert]: ROLE.orch },
          team_view: true,
          orchestration: {
            on: true,
            orchestrator: ROLE.orch,
            roles: { [ROLE.expert]: 'Packaging' },
            skills: {
              // Deleted on disk, and found only in another repository: both "Not found".
              [ROLE.expert]: [{ name: 'gone-skill', maintainer: true }, { name: 'lib-only' }],
              [ROLE.keeper]: [{ name: 'claude-cli', maintainer: true }],
            },
          },
        },
      ],
      windows: [
        {
          current: ROLE_PROJECT,
          tabs: { [ROLE_PROJECT]: [{ panes: [ROLE.expert], orientation: 'horizontal' }] },
        },
      ],
    }),
  )
  writeFileSync(
    join(config, 'state.json'),
    JSON.stringify({
      settings: {
        color_scheme: scheme,
        terminal_theme: catppuccin(scheme),
        terminal_colors: 'theme',
      },
    }),
  )
  return { ...env, FAKE_CLAUDE_SOCKET: '1' }
}

const roleWindow = (page: Page) => page.locator('.role-window')
const skillRow = (page: Page, name: string) =>
  roleWindow(page).locator(`.skill-row[data-skill="${name}"]`)
const openRole = async (page: Page) => {
  await (await rowMenu(page, ROLE.expert)).filter({ hasText: 'Configure role…' }).click()
  await expect(roleWindow(page)).toBeVisible()
}
const rolePressed = (row: ReturnType<typeof skillRow>, label: string) =>
  row.locator('.segmented button', { hasText: label })

test('Configure role… (mock-up C): only the session’s repository and the user’s skills, never Menkar’s; Not found first and never filtered; maintained elsewhere is read only; the same name ticks both; Cancel writes nothing (screenshot)', async () => {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return roleTeam(dirs)
    },
  })
  const page = launched.window
  const projectsFile = () => readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')
  try {
    const labels = await (await rowMenu(page, ROLE.expert)).allTextContents()
    expect(labels).toContain('Configure role…')
    expect(labels).not.toContain('Role…')
    await page.keyboard.press('Escape')
    const before = projectsFile()
    await openRole(page)
    await expect(roleWindow(page).locator('.heading')).toHaveText('Configure role of packager')
    await expect(roleWindow(page).locator('.role-label')).toHaveValue('Packaging')
    await expect(roleWindow(page).locator('.chosen-sum')).toHaveText('0 chosen: none')
    // Decision 1.157: the session's own repository, then the user's; `lib` is another one.
    await expect(roleWindow(page).locator('.skill-group-name')).toHaveText([
      'Not found',
      'app',
      'Yours',
    ])
    await expect(roleWindow(page).locator('.skill-group-place')).toHaveText([
      '.claude/skills/',
      '~/.claude/skills/',
    ])
    const names = await roleWindow(page).locator('.skill-row .skill-name').allTextContents()
    expect(names).toEqual([
      'gone-skill',
      'lib-only',
      'claude-cli',
      'compact-safe',
      'packager',
      'review-branch',
      'commit-style',
      'compact-safe',
    ])
    // Decision 1.154: Menkar's own skills never show, even one so named in the user's folder.
    expect(names.join(' ')).not.toContain('menkar:')
    for (const gone of ['gone-skill', 'lib-only']) {
      await expect(skillRow(page, gone)).toHaveClass(/missing/)
      await expect(skillRow(page, gone).locator('button', { hasText: 'Remove' })).toBeVisible()
      await expect(skillRow(page, gone)).toContainText("Not found in this project's or your skills")
    }

    // The filter: case ignored, empty groups hidden, and the not-found rows always shown.
    const filter = roleWindow(page).locator('.skill-filter')
    await filter.fill('PACK')
    await expect(roleWindow(page).locator('.skill-group-name')).toHaveText(['Not found', 'app'])
    await expect(roleWindow(page).locator('.skill-row:not(.missing)')).toHaveCount(1)
    await filter.fill('zzz')
    await expect(roleWindow(page).locator('.skill-none')).toHaveText('No skill matches.')
    await expect(roleWindow(page).locator('.skill-row.missing')).toHaveCount(2)
    await filter.fill('')

    // Maintained by another session: noted unticked; ticked, its Maintainer is disabled.
    const cli = skillRow(page, 'claude-cli')
    await expect(cli).toContainText('maintained by claude-cli')
    await cli.locator('input[type="checkbox"]').check()
    await expect(cli.locator('.skill-lock')).toHaveText('Maintained by claude-cli')
    await expect(rolePressed(cli, 'Maintainer')).toBeDisabled()
    await expect(rolePressed(cli, 'Read only')).toHaveAttribute('aria-pressed', 'true')

    // Decision 1.154: ticking adds it read only and shows its switch on that line.
    const packager = skillRow(page, 'packager')
    await expect(rolePressed(packager, 'Maintainer')).toHaveCount(0)
    await packager.locator('input[type="checkbox"]').check()
    await expect(rolePressed(packager, 'Read only')).toHaveAttribute('aria-pressed', 'true')
    await rolePressed(packager, 'Maintainer').click()
    await expect(rolePressed(packager, 'Maintainer')).toHaveAttribute('aria-pressed', 'true')

    // What is stored is the name: the same name in two places is ticked in both.
    const both = skillRow(page, 'compact-safe')
    await expect(both).toHaveCount(2)
    await both.first().locator('input[type="checkbox"]').check()
    await expect(both.nth(1).locator('input[type="checkbox"]')).toBeChecked()
    await expect(roleWindow(page).locator('.chosen-sum')).toHaveText(
      '3 chosen: claude-cli, packager, compact-safe',
    )
    await shot(page, 'configure-role-dark.png')

    await roleWindow(page).locator('.responses button', { hasText: 'Cancel' }).click()
    await expect(roleWindow(page)).toHaveCount(0)
    expect(projectsFile()).toBe(before)
    // Escape changes nothing either.
    await openRole(page)
    await skillRow(page, 'packager').locator('input[type="checkbox"]').check()
    await page.keyboard.press('Escape')
    await expect(roleWindow(page)).toHaveCount(0)
    expect(projectsFile()).toBe(before)
  } finally {
    await launched.close()
  }
})

test('Configure role…: Remove and Save drop the not-found skills, a Maintainer and a read-only skill are stored as written, and the running session gets one post naming them, a skill made since its start found again', async () => {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      return roleTeam(dirs)
    },
  })
  const page = launched.window
  const stored = () =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')).projects[0]
      .orchestration
  try {
    await expect.poll(() => teamTexts(home).length).toBe(1)
    // Made after the pane started: Save finds it again, so the block does not call it not found.
    skillAt(join(home, 'work', 'app', '.claude', 'skills'), 'late-skill')
    await openRole(page)
    for (const gone of ['gone-skill', 'lib-only'])
      await skillRow(page, gone).locator('button', { hasText: 'Remove' }).click()
    await expect(roleWindow(page).locator('.skill-row.missing')).toHaveCount(0)
    await expect(roleWindow(page).locator('.skill-group-name')).toHaveText(['app', 'Yours'])
    await skillRow(page, 'packager').locator('input[type="checkbox"]').check()
    await rolePressed(skillRow(page, 'packager'), 'Maintainer').click()
    await skillRow(page, 'review-branch').locator('input[type="checkbox"]').check()
    await skillRow(page, 'late-skill').locator('input[type="checkbox"]').check()
    await roleWindow(page).locator('.role-label').fill('Packaging expert')
    await roleWindow(page).locator('.responses button', { hasText: 'Save' }).click()
    await expect(roleWindow(page)).toHaveCount(0)
    await expect
      .poll(() => stored())
      .toMatchObject({
        roles: { [ROLE.expert]: 'Packaging expert' },
        skills: {
          [ROLE.expert]: [
            { name: 'packager', maintainer: true },
            { name: 'review-branch' },
            { name: 'late-skill' },
          ],
          [ROLE.keeper]: [{ name: 'claude-cli', maintainer: true }],
        },
      })
    // Decision 1.152: the session hears of it at once, in one post.
    await expect
      .poll(() => postsTo(home, ROLE.expert), { timeout: 15_000 })
      .toEqual([
        expect.stringContaining(
          'Your role: "Packaging expert". Your parent is `orchestrator`, the orchestrator.\nSkills to have loaded (load any that is not): `packager`, which you maintain (only you change it, with `menkar:distill`); `review-branch`, read only; `late-skill`, read only.',
        ),
      ])
    await page.waitForTimeout(6000)
    expect(postsTo(home, ROLE.expert)).toHaveLength(1)
    // Reopened, the window shows what was saved.
    await openRole(page)
    await expect(roleWindow(page).locator('.chosen-sum')).toHaveText(
      '3 chosen: packager, review-branch, late-skill',
    )
    await expect(rolePressed(skillRow(page, 'packager'), 'Maintainer')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  } finally {
    await launched.close()
  }
})

test('Configure role… in the light scheme, with skills ticked, one maintained elsewhere and two not found (screenshot)', async () => {
  const launched = await launchApp({ prepare: (dirs) => roleTeam(dirs, 'light') })
  const page = launched.window
  try {
    await openRole(page)
    await skillRow(page, 'claude-cli').locator('input[type="checkbox"]').check()
    await skillRow(page, 'packager').locator('input[type="checkbox"]').check()
    await rolePressed(skillRow(page, 'packager'), 'Maintainer').click()
    await skillRow(page, 'review-branch').locator('input[type="checkbox"]').check()
    await expect(rolePressed(skillRow(page, 'claude-cli'), 'Maintainer')).toBeDisabled()
    await shot(page, 'configure-role-light.png')
  } finally {
    await launched.close()
  }
})
