// The orchestration mode's one sidebar view (decision 1.177): the tiles, Awaiting you, Tasks, the
// session rows and Done today; the ★ on tasks (1.114), tasks on the rows and the Board panel (1.116,
// 1.126), on a seeded team with tasks.json and topics.json.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { SIDEBAR_MIN_WIDTH } from '../src/core/settings'
import { launchApp } from './app'
import { catppuccin, prepare } from './fixtures'

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
  waiting_note?: string
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

// What some tests add to the seed: open topics after the base ones (the last one discussing), the
// language, and files in the project's files folder.
interface SeedMore {
  readonly topics?: number
  readonly language?: string
  readonly files?: number
  // Sessions hidden in the project (decision 1.25).
  readonly hidden?: readonly (keyof typeof TEAM)[]
}

function seed(
  dirs: { readonly root: string; readonly home: string },
  tasks: SeedTask[],
  orchestratorOpen = false,
  more: SeedMore = {},
) {
  const env = prepare(dirs)
  if (more.language) {
    const state = join(dirs.root, 'config', 'menkar', 'state.json')
    const saved = JSON.parse(readFileSync(state, 'utf8'))
    writeFileSync(
      state,
      JSON.stringify({ ...saved, settings: { ...saved.settings, language: more.language } }),
    )
  }
  if (more.files) {
    const folder = join(dirs.home, 'Menkar', 'team', 'files')
    mkdirSync(folder, { recursive: true })
    for (let i = 1; i <= more.files; i++) writeFileSync(join(folder, `note-${i}.md`), `${i}`)
  }
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
          ...(orchestratorOpen ? { orchestrator_open: true } : {}),
          ...(more.hidden ? { hidden: more.hidden.map((k) => TEAM[k]) } : {}),
          ...(more.files ? { files_folder: 'team' } : {}),
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
          next: 4 + (more.topics ?? 0),
          topics: [
            topic(1, 'Name of the docs section', { task: 1 }),
            topic(2, 'Deploy key missing', { blocking: true }),
            topic(3, 'Release date', { status: 'closed', decision: 'Friday', updated: nowIso() }),
            ...Array.from({ length: more.topics ?? 0 }, (_, i) =>
              topic(
                4 + i,
                `Question ${4 + i}`,
                i === (more.topics ?? 0) - 1 ? { status: 'discussing' } : {},
              ),
            ),
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
async function open(
  tasks = BASE_TASKS,
  orchestratorOpen = false,
  profile?: string,
  more: SeedMore = {},
) {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      const env = seed(dirs, tasks, orchestratorOpen, more)
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

const row = (page: Page, key: keyof typeof TEAM) =>
  page.locator(`#session-list .row[data-session="${TEAM[key]}"]`)

test('one view: tiles and Awaiting you on top, no Tasks list in the sidebar, the rows, Consultants folding, Done today folded and saved; ★ from a card (screenshot)', async () => {
  const { launched, page, root } = await open()
  try {
    await expect(page.locator('#view-switch')).toHaveCount(0)
    await expect(page.locator('#topics-section .work-tile .tile-n')).toHaveText(['2', '1', '1'])
    // Topic 1 belongs to task 1, which has no ★: the blocking one comes first.
    await expect(page.locator('#topics-section .topic-row')).toHaveText([
      '2Deploy key missing',
      '1Name of the docs section',
    ])
    // Decision 1.198: the tasks are on the Board only, open by default.
    await expect(page.locator('#board-panel .board .task-card')).toHaveCount(5)
    await expect(page.locator('#sidebar .task-card, #sidebar [data-task]')).toHaveCount(0)
    await expect(page.locator('#sidebar')).not.toContainText('Tasks ·')
    await expect(page.locator('#sidebar')).not.toContainText('See all')
    await expect(row(page, 'expert')).toBeVisible()

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
    await page.locator('[data-heading="consultants"]').click()
    await expect(row(page, 'expert')).toHaveCount(0)
    await expect
      .poll(() => saved(root, 'projects.json').projects[0].consultants_collapsed)
      .toBe(true)
    await page.locator('[data-heading="consultants"]').click()
    await shot(page, 'work.png')

    // The ★ from a card's right-click menu: written, and the card shows it.
    const queued = page.locator('#board-panel .task-card[data-task="3"]')
    await queued.click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Mark with ★' }).click()
    await expect.poll(() => saved(root, 'tasks.json').projects[PROJECT].tasks[2].star).toBe(true)
    await expect(queued.locator('.priority-star')).toHaveCount(1)
  } finally {
    await launched.close()
  }
})

test('the orchestrator unfolded by its triangle, saved as orchestrator_open; each row with its current task and step, ★ from the task; mode off shows none of it (screenshot)', async () => {
  const { launched, page, root } = await open()
  try {
    await expect(row(page, 'w1')).toHaveCount(0)
    expect(saved(root, 'projects.json').projects[0]).not.toHaveProperty('orchestrator_open')
    await row(page, 'orch').locator('.team-fold').click()
    await expect.poll(() => saved(root, 'projects.json').projects[0].orchestrator_open).toBe(true)
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

    // The Board closed by the human is saved; switching the mode off hides it and forgets the
    // closing (decisions 1.126, 1.198).
    await expect(page.locator('#board-panel')).toBeVisible()
    await page.locator('#board-button').click()
    await expect(page.locator('#board-panel')).toBeHidden()
    await expect.poll(() => saved(root, 'projects.json').projects[0].board_open).toBe(false)
    await page.locator('#orchestration-switch').click()
    await expect(page.locator('#board-panel')).toBeHidden()
    await expect
      .poll(() => saved(root, 'projects.json').projects[0])
      .not.toHaveProperty('board_open')
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('#topics-section')).toBeEmpty()
    await expect(page.locator('#board-button')).toBeHidden()
    await expect(page.locator('.team-task')).toHaveCount(0)
    await expect(page.locator('.priority-star')).toHaveCount(0)
    // Turned on again, the Board opens as it does by default.
    await page.locator('#orchestration-switch').click()
    await expect(page.locator('#board-panel')).toBeVisible()
  } finally {
    await launched.close()
  }
})

const panel = (page: Page) => page.locator('#board-panel')
const columnOf = (page: Page, key: string) => page.locator(`#board-panel [data-column="${key}"]`)
const height = async (page: Page, selector: string) =>
  Math.round((await page.locator(selector).boundingBox())?.height ?? -1)
// A column's cards past its height. Every state push replaces the Board's columns, so a locator's
// evaluate can run on a column already detached, which measures 0 and 0; one evaluate that finds
// the node itself reads the live one.
const overflow = (page: Page, key: string) =>
  page.evaluate((selector) => {
    const n = document.querySelector(selector)
    return n === null ? null : n.scrollHeight - n.clientHeight
  }, `#board-panel [data-column="${key}"] .board-cards`)
// The right-hand area under the header.
const area = (page: Page) =>
  page.evaluate(
    () =>
      (document.getElementById('content')?.clientHeight ?? 0) -
      (document.querySelector<HTMLElement>('.content-header')?.offsetHeight ?? 0),
  )

test('the Board panel: open by default (pressed), under the header and over the tab strip only, two cards high, its cards as before; closing it is saved (screenshot)', async () => {
  const { launched, page, root } = await open()
  try {
    const button = page.locator('#board-button')
    const column = (key: string) => columnOf(page, key)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page)).toBeVisible()
    expect(saved(root, 'projects.json').projects[0]).not.toHaveProperty('board_open')
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

    // × closes it as the button does; closed is what is saved, open writes nothing.
    await page.locator('#board-panel [data-key="close"]').click()
    await expect(panel(page)).toBeHidden()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => saved(root, 'projects.json').projects[0].board_open).toBe(false)
    await button.click()
    await expect(panel(page)).toBeVisible()
    await expect
      .poll(() => saved(root, 'projects.json').projects[0])
      .not.toHaveProperty('board_open')
    await button.click()
    await expect(panel(page)).toBeHidden()
    await expect.poll(() => saved(root, 'projects.json').projects[0].board_open).toBe(false)
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

test('a task in To review says whom it waits on, on its card: "waiting on PR approval #436", "waiting on the human"; the orchestrator says nothing (screenshot)', async () => {
  const { launched, page } = await open(IN_REVIEW)
  try {
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

// Decision 1.197: a task in To review waiting on a PR's approval or merge awaits the human, after
// the topics, and the "for you" tile counts it; one waiting on the human or the orchestrator does not.
test('Awaiting you shows a row per PR waiting on the human, after the topics; "for you" counts them; a click selects the assignee; a wait outside shows its kind and note (screenshots)', async () => {
  const merge: SeedTask = {
    number: 4,
    title: 'Search page',
    assignee: TEAM.w2,
    state: 'to review',
    steps: ['a', 'b', 'c'],
    step: 3,
    note: 'approved',
    review_wait: { on: 'pr-merge', note: 'https://github.com/acme/app/pull/512' },
  }
  // Decision 1.199: a wait outside shows its kind's label and its note, as a review wait does.
  const build: SeedTask = {
    number: 5,
    title: 'Nightly package',
    assignee: TEAM.plain,
    state: 'waiting',
    steps: ['a', 'b', 'c'],
    step: 2,
    note: 'built locally',
    waiting_on: 'build',
    waiting_note: 'nightly',
  }
  const { launched, page } = await open([...IN_REVIEW, merge, build])
  try {
    const top = page.locator('#topics-section')
    await expect(top.locator('.work-tile .tile-n')).toHaveText(['4', '0', '1'])
    await expect(top.locator('.topics-toggle')).toHaveText('Awaiting you · 4')
    await expect(top.locator('.topic-row')).toHaveCount(4)
    await expect(top.locator('.topic-row').nth(2)).toHaveAttribute('data-pr-task', '1')
    const pr = (n: number) => top.locator(`.pr-row[data-pr-task="${n}"]`)
    await expect(pr(1).locator('.topic-title')).toHaveText('PR #436 · approve')
    await expect(pr(1).locator('.pr-assignee')).toHaveText('packager')
    await expect(pr(4).locator('.topic-title')).toHaveText('PR #512 · merge')
    await expect(pr(4).locator('.pr-assignee')).toHaveText('docs writer')
    await expect(top.locator('.pr-row')).toHaveCount(2)
    await filesShots(page, (scheme) => `menkar-t170-awaiting-pr-${scheme}.png`)
    await page.locator('.tab', { hasText: 'orchestrator' }).click()
    await expect(page.locator('.tab.selected')).toHaveText(/orchestrator/)
    await pr(1).click()
    await expect(page.locator('.tab.selected')).toHaveText(/packager/)
    await expect(
      columnOf(page, 'waiting').locator('.task-card[data-task="5"] .card-note'),
    ).toHaveText('waiting on the build nightly · built locally')
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
    await expect(panel(page)).toBeVisible()
    const initial = await height(page, '#board-panel')
    // A column with more cards than fit scrolls under its fixed heading.
    expect(await overflow(page, 'queued')).toBeGreaterThan(0)
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
    const fits = ((await overflow(page, 'queued')) ?? Number.POSITIVE_INFINITY) <= 1
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

// A worker's row menu as it was before the single view: its tab open, so Stop and no Trash.
const WORKER_MENU = [
  'Open',
  'Open beside the current tab',
  'Open folder',
  'Stop',
  'Remote control',
  'Mute',
  'Group ▸',
  'Orchestrator',
  'Configure role…',
  'With you',
  'Stop reporting to the orchestrator',
  'Rename…',
  'Fork session',
  'Details…',
  'Copy session ID',
  'Export as Markdown…',
  'Reveal transcript',
  'Hide',
  'Remove from project',
]

// What #session-list holds, top to bottom, one word per item.
const listOrder = (page: Page) =>
  page.locator('#session-list > *').evaluateAll((nodes) =>
    nodes.map((n) => {
      const e = n as HTMLElement
      if (e.classList.contains('team-heading')) return `heading ${e.dataset.heading}`
      if (e.classList.contains('hidden-foot')) return e.textContent ?? ''
      if (e.classList.contains('row')) return `row ${e.querySelector('.name')?.textContent ?? ''}`
      const done = e.querySelector<HTMLElement>('[data-section="done"]')
      if (done) return `${done.textContent} ${done.getAttribute('aria-expanded')}`
      return e.className
    }),
  )

const contentSize = (launched: Awaited<ReturnType<typeof launchApp>>, w: number, h: number) =>
  launched.app.evaluate(
    ({ BrowserWindow }, [width, height]) => {
      const win = BrowserWindow.getAllWindows()[0]
      const b = win?.getContentBounds()
      if (win && b) win.setContentBounds({ ...b, width, height })
    },
    [w, h] as const,
  )

// Decision 1.177 (task 60's mock-ups): one view, no Work/Team switch; the tiles and Awaiting you
// stay on top while the rest scrolls; "N hidden" after Others, before Done today (D4).
test('the single view in order: tiles and Awaiting you fixed, no Tasks list, the orchestrator folded with its count, Consultants, Others, N hidden, Done today folded; at 480 px high the top stays (screenshots)', async () => {
  const { launched, page } = await open(QUEUED, false, undefined, { hidden: ['w2'] })
  try {
    await expect(page.locator('#view-switch')).toHaveCount(0)
    await expect(page.locator('#topics-section > .work-tiles')).toHaveCount(1)
    await expect(page.locator('#topics-section .topics-toggle').first()).toHaveText(
      'Awaiting you · 2',
    )
    await expect(row(page, 'orch').locator('.team-count')).toHaveText('1')
    await expect
      .poll(() => listOrder(page))
      .toEqual([
        'row orchestrator',
        'heading consultants',
        'row fabric',
        'heading others',
        'row notes',
        '1 hidden',
        'Done today · 1 false',
      ])

    // The row menu of a worker keeps its items, in their order (decision 1.177).
    await expect(row(page, 'w1')).toHaveCount(0)
    await row(page, 'orch').locator('.team-fold').click()
    await row(page, 'w1').locator('.more').click()
    expect(await page.locator('.menu-item').allTextContents()).toEqual(WORKER_MENU)
    await page.keyboard.press('Escape')
    await row(page, 'orch').locator('.team-fold').click()
    await expect(row(page, 'w1')).toHaveCount(0)

    await contentSize(launched, 1280, 800)
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(800)
    await filesShots(page, (scheme) => `menkar-t88-41-b4-folded-${scheme}.png`)
    await row(page, 'orch').locator('.team-fold').click()
    await expect(row(page, 'w1')).toBeVisible()
    await filesShots(page, (scheme) => `menkar-t88-41-b4-unfolded-${scheme}.png`)

    // At a low height the list scrolls under the tiles and Awaiting you.
    await contentSize(launched, 1280, 480)
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(480)
    const list = page.locator('#session-list')
    expect(await list.evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true)
    await list.evaluate((n) => {
      n.scrollTop = n.scrollHeight
    })
    await expect(page.locator('[data-section="done"]')).toBeInViewport()
    await expect(page.locator('#topics-section .work-tiles')).toBeInViewport()
    await expect(page.locator('#topics-section .topics-toggle').first()).toBeInViewport()
    const files = process.env.MENKAR_FILES
    if (files) await page.screenshot({ path: join(files, 'menkar-t88-41-b4-scrolled-480.png') })
  } finally {
    await launched.close()
  }
})

test('the shell drawer keeps its height when the Board opens; the agent’s pane gives the room', async () => {
  const { launched, page } = await open()
  try {
    const agent = '.tab-body:not(.hidden) > .pane:not(.drawer)'
    const drawer = '.tab-body:not(.hidden) > .pane.drawer'
    await page.locator('#board-button').click()
    await expect(panel(page)).toBeHidden()
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
        await expect.poll(() => titleLines(card)).toBe(2)
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
    await expect(panel(page)).toBeVisible()
    const cards = columnOf(page, 'in-progress').locator('.task-card')
    await expect(cards).toHaveCount(3)
    const long = cards.nth(1)
    const title = long.locator('.card-title')
    await expect(title).toHaveAttribute('title', LONG_TITLE)
    // The Board redraws while the app starts: a title replaced mid-measure reads no line height.
    const measure = () =>
      title.evaluate((n) => {
        // One line's height, from a copy of the title holding one word.
        const one = n.cloneNode() as HTMLElement
        one.textContent = 'x'
        n.after(one)
        const line = one.offsetHeight
        one.remove()
        return line > 0 ? { shown: n.clientHeight / line, whole: n.scrollHeight / line } : null
      })
    await expect(async () => {
      const lines = await measure()
      expect(lines?.whole).toBeGreaterThanOrEqual(3)
      expect(lines?.shown).toBeLessThanOrEqual(2.05)
    }).toPass()
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

// ---------------------------------------------------------------- decisions 1.171 and 1.172

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

const setScheme = async (page: Page, scheme: 'dark' | 'light') => {
  await page.evaluate(
    async ([s, theme]) => {
      const prefs = (
        globalThis as unknown as {
          menkar: { preferences: { set(k: string, v: string): Promise<unknown> } }
        }
      ).menkar.preferences
      await prefs.set('color_scheme', s)
      await prefs.set('terminal_theme', theme)
    },
    [scheme, catppuccin(scheme)] as const,
  )
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.colorScheme))
    .toBe(scheme)
}

// Each scheme's screenshot into the project's files folder, when the run has one.
async function filesShots(page: Page, name: (scheme: string) => string): Promise<void> {
  const files = process.env.MENKAR_FILES
  if (!files) return
  for (const scheme of ['dark', 'light'] as const) {
    await setScheme(page, scheme)
    await page.screenshot({ path: join(files, name(scheme)) })
  }
  await setScheme(page, 'dark')
}

const typeInto = (page: Page, session: string, data: string) =>
  page.evaluate(
    async ([id, text]) => {
      const m = (
        globalThis as unknown as {
          menkar: {
            window: {
              state(): Promise<{
                tabs: { panes: { id: string; sessionId: string | null }[] }[]
              } | null>
            }
            panes: { input(pane: string, text: string): unknown }
          }
        }
      ).menkar
      const s = await m.window.state()
      const pane = s?.tabs.flatMap((tab) => tab.panes).find((p) => p.sessionId === id)?.id ?? ''
      return m.panes.input(pane, text)
    },
    [session, data] as const,
  )

test('the orchestrator’s group folds (its count and the worst dot, red at a prompt), Consultants and Others, each saved per project and kept after a restart (screenshots)', async () => {
  const first = await open(BASE_TASKS, true)
  const { page, root } = first
  // The config as the quit leaves it; closing removes the run's own directory.
  const profile = mkdtempSync(join(tmpdir(), 'menkar-e2e-profile-'))
  try {
    await expect(row(page, 'w1')).toBeVisible()
    await expect(page.locator('.xterm-rows').first()).toContainText('stand-in claude ready', {
      timeout: 15_000,
    })
    await typeInto(page, TEAM.w1, 'ASK')
    await expect
      .poll(() => row(page, 'w1').locator('.dot').first().getAttribute('class'), {
        timeout: 10_000,
      })
      .toContain('blocked')

    const orch = row(page, 'orch')
    await orch.locator('.team-fold').click()
    await expect
      .poll(() => saved(root, 'projects.json').projects[0])
      .not.toHaveProperty('orchestrator_open')
    await expect(row(page, 'w1')).toHaveCount(0)
    await expect(page.locator('.earlier-row')).toHaveCount(0)
    await expect(orch.locator('.team-count')).toHaveText('2')
    await expect(orch.locator('.team-count + .dot')).toHaveClass(/blocked/)

    await page.locator('[data-heading="consultants"]').click()
    await expect
      .poll(() => saved(root, 'projects.json').projects[0].consultants_collapsed)
      .toBe(true)
    await expect(row(page, 'expert')).toHaveCount(0)
    await page.locator('[data-heading="others"]').click()
    await expect.poll(() => saved(root, 'projects.json').projects[0].others_collapsed).toBe(true)
    await expect(row(page, 'plain')).toHaveCount(0)
    await expect(page.locator('[data-heading="others"]')).toHaveAttribute('aria-expanded', 'false')
    await filesShots(page, (scheme) => `menkar-t52-team-folded-${scheme}.png`)
    cpSync(join(root, 'config'), join(profile, 'config'), { recursive: true })
  } finally {
    await first.launched.close()
  }

  const again = await open(BASE_TASKS, true, profile)
  try {
    const page2 = again.page
    await expect(row(page2, 'orch').locator('.team-count')).toHaveText('2')
    await expect(row(page2, 'w1')).toHaveCount(0)
    await expect(row(page2, 'expert')).toHaveCount(0)
    await expect(row(page2, 'plain')).toHaveCount(0)
    // Unfolded again, every row is back, saved as orchestrator_open, and no fold key is left.
    await row(page2, 'orch').locator('.team-fold').click()
    await page2.locator('[data-heading="consultants"]').click()
    await page2.locator('[data-heading="others"]').click()
    await expect(row(page2, 'w1')).toBeVisible()
    await expect(row(page2, 'expert')).toBeVisible()
    await expect(row(page2, 'plain')).toBeVisible()
    await expect(row(page2, 'orch').locator('.team-count')).toHaveCount(0)
    await expect
      .poll(() => Object.keys(saved(again.root, 'projects.json').projects[0]))
      .not.toContain('others_collapsed')
    const written = saved(again.root, 'projects.json').projects[0]
    expect(written.orchestrator_open).toBe(true)
    for (const key of ['orchestrator_collapsed', 'consultants_collapsed', 'others_collapsed'])
      expect(Object.keys(written)).not.toContain(key)
  } finally {
    await again.launched.close()
    rmSync(profile, { recursive: true, force: true })
  }
})

const topicNumbers = (page: Page) =>
  page.locator('.topic-row').evaluateAll((ns) => ns.map((n) => n.getAttribute('data-topic')))

test('"Awaiting you" shows 5 topics, the current one first, then "N more…"; a click unfolds the rest (screenshots)', async () => {
  // Topics 1, 2 (blocking) and 4–13 open, 13 discussing: 12 in all.
  const { launched, page } = await open(BASE_TASKS, true, undefined, { topics: 10 })
  try {
    await expect(page.locator('#topics-section .topics-toggle')).toHaveText('Awaiting you · 12')
    await expect.poll(() => topicNumbers(page)).toEqual(['13', '2', '1', '4', '5'])
    await expect(page.locator('.topic-more')).toHaveText('7 more…')
    await filesShots(page, (scheme) => `menkar-t52-topics-more-${scheme}.png`)

    await page.locator('.topic-more').click()
    await expect(page.locator('.topic-row')).toHaveCount(12)
    await expect(page.locator('.topic-more')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

// One line each and nothing clipped: every line box of its text on one row and inside it.
const oneLine = (page: Page, selector: string) =>
  page.locator(selector).evaluate((node) => {
    const box = node.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(node)
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
    const middle = (r: DOMRect) => (r.top + r.bottom) / 2
    const line = rects[0] ? middle(rects[0]) : 0
    return {
      lines: rects.length > 0 && rects.every((r) => Math.abs(middle(r) - line) < 4),
      clipped: node.scrollWidth > node.clientWidth + 1 || box.right > window.innerWidth,
    }
  })

for (const language of ['en', 'es'] as const)
  test(`at the narrowest sidebar, 270 px, nothing wraps or is clipped in its top rows and headings; the Files heading shortens with "…" (${language}, screenshot)`, async () => {
    const { launched, page } = await open(BASE_TASKS, false, undefined, {
      topics: 10,
      files: 54,
      language,
    })
    try {
      expect(SIDEBAR_MIN_WIDTH).toBe(270)
      await act(page, { type: 'setSidebarWidth', width: SIDEBAR_MIN_WIDTH })
      await expect.poll(async () => (await page.locator('#sidebar').boundingBox())?.width).toBe(270)
      const awaiting = language === 'es' ? 'Pendientes tuyos · 12' : 'Awaiting you · 12'
      await expect(page.locator('.topics-heading .topics-toggle').first()).toHaveText(awaiting)
      await expect(page.locator('.files-label')).toHaveText(
        language === 'es' ? 'Archivos · 54' : 'Files · 54',
      )
      await expect(page.locator('#presence-chip')).toBeVisible()
      for (const selector of [
        '.sidebar-header',
        '#topics-section .topics-heading .topics-toggle',
        '.files-heading',
        '#presence-chip',
      ])
        expect({ selector, ...(await oneLine(page, selector)) }).toEqual({
          selector,
          lines: true,
          clipped: false,
        })
      // The project's name reads whole, not shortened to a letter or two.
      expect(
        await page
          .locator('#project-button .project-name')
          .evaluate((n) => n.scrollWidth <= n.clientWidth),
      ).toBe(true)
      // The label may shorten, on its one line, but never pushes its heading's buttons out.
      expect(await oneLine(page, '.files-label')).toMatchObject({ lines: true })
      const files = process.env.MENKAR_FILES
      if (files) await page.screenshot({ path: join(files, `menkar-t52-min-270-${language}.png`) })
    } finally {
      await launched.close()
    }
  })
