// §2.4 of the multi-agent architecture (1.155 Q4, 1.159 B3): a saved tab whose session no reader
// finds is kept, not started, with one line, when state.json's `session_agents` names its agent —
// one this build knows or one it does not — and survives a save as it was. `session_agents` is
// written for a Cursor session and never for a Claude one.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { CURSOR_SESSION, launchApp, savedCursorTab, savedState, terminalText } from './app'
import { catppuccin, prepare } from './fixtures'

const S1 = '6a6a6a6a-0000-4000-8000-0000000000a1'
const PROJECT = 'aaaaaaaaaaaa'

const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate(
    (a) =>
      (
        globalThis as unknown as { menkar: { window: { act(x: unknown): Promise<unknown> } } }
      ).menkar.window.act(a),
    action,
  )

const projectsFile = (root: string) => join(root, 'config', 'menkar', 'projects.json')

// A saved tab of S1 with no transcript anywhere, its agent recorded as `agent`; the stand-in
// `claude` on the PATH records any start in claude-args.txt.
function savedTabOf(agent: string, scheme: 'dark' | 'light') {
  return (dirs: { readonly root: string; readonly home: string }) => {
    const env = prepare(dirs)
    const config = join(dirs.root, 'config', 'menkar')
    mkdirSync(config, { recursive: true })
    writeFileSync(
      join(config, 'projects.json'),
      JSON.stringify({
        version: 1,
        current: PROJECT,
        projects: [{ id: PROJECT, name: 'Client work', members: [S1], groups: [] }],
        windows: [
          {
            current: PROJECT,
            tabs: { [PROJECT]: [{ panes: [S1], orientation: 'horizontal' }] },
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
        session_agents: { [S1]: agent },
      }),
    )
    return env
  }
}

const CASES = [
  {
    agent: 'gemini',
    shot: 'unsupported',
    line: "This session's agent (gemini) is not supported by this version of Menkar.",
  },
  {
    agent: 'cursor',
    shot: 'not-found',
    line: 'This session was not found: its agent (Cursor) may be uninstalled or its files gone.',
  },
] as const

for (const { agent, shot, line } of CASES) {
  test(`a saved tab of a session recorded as ${agent}, with no files, is kept with one line and not started; saved untouched (screenshots)`, async () => {
    for (const scheme of ['dark', 'light'] as const) {
      const launched = await launchApp({ prepare: savedTabOf(agent, scheme) })
      const { window, root } = launched
      const seeded = readFileSync(projectsFile(root), 'utf8')
      try {
        await expect.poll(() => terminalText(window)).toContain(line)
        await expect.poll(() => terminalText(window)).toMatch(/\$\s*$/m)
        // Saved again since the start, and the tab and the record are as they were.
        await expect.poll(() => readFileSync(projectsFile(root), 'utf8')).not.toBe(seeded)
        const saved = JSON.parse(readFileSync(projectsFile(root), 'utf8'))
        expect(JSON.stringify(saved.windows)).toContain(S1)
        expect(saved.projects[0].members).toContain(S1)
        expect(savedState(root).session_agents).toEqual({ [S1]: agent })
        expect(existsSync(join(root, 'home', 'claude-args.txt'))).toBe(false)
        const files = process.env.MENKAR_FILES
        if (files)
          await window.screenshot({ path: join(files, `menkar-t64-restore-${shot}-${scheme}.png`) })
      } finally {
        await launched.close()
      }
    }
  })
}

test('a saved tab whose session nothing records and no reader finds is dropped, as before', async () => {
  const launched = await launchApp({
    prepare: (dirs) => {
      const env = savedTabOf('cursor', 'dark')(dirs)
      const state = join(dirs.root, 'config', 'menkar', 'state.json')
      const { session_agents: _gone, ...rest } = JSON.parse(readFileSync(state, 'utf8'))
      writeFileSync(state, JSON.stringify(rest))
      return env
    },
  })
  const { window, root } = launched
  try {
    await expect
      .poll(() => JSON.stringify(JSON.parse(readFileSync(projectsFile(root), 'utf8')).windows))
      .not.toContain(S1)
    await expect(window.locator('.xterm')).toHaveCount(0)
    expect(existsSync(join(root, 'home', 'claude-args.txt'))).toBe(false)
  } finally {
    await launched.close()
  }
})

test('a Claude start writes no session_agents; a Cursor resume writes its agent', async () => {
  const claude = await launchApp({ prepare })
  try {
    const folder = join(claude.root, 'home', 'work')
    await act(claude.window, { type: 'startNew', agent: 'claude', folder, name: 'plain' })
    const args = join(claude.root, 'home', 'claude-args.txt')
    await expect.poll(() => existsSync(args)).toBe(true)
    const id = /--session-id (\S+)/.exec(readFileSync(args, 'utf8'))?.[1] ?? ''
    // A new session is recorded when its id binds: once it is a member, it has.
    await expect
      .poll(() => JSON.parse(readFileSync(projectsFile(claude.root), 'utf8')).projects[0].members)
      .toContain(id)
    await claude.window.waitForTimeout(500)
    expect(savedState(claude.root).session_agents).toBeUndefined()
  } finally {
    await claude.close()
  }
  const cursor = await launchApp({ prepare: savedCursorTab })
  try {
    await expect
      .poll(() => savedState(cursor.root).session_agents)
      .toEqual({ [CURSOR_SESSION]: 'cursor' })
  } finally {
    await cursor.close()
  }
})
