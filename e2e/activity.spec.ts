// Decision 1.180: Menkar records, with no text, each prompt the human answers, each topic discussed
// or closed, and each task's state changes, in a journal main appends to and imports into the usage
// history after each usage pass, off its main thread.
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, type Page, test } from '@playwright/test'
import { type LaunchedApp, launchApp, terminalText } from './app'
import { prepare, SESSION } from './fixtures'

const CLIENT_WORK = 'aaaaaaaaaaaa'
const TOPIC_TITLE = 'Secret topic title'
const TASK_TITLES = [
  'Secret queued task',
  'Secret closed task',
  'Secret waiting task',
  'Fix the login',
]

type Row = Record<string, unknown>

const activityDir = (root: string) => join(root, 'data', 'menkar', 'activity')
const journalPath = (root: string) => join(activityDir(root), 'journal.jsonl')

function journal(root: string): Row[] {
  if (!existsSync(journalPath(root))) return []
  return readFileSync(journalPath(root), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row)
}

function rows(root: string, table: 'activity' | 'task_states'): Row[] {
  try {
    const db = new DatabaseSync(join(root, 'data', 'menkar', 'history.sqlite'), { readOnly: true })
    try {
      return db.prepare(`SELECT * FROM ${table} ORDER BY at`).all() as Row[]
    } finally {
      db.close()
    }
  } catch {
    return [] // not written yet
  }
}

const task = (number: number, state: string, more: Row = {}) => ({
  number,
  title: TASK_TITLES[number - 1],
  star: false,
  state,
  steps: [],
  step: 0,
  note: '',
  created: '2026-11-12T10:00:00.000-03:00',
  updated: '2026-11-12T10:00:00.000-03:00',
  ...more,
})

// `data`: a previous run's data directory, carried over as a restart finds it.
async function open(data?: string): Promise<{ launched: LaunchedApp; page: Page; root: string }> {
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      const env = prepare(dirs)
      const work = join(dirs.home, 'work')
      writeFileSync(
        join(
          dirs.home,
          '.claude',
          'projects',
          work.replace(/[^A-Za-z0-9]/g, '-'),
          `${SESSION}.jsonl`,
        ),
        `${[
          { type: 'custom-title', customTitle: 'api' },
          { type: 'user', cwd: work, message: { content: 'fix the login bug' } },
        ]
          .map((l) => JSON.stringify(l))
          .join('\n')}\n`,
      )
      const config = join(dirs.root, 'config', 'menkar')
      writeFileSync(
        join(config, 'projects.json'),
        JSON.stringify({
          version: 1,
          current: CLIENT_WORK,
          projects: [
            {
              id: CLIENT_WORK,
              name: 'Client work',
              members: [SESSION],
              groups: [],
              orchestration: { on: true, orchestrator: SESSION },
              orchestrator_open: true,
            },
          ],
          windows: [],
        }),
      )
      writeFileSync(
        join(config, 'topics.json'),
        JSON.stringify({
          version: 1,
          projects: {
            [CLIENT_WORK]: {
              next: 2,
              topics: [
                {
                  number: 1,
                  title: TOPIC_TITLE,
                  context: 'What to do about it.',
                  from: SESSION,
                  blocking: false,
                  status: 'open',
                  created: '2026-11-12T10:00:00.000-03:00',
                  updated: '2026-11-12T10:00:00.000-03:00',
                },
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
            [CLIENT_WORK]: {
              next: 4,
              tasks: [
                task(1, 'queued'),
                task(2, 'done', { closed: '2026-11-12T11:00:00.000-03:00' }),
                // Waits on the orchestrator by its name: the id is what is recorded.
                task(3, 'waiting', { assignee: SESSION, step: 1, waiting_on: 'api' }),
              ],
            },
          },
        }),
      )
      if (data) cpSync(data, join(dirs.root, 'data', 'menkar'), { recursive: true })
      return env
    },
  })
  return { launched, page: launched.window, root }
}

const said = (page: Page, text: string) =>
  expect.poll(() => terminalText(page), { timeout: 15_000 }).toContain(text)

const textOf = (root: string): string =>
  [
    existsSync(journalPath(root)) ? readFileSync(journalPath(root), 'utf8') : '',
    JSON.stringify(rows(root, 'activity')),
    JSON.stringify(rows(root, 'task_states')),
  ].join('\n')

test('a prompt answered, a topic discussed and a task’s states are journaled with no text, and imported into the history after the next start’s pass', async () => {
  const { launched, page, root } = await open()
  const carried = mkdtempSync(join(tmpdir(), 'menkar-e2e-data-'))
  const files = process.env.MENKAR_FILES
  const record: string[] = []
  try {
    // The start's pass imports what the start journaled: app_start, then one baseline row per open
    // task, the closed one left out.
    await expect.poll(() => rows(root, 'activity').map((r) => r.kind)).toEqual(['app_start'])
    await expect
      .poll(() => rows(root, 'task_states').map((r) => [r.task, r.state, r.baseline]))
      .toEqual([
        [1, 'queued', 1],
        [3, 'waiting', 1],
      ])
    expect(rows(root, 'task_states').find((r) => r.task === 3)).toMatchObject({
      project_id: CLIENT_WORK,
      wait_kind: 'session',
      wait_ref: SESSION,
      assignee: SESSION,
    })
    expect(rows(root, 'activity')[0]?.at).toBeLessThanOrEqual(
      Number(rows(root, 'task_states')[0]?.at),
    )
    await expect.poll(() => existsSync(journalPath(root))).toBe(false)
    record.push('-- imported at start', textOf(root))

    // A prompt answered: the pane blocked at a question, then a turn clears its screen.
    await page.locator('.row', { hasText: 'api' }).dblclick()
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    await page.locator('.xterm').click()
    await page.keyboard.type('ASK')
    await expect(page.locator('.xterm-rows')).toContainText('Do you want to proceed?')
    await page.waitForTimeout(1500)
    await page.keyboard.type('TURN')
    await expect
      .poll(() => journal(root).filter((r) => r.kind === 'prompt_answered'), { timeout: 15_000 })
      .toEqual([
        expect.objectContaining({ v: 1, sessionId: SESSION, projectId: CLIENT_WORK, next: 'idle' }),
      ])
    const answered = journal(root).find((r) => r.kind === 'prompt_answered')
    expect(Number(answered?.blockedSeconds)).toBeGreaterThan(0)

    // A topic double-clicked.
    await page.locator('.topic-row[data-topic="1"]').dblclick()
    await expect
      .poll(() => journal(root).filter((r) => r.kind === 'topic_discussed'))
      .toEqual([expect.objectContaining({ topic: 1, projectId: CLIENT_WORK })])

    // A task added, its worker started, its steps given.
    await page.locator('.xterm').first().click()
    await page.keyboard.type('TASKADD')
    await said(page, 'TOOL task_add: Task 4 added.')
    await page.keyboard.type('WORKT')
    await said(page, 'TOOL start_session: Started "client-work-t1"')
    const tasks = () =>
      journal(root)
        .filter((r) => r.kind === 'task_state')
        .map((r) => [r.task, r.state])
    await expect.poll(tasks).toEqual([[4, 'queued']])
    const worker = page.locator('.row', { hasText: 'client-work-t1' })
    // Started with a prompt on its command line: its first turn is not the human's. The session
    // the human opened from the list above had none.
    const workerId = await worker.getAttribute('data-session')
    await expect
      .poll(() => journal(root).filter((r) => r.kind === 'prompted_start'))
      .toEqual([expect.objectContaining({ v: 1, sessionId: workerId, projectId: CLIENT_WORK })])
    await worker.click()
    await expect(page.locator('.xterm-rows:visible')).toContainText('stand-in claude ready')
    await page
      .locator('.tab-body:not(.hidden) .pane-banner button', { hasText: 'Take control' })
      .click()
    await page.locator('.xterm:visible').click()
    await page.keyboard.type('STEPS')
    await said(page, 'TOOL task_steps: Task 1 has 3 steps')
    await expect.poll(tasks).toEqual([
      [4, 'queued'],
      [1, 'in progress'],
    ])
    for (const line of journal(root)) {
      expect(typeof line.id).toBe('string')
      expect(typeof line.at).toBe('number')
    }
    record.push('-- journaled while running', readFileSync(journalPath(root), 'utf8'))

    for (const title of [TOPIC_TITLE, ...TASK_TITLES, 'Pick a port', 'fix the login'])
      expect(textOf(root)).not.toContain(title)
    cpSync(join(root, 'data', 'menkar'), carried, { recursive: true })
  } finally {
    await launched.close()
  }

  // The journal a quit left is imported after the next start's pass; nothing is lost, nothing twice.
  const again = await open(carried)
  try {
    // The clicks and keys above also left presence marks; their own test is below.
    const kinds = () =>
      rows(again.root, 'activity')
        .map((r) => r.kind)
        .filter((kind) => kind !== 'present')
    await expect
      .poll(kinds, { timeout: 20_000 })
      .toEqual(['app_start', 'prompt_answered', 'topic_discussed', 'prompted_start', 'app_start'])
    expect(rows(again.root, 'task_states').map((r) => [r.task, r.state, r.baseline])).toEqual([
      [1, 'queued', 1],
      [3, 'waiting', 1],
      [4, 'queued', 0],
      [1, 'in progress', 0],
    ])
    await expect.poll(() => existsSync(journalPath(again.root))).toBe(false)
    expect(readdirSync(activityDir(again.root)).filter((n) => n.startsWith('batch-'))).toEqual([])
    // The baseline is taken once: its marker is there, and the second start added none.
    expect(existsSync(join(activityDir(again.root), 'baseline'))).toBe(true)
    record.push('-- imported after the restart', textOf(again.root))
    if (files) writeFileSync(join(files, 'menkar-t96-43-b3-journal.txt'), `${record.join('\n')}\n`)
  } finally {
    await again.launched.close()
    rmSync(carried, { recursive: true, force: true })
  }
})

test('a key, a click or a scroll in the focused window is a presence mark with its project, at most one a minute, and every key still reaches the pane', async () => {
  test.setTimeout(150_000)
  const { launched, page, root } = await open()
  const files = process.env.MENKAR_FILES
  try {
    // What the start journaled is imported first, so the marks below stay in the journal.
    await expect.poll(() => rows(root, 'activity').map((r) => r.kind)).toEqual(['app_start'])
    await expect.poll(() => existsSync(journalPath(root))).toBe(false)
    const marks = () => journal(root).filter((r) => r.kind === 'present')
    const mark = (at: unknown) => ({
      v: 1,
      id: expect.any(String),
      at,
      kind: 'present',
      projectId: CLIENT_WORK,
    })

    // The renderer is up, its listeners set, once the list is drawn.
    await expect(page.locator('.row', { hasText: 'api' })).toBeVisible()
    await page.keyboard.press('Shift')
    await expect.poll(marks).toEqual([mark(expect.any(Number))])
    const first = Number(marks()[0]?.at)

    // Within the minute: a click, a session opened, keys typed into its pane — no second mark, and
    // the pane got the keys: the stand-in asks its question on ASK.
    await page.locator('.row', { hasText: 'api' }).dblclick()
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    await page.locator('.xterm').click()
    await page.keyboard.type('ASK')
    await expect(page.locator('.xterm-rows')).toContainText('Do you want to proceed?')
    expect(marks()).toHaveLength(1)

    // A scroll in the sidebar once the minute has passed.
    await page.waitForTimeout(Math.max(0, (first + 61) * 1000 - Date.now()))
    await page.locator('#sidebar').hover()
    await page.mouse.wheel(0, 120)
    await expect.poll(marks).toEqual([mark(first), mark(expect.any(Number))])
    expect(Number(marks()[1]?.at) - first).toBeGreaterThanOrEqual(60)
    if (files)
      writeFileSync(
        join(files, 'menkar-t98-43-b3c-journal.txt'),
        readFileSync(journalPath(root), 'utf8'),
      )
  } finally {
    await launched.close()
  }
})

// Every change of the human's presence, by the shortcut or by the orchestrator's tools, is a line.
test('away and back are journaled each time presence changes: by Ctrl+B a, and by human_away and human_back', async () => {
  const { launched, page, root } = await open()
  try {
    await expect.poll(() => rows(root, 'activity').map((r) => r.kind)).toEqual(['app_start'])
    await expect.poll(() => existsSync(journalPath(root))).toBe(false)
    const presence = () =>
      journal(root)
        .filter((r) => r.kind === 'away' || r.kind === 'back')
        .map((r) => r.kind)
    await page.locator('.row', { hasText: 'api' }).dblclick()
    await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
    await page.locator('.xterm').click()

    await page.keyboard.press('Control+b')
    await page.keyboard.press('a')
    await expect.poll(presence).toEqual(['away'])
    await page.keyboard.press('Control+b')
    await page.keyboard.press('a')
    await expect.poll(presence).toEqual(['away', 'back'])

    await page.keyboard.type('HUMANAWAY')
    await said(page, 'TOOL human_away: The human is marked away.')
    // Asked again, nothing changed: no line.
    await page.keyboard.type('HUMANAWAY')
    await said(page, 'TOOL human_away: The human is already marked away.')
    await page.keyboard.type('HUMANBACK')
    await said(page, 'TOOL human_back: The human is marked back.')
    await expect.poll(presence).toEqual(['away', 'back', 'away', 'back'])
    for (const line of journal(root).filter((r) => r.kind === 'away' || r.kind === 'back'))
      expect(Object.keys(line).sort()).toEqual(['at', 'id', 'kind', 'v'])
  } finally {
    await launched.close()
  }
})
