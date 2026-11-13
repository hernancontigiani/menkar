// Plan 36: the orchestration mode's Work view (decisions 1.112, 1.115), the ★ on tasks (1.114),
// tasks in the Team view and the Board (1.116), on a seeded team with tasks.json and topics.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    state: 'done',
    steps: ['a', 'b', 'c'],
    step: 3,
    closed: daysAgo(3),
  },
  {
    number: 6,
    title: 'Icon fix',
    assignee: TEAM.w1,
    state: 'done',
    steps: ['a', 'b', 'c'],
    step: 3,
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

async function open(tasks = BASE_TASKS, teamView = false) {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return seed(dirs, tasks, teamView)
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

    // The human, 2026-11-13: switching the mode off closes the Board tab.
    await page.locator('#board-button').click()
    await expect(page.locator('.tab')).toHaveCount(3)
    await page.locator('#orchestration-switch').click()
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('.tab', { hasText: 'Board' })).toHaveCount(0)
    await expect(page.locator('#view-switch')).toBeEmpty()
    await expect(page.locator('#board-button')).toBeHidden()
    await expect(page.locator('.team-task')).toHaveCount(0)
    await expect(page.locator('.priority-star')).toHaveCount(0)
    await expect(page.locator('.task-row')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('the Board: opened from the header once, its columns and cards, a card selects its assignee’s tab, "Done before" folded (screenshot)', async () => {
  const { launched, page } = await open()
  try {
    await page.locator('#board-button').click()
    await expect(page.locator('.tab')).toHaveCount(3)
    await expect(page.locator('.tab.selected')).toHaveText(/Board/)
    const column = (key: string) => page.locator(`.tab-body:not(.hidden) [data-column="${key}"]`)
    await expect(column('topics').locator('.board-card')).toHaveCount(2)
    await expect(column('queued').locator('.task-card')).toHaveText([/Notes cleanup/])
    await expect(column('in-progress').locator('.task-card')).toHaveText([/Release 0.2/])
    await expect(column('in-progress').locator('.task-card')).toContainText('3/5')
    await expect(column('in-progress').locator('.task-card')).toContainText('building .deb')
    await expect(column('in-progress').locator('.task-card .dot')).toHaveCount(1)
    await expect(column('waiting').locator('.task-card')).toHaveText([/Docs pass/])
    await expect(column('to-review').locator('.task-card')).toHaveText([/Login fix/])
    await expect(column('done').locator('.task-card')).toHaveText([/Icon fix/])
    await expect(column('done').locator('.board-before')).toHaveText('Done before · 1')
    await shot(page, 'board.png')
    await column('done').locator('.board-before').click()
    await expect(column('done').locator('.task-card')).toHaveCount(2)

    // Opening it again selects the same tab.
    await page.locator('.tab', { hasText: 'orchestrator' }).click()
    await page.locator('#board-button').click()
    await expect(page.locator('.tab')).toHaveCount(3)
    await expect(page.locator('.tab.selected')).toHaveText(/Board/)

    await column('in-progress').locator('.task-card').click()
    await expect(page.locator('.tab.selected')).toHaveText(/packager/)
  } finally {
    await launched.close()
  }
})

test('more than 6 open tasks: the list shows 6 and "See all (8) →", which opens the Board, once', async () => {
  const many: SeedTask[] = Array.from({ length: 8 }, (_, i) => ({
    number: i + 1,
    title: `Task ${i + 1}`,
    assignee: TEAM.w2,
    state: 'queued',
  }))
  const { launched, page } = await open(many)
  try {
    await expect(page.locator('#session-list .task-row')).toHaveCount(6)
    await expect(page.locator('.see-all')).toHaveText('See all (8) →')
    await page.locator('.see-all').click()
    await expect(page.locator('.tab.selected')).toHaveText(/Board/)
    await expect(
      page.locator('.tab-body:not(.hidden) [data-column="queued"] .task-card'),
    ).toHaveCount(8)
    await page.locator('.tab', { hasText: 'orchestrator' }).click()
    await page.locator('.see-all').click()
    await expect(page.locator('.tab')).toHaveCount(3)
    await expect(page.locator('.tab.selected')).toHaveText(/Board/)
  } finally {
    await launched.close()
  }
})
