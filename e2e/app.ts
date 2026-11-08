import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron, type ElectronApplication, type Page } from '@playwright/test'

export interface LaunchedApp {
  readonly root: string
  // The environment the app runs with, for a second process that must reach the same instance.
  readonly env: Readonly<Record<string, string>>
  readonly app: ElectronApplication
  readonly window: Page
  close(): Promise<void>
}

// The app runs against a throwaway HOME and XDG set, so a run never reads or writes the
// developer's own directories, and its shell starts without their rc files.
export interface LaunchOptions {
  // Fills the temporary HOME before the app starts (transcripts, a fake agent on the PATH); what
  // it returns is added to the app's environment.
  readonly prepare?: (dirs: {
    readonly root: string
    readonly home: string
  }) => Readonly<Record<string, string>> | undefined
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  // Set only by `npm run ui-check` and `npm run package:smoke`, inside xvfb-run: a run started
  // any other way would open its window on the developer's screen.
  if (process.env.MENKAR_E2E_XVFB !== '1') {
    throw new Error(
      'e2e runs only through `npm run ui-check` (xvfb-run); refusing to open a window here',
    )
  }
  const root = mkdtempSync(join(tmpdir(), 'menkar-e2e-'))
  const home = join(root, 'home')
  mkdirSync(home)
  const extraEnv = options.prepare?.({ root, home }) ?? {}
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  Object.assign(env, {
    HOME: home,
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
    SHELL: '/bin/bash',
    ...extraEnv,
  })
  delete env.ELECTRON_RENDERER_URL
  // On a Wayland desktop Electron would open its window on the developer's screen and ignore
  // xvfb-run's DISPLAY.
  delete env.WAYLAND_DISPLAY
  env.XDG_SESSION_TYPE = 'x11'
  // MENKAR_E2E_EXECUTABLE runs the suite against a packaged build instead of `out/`.
  const executable = process.env.MENKAR_E2E_EXECUTABLE
  const app = await _electron.launch(
    executable
      ? { executablePath: executable, args: ['--ozone-platform=x11'], env }
      : { args: ['--ozone-platform=x11', '.'], env },
  )
  const window = await app.firstWindow()
  return {
    root,
    env,
    app,
    window,
    async close() {
      // A running agent makes closing the window ask; a test's end closes its tabs first.
      for (const page of app.windows()) {
        await page
          .evaluate(() =>
            (
              globalThis as unknown as {
                menkar?: { window: { act(a: { type: string }): Promise<unknown> } }
              }
            ).menkar?.window.act({
              type: 'closeAllTabs',
            }),
          )
          .catch(() => undefined)
      }
      await app.close()
      rmSync(root, { recursive: true, force: true })
    },
  }
}

export async function terminalText(window: Page): Promise<string> {
  const rows = await window.locator('.xterm-rows > div').allTextContents()
  return rows.join('\n')
}

// A start that reopens one saved tab: a Cursor session whose stand-in `cursor-agent` replaces
// itself with a plain bash, so the tab shows a shell prompt. Never the real agent. Cursor, because
// its command carries no `--settings` and so writes nothing into the config directory.
export const CURSOR_SESSION = 'c0ffee01'

export function savedCursorTab(
  dirs: { readonly root: string; readonly home: string },
  settings: Readonly<Record<string, unknown>> = {},
): Record<string, string> {
  const bin = join(dirs.root, 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'cursor-agent'), '#!/bin/sh\nexec /bin/bash --norc --noprofile -i\n')
  chmodSync(join(bin, 'cursor-agent'), 0o755)
  const folder = dirs.home.slice(1).replace(/[^A-Za-z0-9]/g, '-')
  const transcripts = join(
    dirs.home,
    '.cursor',
    'projects',
    folder,
    'agent-transcripts',
    CURSOR_SESSION,
  )
  mkdirSync(transcripts, { recursive: true })
  writeFileSync(
    join(transcripts, `${CURSOR_SESSION}.jsonl`),
    `${JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: '<user_query>hello</user_query>' }] } })}\n`,
  )
  const config = join(dirs.root, 'config', 'menkar')
  mkdirSync(config, { recursive: true })
  const project = 'aaaaaaaaaaaa'
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: project,
      projects: [{ id: project, name: 'Default', members: [CURSOR_SESSION], groups: [] }],
      windows: [
        {
          current: project,
          tabs: { [project]: [{ panes: [CURSOR_SESSION], orientation: 'horizontal' }] },
        },
      ],
    }),
  )
  writeFileSync(join(config, 'state.json'), JSON.stringify({ settings }))
  return { PATH: `${bin}:${process.env.PATH ?? ''}` }
}
