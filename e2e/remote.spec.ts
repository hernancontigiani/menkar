import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { launchApp } from './app'
import { CLIENT, clientWork, prepare, SESSION } from './fixtures'

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
      .toMatch(
        /--session-id ([0-9a-f-]{36}) -n JWT auth --remote-control=JWT auth --add-dir \S+\/Menkar\/Client work\/files --mcp-config \{.+\} --settings /,
      )
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
      .toMatch(
        new RegExp(
          `^--resume ${SESSION} --remote-control=fix the login bug --add-dir \\S+/Menkar/Client work/files --mcp-config \\{.+\\} --settings `,
        ),
      )
    await expect(page.locator('.row .phone')).toHaveAttribute(
      'title',
      'Remote Control on at start (state unknown)',
    )
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
    await expect
      .poll(args)
      .toMatch(
        new RegExp(
          `^--resume ${SESSION} --add-dir \\S+/Menkar/Client work/files --mcp-config \\{.+\\} --settings `,
        ),
      )
    await page.locator('.row', { hasText: 'fix the login bug' }).click({ button: 'right' })
    const items = await page.locator('.menu-item').allTextContents()
    expect(items.slice(0, 5).map((x) => x.trim())).toEqual([
      'Open',
      'Open beside the current tab',
      'Open folder',
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
      'Remote Control on at start (state unknown)',
    )
    await page.locator('.tab.selected').click({ button: 'right' })
    await expect(page.locator('.menu-item', { hasText: 'Remote control' })).toHaveText(
      '✓ Remote control',
    )
  } finally {
    await launched.close()
  }
})

// ---------------------------------------------------------------- the rest of the cases

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

function withCursor(dirs: { readonly root: string }) {
  writeFileSync(
    join(dirs.root, 'bin', 'cursor-agent'),
    '#!/bin/sh\nexec /bin/bash --norc --noprofile -i\n',
  )
  chmodSync(join(dirs.root, 'bin', 'cursor-agent'), 0o755)
}

const tabMenu = async (page: Page, nth = 0) => {
  await page.locator('.tab').nth(nth).click({ button: 'right' })
  const items = (await page.locator('.menu-item').allTextContents()).map((x) => x.trim())
  await page.keyboard.press('Escape')
  return items
}

test('RC-3 New: Cursor hides the switch; Claude Code shows it again, off', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = setup([])(dirs)
      withCursor(dirs)
      return env
    },
  })
  const page = launched.window
  try {
    await newPage(page)
    const row = page.locator('.add-session .remote-row')
    await row.locator('input').check()
    await page.locator('.add-session [data-agent="cursor"]').click()
    await expect(row).toBeHidden()
    await page.locator('.add-session [data-agent="claude"]').click()
    await expect(row).toBeVisible()
    await expect(row.locator('input')).not.toBeChecked()
  } finally {
    await launched.close()
  }
})

test('RC-4 only Cursor installed: New has Claude Code greyed out and Cursor chosen, and no switch', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      setup([])(dirs)
      withCursor(dirs)
      rmSync(join(dirs.root, 'bin', 'claude'))
      writeFileSync(
        join(dirs.root, 'config', 'menkar', 'state.json'),
        JSON.stringify({
          settings: { color_scheme: 'dark', new_session_dir: join(dirs.home, 'work') },
        }),
      )
      return { PATH: `${join(dirs.root, 'bin')}:/usr/bin:/bin` }
    },
  })
  const page = launched.window
  try {
    await page.locator('#strip-plus').click()
    await expect(page.locator('.add-session .switch.selected')).toHaveText('New')
    await expect(page.locator('.add-session .pill')).toBeVisible()
    await expect(page.locator('.add-session [data-agent="claude"]')).toBeDisabled()
    await expect(page.locator('.add-session [data-agent="claude"]')).toHaveAttribute(
      'title',
      'claude is not installed',
    )
    await expect(page.locator('.add-session [data-agent="cursor"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('.add-session .remote-row')).toBeHidden()
  } finally {
    await launched.close()
  }
})

test('RC-11 a fork of a listed session carries no flag and is not listed', async () => {
  const launched = await launchApp({ prepare: setup([SESSION]) })
  const page = launched.window
  try {
    await expect(page.locator('.row')).toHaveCount(1)
    await act(page, { type: 'forkSession', session: SESSION })
    await expect.poll(args).toMatch(new RegExp(`^--resume ${SESSION} --fork-session --session-id `))
    expect(args()).not.toContain('--remote-control')
    expect(stateFile().remote_control).toEqual([SESSION])
  } finally {
    await launched.close()
  }
})

test('RC-14 the tab menu’s Remote control: one session yes; two sessions no; a session and a shell yes; a file tab no; a new session before its first message no', async () => {
  const launched = await launchApp({
    prepare: (dirs) => ({
      ...clientWork(dirs, { tabs: [['login'], ['api', 'long']] }),
      FAKE_CLAUDE_QUIET: '1',
    }),
  })
  const page = launched.window
  try {
    await expect(page.locator('.tab')).toHaveCount(2)
    expect(await tabMenu(page, 0)).toContain('Remote control')
    expect(await tabMenu(page, 1)).not.toContain('Remote control')
    await page.locator('.tab').first().click()
    await page.locator('.tab-body:not(.hidden) .xterm').click()
    await page.keyboard.press('Control+b')
    await page.keyboard.press('v')
    await expect(page.locator('.tab-body:not(.hidden) .pane')).toHaveCount(2)
    expect(await tabMenu(page, 0)).toContain('Remote control')
    writeFileSync(join(launched.root, 'home', 'n.txt'), 'n\n')
    await act(page, { type: 'openFilePath', path: join(launched.root, 'home', 'n.txt') })
    expect(await tabMenu(page, 2)).not.toContain('Remote control')
    await act(page, {
      type: 'startNew',
      agent: 'claude',
      folder: join(launched.root, 'home', 'work', 'web'),
      name: 'fresh',
    })
    await expect(page.locator('.tab')).toHaveCount(4)
    expect(await tabMenu(page, 3)).not.toContain('Remote control')
  } finally {
    await launched.close()
  }
})

test('RC-17 a stopped session checked: no toast, no phone until it runs, and the next open carries the flag', async () => {
  const launched = await launchApp({ prepare: setup([]) })
  const page = launched.window
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Remote control' }).click()
    await expect.poll(() => stateFile().remote_control).toEqual([SESSION])
    await expect(page.locator('.row .phone')).toHaveCount(0)
    await expect(page.locator('.toast')).toHaveCount(0)
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(args).toMatch(/--remote-control=fix the login bug/)
    await expect(page.locator('.row .phone')).toHaveAttribute(
      'title',
      'Remote Control on at start (state unknown)',
    )
  } finally {
    await launched.close()
  }
})

test('RC-18, RC-19 running with the flag: unchecking leaves the list with no toast and the phone kept; checking again keeps it; unchecked, a reopen has no icon and no flag', async () => {
  const launched = await launchApp({ prepare: setup([SESSION]) })
  const page = launched.window
  // No toast at any toggle: checked at once, before a toast would time out.
  const toggle = async () => {
    await page.locator('.row', { hasText: 'fix the login bug' }).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Remote control' }).click()
    await page.waitForTimeout(300)
    expect(await page.locator('.toast').count()).toBe(0)
  }
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(args).toMatch(/--remote-control=/)
    await expect
      .poll(
        async () =>
          (
            await page.evaluate(() =>
              (
                globalThis as unknown as {
                  menkar: { window: { state(): Promise<{ running: string[] }> } }
                }
              ).menkar.window.state(),
            )
          ).running,
      )
      .toEqual([SESSION])
    await toggle()
    await expect(page.locator('.row .phone')).toHaveAttribute(
      'title',
      'Remote Control on at start (state unknown)',
    )
    await expect.poll(() => stateFile().remote_control).toEqual([])
    await toggle()
    await expect(page.locator('.row .phone')).toHaveAttribute(
      'title',
      'Remote Control on at start (state unknown)',
    )
    await toggle()
    await expect(page.locator('.toast')).toHaveCount(0)
    await act(page, { type: 'closeAllTabs' })
    await expect(page.locator('.row .phone')).toHaveCount(0)
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(() => args().trim().split('\n').length).toBe(2)
    expect(args().trim().split('\n')[1]).not.toContain('--remote-control')
  } finally {
    await launched.close()
  }
})

test('RC-21 renamed in the app while running: the next start carries the new name', async () => {
  const launched = await launchApp({ prepare: setup([SESSION]) })
  const page = launched.window
  try {
    await page.locator('.row', { hasText: 'fix the login bug' }).dblclick()
    await expect.poll(args).toMatch(/--remote-control=fix the login bug/)
    await page.locator('.row', { hasText: 'fix the login bug' }).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Rename…' }).click()
    await page.locator('.dialog input').fill('api v2')
    await page.locator('.dialog button', { hasText: 'Save' }).click()
    await expect(page.locator('.row .name')).toHaveText('api v2')
    await act(page, { type: 'closeAllTabs' })
    await page.locator('.row', { hasText: 'api v2' }).dblclick()
    await expect.poll(() => args().trim().split('\n').length).toBe(2)
    expect(args().trim().split('\n')[1]).toMatch(
      /--remote-control=api v2 --add-dir \S+\/Menkar\/Client work\/files --mcp-config \{.+\} --settings/,
    )
  } finally {
    await launched.close()
  }
})

test('RC-25 trashing a listed session leaves its id in remote_control', async () => {
  const launched = await launchApp({ prepare: setup([SESSION]) })
  const page = launched.window
  try {
    // The desktop's trash is the human's check; here it only removes the file.
    await launched.app.evaluate(({ shell }) => {
      shell.trashItem = (async (path: string) => {
        const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs')
        fs.rmSync(path)
      }) as never
    })
    await page.locator('#add-session').click()
    await page.locator('.add-session button[title="Expand all groups"]').click()
    await page.locator(`.history-row[data-session="${SESSION}"]`).click({ button: 'right' })
    await page.locator('.menu-item', { hasText: 'Move transcript to trash…' }).click()
    await page.locator('.dialog button', { hasText: 'Move to Trash' }).click()
    await expect(page.locator(`.history-row[data-session="${SESSION}"]`)).toHaveCount(0)
    expect(stateFile().remote_control).toEqual([SESSION])
  } finally {
    await launched.close()
  }
})

test('RC-26 a listed session reopened at start carries the flag, and so does Open beside', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = clientWork(dirs, { tabs: [['login']] })
      writeFileSync(
        join(dirs.root, 'config', 'menkar', 'state.json'),
        JSON.stringify({
          remote_control: [CLIENT.login, CLIENT.api],
          settings: { color_scheme: 'dark' },
        }),
      )
      home = dirs.home
      return env
    },
  })
  const page = launched.window
  try {
    await expect
      .poll(args)
      .toMatch(new RegExp(`--resume ${CLIENT.login} --remote-control=login fix`))
    await act(page, { type: 'openBeside', session: CLIENT.api })
    await expect.poll(() => args().trim().split('\n').length).toBe(2)
    expect(args().trim().split('\n')[1]).toMatch(
      new RegExp(`--resume ${CLIENT.api} --remote-control=api review`),
    )
  } finally {
    await launched.close()
  }
})

// The agent picker at the top of Add session → New: every supported agent, the ones not installed
// greyed out and off, Claude Code chosen when it is there.
const picker = (page: Page) => page.locator('.add-session [data-picker="agent"]')
const segment = (page: Page, name: string) => picker(page).locator('button', { hasText: name })

test('SES-72 (decision 1.30) New picks the agent: both installed, Claude Code chosen and Cursor hides the switch; Claude only, Cursor greyed and saying why', async () => {
  const both = await launchApp({
    prepare: (dirs) => {
      const env = setup([])(dirs)
      withCursor(dirs)
      return env
    },
  })
  try {
    const page = both.window
    await page.locator('#strip-plus').click()
    await expect(picker(page)).toBeVisible()
    await expect(picker(page)).toHaveClass(/segmented/)
    await expect(picker(page).locator('button')).toHaveText(['Claude Code', 'Cursor'])
    await expect(segment(page, 'Claude Code')).toHaveAttribute('aria-pressed', 'true')
    await expect(segment(page, 'Cursor')).toBeEnabled()
    await page.locator('.add-session .folder-row', { hasText: 'work' }).click()
    await expect(picker(page)).toBeVisible()
    const row = page.locator('.add-session .remote-row')
    await expect(row).toBeVisible()
    await row.locator('input').check()
    await segment(page, 'Cursor').click()
    await expect(segment(page, 'Cursor')).toHaveAttribute('aria-pressed', 'true')
    await expect(row).toBeHidden()
    await segment(page, 'Claude Code').click()
    await expect(row).toBeVisible()
    await expect(row.locator('input')).not.toBeChecked()
    await expect(page.locator('.add-session select')).toHaveCount(0)
  } finally {
    await both.close()
  }

  const claudeOnly = await launchApp({ prepare: setup([]) })
  try {
    const page = claudeOnly.window
    await page.locator('#strip-plus').click()
    await expect(picker(page).locator('button')).toHaveText(['Claude Code', 'Cursor'])
    await expect(segment(page, 'Claude Code')).toHaveAttribute('aria-pressed', 'true')
    await expect(segment(page, 'Cursor')).toBeDisabled()
    await expect(segment(page, 'Cursor')).toHaveAttribute('title', 'cursor-agent is not installed')
  } finally {
    await claudeOnly.close()
  }
})

test('SES-74 (decision 1.31) New remembers the last agent started: Cursor again next time; remembered but not installed, or unreadable, it falls back to Claude Code', async () => {
  const both = await launchApp({
    prepare: (dirs) => {
      const env = setup([])(dirs)
      withCursor(dirs)
      return env
    },
  })
  try {
    const page = both.window
    await newPage(page)
    await segment(page, 'Cursor').click()
    await page.locator('.add-session .pill').click()
    await expect(page.locator('.add-session')).toHaveCount(0)
    await expect.poll(() => stateFile().settings?.last_agent).toBe('cursor')
    await page.locator('#strip-plus').click()
    await expect(segment(page, 'Cursor')).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await both.close()
  }

  for (const remembered of ['cursor', 'bogus', 7]) {
    const claudeOnly = await launchApp({
      prepare: (dirs) => {
        const env = setup([])(dirs)
        writeFileSync(
          join(dirs.root, 'config', 'menkar', 'state.json'),
          JSON.stringify({ settings: { color_scheme: 'dark', last_agent: remembered } }),
        )
        return env
      },
    })
    try {
      const page = claudeOnly.window
      await page.locator('#strip-plus').click()
      await expect(segment(page, 'Claude Code'), String(remembered)).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    } finally {
      await claudeOnly.close()
    }
  }
})
