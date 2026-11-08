import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import type { MenkarApi, ProjectsSnapshot } from '../src/shared/ipc'
import { launchApp } from './app'
import { CLIENT, CLIENT_NAMES, clientWork } from './fixtures'

type PageGlobals = { menkar: MenkarApi }

test("the first start imports agent-tablet's projects and settings, and leaves its files as they were", async () => {
  let source = ''
  let menkar = ''
  const agentProjects = {
    version: 1,
    current: 'b2b2b2b2b2b2',
    projects: [
      {
        id: 'a1a1a1a1a1a1',
        name: 'Client work',
        members: ['s1', 's2'],
        groups: [{ name: 'api pair', color: '#c17be0', members: ['s1'] }],
      },
      { id: 'b2b2b2b2b2b2', name: 'Research', members: ['s3'] },
    ],
    windows: [
      {
        current: 'a1a1a1a1a1a1',
        tabs: { a1a1a1a1a1a1: [{ panes: ['s1'], orientation: 'horizontal' }] },
      },
    ],
  }
  const agentState = { names: { s2: 'Docs' }, hidden: ['s3'], settings: { ui_style: 'classic' } }
  const launched = await launchApp({
    prepare: ({ root }) => {
      source = join(root, 'config', 'agent-tablet')
      menkar = join(root, 'config', 'menkar')
      mkdirSync(source, { recursive: true })
      writeFileSync(join(source, 'projects.json'), JSON.stringify(agentProjects, null, 2))
      writeFileSync(join(source, 'state.json'), JSON.stringify(agentState, null, 2))
      return undefined
    },
  })
  const files = ['projects.json', 'state.json'].map((name) => join(source, name))
  const before = files.map((f) => [readFileSync(f, 'utf8'), statSync(f).mtimeMs])
  try {
    const snapshot: ProjectsSnapshot = await launched.window.evaluate(() =>
      (globalThis as unknown as PageGlobals).menkar.projects.get(),
    )
    expect(snapshot).toEqual({
      current: 'b2b2b2b2b2b2',
      projects: [
        {
          id: 'a1a1a1a1a1a1',
          name: 'Client work',
          members: ['s1', 's2'],
          groups: [{ name: 'api pair', color: '#c17be0', members: ['s1'] }],
        },
        { id: 'b2b2b2b2b2b2', name: 'Research', members: ['s3'], groups: [] },
      ],
      notices: [],
    })
    const written = JSON.parse(readFileSync(join(menkar, 'projects.json'), 'utf8'))
    expect(written.projects.map((p: { name: string }) => p.name)).toEqual([
      'Client work',
      'Research',
    ])
    expect(written.windows).toEqual([])
    expect(JSON.parse(readFileSync(join(menkar, 'state.json'), 'utf8'))).toEqual({
      names: { s2: 'Docs' },
      hidden: ['s3'],
      settings: { ui_style: 'classic' },
    })
    expect(files.map((f) => [readFileSync(f, 'utf8'), statSync(f).mtimeMs])).toEqual(before)
  } finally {
    await launched.close()
  }
})

// ---------------------------------------------------------------- the acceptance cases

interface Shown {
  shown: string
  selectedTab: string | null
  running: string[]
  tabCount: number
  projects: {
    id: string
    name: string
    members: string[]
    groups: { name: string; color: string; members: string[] }[]
  }[]
  tabs: {
    id: string
    project: string
    title: string
    panes: { id: string; sessionId: string | null }[]
  }[]
}

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) => (globalThis as unknown as PageGlobals).menkar.window.act(a as never),
    action,
  ) as Promise<{ refusal?: string; value?: unknown }>

const shown = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as PageGlobals).menkar.window.state(),
  ) as unknown as Promise<Shown>

const RESEARCH = { id: 'dddddddddddd', name: 'Research', members: [] as string[] }

async function client(options: Parameters<typeof clientWork>[1] = {}) {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      return clientWork(dirs, options)
    },
  })
  const page = launched.window
  await expect(page.locator('#session-list .row')).toHaveCount(3)
  return { launched, page, home, root }
}

async function rowMenu(page: Page, session: string, ...path: string[]) {
  await page.locator(`.row[data-session="${session}"] .more`).click()
  for (const item of path) await page.locator('.menu-item', { hasText: item }).last().click()
}

const dialog = (page: Page) => page.locator('.dialog')

// The file is written at once by the first start's import (both of Menkar's files, so the next
// start is not a first start), not after the first change.
test('PRJ-1 no projects.json: "Default" with its empty list', async () => {
  const launched = await launchApp()
  const page = launched.window
  try {
    await expect(page.locator('#project-button .project-name')).toHaveText('Default')
    await expect(page.locator('#session-list .heading')).toHaveText('Default has no sessions')
  } finally {
    await launched.close()
  }
})

test('PRJ-2 an unreadable projects.json is moved aside, one empty Default starts, and a toast says so until dismissed', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      mkdirSync(join(dirs.root, 'config', 'menkar'), { recursive: true })
      writeFileSync(join(dirs.root, 'config', 'menkar', 'projects.json'), '{')
      return {}
    },
  })
  const page = launched.window
  try {
    const config = join(launched.root, 'config', 'menkar')
    const aside = readdirSync(config).filter(
      (f) => f.startsWith('projects.json') && f !== 'projects.json',
    )
    expect(aside).toHaveLength(1)
    expect(readFileSync(join(config, aside[0] ?? ''), 'utf8')).toBe('{')
    await expect(page.locator('#project-button .project-name')).toHaveText('Default')
    expect((await shown(page)).projects.map((p) => p.name)).toEqual(['Default'])
    const toast = page.locator('.toast', { hasText: 'The projects file could not be read' })
    await expect(toast).toHaveText(
      new RegExp(
        `The projects file could not be read; it was kept as ${aside[0]?.replace(/[.]/g, '\\.')} and a new one started`,
      ),
    )
    await page.waitForTimeout(6000)
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Dismiss' }).first().click()
    await expect(toast).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('PRJ-12, PRJ-15 a name differing only in case and spaces is taken; the last project cannot be deleted', async () => {
  const launched = await launchApp()
  const page = launched.window
  try {
    await page.locator('#project-button').click()
    await page.locator('.popover input').fill('Work')
    await page.locator('.popover button', { hasText: 'Create' }).click()
    await expect(page.locator('#project-button .project-name')).toHaveText('Work')
    await page.locator('#project-button').click()
    await page.locator('.popover input').fill('work ')
    await page.locator('.popover button', { hasText: 'Create' }).click()
    await expect(page.locator('.popover .error-line')).toHaveText(
      'There is already a project with that name.',
    )
    await page.keyboard.press('Escape')
    await act(page, {
      type: 'deleteProject',
      project: (await shown(page)).projects.find((p) => p.name === 'Default')?.id,
    })
    await expect.poll(async () => (await shown(page)).projects.length).toBe(1)
    await page.locator('#project-button').click()
    await page.locator('.project-row button[title="Delete project"]').click()
    await expect(dialog(page).locator('.heading')).toHaveText('The project was not deleted')
    await expect(dialog(page).locator('.body')).toHaveText('The last project cannot be deleted.')
  } finally {
    await launched.close()
  }
})

test('PRJ-16 deleting a project with a running member asks, counting it; Delete stops it, closes its tab, shows the first project, and frees the members', async () => {
  const { launched, page } = await client({ tabs: [['login']], extraProjects: [RESEARCH] })
  try {
    await expect.poll(async () => (await shown(page)).running).toEqual([CLIENT.login])
    await page.locator('#project-button').click()
    await page
      .locator('.project-row[data-project="cccccccccccc"] button[title="Delete project"]')
      .click()
    await expect(dialog(page).locator('.heading')).toHaveText('Delete “Client work”?')
    await expect(dialog(page).locator('.body')).toHaveText(
      'Its sessions leave the list; their conversations stay in Claude. 1 running session(s) will be stopped first.',
    )
    await dialog(page).locator('button', { hasText: 'Delete' }).click()
    await expect(page.locator('.tab')).toHaveCount(0)
    await expect(page.locator('#project-button .project-name')).toHaveText('Research')
    const after = await shown(page)
    expect(after.projects.map((p) => p.name)).toEqual(['Research'])
    expect(after.projects.flatMap((p) => p.members)).toEqual([])
    expect(after.running).toEqual([])
  } finally {
    await launched.close()
  }
})

test('PRJ-19 switching to a project with no tabs shows "No session open", the agents keep running, and coming back selects the same tab', async () => {
  const { launched, page } = await client({ tabs: [['login'], ['api']], extraProjects: [RESEARCH] })
  try {
    const second = await page.locator('.tab').nth(1).getAttribute('data-tab')
    await page.locator('.tab').nth(1).click()
    await expect.poll(async () => (await shown(page)).selectedTab).toBe(second)
    const selected = second
    await act(page, { type: 'switchProject', project: RESEARCH.id })
    await expect(page.locator('#empty-content .heading')).toHaveText('No session open')
    await expect
      .poll(async () => (await shown(page)).running.sort())
      .toEqual([CLIENT.api, CLIENT.login].sort())
    await act(page, { type: 'switchProject', project: 'cccccccccccc' })
    await expect(page.locator('.tab.selected')).toHaveAttribute('data-tab', selected ?? '')
  } finally {
    await launched.close()
  }
})

test('PRJ-20, PRJ-21 with no groups the rows show with no heading, each with its folder', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = clientWork(dirs)
      const file = join(dirs.root, 'config', 'menkar', 'projects.json')
      const saved = JSON.parse(readFileSync(file, 'utf8'))
      saved.projects[0].groups = []
      writeFileSync(file, JSON.stringify(saved))
      return env
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    await expect(page.locator('#session-list .group-heading')).toHaveCount(0)
    await expect(page.locator('#session-list .folder')).toHaveText(['api', 'api', 'web'])
  } finally {
    await launched.close()
  }
})

test('PRJ-22, PRJ-23, PRJ-24 groups from the row menu: a new group gets the next color and the session alone; a taken name is refused; No group drops an emptied group; moving goes last', async () => {
  const { launched, page, root } = await client()
  try {
    await rowMenu(page, CLIENT.long, 'Group', 'New group…')
    await dialog(page).locator('input').fill('pair')
    await dialog(page).locator('button', { hasText: 'Save' }).click()
    await expect
      .poll(async () => (await shown(page)).projects[0]?.groups.find((g) => g.name === 'pair'))
      .toEqual({
        name: 'pair',
        color: '#c17be0',
        members: [CLIENT.long],
      })
    await rowMenu(page, CLIENT.login, 'Group', 'New group…')
    await dialog(page).locator('input').fill('pair')
    await dialog(page).locator('button', { hasText: 'Save' }).click()
    await expect(dialog(page).locator('.heading')).toHaveText('The group was not created')
    await expect(dialog(page).locator('.body')).toHaveText(
      'There is already a group with that name.',
    )
    await dialog(page).locator('button').first().click()

    await rowMenu(page, CLIENT.login, 'Group', 'pair')
    await expect
      .poll(async () => (await shown(page)).projects[0]?.groups.map((g) => [g.name, g.members]))
      .toEqual([
        ['api pair', [CLIENT.api]],
        ['pair', [CLIENT.long, CLIENT.login]],
      ])
    await rowMenu(page, CLIENT.api, 'Group', 'No group')
    await expect(page.locator('#session-list .group-heading', { hasText: 'api pair' })).toHaveCount(
      0,
    )
    await expect
      .poll(() =>
        JSON.parse(
          readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'),
        ).projects[0].groups.map((g: { name: string }) => g.name),
      )
      .toEqual(['pair'])
  } finally {
    await launched.close()
  }
})

test('PRJ-25, PRJ-26 removing a stopped session is at once; a running one asks, Cancel keeps it, Stop and remove closes its tab and frees it', async () => {
  const { launched, page } = await client({ tabs: [['login']] })
  try {
    await rowMenu(page, CLIENT.long, 'Remove from project')
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.locator(`.row[data-session="${CLIENT.long}"]`)).toHaveCount(0)
    await expect.poll(async () => (await shown(page)).running).toEqual([CLIENT.login])
    await rowMenu(page, CLIENT.login, 'Remove from project')
    await expect(dialog(page).locator('.heading')).toHaveText(
      'Remove “login fix” from the project?',
    )
    await expect(dialog(page).locator('.body')).toHaveText(
      'It is running, so it is stopped first. Its conversation stays in Claude.',
    )
    await dialog(page).locator('button', { hasText: 'Cancel' }).click()
    expect((await shown(page)).projects[0]?.members).toContain(CLIENT.login)
    await rowMenu(page, CLIENT.login, 'Remove from project')
    await dialog(page).locator('button', { hasText: 'Stop and remove' }).click()
    await expect(page.locator('.tab')).toHaveCount(0)
    const after = await shown(page)
    expect(after.projects.flatMap((p) => p.members)).toEqual([CLIENT.api])
    expect(after.projects[0]?.groups.flatMap((g) => g.members)).toEqual([CLIENT.api])
  } finally {
    await launched.close()
  }
})

test('PRJ-28, PRJ-29, PRJ-30 Open beside: a stopped session resumes on the right with focus, the title joined; a running one moves in, not restarted; a full tab refuses', async () => {
  const { launched, page, home } = await client({ tabs: [['login'], ['api']] })
  try {
    await page.locator('.tab').first().click()
    await rowMenu(page, CLIENT.long, 'Open beside the current tab')
    await expect(page.locator('.tab-body:not(.hidden) .pane')).toHaveCount(2)
    await expect(page.locator('.tab.selected .title')).toHaveText(
      `login fix │ ${CLIENT_NAMES.long.slice(0, 28 - 12)}…`,
    )
    await expect
      .poll(() =>
        page
          .locator('.tab-body:not(.hidden) .frame')
          .evaluateAll((ns) => ns.map((n) => n.matches(':focus-within'))),
      )
      .toEqual([false, true])
    const right = await page.locator('.tab-body:not(.hidden) .pane').nth(0).boundingBox()
    const left = await page.locator('.tab-body:not(.hidden) .pane').nth(1).boundingBox()
    expect((left?.x ?? 0) > (right?.x ?? 0)).toBe(true)

    await act(page, { type: 'closePane', pane: (await shown(page)).tabs[0]?.panes[1]?.id })
    await expect(page.locator('.tab-body:not(.hidden) .pane')).toHaveCount(1)
    const apiPid = () => {
      const lines = readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n')
      return lines.filter((l) => l.includes(CLIENT.api)).length
    }
    const startsBefore = apiPid()
    await rowMenu(page, CLIENT.api, 'Open beside the current tab')
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect(page.locator('.tab-body:not(.hidden) .pane')).toHaveCount(2)
    expect(apiPid()).toBe(startsBefore)

    await rowMenu(page, CLIENT.long, 'Open beside the current tab')
    await expect(page.locator('.toast')).toHaveText('A tab holds two panes at most')
  } finally {
    await launched.close()
  }
})

const OTHER = '4d4d4d4d-0000-4000-8000-000000000004'

// A fourth session, a member of Research.
function withResearch(
  dirs: { readonly root: string; readonly home: string },
  tabs: readonly (readonly ('login' | 'api' | 'long')[])[] = [],
) {
  const env = clientWork(dirs, { tabs, extraProjects: [{ ...RESEARCH, members: [OTHER] }] })
  const cwd = join(dirs.home, 'work', 'api')
  writeFileSync(
    join(dirs.home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'), `${OTHER}.jsonl`),
    `${JSON.stringify({ type: 'custom-title', customTitle: 'other work' })}\n${JSON.stringify({ type: 'user', cwd, message: { content: 'other' } })}\n`,
  )
  return env
}

test('PRJ-31, PRJ-32, PRJ-33 Open beside: another project’s session is refused; one already beside is refused; with a file tab selected it opens a tab', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return withResearch(dirs, [['login', 'api'], ['long']])
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    await page.locator('.tab').nth(1).click()
    expect((await act(page, { type: 'openBeside', session: OTHER })).refusal).toBe(
      'layout.otherProject',
    )
    expect((await act(page, { type: 'openBeside', session: CLIENT.api })).refusal).toBe(
      'layout.alreadyBeside',
    )
    await rowMenu(page, CLIENT.api, 'Open beside the current tab')
    await expect(page.locator('.toast').last()).toHaveText('It is already beside another session')
    writeFileSync(join(home, 'notes.txt'), 'notes\n')
    await act(page, { type: 'openFilePath', path: join(home, 'notes.txt') })
    await expect(page.locator('.tab')).toHaveCount(3)
    await act(page, { type: 'closeTab', tab: (await shown(page)).tabs[1]?.id })
    await expect(page.locator('.tab')).toHaveCount(2)
    await page.locator('.tab').nth(1).click()
    await rowMenu(page, CLIENT.long, 'Open beside the current tab')
    await expect(page.locator('.tab')).toHaveCount(3)
    await expect(page.locator('.tab.selected')).toHaveText(/abcdef/)
  } finally {
    await launched.close()
  }
})

const sessionIdTyped = (home: string) =>
  /--session-id (\S+)/.exec(
    readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n').pop() ?? '',
  )?.[1] ?? ''

function typedTranscript(home: string, folder: string, id: string) {
  const dir = join(home, '.claude', 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, `${id}.jsonl`),
    `${JSON.stringify({ type: 'user', cwd: folder, message: { content: 'a typed message' } })}\n`,
  )
}

test('PRJ-36 a new session closed before a typed message leaves the members as they were; after one, it joins', async () => {
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      return { ...clientWork(dirs), FAKE_CLAUDE_QUIET: '1' }
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(3)
    const folder = join(home, 'work', 'web')
    await act(page, { type: 'startNew', agent: 'claude', folder, name: 'first' })
    await expect(page.locator('.tab')).toHaveCount(1)
    await expect.poll(() => existsSync(join(home, 'claude-args.txt'))).toBe(true)
    await act(page, { type: 'closeAllTabs' })
    await expect(page.locator('.tab')).toHaveCount(0)
    await page.waitForTimeout(2000)
    expect((await shown(page)).projects[0]?.members).toEqual([
      CLIENT.login,
      CLIENT.api,
      CLIENT.long,
    ])

    await act(page, { type: 'startNew', agent: 'claude', folder, name: 'second' })
    await expect
      .poll(() => readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n').length)
      .toBe(2)
    const id = sessionIdTyped(home)
    typedTranscript(home, folder, id)
    await expect
      .poll(async () => (await shown(page)).projects[0]?.members, { timeout: 10_000 })
      .toContain(id)
    await act(page, { type: 'closeAllTabs' })
    expect((await shown(page)).projects[0]?.members).toContain(id)
  } finally {
    await launched.close()
  }
})

// Client work's three tabs and one of Research, in the same window.
function fourTabs(dirs: { readonly root: string; readonly home: string }) {
  const env = withResearch(dirs, [['login'], ['api'], ['long']])
  const file = join(dirs.root, 'config', 'menkar', 'projects.json')
  const saved = JSON.parse(readFileSync(file, 'utf8'))
  saved.windows[0].tabs[RESEARCH.id] = [{ panes: [OTHER], orientation: 'horizontal' }]
  writeFileSync(file, JSON.stringify(saved))
  return env
}

test('PRJ-38, PRJ-39, PRJ-40 Ctrl+Tab and Ctrl+Shift+Tab wrap among the shown project’s tabs; Ctrl+B 2 picks the second, Ctrl+B 7 nothing; one tab and Ctrl+PgDn nothing', async () => {
  const launched = await launchApp({ prepare: fourTabs })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(3)
    expect((await shown(page)).tabs).toHaveLength(4)
    const ids = await page
      .locator('.tab')
      .evaluateAll((ns) => ns.map((n) => n.getAttribute('data-tab')))
    const selected = () => page.locator('.tab.selected').getAttribute('data-tab')
    await page.locator('.tab').nth(2).click()
    await page.locator('.xterm-helper-textarea:visible').first().focus()
    await page.keyboard.press('Control+Tab')
    await expect.poll(selected).toBe(ids[0])
    await page.keyboard.press('Control+Shift+Tab')
    await expect.poll(selected).toBe(ids[2])
    await page.keyboard.press('Control+b')
    await page.keyboard.press('2')
    await expect.poll(selected).toBe(ids[1])
    await page.keyboard.press('Control+b')
    await page.keyboard.press('7')
    await page.waitForTimeout(300)
    expect(await selected()).toBe(ids[1])

    await act(page, { type: 'closeTab', tab: ids[0] })
    await act(page, { type: 'closeTab', tab: ids[2] })
    await expect(page.locator('.tab')).toHaveCount(1)
    await page.keyboard.press('Control+PageDown')
    await page.waitForTimeout(300)
    expect(await selected()).toBe(ids[1])
    expect((await shown(page)).shown).toBe('cccccccccccc')
  } finally {
    await launched.close()
  }
})

test('PRJ-41, PRJ-43 a middle click closes a tab; a right click shows its menu; Close all closes the tabs of every project in the window', async () => {
  const launched = await launchApp({ prepare: fourTabs })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(3)
    await page.locator('.tab').nth(2).click({ button: 'middle' })
    await expect(page.locator('.tab')).toHaveCount(2)
    await page.locator('.tab').first().click({ button: 'right' })
    await expect(page.locator('.menu-item')).toHaveText(
      ['Rename…', 'Copy session ID', "Swap the split's orientation", 'Close', /.*/].slice(
        0,
        await page.locator('.menu-item').count(),
      ),
    )
    await page.keyboard.press('Escape')
    await expect(page.locator('#close-all')).toBeVisible()
    await page.locator('#close-all').click()
    await expect.poll(async () => (await shown(page)).tabs.length).toBe(0)
  } finally {
    await launched.close()
  }
})

test('PRJ-42 renaming a file tab: empty keeps the title; "Notes" renames it; after a restart it has its file’s name', async () => {
  let root = ''
  let home = ''
  let launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      return clientWork(dirs)
    },
  })
  try {
    const page = launched.window
    writeFileSync(join(home, 'todo.txt'), 'todo\n')
    await act(page, { type: 'openFilePath', path: join(home, 'todo.txt') })
    await expect(page.locator('.tab .title')).toHaveText('todo.txt')
    const rename = async (text: string) => {
      await page.locator('.tab').click({ button: 'right' })
      await page.locator('.menu-item', { hasText: 'Rename…' }).click()
      await dialog(page).locator('input').fill(text)
      await dialog(page).locator('button', { hasText: 'Save' }).click()
    }
    await rename('')
    await expect(page.locator('.tab .title')).toHaveText('todo.txt')
    await rename('Notes')
    await expect(page.locator('.tab .title')).toHaveText('Notes')
    await page.waitForTimeout(800)
    await launched.app.close()
    launched = await launchApp({
      prepare: (dirs) => {
        const env = clientWork(dirs)
        cpSync(join(root, 'config'), join(dirs.root, 'config'), { recursive: true })
        return env
      },
    })
    await expect(launched.window.locator('.tab .title')).toHaveText('todo.txt')
  } finally {
    await launched.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('PRJ-48 a saved vertical tab reopens with the first session above the second', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = clientWork(dirs, { tabs: [['login', 'api']] })
      const file = join(dirs.root, 'config', 'menkar', 'projects.json')
      const saved = JSON.parse(readFileSync(file, 'utf8'))
      saved.windows[0].tabs.cccccccccccc[0].orientation = 'vertical'
      writeFileSync(file, JSON.stringify(saved))
      return env
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('.tab-body.vertical .pane')).toHaveCount(2)
    const [top, bottom] = [
      await page.locator('.pane').nth(0).boundingBox(),
      await page.locator('.pane').nth(1).boundingBox(),
    ]
    expect((bottom?.y ?? 0) > (top?.y ?? 0)).toBe(true)
    expect((await shown(page)).tabs[0]?.panes.map((p) => p.sessionId)).toEqual([
      CLIENT.login,
      CLIENT.api,
    ])
  } finally {
    await launched.close()
  }
})

test('PRJ-54 a fork tab and a replay tab open at close are not saved', async () => {
  const { launched, page, root } = await client({ tabs: [['long']] })
  try {
    await act(page, { type: 'forkSession', session: CLIENT.login })
    await act(page, { type: 'replaySession', session: CLIENT.api })
    await expect(page.locator('.tab')).toHaveCount(3)
    await page.waitForTimeout(1000)
    const saved = JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
    expect(saved.windows).toEqual([
      {
        current: 'cccccccccccc',
        tabs: { cccccccccccc: [{ panes: [CLIENT.long], orientation: 'horizontal' }] },
      },
    ])
  } finally {
    await launched.close()
  }
})

test('PRJ-57 a member whose transcript was deleted has no row, and the dropdown still counts it', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = clientWork(dirs)
      const cwd = join(dirs.home, 'work', 'web')
      rmSync(
        join(
          dirs.home,
          '.claude',
          'projects',
          cwd.replace(/[^A-Za-z0-9]/g, '-'),
          `${CLIENT.long}.jsonl`,
        ),
      )
      return env
    },
  })
  const page = launched.window
  try {
    await expect(page.locator('#session-list .row')).toHaveCount(2)
    await page.locator('#project-button').click()
    await expect(page.locator('.project-row span[title="Sessions in this project"]')).toHaveText(
      '3',
    )
  } finally {
    await launched.close()
  }
})

async function secondWindow(launched: Awaited<ReturnType<typeof launchApp>>, page: Page) {
  const opened = launched.app.waitForEvent('window')
  await act(page, { type: 'newWindow' })
  const other = await opened
  await expect(other.locator('#sidebar')).toBeVisible()
  return other
}

async function withTwoWindows(tabs: readonly (readonly ('login' | 'api' | 'long')[])[] = []) {
  let home = ''
  let root = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      home = dirs.home
      root = dirs.root
      return { ...withResearch(dirs, tabs), FAKE_CLAUDE_QUIET: '1' }
    },
  })
  const page = launched.window
  await expect(page.locator('#session-list .row')).toHaveCount(3)
  const other = await secondWindow(launched, page)
  await expect(other.locator('#project-button .project-name')).toHaveText('Research')
  return { launched, page, other, home, root }
}

test('PRJ-17 deleting a project open in another window with a running session: the count includes it, it stops there, and that window shows the first remaining project', async () => {
  const { launched, page, other } = await withTwoWindows()
  try {
    await act(other, { type: 'openSession', session: OTHER })
    await expect.poll(async () => (await shown(other)).running).toEqual([OTHER])
    await page.locator('#project-button').click()
    await page
      .locator(`.project-row[data-project="${RESEARCH.id}"] button[title="Delete project"]`)
      .click()
    await expect(dialog(page).locator('.body')).toContainText(
      '1 running session(s) will be stopped first.',
    )
    await dialog(page).locator('button', { hasText: 'Delete' }).click()
    await expect(other.locator('.tab')).toHaveCount(0)
    await expect.poll(async () => (await shown(other)).running).toEqual([])
    await expect(other.locator('#project-button .project-name')).toHaveText('Client work')
  } finally {
    await launched.close()
  }
})

test('PRJ-18 choosing a project held by another window brings that window forward and leaves this one as it was', async () => {
  const { launched, page, other } = await withTwoWindows()
  try {
    // Without a window manager focus cannot move, so the call that brings a window forward marks
    // that window's page.
    await launched.app.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        const focus = win.focus.bind(win)
        win.focus = () => {
          void win.webContents.executeJavaScript('globalThis.broughtForward = true')
          focus()
        }
      }
    })
    await act(page, { type: 'switchProject', project: RESEARCH.id })
    const forward = (p: Page) =>
      p.evaluate(
        () => (globalThis as unknown as { broughtForward?: boolean }).broughtForward ?? false,
      )
    await expect.poll(() => forward(other)).toBe(true)
    expect(await forward(page)).toBe(false)
    await expect(page.locator('#project-button .project-name')).toHaveText('Client work')
  } finally {
    await launched.close()
  }
})

test('PRJ-34 picking a session running alone in another window moves its tab here, not restarted', async () => {
  const { launched, page, other, home } = await withTwoWindows([['login']])
  try {
    await act(other, { type: 'openSession', session: OTHER })
    // Both stand-ins started (each records its arguments as it starts).
    await expect
      .poll(async () => (await shown(other)).running.sort())
      .toEqual([CLIENT.login, OTHER].sort())
    await expect
      .poll(() => readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n').length)
      .toBe(2)
    const starts = () =>
      readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n').length
    const before = starts()
    await act(page, { type: 'pickSession', session: OTHER })
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect(page.locator('.tab').last()).toHaveClass(/selected/)
    await expect(page.locator('.tab.selected')).toHaveText(/other work/)
    expect(starts()).toBe(before)
    const after = await shown(page)
    expect(after.projects.find((p) => p.id === 'cccccccccccc')?.members).toContain(OTHER)
    expect(after.projects.find((p) => p.id === RESEARCH.id)?.members).toEqual([])
    await expect(other.locator('#empty-content')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('PRJ-35 a session sharing a tab in another window is refused and stays there', async () => {
  const { launched, page, other } = await withTwoWindows()
  try {
    // A second Research member, beside OTHER in window 2's tab.
    await act(other, { type: 'pickSession', session: CLIENT.long })
    await act(other, { type: 'openSession', session: OTHER })
    await expect(other.locator('.tab')).toHaveCount(1)
    await act(other, { type: 'openBeside', session: CLIENT.long })
    await expect(other.locator('.pane')).toHaveCount(2)
    expect((await act(page, { type: 'pickSession', session: OTHER })).refusal).toBe(
      'layout.sharesTab',
    )
    expect((await shown(page)).projects.find((p) => p.id === RESEARCH.id)?.members).toContain(OTHER)
    await expect(other.locator('.pane')).toHaveCount(2)
  } finally {
    await launched.close()
  }
})

test('PRJ-37 a new session started in window 2 joins the project window 2 shows, whatever window 1 chose last', async () => {
  const { launched, page, other, home } = await withTwoWindows()
  try {
    await act(page, { type: 'switchProject', project: 'cccccccccccc' })
    const folder = join(home, 'work', 'web')
    await act(other, { type: 'startNew', agent: 'claude', folder, name: 'in two' })
    await expect.poll(() => existsSync(join(home, 'claude-args.txt'))).toBe(true)
    const id = sessionIdTyped(home)
    typedTranscript(home, folder, id)
    await expect
      .poll(async () => (await shown(other)).projects.find((p) => p.id === RESEARCH.id)?.members, {
        timeout: 10_000,
      })
      .toContain(id)
    expect(
      (await shown(page)).projects.find((p) => p.id === 'cccccccccccc')?.members,
    ).not.toContain(id)
  } finally {
    await launched.close()
  }
})

test('PRJ-44 Ctrl+Shift+N opens a window on the next free project, with no tabs; with all held it asks for a new project, refusing an empty name', async () => {
  const { launched, page } = await withTwoWindows([['login']])
  try {
    await act(page, { type: 'createProject', name: 'Third' })
    await act(page, { type: 'switchProject', project: 'cccccccccccc' })
    await page.locator('#content').click({ position: { x: 40, y: 60 } })
    const opened = launched.app.waitForEvent('window')
    await page.keyboard.press('Control+Shift+N')
    const third = await opened
    await expect(third.locator('#project-button .project-name')).toHaveText('Third')
    await expect(third.locator('.tab')).toHaveCount(0)

    await page.bringToFront()
    await page.locator('#content').click({ position: { x: 40, y: 60 } })
    await page.keyboard.press('Control+Shift+N')
    await expect(dialog(page).locator('.heading')).toHaveText('New project')
    await dialog(page).locator('input').fill('')
    await dialog(page).locator('button', { hasText: 'Save' }).click()
    await expect(dialog(page).locator('.heading')).toHaveText('No new window')
    await expect(dialog(page).locator('.body')).toHaveText('A project needs a name.')
    await dialog(page).locator('button').first().click()
    await page.keyboard.press('Control+Shift+N')
    const ops = launched.app.waitForEvent('window')
    await dialog(page).locator('input').fill('Ops')
    await dialog(page).locator('button', { hasText: 'Save' }).click()
    await expect((await ops).locator('#project-button .project-name')).toHaveText('Ops')
  } finally {
    await launched.close()
  }
})

test('PRJ-47 closing window 2 then window 1 saves one window, A with its tabs; the next start reopens just that', async () => {
  test.setTimeout(120_000)
  let root = ''
  let launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      return withResearch(dirs, [['login'], ['api']])
    },
  })
  try {
    const page = launched.window
    await expect(page.locator('.tab')).toHaveCount(2)
    const other = await secondWindow(launched, page)
    await act(other, { type: 'openSession', session: OTHER })
    await expect(other.locator('.tab')).toHaveCount(1)
    await act(other, { type: 'closeAllTabs' })
    await launched.app.evaluate(({ app }) => {
      app.removeAllListeners('window-all-closed')
    })
    await other.close()
    await expect.poll(() => launched.app.windows().length).toBe(1)
    await launched.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
    await expect(page.locator('.dialog .heading')).toHaveText(/Stop 2 running/)
    await page.locator('.dialog button', { hasText: 'Stop and close' }).click()
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8')).windows,
      )
      .toEqual([
        {
          current: 'cccccccccccc',
          tabs: {
            cccccccccccc: [
              { panes: [CLIENT.login], orientation: 'horizontal' },
              { panes: [CLIENT.api], orientation: 'horizontal' },
            ],
          },
        },
      ])
    await launched.app.close()
    launched = await launchApp({
      prepare: (dirs) => {
        const env = withResearch(dirs)
        cpSync(join(root, 'config'), join(dirs.root, 'config'), { recursive: true })
        return env
      },
    })
    await expect(launched.window.locator('.tab')).toHaveCount(2)
    expect(launched.app.windows()).toHaveLength(1)
  } finally {
    await launched.close()
    rmSync(root, { recursive: true, force: true })
  }
})

test('PRJ-56 the sidebar width is saved 600 ms after a drag and a new window takes it; hiding it does not overwrite it', async () => {
  const { launched, page, root } = await client({ extraProjects: [RESEARCH] })
  try {
    const d = await page.locator('#divider').boundingBox()
    if (!d) throw new Error('no divider')
    await page.mouse.move(d.x + 0.5, d.y + 200)
    await page.mouse.down()
    await page.mouse.move(360, d.y + 200, { steps: 6 })
    await page.mouse.up()
    const width = () =>
      JSON.parse(readFileSync(join(root, 'config', 'menkar', 'state.json'), 'utf8')).settings
        ?.sidebar_width
    expect(width()).not.toBe(360)
    await expect.poll(width, { timeout: 2000 }).toBe(360)
    const other = await secondWindow(launched, page)
    expect((await other.locator('#sidebar').boundingBox())?.width).toBe(360)
    await page.locator('#toggle-sidebar').click()
    await page.waitForTimeout(1000)
    expect(width()).toBe(360)
  } finally {
    await launched.close()
  }
})
