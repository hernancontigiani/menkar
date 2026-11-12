// Decisions 1.56 and 1.57: `/clear` and an in-session `/resume` give the session in a tab another
// id; the tab follows it. The stand-in claude runs the SessionStart hook its --settings declares,
// as Claude Code does, and the app learns from the hook's record which pane it came from.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp, savedState } from './app'
import { CLEARED_SESSION, prepare, SESSION } from './fixtures'

// A session of another project, in a group there, that the tab's session resumes into.
const ELSEWHERE = '7d7d7d7d-0000-4000-8000-0000000000e1'
const CLIENT_WORK = 'aaaaaaaaaaaa'
const SIDE = 'bbbbbbbbbbbb'

function twoProjects(dirs: { readonly root: string; readonly home: string }) {
  const env = prepare(dirs)
  const work = join(dirs.home, 'work')
  writeFileSync(
    join(
      dirs.home,
      '.claude',
      'projects',
      work.replace(/[^A-Za-z0-9]/g, '-'),
      `${ELSEWHERE}.jsonl`,
    ),
    `${JSON.stringify({ type: 'user', cwd: work, message: { content: 'the side quest' } })}\n`,
  )
  writeFileSync(
    join(dirs.root, 'config', 'menkar', 'projects.json'),
    JSON.stringify({
      version: 1,
      current: CLIENT_WORK,
      projects: [
        {
          id: CLIENT_WORK,
          name: 'Client work',
          members: [SESSION],
          groups: [{ name: 'pair', color: '#5ec4b6', members: [SESSION], leader: SESSION }],
        },
        {
          id: SIDE,
          name: 'Side',
          members: [ELSEWHERE],
          groups: [{ name: 'quests', color: '#c17be0', members: [ELSEWHERE] }],
        },
      ],
      windows: [],
    }),
  )
  // Remote Control on for the session in the tab: after a clear it is the new id's.
  const state = join(dirs.root, 'config', 'menkar', 'state.json')
  writeFileSync(
    state,
    JSON.stringify({ ...JSON.parse(readFileSync(state, 'utf8')), remote_control: [SESSION] }),
  )
  return { ...env, FAKE_CLAUDE_RESUME: ELSEWHERE }
}

interface Saved {
  projects: {
    id: string
    members: string[]
    groups: { members: string[]; leader?: string }[]
    earlier?: Record<string, string[]>
  }[]
  windows: { tabs: Record<string, { panes?: string[] }[]> }[]
}

async function openAndType(word: string) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      return twoProjects(dirs)
    },
  })
  const page = launched.window
  await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
  await expect.poll(() => existsSync(join(home, 'claude-pid.txt'))).toBe(true)
  await expect(page.locator('.xterm-rows')).toContainText('stand-in claude ready')
  await page.locator('.xterm').click()
  await page.keyboard.type(word)
  const saved = (): Saved =>
    JSON.parse(readFileSync(join(root, 'config', 'menkar', 'projects.json'), 'utf8'))
  const remote = (): unknown => savedState(root).remote_control
  return { launched, page, saved, remote }
}

const dot = (page: Page, session: string) => page.locator(`.row[data-session="${session}"] .dot`)

test('after /clear the tab runs the new id, which takes the old one’s place in its project and group, leader mark and Remote Control too; the old one is its earlier conversation, opened again from its menu', async () => {
  const { launched, page, saved, remote } = await openAndType('CLEAR')
  try {
    await expect(page.locator('.xterm-rows')).toContainText('stand-in cleared')
    await expect.poll(() => saved().projects[0]?.members).toEqual([CLEARED_SESSION, SESSION])
    expect(saved().projects[0]?.groups).toEqual([
      { name: 'pair', color: '#5ec4b6', members: [CLEARED_SESSION], leader: CLEARED_SESSION },
    ])
    expect(saved().windows[0]?.tabs[CLIENT_WORK]?.map((t) => t.panes)).toEqual([[CLEARED_SESSION]])
    expect(saved().projects[0]?.earlier).toEqual({ [CLEARED_SESSION]: [SESSION] })
    // Decision 1.63: no row for the session left, and it is not one of the hidden either.
    await expect(dot(page, CLEARED_SESSION)).not.toHaveClass(/stopped/)
    await expect(page.locator(`.row[data-session="${SESSION}"]`)).toHaveCount(0)
    await expect(page.locator('.hidden-foot')).toHaveCount(0)
    await expect.poll(remote).toEqual([CLEARED_SESSION])
    await page.locator(`.row[data-session="${CLEARED_SESSION}"] .more`).click()
    await page.locator('.menu-item', { hasText: 'Earlier conversations' }).click()
    const earlier = page.locator('.menu-item', { hasText: 'fix the login bug' })
    await expect(earlier).toHaveText(/fix the login bug · \d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
    await earlier.click()
    // Opened in a tab of its own, and a row of the list again.
    await expect(dot(page, SESSION)).not.toHaveClass(/stopped/)
    await expect(page.locator('.tab')).toHaveCount(2)
    await expect.poll(() => saved().projects[0]?.earlier).toBeUndefined()
  } finally {
    await launched.close()
  }
})

test('after an in-session /resume the tab runs the resumed session, which leaves its project and group for the tab’s, in the left one’s place; the session left is its earlier conversation', async () => {
  const { launched, page, saved } = await openAndType('RESUME')
  try {
    await expect(page.locator('.xterm-rows')).toContainText('stand-in resumed')
    await expect.poll(() => saved().projects[0]?.members).toEqual([ELSEWHERE, SESSION])
    expect(saved().projects[1]).toMatchObject({ id: SIDE, members: [], groups: [] })
    expect(saved().windows[0]?.tabs[CLIENT_WORK]?.map((t) => t.panes)).toEqual([[ELSEWHERE]])
    expect(saved().projects[0]?.earlier).toEqual({ [ELSEWHERE]: [SESSION] })
    await expect(page.locator(`.row[data-session="${SESSION}"]`)).toHaveCount(0)
    await expect(dot(page, ELSEWHERE)).not.toHaveClass(/stopped/)
  } finally {
    await launched.close()
  }
})
