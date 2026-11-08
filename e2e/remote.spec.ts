import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { prepare, SESSION } from './fixtures'

let home = ''
let root = ''

function setup(remote: string[]) {
  return (dirs: { readonly root: string; readonly home: string }) => {
    home = dirs.home
    root = dirs.root
    const env = prepare(dirs)
    writeFileSync(
      join(dirs.root, 'config', 'menkar', 'state.json'),
      JSON.stringify({ remote_control: remote, settings: { color_scheme: 'dark' } }),
    )
    return env
  }
}

const args = () =>
  existsSync(join(home, 'claude-args.txt'))
    ? readFileSync(join(home, 'claude-args.txt'), 'utf8')
    : ''
const stateFile = () =>
  JSON.parse(readFileSync(join(root, 'config', 'menkar', 'state.json'), 'utf8'))

async function newPage(page: Page): Promise<void> {
  await page.locator('#strip-plus').click()
  await page.locator('.add-session .folder-row', { hasText: 'work' }).click()
}

test('RC-1, RC-2 the switch on New: the id joins the list at once, the flag carries the typed name; off when New opens again', async () => {
  const launched = await launchApp({ prepare: setup([]) })
  const page = launched.window
  try {
    await newPage(page)
    const sw = page.locator('.add-session .remote-row input')
    await expect(sw).not.toBeChecked()
    await sw.check()
    await page.locator('.add-session .form-row input[type="text"]').fill('JWT auth')
    await page.locator('.add-session .pill').click()
    await expect
      .poll(args)
      .toMatch(/--session-id ([0-9a-f-]{36}) -n JWT auth --remote-control=JWT auth --settings /)
    const id = /--session-id ([0-9a-f-]{36})/.exec(args())?.[1]
    expect(stateFile().remote_control).toEqual([id])
    // The folder is remembered now, so New opens straight on the name step.
    await page.locator('#strip-plus').click()
    await expect(page.locator('.add-session .remote-row input')).not.toBeChecked()
  } finally {
    await launched.close()
  }
})

test('RC-5 a session in the list resumes with its name as the flag', async () => {
  const launched = await launchApp({ prepare: setup([SESSION]) })
  const page = launched.window
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect
      .poll(args)
      .toMatch(new RegExp(`^--resume ${SESSION} --remote-control=fix the login bug --settings `))
    await expect(page.locator('.row .phone')).toHaveAttribute('title', 'Remote control on')
  } finally {
    await launched.close()
  }
})

test('RC-6, RC-13, RC-15, RC-16 not in the list: no flag; checking it while running toasts, lists it, and the tab menu follows', async () => {
  const launched = await launchApp({ prepare: setup([]) })
  const page = launched.window
  try {
    await expect(page.locator('.row .phone')).toHaveCount(0)
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(args).toMatch(new RegExp(`^--resume ${SESSION} --settings `))
    await page.locator('.row', { hasText: 'fix the login bug' }).click({ button: 'right' })
    const items = await page.locator('.menu-item').allTextContents()
    expect(items.slice(0, 4).map((x) => x.trim())).toEqual([
      'Open',
      'Open beside the current tab',
      'Stop',
      'Remote control',
    ])
    await page.locator('.menu-item', { hasText: 'Remote control' }).click()
    await expect(page.locator('.toast')).toContainText(
      'Remote control connects when this session restarts, or type /rc in it',
    )
    await expect.poll(() => stateFile().remote_control).toEqual([SESSION])
    await expect(page.locator('.row .phone')).toHaveAttribute(
      'title',
      "Remote control from this session's next start, or type /rc in it",
    )
    await page.locator('.tab.selected').click({ button: 'right' })
    await expect(page.locator('.menu-item', { hasText: 'Remote control' })).toHaveText(
      '✓ Remote control',
    )
  } finally {
    await launched.close()
  }
})
