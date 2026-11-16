// Plan 36: the orchestration mode's Work view (decisions 1.112, 1.115), the ★ on tasks (1.114),
// tasks in the Team view and the Board panel (1.116, 1.126), on a seeded team with tasks.json and
// topics.json.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare } from './fixtures'

const SHOTS = '/tmp/menkar-shots'
const PROJECT = 'eeeeeeeeeeee'

const TEAM = {
  orch: 'b0b0b0b0-0000-4000-8000-0000000000b1',
  w1: 'b0b0b0b0-0000-4000-8000-0000000000b2',
  w2: 'b0b0b0b0-0000-4000-8000-0000000000b3',
  expert: 'b0b0b0b0-0000-4000-8000-0000000000b4',
  plain: 'b0b0b0b0-0000-4000-8000-0000000000b5',
} as const
const NAMES: Record<keyof typeof TEAM, string> = {
  orch: 'orchestrator',
  w1: 'packager',
  w2: 'docs writer',
  expert: 'fabric',
  plain: 'notes',
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, name) })
}

// Times relative to the run, so "today" is today whenever the suite runs.
const nowIso = () => new Date(Date.now()).toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

interface SeedTask {
  number: number
  title: string
  assignee: string
  star?: boolean
  state: string
  steps?: string[]
  step?: number
  note?: string
  waiting_on?: string
  review_wait?: { on: string; note?: string }
  closed?: string
}

const STEPS5 = ['version', 'changelog', 'build', 'install', 'smoke']
const BASE_TASKS: SeedTask[] = [
  {
    number: 1,
    title: 'Docs pass',
    assignee: TEAM.w2,
    state: 'waiting',
    steps: ['a', 'b', 'c'],
    step: 2,
    note: 'needs a name',
    waiting_on: 'topic 1',
  },
  {
    number: 2,
    title: 'Release 0.2',
    assignee: TEAM.w1,
    star: true,
    state: 'in progress',
    steps: STEPS5,
    step: 3,
    note: 'building .deb',
  },
  { number: 3, title: 'Notes cleanup', assignee: TEAM.plain, state: 'queued' },
  {
    number: 4,
    title: 'Login fix',
    assignee: TEAM.w1,
    state: 'to review',
    steps: ['a', 'b', 'c'],
    step: 3,
    note: 'try the login',
  },
  {
    number: 5,
    title: 'Old chore',
    assignee: TEAM.w2,
    state: 'dropped',
    steps: ['a', 'b', 'c', 'd', 'e', 'f'],
    step: 4,
    closed: daysAgo(3),
  },
  {
    number: 6,
    title: 'Icon fix',
    assignee: TEAM.w1,
    state: 'done',
    steps: ['a', 'b', 'c', 'd', 'e', 'f'],
    step: 4,
    closed: nowIso(),
  },
]

function seed(
  dirs: { readonly root: string; readonly home: string },
  tasks: SeedTask[],
  teamView = false,
) {
  const env = prepare(dirs)
  for (const key of Object.keys(TEAM) as (keyof typeof TEAM)[]) {
    const cwd = join(dirs.home, 'work', 'app')
    mkdirSync(cwd, { recursive: true })
    const transcripts = join(dirs.home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'))
    mkdirSync(transcripts, { recursive: true })
    writeFileSync(
      join(transcripts, `${TEAM[key]}.jsonl`),
      `${[
        { type: 'custom-title', customTitle: NAMES[key] },
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
      current: PROJECT,
      projects: [
        {
          id: PROJECT,
          name: 'Team',
          members: Object.values(TEAM),
          groups: [],
          parents: { [TEAM.w1]: TEAM.orch, [TEAM.w2]: TEAM.orch },
          ...(teamView ? { team_view: true } : {}),
          orchestration: {
            on: true,
            orchestrator: TEAM.orch,
            roles: { [TEAM.expert]: 'Fabric expert' },
          },
        },
      ],
      windows: [
        {
          current: PROJECT,
          tabs: {
            [PROJECT]: [
              { panes: [TEAM.orch], orientation: 'horizontal' },
              { panes: [TEAM.w1], orientation: 'horizontal' },
              // An earlier version's Board tab: dropped on read (decision 1.126).
              { board: true },
            ],
          },
        },
      ],
    }),
  )
  const at = daysAgo(1)
  const topic = (number: number, title: string, extra: Record<string, unknown> = {}) => ({
    number,
    title,
    context: `About ${title.toLowerCase()}.`,
    from: TEAM.orch,
    blocking: false,
    status: 'open',
    created: at,
    updated: at,
    ...extra,
  })
  writeFileSync(
    join(config, 'topics.json'),
    JSON.stringify({
      version: 1,
      projects: {
        [PROJECT]: {
          next: 4,
          topics: [
            topic(1, 'Name of the docs section', { task: 1 }),
            topic(2, 'Deploy key missing', { blocking: true }),
            topic(3, 'Release date', { status: 'closed', decision: 'Friday', updated: nowIso() }),
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
        [PROJECT]: {
          next: tasks.length + 1,
          tasks: tasks.map((x) => ({
            steps: [],
            step: 0,
            note: '',
            star: false,
            created: at,
            updated: at,
            ...x,
          })),
        },
      },
    }),
  )
  return env
}

const saved = (root: string, file: string) =>
  JSON.parse(readFileSync(join(root, 'config', 'menkar', file), 'utf8'))

// `profile`: a previous run's root, whose config is carried over, as a restart would find it.
async function open(tasks = BASE_TASKS, teamView = false, profile?: string) {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      const env = seed(dirs, tasks, teamView)
      if (profile)
        cpSync(join(profile, 'config'), join(dirs.root, 'config'), {
          recursive: true,
          force: true,
        })
      return env
    },
  })
  const page = launched.window
  await expect(page.locator('.tab')).toHaveCount(2)
  return { launched, page, root }
}

const taskNumbers = (page: Page) =>
  page
    .locator('#session-list .task-row')
    .evaluateAll((ns) => ns.map((n) => n.getAttribute('data-task')))

test('the Work view by default: tiles, Topics, Tasks ★ first with their steps, Consultants, Done today folded and saved (screenshot)', async () => {
  const { launched, page, root } = await open()
  try {
    await expect(page.locator('#view-switch .view-work')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#session-list .row')).toHaveCount(0)
    await expect(page.locator('.work-tile .tile-n')).toHaveText(['2', '1', '1'])
    // Topic 1 belongs to task 1, which has no ★: the blocking one comes first.
    await expect(page.locator('#session-list .topic-row')).toHaveText([
      '2Deploy key missing',
      '1Name of the docs section',
    ])
    // Open ones, ★ first, then by number.
    await expect.poll(() => taskNumbers(page)).toEqual(['2', '1', '3', '4'])
    const release = page.locator('.task-row[data-task="2"]')
    await expect(release).toContainText('Release 0.2')
    await expect(release).toContainText('3/5')
    await expect(release).toContainText('packager')
    await expect(release).toContainText('building .deb')
    await expect(release.locator('.priority-star')).toHaveCount(1)
    await expect(release.locator('.segment')).toHaveCount(5)
    await expect(release.locator('.segment.done')).toHaveCount(2)
    await expect(release.locator('.segment.current')).toHaveCount(1)
    await expect(page.locator('.task-row[data-task="1"]')).toHaveClass(/waiting/)
    await expect(page.locator('.task-row[data-task="1"]')).toContainText('waiting on topic 1')
    await expect(page.locator('.task-row[data-task="3"]')).toContainText('queued')
    await expect(page.locator('.see-all')).toHaveCount(0)
    await expect(page.locator('.consultant-row')).toHaveText([/fabric/])

    // Done today: folded by default; unfolded, the topic and the task closed today, saved.
    const done = page.locator('[data-section="done"]')
    await expect(done).toHaveText('Done today · 2')
    await expect(done).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.done-row')).toHaveCount(0)
    await done.click()
    await expect(page.locator('.done-row')).toHaveCount(2)
    await expect(page.locator('.done-row[data-done="task-6"]')).toContainText('Icon fix')
    await expect(page.locator('.done-row[data-done="topic-3"]')).toContainText('Release date')
    await expect.poll(() => saved(root, 'projects.json').projects[0].done_today_open).toBe(true)
    await page.locator('[data-section="consultants"]').click()
    await expect(page.locator('.consultant-row')).toHaveCount(0)
    await expect
      .poll(() => saved(root, 'projects.json').projects[0].consultants_collapsed)
      .toBe(true)
    await page.locator('[data-section="consultants"]').click()
    await shot(page, 'work.png')

    // The ★ from a task's right-click menu: written, and the order follows.
    await page.locator('.task-row[data-task="3"]').click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Mark with ★' }).click()
    await expect.poll(() => taskNumbers(page)).toEqual(['2', '3', '1', '4'])
    await expect.poll(() => saved(root, 'tasks.json').projects[PROJECT].tasks[2].star).toBe(true)

    // A click on a task selects its assignee's tab.
    await page.locator('.tab', { hasText: 'orchestrator' }).click()
    await page.locator('.task-row[data-task="2"]').click()
    await expect(page.locator('.tab.selected')).toHaveText(/packager/)
  } finally {
    await launched.close()
  }
})

test('the Team view: saved per project, each row with its current task and step, ★ from the task; mode off shows none of it (screenshot)', async () => {
  const { launched, page, root } = await open()
  try {
    await page.locator('#view-switch .view-team').click()
    await expect.poll(() => saved(root, 'projects.json').projects[0].team_view).toBe(true)
    await expect(page.locator('#topics-section .topic-row')).toHaveCount(2)
    const packager = page.locator(`.row[data-session="${TEAM.w1}"]`)
    await expect(packager.locator('.team-task')).toHaveText('Release 0.2 · 3/5')
    await expect(packager.locator('.priority-star')).toHaveCount(1)
    await page.locator('.earlier-row').click()
    await expect(page.locator(`.row[data-session="${TEAM.w2}"] .team-task`)).toHaveText(
      'Docs pass · 2/3',
    )
    await expect(page.locator(`.row[data-session="${TEAM.plain}"] .team-task`)).toHaveText(
      'Notes cleanup · queued',
    )
    await expect(page.locator(`.row[data-session="${TEAM.orch}"] .team-task`)).toHaveCount(0)
    await shot(page, 'team-tasks.png')

    // Switching the mode off closes the Board panel, and the saved flag with it (decision 1.126).
    await page.locator('#board-button').click()
    await expect(page.locator('#board-panel')).toBeVisible()
    await expect.poll(() => saved(root, 'projects.json').projects[0].board_open).toBe(true)
    await page.locator('#orchestration-switch').click()
    await expect(page.locator('#board-panel')).toBeHidden()
    await expect
      .poll(() => saved(root, 'projects.json').projects[0])
      .not.toHaveProperty('board_open')
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('#view-switch')).toBeEmpty()
    await expect(page.locator('#board-button')).toBeHidden()
    await expect(page.locator('.team-task')).toHaveCount(0)
    await expect(page.locator('.priority-star')).toHaveCount(0)
    await expect(page.locator('.task-row')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

const panel = (page: Page) => page.locator('#board-panel')
const columnOf = (page: Page, key: string) => page.locator(`#board-panel [data-column="${key}"]`)
const height = async (page: Page, selector: string) =>
  Math.round((await page.locator(selector).boundingBox())?.height ?? -1)
// The right-hand area under the header.
const area = (page: Page) =>
  page.evaluate(
    () =>
      (document.getElementById('content')?.clientHeight ?? 0) -
      (document.querySelector<HTMLElement>('.content-header')?.offsetHeight ?? 0),
  )

test('the Board panel: toggled from the header (pressed), under the header and over the tab strip only, two cards high, its cards as before (screenshot)', async () => {
  const { launched, page, root } = await open()
  try {
    const button = page.locator('#board-button')
    const column = (key: string) => columnOf(page, key)
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(panel(page)).toBeHidden()
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page)).toBeVisible()
    await expect.poll(() => saved(root, 'projects.json').projects[0].board_open).toBe(true)
    await expect(page.locator('.tab')).toHaveCount(2)
    const [header, box, strip, sidebar] = await Promise.all(
      ['.content-header', '#board-panel', '#tab-strip', '#sidebar'].map((x) =>
        page.locator(x).boundingBox(),
      ),
    )
    expect(Math.round(box?.y ?? 0)).toBeGreaterThanOrEqual(
      Math.round((header?.y ?? 0) + (header?.height ?? 0)),
    )
    expect(Math.round(strip?.y ?? 0)).toBeGreaterThanOrEqual(
      Math.round((box?.y ?? 0) + (box?.height ?? 0)),
    )
    expect(Math.round(box?.x ?? 0)).toBeGreaterThanOrEqual(
      Math.round((sidebar?.x ?? 0) + (sidebar?.width ?? 0)),
    )
    // Two full cards per column, about 240 px, whatever the window's height.
    const initial = await height(page, '#board-panel')
    expect(initial).toBeGreaterThan(220)
    expect(initial).toBeLessThan(260)

    await expect(column('topics').locator('.board-card')).toHaveCount(2)
    await expect(column('queued').locator('.task-card')).toHaveText([/Notes cleanup/])
    await expect(column('in-progress').locator('.task-card')).toHaveText([/Release 0.2/])
    await expect(column('in-progress').locator('.task-card')).toContainText('3/5')
    await expect(column('in-progress').locator('.task-card')).toContainText('building .deb')
    await expect(column('in-progress').locator('.task-card .dot')).toHaveCount(1)
    await expect(column('waiting').locator('.task-card')).toHaveText([/Docs pass/])
    await expect(column('to-review').locator('.task-card')).toHaveText([/Login fix/])
    await expect(column('done').locator('.task-card')).toHaveText([/Icon fix/])
    // A done task's bar is complete whatever step its worker last reported.
    const iconFix = column('done').locator('.task-card', { hasText: 'Icon fix' })
    await expect(iconFix).toContainText('6/6')
    await expect(iconFix.locator('.segment')).toHaveCount(6)
    await expect(iconFix.locator('.segment.done')).toHaveCount(6)
    await expect(column('done').locator('.board-before')).toHaveText('Done before · 1')
    await shot(page, 'board-default.png')
    await column('done').locator('.board-before').click()
    await expect(column('done').locator('.task-card')).toHaveCount(2)
    const dropped = column('done').locator('.task-card', { hasText: 'Old chore' })
    await expect(dropped).toContainText('4/6')
    await expect(dropped.locator('.segment.done')).toHaveCount(3)
    await expect(dropped.locator('.segment.current')).toHaveCount(1)
    await iconFix.screenshot({ path: join(SHOTS, 'board-done-card.png') })

    await page.locator('.tab', { hasText: 'orchestrator' }).click()
    await column('in-progress').locator('.task-card').click()
    await expect(page.locator('.tab.selected')).toHaveText(/packager/)

    // × closes it as the button does.
    await page.locator('#board-panel [data-key="close"]').click()
    await expect(panel(page)).toBeHidden()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    await expect(panel(page)).toBeVisible()
    await button.click()
    await expect(panel(page)).toBeHidden()
    await expect
      .poll(() => saved(root, 'projects.json').projects[0])
      .not.toHaveProperty('board_open')
  } finally {
    await launched.close()
  }
})

// Decision 1.164: a task in To review says whom it waits on, on the note line as a waiting task
// does, unless it waits on the orchestrator (the default).
const IN_REVIEW: SeedTask[] = [
  {
    number: 1,
    title: 'Login fix',
    assignee: TEAM.w1,
    state: 'to review',
    steps: ['a', 'b', 'c'],
    step: 3,
    note: 'PR open',
    review_wait: { on: 'pr-approval', note: '#436' },
  },
  {
    number: 2,
    title: 'Docs pass',
    assignee: TEAM.w2,
    state: 'to review',
    steps: ['a', 'b', 'c'],
    step: 3,
    note: 'read it',
    review_wait: { on: 'human' },
  },
  {
    number: 3,
    title: 'Icon fix',
    assignee: TEAM.w2,
    state: 'to review',
    steps: ['a', 'b', 'c'],
    step: 3,
    note: 'try it',
  },
]

test('a task in To review says whom it waits on, on the card and in the Work view: "waiting on PR approval #436", "waiting on the human"; the orchestrator says nothing (screenshot)', async () => {
  const { launched, page } = await open(IN_REVIEW)
  try {
    const row = (n: number) => page.locator(`#session-list .task-row[data-task="${n}"] .task-note`)
    await expect(row(1)).toHaveText('waiting on PR approval #436 · PR open')
    await expect(row(2)).toHaveText('waiting on the human · read it')
    await expect(row(3)).toHaveText('try it')
    await page.locator('#board-button').click()
    const card = (n: number) =>
      columnOf(page, 'to-review').locator(`.task-card[data-task="${n}"] .card-note`)
    await expect(card(1)).toHaveText('waiting on PR approval #436 · PR open')
    await expect(card(2)).toHaveText('waiting on the human · read it')
    await expect(card(3)).toHaveText('try it')
    const files = process.env.MENKAR_FILES
    if (files)
      await page.screenshot({ path: join(files, 'menkar-t43-to-review-waiting-on-pr.png') })
  } finally {
    await launched.close()
  }
})

const QUEUED: SeedTask[] = Array.from({ length: 8 }, (_, i) => ({
  number: i + 1,
  title: `Task ${i + 1}`,
  assignee: TEAM.w2,
  state: 'queued',
}))

test('the Board panel resized by dragging, reopened at its last height, Show all at most 70 %, Default size, and as it was after a restart (screenshot)', async () => {
  const { launched, page, root } = await open(QUEUED)
  let relaunched: Awaited<ReturnType<typeof open>> | undefined
  let closed = false
  try {
    await page.locator('#board-button').click()
    await expect(panel(page)).toBeVisible()
    const initial = await height(page, '#board-panel')
    // A column with more cards than fit scrolls under its fixed heading.
    const queued = columnOf(page, 'queued').locator('.board-cards')
    expect(await queued.evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true)
    await expect(columnOf(page, 'queued').locator('.board-heading')).toBeInViewport()

    const divider = await page.locator('#board-divider').boundingBox()
    const x = (divider?.x ?? 0) + (divider?.width ?? 0) / 2
    const y = (divider?.y ?? 0) + (divider?.height ?? 0) / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 40, { steps: 4 })
    await page.mouse.move(x, y + 60, { steps: 4 })
    await page.mouse.up()
    const dragged = await height(page, '#board-panel')
    expect(Math.abs(dragged - (initial + 60))).toBeLessThanOrEqual(4)
    await expect.poll(() => saved(root, 'projects.json').projects[0].board_height).toBe(dragged)

    await page.locator('#board-button').click()
    await expect(panel(page)).toBeHidden()
    await page.locator('#board-button').click()
    await expect.poll(() => height(page, '#board-panel')).toBe(dragged)

    await page.locator('#board-panel [data-key="show-all"]').click()
    const all = await height(page, '#board-panel')
    expect(all).toBeGreaterThan(dragged)
    expect(all).toBeLessThanOrEqual(Math.floor((await area(page)) * 0.7))
    const fits = await queued.evaluate((n) => n.scrollHeight <= n.clientHeight + 1)
    expect(fits || all === Math.floor((await area(page)) * 0.7)).toBe(true)
    await expect.poll(() => saved(root, 'projects.json').projects[0].board_height).toBe(all)
    await shot(page, 'board-all.png')

    await page.locator('#board-panel [data-key="default-size"]').click()
    await expect.poll(() => height(page, '#board-panel')).toBe(initial)
    await expect
      .poll(() => saved(root, 'projects.json').projects[0])
      .not.toHaveProperty('board_height')

    await page.locator('#board-panel [data-key="show-all"]').click()
    await expect.poll(() => saved(root, 'projects.json').projects[0].board_height).toBe(all)
    // The config as the quit leaves it; closing removes the run's own directory.
    const profile = mkdtempSync(join(tmpdir(), 'menkar-e2e-profile-'))
    cpSync(join(root, 'config'), join(profile, 'config'), { recursive: true })
    await launched.close()
    closed = true
    relaunched = await open(QUEUED, false, profile)
    await expect(relaunched.page.locator('#board-button')).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(relaunched.page)).toBeVisible()
    await expect.poll(() => height(relaunched?.page as Page, '#board-panel')).toBe(all)
  } finally {
    if (!closed) await launched.close()
    await relaunched?.launched.close()
  }
})

test('more than 6 open tasks: the list shows 6 and "See all (8) →", which opens the Board on Show all', async () => {
  const { launched, page } = await open(QUEUED)
  try {
    await expect(page.locator('#session-list .task-row')).toHaveCount(6)
    await expect(page.locator('.see-all')).toHaveText('See all (8) →')
    await page.locator('.see-all').click()
    await expect(panel(page)).toBeVisible()
    await expect(page.locator('#board-button')).toHaveAttribute('aria-pressed', 'true')
    await expect(columnOf(page, 'queued').locator('.task-card')).toHaveCount(8)
    const queued = columnOf(page, 'queued').locator('.board-cards')
    await expect
      .poll(async () => {
        const fits = await queued.evaluate((n) => n.scrollHeight <= n.clientHeight + 1)
        const capped = (await height(page, '#board-panel')) === Math.floor((await area(page)) * 0.7)
        return fits || capped
      })
      .toBe(true)
    await expect(page.locator('.tab')).toHaveCount(2)
  } finally {
    await launched.close()
  }
})

test('the shell drawer keeps its height when the Board opens; the agent’s pane gives the room', async () => {
  const { launched, page } = await open()
  try {
    const agent = '.tab-body:not(.hidden) > .pane:not(.drawer)'
    const drawer = '.tab-body:not(.hidden) > .pane.drawer'
    await page.locator(`${agent} .xterm`).click()
    await page.keyboard.press('Control+Backquote')
    await expect(page.locator(drawer)).toBeVisible()
    const before = await height(page, drawer)
    const paneBefore = await height(page, agent)
    await page.locator('#board-button').click()
    await expect(panel(page)).toBeVisible()
    const board = await height(page, '#board-panel')
    await expect.poll(() => height(page, drawer)).toBe(before)
    expect(await height(page, agent)).toBeLessThan(paneBefore - board + 10)
    // Show all is capped so the agent's pane keeps its minimum: the drawer still keeps its height.
    await page.locator('#board-panel [data-key="show-all"]').click()
    await expect.poll(() => height(page, drawer)).toBe(before)
  } finally {
    await launched.close()
  }
})

const FULL: SeedTask[] = [7, 8, 9].map((number) => ({
  number,
  title: 'Measure the default height',
  assignee: TEAM.w1,
  state: 'in progress',
  steps: STEPS5,
  step: 2,
  note: 'reading the probe',
}))

// How many lines a card's title takes, from the rectangles of its text.
const titleLines = (card: ReturnType<Page['locator']>) =>
  card.locator('.card-title').evaluate((n) => {
    const range = document.createRange()
    range.selectNodeContents(n)
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size
  })

test('the Board at its default height shows two full cards whole (two-line title, assignee, bar, note), at the test window’s width and at a wide one (screenshots)', async () => {
  const { launched, page } = await open(FULL)
  try {
    await page.locator('#board-button').click()
    await expect(panel(page)).toBeVisible()
    for (const width of [0, 1550]) {
      if (width > 0) {
        await launched.app.evaluate(({ BrowserWindow }, w) => {
          const win = BrowserWindow.getAllWindows()[0]
          const b = win?.getContentBounds()
          if (win && b) win.setContentBounds({ ...b, width: w })
        }, width)
        await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width)
      }
      const cards = columnOf(page, 'in-progress').locator('.task-card')
      await expect(cards).toHaveCount(3)
      for (const i of [0, 1]) {
        const card = cards.nth(i)
        expect(await titleLines(card)).toBe(2)
        await expect(card.locator('.card-assignee')).toHaveText('packager')
        await expect(card.locator('.dot')).toHaveCount(1)
        await expect(card.locator('.segment')).toHaveCount(5)
        await expect(card.locator('.card-note')).toHaveText('reading the probe')
      }
      const visible = await columnOf(page, 'in-progress')
        .locator('.board-cards')
        .evaluate((n) => n.getBoundingClientRect().bottom)
      const second = await cards.nth(1).evaluate((n) => n.getBoundingClientRect().bottom)
      expect(second).toBeLessThanOrEqual(visible + 0.5)
      await shot(page, `board-full-cards-${width || 'test'}.png`)
    }
  } finally {
    await launched.close()
  }
})

const LONG_TITLE =
  'task_star: the orchestrator sets or removes a star on a task when the human asks for it, and the Board shows it'

test('a title of three lines or more is clamped to two on the Board, whole in its tooltip, and the second card still fits at the default height (screenshot)', async () => {
  const [first, second, third] = FULL
  const { launched, page } = await open([
    first as SeedTask,
    { ...(second as SeedTask), title: LONG_TITLE },
    third as SeedTask,
  ])
  try {
    await page.locator('#board-button').click()
    await expect(panel(page)).toBeVisible()
    const cards = columnOf(page, 'in-progress').locator('.task-card')
    await expect(cards).toHaveCount(3)
    const long = cards.nth(1)
    const title = long.locator('.card-title')
    await expect(title).toHaveAttribute('title', LONG_TITLE)
    const lines = await title.evaluate((n) => {
      // One line's height, from a copy of the title holding one word.
      const one = n.cloneNode() as HTMLElement
      one.textContent = 'x'
      n.after(one)
      const line = one.offsetHeight
      one.remove()
      return { shown: n.clientHeight / line, whole: n.scrollHeight / line }
    })
    expect(lines.whole).toBeGreaterThanOrEqual(3)
    expect(lines.shown).toBeLessThanOrEqual(2.05)
    const visible = await columnOf(page, 'in-progress')
      .locator('.board-cards')
      .evaluate((n) => n.getBoundingClientRect().bottom)
    for (const part of ['.step-segments', '.card-note']) {
      const bottom = await long.locator(part).evaluate((n) => n.getBoundingClientRect().bottom)
      expect(bottom).toBeLessThanOrEqual(visible + 0.5)
    }
    await shot(page, 'board-long-title.png')
  } finally {
    await launched.close()
  }
})
