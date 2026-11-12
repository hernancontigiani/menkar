// Plan 34: the orchestration mode. Switched from the header (1.91) and from the project popover
// (1.89); the row menu's block — Orchestrator, Role…, Priority, With you — only while it is on;
// switching it off keeps every mark (1.77).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

// The first time, the switch opens the card; Start with the first session listed marks it.
async function startWithFirst(page: Page): Promise<void> {
  await expect(card(page)).toBeVisible()
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

    items = await rowMenu(page, CLIENT.login)
    const labels = await items.allTextContents()
    const group = labels.findIndex((l) => l.startsWith('Group'))
    expect(labels.slice(group + 1, group + 5)).toEqual([
      'Orchestrator',
      'Role…',
      'Priority',
      'With you',
    ])
    await items.filter({ hasText: /^Orchestrator$/ }).click()
    await expect.poll(async () => (await shown(page))?.orchestrator).toBe(CLIENT.login)

    // Marking another unmarks the first: one orchestrator per project.
    await (await rowMenu(page, CLIENT.api)).filter({ hasText: /^Orchestrator$/ }).click()
    await expect.poll(async () => (await shown(page))?.orchestrator).toBe(CLIENT.api)

    await (await rowMenu(page, CLIENT.long)).filter({ hasText: 'Role…' }).click()
    await page.locator('[role="alertdialog"] input').fill('Fabric expert')
    await page.locator('[role="alertdialog"] button', { hasText: 'Save' }).click()
    await (await rowMenu(page, CLIENT.long)).filter({ hasText: /^Priority$/ }).click()
    await (await rowMenu(page, CLIENT.login)).filter({ hasText: /^With you$/ }).click()
    const marks = {
      on: true,
      orchestrator: CLIENT.api,
      roles: { [CLIENT.long]: 'Fabric expert' },
      priority: [CLIENT.long],
      withYou: [CLIENT.login],
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
      priority: [CLIENT.long],
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

test('the card: "A new session" starts a tab named as typed, marked orchestrator, told to load the skill', async () => {
  const { launched, page, home } = await launch()
  try {
    await page.locator('#orchestration-switch').click()
    await card(page).locator('.card-choice', { hasText: 'A new session' }).click()
    await card(page).locator('.card-name').fill('lead')
    await cardButton(page, 'Start').click()
    await expect(page.locator('.tab.selected')).toHaveText(/lead/)
    const argsFile = join(home, 'claude-args.txt')
    const args = () => (existsSync(argsFile) ? readFileSync(argsFile, 'utf8') : '')
    await expect
      .poll(args)
      .toContain(
        '-n lead Load `menkar:orchestrator`. You are the orchestrator of the project Client work.',
      )
    const id = /--session-id (\S+) -n lead/.exec(args())?.[1]
    await expect.poll(() => shown(page)).toMatchObject({ on: true, orchestrator: id })
  } finally {
    await launched.close()
  }
})

// A team: the orchestrator with two children (one with a tab, one without), an expert with the ★,
// a plain session in a group, and three topics, one from the ★ session and one blocking.
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
          orchestration: {
            on: true,
            orchestrator: TEAM.orch,
            roles: { [TEAM.expert]: 'Fabric expert' },
            priority: [TEAM.expert],
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
  const topic = (number: number, title: string, from: string, blocking: boolean) => ({
    number,
    title,
    context: `What to do about ${title.toLowerCase()}.`,
    from,
    blocking,
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
            topic(2, 'Schema of the orders table', TEAM.expert, false),
            topic(3, 'Deploy key missing', TEAM.orch, true),
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
        'Experts and consultants',
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
    // The ★ session's topic first; the blocking one marked, not moved.
    await expect(page.locator('.topics-toggle')).toHaveText('Topics · 3')
    await expect(page.locator('.topic-row')).toHaveText([
      '★2Schema of the orders table',
      '1Release date',
      '3Deploy key missing',
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
